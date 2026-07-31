import { z } from 'zod'
import type { TMDB } from 'tmdb-ts'
import { getTmdbClient, normalizeToMediaItem, fillItemLogos } from '@/shared/lib/tmdb'
import type {
  TmdbMediaItem,
  TmdbMediaType,
  TmdbPagination,
  TmdbGenre,
  TmdbCountry,
  TmdbFilterOptions,
  TmdbPersonResult,
} from '@/shared/types/tmdb'

// ---------- zod schema（外部 TMDB 响应结构校验，unknown 进校验后出） ----------

const tmdbPageSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())),
  page: z.number().optional(),
  total_pages: z.number().optional(),
  total_results: z.number().optional(),
})

const tmdbGenresSchema = z.object({
  genres: z.array(z.object({ id: z.number(), name: z.string() })),
})

const tmdbCountriesSchema = z.array(
  z.object({
    iso_3166_1: z.string(),
    english_name: z.string(),
    native_name: z.string(),
  }),
)

// ---------- 工具 ----------

type TmdbClient = ReturnType<typeof getTmdbClient>
type TmdbLang = NonNullable<Parameters<TmdbClient['search']['multi']>[0]>['language']

/** tmdb-ts 的 language 参数是严格字面量类型，动态配置值需安全收窄（不用 any） */
function langOpts(language: string): { language: TmdbLang } {
  return { language: language as TmdbLang }
}

/** tmdb-ts 的 options 类型不含 signal，包装后作为变量传入可避开多余属性检查 */
function withSignal<T extends object>(opts: T, signal?: AbortSignal): T & { signal?: AbortSignal } {
  return signal ? { ...opts, signal } : opts
}

function isTmdbMediaType(value: unknown): value is TmdbMediaType {
  return value === 'movie' || value === 'tv'
}

/** 按条目自带 media_type 规范化；非 movie/tv 条目丢弃 */
function normalizeListResults(results: Array<Record<string, unknown>>): TmdbMediaItem[] {
  return results.flatMap(item => {
    if (!isTmdbMediaType(item.media_type)) return []
    return [normalizeToMediaItem(item, item.media_type)]
  })
}

/** 固定 mediaType 规范化（列表/发现等接口） */
function normalizeFixedType(results: Array<Record<string, unknown>>, type: TmdbMediaType): TmdbMediaItem[] {
  return results.map(item => normalizeToMediaItem(item, type))
}

/**
 * 提取 TMDB 列表响应并规范化
 * @param result - TMDB 列表接口返回（含 results / page / total_pages / total_results）
 * @param type - 固定媒体类型（null 表示按条目 media_type 判断）
 * @returns 规范化后的条目与分页信息
 */
function parseTmdbPage(
  result: unknown,
  type: TmdbMediaType | null,
): { items: TmdbMediaItem[]; pagination: TmdbPagination } {
  const parsed = tmdbPageSchema.safeParse(result)
  if (!parsed.success) {
    throw new Error('Invalid TMDB list response')
  }
  const data = parsed.data
  const items = type ? normalizeFixedType(data.results, type) : normalizeListResults(data.results)
  return {
    items,
    pagination: {
      page: data.page ?? 1,
      totalPages: data.total_pages ?? 0,
      totalResults: data.total_results ?? 0,
    },
  }
}

// ---------- 列表（首页热映/热门等） ----------

type ListCall = (client: TMDB, language: string, signal?: AbortSignal) => Promise<{ results: unknown[] }>

const LIST_CALLS: Record<`${TmdbMediaType}:${string}`, ListCall> = {
  'movie:nowPlaying': (c, l, s) => c.movies.nowPlaying(withSignal(langOpts(l), s)),
  'movie:popular': (c, l, s) => c.movies.popular(withSignal(langOpts(l), s)),
  'movie:topRated': (c, l, s) => c.movies.topRated(withSignal(langOpts(l), s)),
  'movie:upcoming': (c, l, s) => c.movies.upcoming(withSignal(langOpts(l), s)),
  'tv:popular': (c, l, s) => c.tvShows.popular(withSignal(langOpts(l), s)),
  'tv:topRated': (c, l, s) => c.tvShows.topRated(withSignal(langOpts(l), s)),
  'tv:airingToday': (c, l, s) => c.tvShows.airingToday(withSignal(langOpts(l), s)),
}

/**
 * 获取 TMDB 首页列表（热映/热门/口碑/即将上映/今日播出）
 * @param mediaType - movie | tv
 * @param endpoint - 列表类型（movie: nowPlaying/popular/topRated/upcoming；tv: popular/topRated/airingToday）
 * @param language - 显示语言
 * @param signal - 取消/超时信号
 * @returns 规范化后的条目列表
 */
export async function fetchTmdbList(
  mediaType: TmdbMediaType,
  endpoint: 'nowPlaying' | 'popular' | 'topRated' | 'upcoming' | 'airingToday',
  language: string,
  signal?: AbortSignal,
): Promise<TmdbMediaItem[]> {
  const call = LIST_CALLS[`${mediaType}:${endpoint}`]
  if (!call) {
    throw new Error(`Unsupported TMDB list endpoint: ${mediaType}:${endpoint}`)
  }
  const res = await call(getTmdbClient(), language, signal)
  return parseTmdbPage(res, mediaType).items
}

/**
 * 获取 TMDB 综合趋势（trending all），并批量填充 logo
 * @param timeWindow - day | week
 * @param language - 显示语言
 * @param signal - 取消/超时信号
 * @returns 规范化后的趋势条目（含 logoPath）
 */
export async function fetchTmdbTrending(
  timeWindow: 'day' | 'week',
  language: string,
  signal?: AbortSignal,
): Promise<TmdbMediaItem[]> {
  const client = getTmdbClient()
  const res = await client.trending.trending('all', timeWindow, withSignal(langOpts(language), signal))
  const items = parseTmdbPage(res, null).items
  await fillItemLogos(client, items)
  return items
}

// ---------- 搜索 / 按 ID 查找 ----------

/**
 * 搜索 TMDB 媒体；带年份时分别搜索 movie/tv 后按热度合并，否则用 multi search
 * @param query - 搜索关键词
 * @param page - 页码，从 1 开始
 * @param year - 可选，按年份过滤（movie 用 primary_release_year，tv 用 first_air_date_year）
 * @param language - 显示语言
 * @param includeAdult - 是否包含成人内容（= !isAdultFilterEnabled，影响 API 结果故入参）
 * @param signal - 取消/超时信号
 * @returns 单页结果与分页信息（分页拼接与关键词过滤由派生层处理）
 */
export async function fetchTmdbSearch(
  query: string,
  page: number,
  year: number | undefined,
  language: string,
  includeAdult: boolean,
  signal?: AbortSignal,
): Promise<{ items: TmdbMediaItem[]; pagination: TmdbPagination }> {
  const client = getTmdbClient()
  const baseParams = {
    query,
    page,
    ...langOpts(language),
    include_adult: includeAdult,
  }

  if (year !== undefined) {
    // tmdb-ts 的 search 参数类型不含年份键，动态参数需断言
    const movieParams = { ...baseParams, primary_release_year: year }
    const tvParams = { ...baseParams, first_air_date_year: year }
    const [movieRes, tvRes] = await Promise.all([
      client.search.movies(withSignal(movieParams as Parameters<TmdbClient['search']['movies']>[0], signal)),
      client.search.tvShows(withSignal(tvParams as Parameters<TmdbClient['search']['tvShows']>[0], signal)),
    ])

    const movieParsed = parseTmdbPage(movieRes, 'movie')
    const tvParsed = parseTmdbPage(tvRes, 'tv')
    const items = [...movieParsed.items, ...tvParsed.items].sort((a, b) => b.popularity - a.popularity)
    return {
      items,
      pagination: {
        page,
        totalPages: Math.max(movieParsed.pagination.totalPages, tvParsed.pagination.totalPages),
        totalResults: movieParsed.pagination.totalResults + tvParsed.pagination.totalResults,
      },
    }
  }

  const res = await client.search.multi(withSignal(baseParams as Parameters<TmdbClient['search']['multi']>[0], signal))
  return parseTmdbPage(res, null)
}

// ---------- 发现 / 区域发现 ----------

/**
 * 发现页列表（按筛选条件构建 discover 请求；mediaType=all 时 movie/tv 合并按热度排序）
 * @param options - 筛选条件（genreIds/originCountry/releaseYear/minVoteAverage/sortBy 等）
 * @param page - 页码
 * @param language - 显示语言
 * @param varietyNetworks - 用户配置的综艺网络 ID 串（`|` 分隔，决定中文平台偏好）
 * @param signal - 取消/超时信号
 * @returns 单页结果与分页信息
 */
export async function fetchTmdbDiscover(
  options: TmdbFilterOptions,
  page: number,
  language: string,
  varietyNetworks: string,
  signal?: AbortSignal,
): Promise<{ items: TmdbMediaItem[]; pagination: TmdbPagination }> {
  const client = getTmdbClient()
  const mediaType = options.mediaType === 'tv' ? 'tv' : 'movie'
  const networkIds = varietyNetworks.split('|').filter(Boolean)
  const hasChineseNetwork = networkIds.includes('1330') || networkIds.includes('2007')

  const sortByMap: Record<string, string> = {
    popularity: 'popularity.desc',
    vote_average: 'vote_average.desc',
    release_date: mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
  }
  const sortOrder = options.sortOrder === 'asc' ? 'asc' : 'desc'
  const sortByValue = options.sortBy
    ? sortByMap[options.sortBy]?.replace('.desc', `.${sortOrder}`) || 'popularity.desc'
    : 'popularity.desc'

  const discoverParams: Record<string, unknown> = {
    page,
    ...langOpts(language),
    sort_by: sortByValue,
  }
  if (options.genreIds && options.genreIds.length > 0) discoverParams.with_genres = options.genreIds.join(',')
  if (options.originCountry) discoverParams.with_origin_country = options.originCountry
  if (options.releaseYear) {
    if (mediaType === 'movie') discoverParams.primary_release_year = options.releaseYear
    else discoverParams.first_air_date_year = options.releaseYear
  }
  if (options.minVoteAverage && options.minVoteAverage > 0) {
    discoverParams['vote_average.gte'] = options.minVoteAverage
    discoverParams['vote_count.gte'] = 50
  }

  // 中国平台偏好 → 电影加中文筛选
  const movieParams = { ...discoverParams }
  if (hasChineseNetwork) movieParams.with_original_language = 'zh'

  // 箭头函数包裹保留 this 绑定（tmdb-ts 方法内部用 this.api，直接解构会丢失）；参数/返回值断言适配动态参数
  const discoverMovie = (p: Record<string, unknown>): Promise<{ results: Array<Record<string, unknown>> }> =>
    client.discover.movie(p as Parameters<TmdbClient['discover']['movie']>[0]) as unknown as Promise<{ results: Array<Record<string, unknown>> }>
  const discoverTv = (p: Record<string, unknown>): Promise<{ results: Array<Record<string, unknown>> }> =>
    client.discover.tvShow(p as Parameters<TmdbClient['discover']['tvShow']>[0]) as unknown as Promise<{ results: Array<Record<string, unknown>> }>

  if (options.mediaType === 'all' || !options.mediaType) {
    const [movieRes, tvRes] = await Promise.all([
      discoverMovie({ ...movieParams, signal }),
      discoverTv({
        ...discoverParams,
        first_air_date_year: options.releaseYear,
        primary_release_year: undefined,
        with_networks: varietyNetworks,
        signal,
      }),
    ])
    const movie = parseTmdbPage(movieRes, 'movie')
    const tv = parseTmdbPage(tvRes, 'tv')
    const items = [...movie.items, ...tv.items].sort((a, b) => b.popularity - a.popularity)
    return {
      items,
      pagination: {
        page,
        totalPages: Math.max(movie.pagination.totalPages, tv.pagination.totalPages),
        totalResults: movie.pagination.totalResults + tv.pagination.totalResults,
      },
    }
  }

  const res =
    mediaType === 'movie'
      ? await discoverMovie({ ...movieParams, signal })
      : await discoverTv({ ...discoverParams, with_networks: varietyNetworks, signal })
  return parseTmdbPage(res, mediaType)
}

/** 区域发现结果结构（对应原 regionCache.default） */
export interface TmdbRegionalData {
  regionalTvShows: TmdbMediaItem[]
  regionalMovies: TmdbMediaItem[]
  regionalAnimated: TmdbMediaItem[]
  regionalVariety: TmdbMediaItem[]
  regionalFeatured: TmdbMediaItem[]
  regionalNowPlaying: TmdbMediaItem[]
  regionalPopularMovies: TmdbMediaItem[]
  regionalTopRatedMovies: TmdbMediaItem[]
  regionalUpcoming: TmdbMediaItem[]
  regionalPopularTv: TmdbMediaItem[]
  regionalTopRatedTv: TmdbMediaItem[]
}

/**
 * 区域发现数据（按用户偏好平台分组查询电影/动漫后合并，并填充 logo）
 * @param networks - 用户配置的综艺网络 ID 串（`|` 分隔）
 * @param language - 显示语言
 * @param signal - 取消/超时信号
 * @returns 各分类条目（电影/动漫/剧集/综艺/精选）
 */
export async function fetchTmdbRegional(
  networks: string,
  language: string,
  signal?: AbortSignal,
): Promise<TmdbRegionalData> {
  const client = getTmdbClient()
  const networkIds = networks.split('|').filter(Boolean)
  const hasWestern = networkIds.includes('213') || networkIds.includes('2552')
  const hasChinese = networkIds.includes('1330') || networkIds.includes('2007')

  const discoverMovie = (p: Record<string, unknown>): Promise<{ results: Array<Record<string, unknown>> }> =>
    client.discover.movie(p as Parameters<TmdbClient['discover']['movie']>[0]) as unknown as Promise<{ results: Array<Record<string, unknown>> }>
  const discoverTv = (p: Record<string, unknown>): Promise<{ results: Array<Record<string, unknown>> }> =>
    client.discover.tvShow(p as Parameters<TmdbClient['discover']['tvShow']>[0]) as unknown as Promise<{ results: Array<Record<string, unknown>> }>

  const movieCalls: Promise<{ results: Array<Record<string, unknown>> }>[] = []
  const animeCalls: Promise<{ results: Array<Record<string, unknown>> }>[] = []
  if (hasWestern) {
    movieCalls.push(
      discoverMovie({
        language, sort_by: 'vote_average.desc',
        with_watch_providers: '8|350', 'primary_release_date.gte': '2020-01-01',
        'vote_count.gte': 200, signal,
      }),
    )
    animeCalls.push(
      discoverMovie({
        language, sort_by: 'popularity.desc',
        with_genres: '16', with_watch_providers: '8|350',
        'vote_count.gte': 30, signal,
      }),
    )
  }
  if (hasChinese) {
    movieCalls.push(
      discoverMovie({
        language, sort_by: 'vote_average.desc',
        with_original_language: 'zh', 'primary_release_date.gte': '2020-01-01',
        'vote_count.gte': 30, signal,
      }),
    )
    animeCalls.push(
      discoverMovie({
        language, sort_by: 'popularity.desc',
        with_genres: '16', with_original_language: 'zh',
        'vote_count.gte': 20, signal,
      }),
    )
  }

  const mCount = movieCalls.length
  const [tvRes, varietyRes, ...rest] = await Promise.all([
    discoverTv({ language, sort_by: 'popularity.desc', with_networks: networks, 'vote_count.gte': 50, signal }),
    discoverTv({ language, sort_by: 'popularity.desc', with_networks: networks, with_genres: '10764', 'vote_count.gte': 5, signal }),
    ...movieCalls,
    ...animeCalls,
  ])

  const movieResults = rest.slice(0, mCount).flatMap(r => r.results)
  const animeResults = rest.slice(mCount).flatMap(r => r.results)

  const movieItems = normalizeFixedType(movieResults, 'movie')
  // 排除已在电影列表中的动画电影，避免跨区重复
  const movieKeySet = new Set(movieItems.map(i => `${i.mediaType}-${i.id}`))
  const animeItems = normalizeFixedType(animeResults, 'movie')
    .filter(i => !movieKeySet.has(`${i.mediaType}-${i.id}`))
  const tvItems = normalizeFixedType(tvRes.results, 'tv')
  const varietyItems = normalizeFixedType(varietyRes.results, 'tv')
  const featured = [...new Map(
    [...tvItems, ...movieItems, ...animeItems].map(i => [i.id + i.mediaType, i]),
  ).values()]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 10)

  // TMDB discover 不返回 logo_path，批量拉取
  await fillItemLogos(client, featured)

  return {
    regionalTvShows: tvItems,
    regionalMovies: movieItems,
    regionalAnimated: animeItems,
    regionalVariety: varietyItems,
    regionalFeatured: featured,
    regionalNowPlaying: [],
    regionalPopularMovies: [],
    regionalTopRatedMovies: [],
    regionalUpcoming: [],
    regionalPopularTv: [],
    regionalTopRatedTv: [],
  }
}

// ---------- 推荐 / genres / 详情 ----------

/**
 * 获取媒体的推荐列表
 * @param id - TMDB ID
 * @param mediaType - movie | tv
 * @param language - 显示语言
 * @param signal - 取消/超时信号
 * @returns 推荐条目列表
 */
export async function fetchTmdbRecommendations(
  id: number,
  mediaType: TmdbMediaType,
  language: string,
  signal?: AbortSignal,
): Promise<TmdbMediaItem[]> {
  const client = getTmdbClient()
  const res =
    mediaType === 'movie'
      ? await client.movies.recommendations(id, withSignal(langOpts(language), signal))
      : await client.tvShows.recommendations(id, withSignal(langOpts(language), signal))
  return parseTmdbPage(res, mediaType).items
}

/**
 * 获取电影/剧集 genres 与全部国家地区
 * @param language - 显示语言
 * @param signal - 取消/超时信号
 * @returns genres（电影/剧集，已去重合并）与国家列表
 */
export async function fetchTmdbGenresAndCountries(
  language: string,
  signal?: AbortSignal,
): Promise<{ movieGenres: TmdbGenre[]; tvGenres: TmdbGenre[]; countries: TmdbCountry[] }> {
  const client = getTmdbClient()
  const [movieRes, tvRes, countriesRes] = await Promise.all([
    client.genres.movies(withSignal(langOpts(language), signal)),
    client.genres.tvShows(withSignal(langOpts(language), signal)),
    client.configuration.getCountries(),
  ])

  const movieGenres = tmdbGenresSchema.safeParse(movieRes)
  const tvGenres = tmdbGenresSchema.safeParse(tvRes)
  const countries = tmdbCountriesSchema.safeParse(countriesRes)
  if (!movieGenres.success || !tvGenres.success || !countries.success) {
    throw new Error('Invalid TMDB genres/countries response')
  }

  return {
    movieGenres: movieGenres.data.genres,
    tvGenres: tvGenres.data.genres,
    countries: countries.data,
  }
}

/** 人物搜索结果规范化（known_for 条目复用 normalizeToMediaItem，media_type 非 movie/tv 丢弃） */
function normalizePerson(raw: Record<string, unknown>): TmdbPersonResult {
  const knownFor = Array.isArray(raw.known_for) ? (raw.known_for as Array<Record<string, unknown>>) : []
  const knownForItems: TmdbMediaItem[] = knownFor.flatMap(item => {
    if (!isTmdbMediaType(item.media_type)) return []
    return [normalizeToMediaItem(item, item.media_type)]
  })

  return {
    id: raw.id as number,
    name: (raw.name as string) || '',
    profilePath: (raw.profile_path as string) || null,
    knownFor: knownForItems.slice(0, 3).map(i => i.title).join('、'),
    knownForItems,
    popularity: (raw.popularity as number) || 0,
    adult: Boolean(raw.adult),
  }
}

/**
 * 按关键词搜索人物
 * @param query - 搜索关键词
 * @param page - 页码，从 1 开始
 * @param language - 显示语言
 * @param includeAdult - 是否包含成人内容
 * @param signal - 取消/超时信号
 * @returns 单页人物结果与分页信息
 */
export async function fetchTmdbPersonSearch(
  query: string,
  page: number,
  language: string,
  includeAdult: boolean,
  signal?: AbortSignal,
): Promise<{ items: TmdbPersonResult[]; pagination: TmdbPagination }> {
  const client = getTmdbClient()
  const res = await client.search.people(
    withSignal(
      { query: query.trim(), page, ...langOpts(language), include_adult: includeAdult } as Parameters<TmdbClient['search']['people']>[0],
      signal,
    ),
  )
  const parsed = tmdbPageSchema.safeParse(res)
  if (!parsed.success) {
    throw new Error('Invalid TMDB person search response')
  }
  return {
    items: parsed.data.results.map(normalizePerson),
    pagination: {
      page: parsed.data.page ?? 1,
      totalPages: parsed.data.total_pages ?? 0,
      totalResults: parsed.data.total_results ?? 0,
    },
  }
}

