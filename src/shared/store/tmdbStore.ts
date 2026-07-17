import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getTmdbClient, normalizeToMediaItem, fillItemLogos } from '../lib/tmdb'
import { get, set, del } from 'idb-keyval'
import { useSettingStore } from './settingStore'
import type {
  TmdbMediaItem,
  TmdbFilterOptions,
  TmdbFilterAvailableOptions,
  TmdbPagination,
  TmdbGenre,
} from '../types/tmdb'

// tmdb-ts 的 language 参数要求特定字面量联合类型，这里用类型断言兼容动态值
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTmdbLanguage(): any {
  return useSettingStore.getState().system.tmdbLanguage
}

interface TmdbState {
  // 搜索相关
  searchQuery: string
  searchResults: TmdbMediaItem[]
  filteredResults: TmdbMediaItem[] // 筛选后的结果
  searchPagination: TmdbPagination

  // 发现/浏览模式（无搜索词时使用）
  discoverResults: TmdbMediaItem[]
  discoverPagination: TmdbPagination

  // 热映/热门
  nowPlayingMovies: TmdbMediaItem[]
  popularMovies: TmdbMediaItem[]
  topRatedMovies: TmdbMediaItem[]
  upcomingMovies: TmdbMediaItem[]
  popularTv: TmdbMediaItem[]
  topRatedTv: TmdbMediaItem[]
  airingTodayTv: TmdbMediaItem[]
  trending: TmdbMediaItem[]

  // 区域发现缓存（按 region 分池，切换不重新请求）
  regionCache: Record<
    string,
    {
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
  >
  regionalLoading: boolean
  cachedNetworks: string | null

  // 推荐
  recommendations: TmdbMediaItem[]
  recommendationSourceId: number | null // 推荐来源的 TMDB ID
  recommendationSourceMediaType: 'movie' | 'tv' | null // 推荐来源的 TMDB 媒体类型

  // 筛选条件 (内部维护)
  filterOptions: TmdbFilterOptions

  // 可用的筛选选项列表
  availableFilterOptions: TmdbFilterAvailableOptions

  // 缓存数据
  movieGenres: TmdbGenre[]
  tvGenres: TmdbGenre[]
  genresLanguage: string | null // 缓存 genres 时使用的语言

  // 加载状态
  loading: {
    search: boolean
    discover: boolean
    nowPlaying: boolean
    popularMovies: boolean
    topRatedMovies: boolean
    upcomingMovies: boolean
    popularTv: boolean
    topRatedTv: boolean
    airingTodayTv: boolean
    trending: boolean
    recommendations: boolean
    genres: boolean
  }
  error: string | null
}

interface TmdbActions {
  // 搜索
  search: (query: string, page?: number, year?: number) => Promise<void>
  findById: (id: number) => Promise<void>

  // 发现/浏览（无搜索词时使用 Discover API）
  fetchDiscover: (page?: number) => Promise<void>

  // 热映/热门
  fetchNowPlaying: () => Promise<void>
  fetchPopularMovies: () => Promise<void>
  fetchTopRatedMovies: () => Promise<void>
  fetchUpcomingMovies: () => Promise<void>
  fetchPopularTv: () => Promise<void>
  fetchTopRatedTv: () => Promise<void>
  fetchAiringTodayTv: () => Promise<void>
  fetchTrending: (timeWindow?: 'day' | 'week') => Promise<void>
  fetchRegionalDiscover: () => Promise<void>
  fetchRecommendations: (id: number, mediaType: 'movie' | 'tv') => Promise<void>

  // 筛选
  setFilter: (options: Partial<TmdbFilterOptions>) => void
  clearFilter: () => void

  // 基础数据
  fetchGenresAndCountries: () => Promise<void>

  // 内部辅助
  _applyFilters: () => void
  _updateAvailableYears: () => void
}

const INITIAL_FILTER: TmdbFilterOptions = {
  mediaType: 'all',
  sortOrder: 'desc',
  // sortBy 默认为 undefined，表示按 TMDB 返回顺序不做排序
}

// 仅允许最新一次 TMDB 搜索写回结果，避免竞态导致旧结果覆盖新结果
let latestSearchRequestId = 0

export const useTmdbStore = create<TmdbState & TmdbActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        // State
        searchQuery: '',
        searchResults: [],
        filteredResults: [],
        searchPagination: { page: 1, totalPages: 0, totalResults: 0 },

        discoverResults: [],
        discoverPagination: { page: 1, totalPages: 0, totalResults: 0 },

        nowPlayingMovies: [],
        popularMovies: [],
        topRatedMovies: [],
        upcomingMovies: [],
        popularTv: [],
        topRatedTv: [],
        airingTodayTv: [],
        trending: [],

        regionCache: {},
        regionalLoading: false,
        cachedNetworks: null,

        recommendations: [],
        recommendationSourceId: null,
        recommendationSourceMediaType: null,

        filterOptions: { ...INITIAL_FILTER },

        availableFilterOptions: {
          genres: [],
          countries: [],
          years: [],
          mediaTypes: ['movie', 'tv'],
        },

        movieGenres: [],
        tvGenres: [],
        genresLanguage: null,

        loading: {
          search: false,
          discover: false,
          nowPlaying: false,
          popularMovies: false,
          topRatedMovies: false,
          upcomingMovies: false,
          popularTv: false,
          topRatedTv: false,
          airingTodayTv: false,
          trending: false,
          recommendations: false,
          genres: false,
        },
        error: null,

        // Actions
        fetchGenresAndCountries: async () => {
          const client = getTmdbClient()
          const currentLang = getTmdbLanguage()
          // 仅在语言未变且 genres 和 countries 都已缓存时跳过
          const { movieGenres, genresLanguage, availableFilterOptions } = get()
          if (
            movieGenres.length > 0 &&
            availableFilterOptions.countries.length > 0 &&
            genresLanguage === currentLang
          ) {
            return
          }

          set(state => {
            state.loading.genres = true
          })
          try {
            const [movieGenres, tvGenres, countries] = await Promise.all([
              client.genres.movies({ language: getTmdbLanguage() }),
              client.genres.tvShows({ language: getTmdbLanguage() }),
              client.configuration.getCountries(),
            ])

            set(state => {
              state.movieGenres = movieGenres.genres
              state.tvGenres = tvGenres.genres
              state.genresLanguage = currentLang
              state.availableFilterOptions.genres = [
                ...movieGenres.genres,
                ...tvGenres.genres,
              ].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) // 去重
              state.availableFilterOptions.countries = countries
              state.loading.genres = false
            })
          } catch (err: unknown) {
            console.error('Failed to fetch TMDB config:', err)
            set(state => {
              state.loading.genres = false
            })
          }
        },

        search: async (query: string, page = 1, year?: number) => {
          const requestId = ++latestSearchRequestId
          const client = getTmdbClient()
          set(state => {
            state.searchQuery = query
            state.loading.search = true
            state.error = null
          })

          try {
            const baseParams = {
              query,
              page,
              language: getTmdbLanguage(),
              include_adult: !useSettingStore.getState().system.isAdultFilterEnabled,
            }

            let totalPages = 0
            let totalResults = 0

            if (year !== undefined) {
              // 年份存在时：分别搜索 movie 和 tv，传年份给 API 服务端过滤
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const movieParams: any = { ...baseParams, primary_release_year: year }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const tvParams: any = { ...baseParams, first_air_date_year: year }

              const [movieRes, tvRes] = await Promise.all([
                client.search.movies(movieParams),
                client.search.tvShows(tvParams),
              ])

              const movieItems = (movieRes.results as unknown as Array<Record<string, unknown>>).map(r =>
                normalizeToMediaItem(r, 'movie'),
              )
              const tvItems = (tvRes.results as unknown as Array<Record<string, unknown>>).map(r =>
                normalizeToMediaItem(r, 'tv'),
              )

              // 合并并按热度排序
              const allItems = [...movieItems, ...tvItems].sort((a, b) => b.popularity - a.popularity)

              // 成人过滤
              const { isAdultFilterEnabled, cmsFilterKeywords } = useSettingStore.getState().system
              const keywords = (import.meta.env.OKI_CMS_FILTER_KEYWORDS || cmsFilterKeywords)
                .split(',').map((k: string) => k.trim()).filter(Boolean)

              const results = allItems.filter(item => {
                if (!isAdultFilterEnabled) return true
                if (keywords.length === 0) return true
                const haystack = [item.title, item.originalTitle, item.overview]
                  .filter(Boolean).join(' ')
                return !keywords.some((kw: string) => haystack.includes(kw))
              })

              totalPages = Math.max(movieRes.total_pages, tvRes.total_pages)
              totalResults = movieRes.total_results + tvRes.total_results

              if (requestId !== latestSearchRequestId) return

              set(state => {
                if (page > 1) {
                  const existingKeys = new Set(state.searchResults.map(r => `${r.mediaType}-${r.id}`))
                  const newItems = results.filter(r => !existingKeys.has(`${r.mediaType}-${r.id}`))
                  state.searchResults = [...state.searchResults, ...newItems]
                } else {
                  state.searchResults = results
                }
                state.searchPagination = { page, totalPages, totalResults }
                state.loading.search = false
              })
            } else {
              // 无年份：使用 multi search（保持原有行为）
              const res = await client.search.multi(baseParams)

              const results: TmdbMediaItem[] = res.results
                .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
                .map(item =>
                  normalizeToMediaItem(item as unknown as Record<string, unknown>, item.media_type),
                )
                .filter(item => {
                  const { isAdultFilterEnabled, cmsFilterKeywords } = useSettingStore.getState().system
                  if (!isAdultFilterEnabled) return true
                  const keywords = (import.meta.env.OKI_CMS_FILTER_KEYWORDS || cmsFilterKeywords)
                    .split(',').map((k: string) => k.trim()).filter(Boolean)
                  if (keywords.length === 0) return true
                  const haystack = [item.title, item.originalTitle, item.overview]
                    .filter(Boolean).join(' ')
                  return !keywords.some((kw: string) => haystack.includes(kw))
                })

              if (requestId !== latestSearchRequestId) return

              set(state => {
                if (page > 1) {
                  const existingKeys = new Set(state.searchResults.map(r => `${r.mediaType}-${r.id}`))
                  const newItems = results.filter(r => !existingKeys.has(`${r.mediaType}-${r.id}`))
                  state.searchResults = [...state.searchResults, ...newItems]
                } else {
                  state.searchResults = results
                }
                state.searchPagination = {
                  page: res.page,
                  totalPages: res.total_pages,
                  totalResults: res.total_results,
                }
                state.loading.search = false
              })
            }

            // 更新可用筛选值和应用筛选
            get()._updateAvailableYears()
            get()._applyFilters()
          } catch (err: unknown) {
            if (requestId !== latestSearchRequestId) return

            set(state => {
              state.error = (err as Error).message || 'Search failed'
              state.loading.search = false
            })
          }
        },

        findById: async (id: number) => {
          const requestId = ++latestSearchRequestId
          const client = getTmdbClient()
          const language = getTmdbLanguage()
          set(state => {
            state.searchQuery = String(id)
            state.loading.search = true
            state.error = null
          })

          try {
            const results = await Promise.allSettled([
              client.movies.details(id, [], language),
              client.tvShows.details(id, [], language),
            ])

            const items: TmdbMediaItem[] = []
            for (const r of results) {
              if (r.status === 'fulfilled' && r.value) {
                const raw = r.value as Record<string, unknown>
                items.push(normalizeToMediaItem(raw, 'title' in raw ? 'movie' : 'tv'))
              }
            }

            if (requestId !== latestSearchRequestId) return

            set(state => {
              state.searchResults = items
              state.searchPagination = { page: 1, totalPages: 1, totalResults: items.length }
              state.loading.search = false
              if (items.length === 0) state.error = '未找到该 ID 对应的内容'
            })

            get()._updateAvailableYears()
            get()._applyFilters()
          } catch (err: unknown) {
            if (requestId !== latestSearchRequestId) return
            set(state => {
              state.error = (err as Error).message || 'ID search failed'
              state.loading.search = false
            })
          }
        },

        fetchDiscover: async (page = 1) => {
          const client = getTmdbClient()
          const { filterOptions } = get()

          set(state => {
            state.loading.discover = true
            state.error = null
          })

          try {
            // 根据 mediaType 决定调用哪个 discover 接口
            const mediaType = filterOptions.mediaType === 'tv' ? 'tv' : 'movie'
            const networks = useSettingStore.getState().system.varietyNetworks
            const networkIds = networks.split('|').filter(Boolean)
            const hasChineseNetwork = networkIds.includes('1330') || networkIds.includes('2007')

            // 构建 discover 请求参数
            const sortByMap: Record<string, string> = {
              popularity: 'popularity.desc',
              vote_average: 'vote_average.desc',
              release_date: mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
            }
            const sortOrder = filterOptions.sortOrder === 'asc' ? 'asc' : 'desc'
            const sortByValue = filterOptions.sortBy
              ? sortByMap[filterOptions.sortBy]?.replace('.desc', `.${sortOrder}`) || 'popularity.desc'
              : 'popularity.desc'

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const discoverParams: any = {
              page,
              language: getTmdbLanguage(),
              sort_by: sortByValue,
            }

            // 添加分类筛选
            if (filterOptions.genreIds && filterOptions.genreIds.length > 0) {
              discoverParams.with_genres = filterOptions.genreIds.join(',')
            }

            // 添加国家筛选
            if (filterOptions.originCountry) {
              discoverParams.with_origin_country = filterOptions.originCountry
            }

            // 添加年份筛选
            if (filterOptions.releaseYear) {
              if (mediaType === 'movie') {
                discoverParams.primary_release_year = filterOptions.releaseYear
              } else {
                discoverParams.first_air_date_year = filterOptions.releaseYear
              }
            }

            // 添加评分筛选
            if (filterOptions.minVoteAverage && filterOptions.minVoteAverage > 0) {
              discoverParams['vote_average.gte'] = filterOptions.minVoteAverage
              discoverParams['vote_count.gte'] = 50 // 确保有足够的投票数
            }

            let allResults: TmdbMediaItem[] = []
            let totalPages = 0
            let totalResults = 0

            // 中国平台偏好 → 电影加中文筛选
            const movieParams = { ...discoverParams }
            if (hasChineseNetwork) {
              movieParams.with_original_language = 'zh'
            }

            // 如果是 'all' 类型，同时获取电影和剧集
            if (filterOptions.mediaType === 'all' || !filterOptions.mediaType) {
              const [movieRes, tvRes] = await Promise.all([
                client.discover.movie(movieParams),
                client.discover.tvShow({
                  ...discoverParams,
                  // TV 的年份参数不同
                  first_air_date_year: filterOptions.releaseYear,
                  primary_release_year: undefined,
                  with_networks: networks,
                }),
              ])

              const movieResults = movieRes.results.map((i: unknown) =>
                normalizeToMediaItem(i as Record<string, unknown>, 'movie'),
              )
              const tvResults = tvRes.results.map((i: unknown) =>
                normalizeToMediaItem(i as Record<string, unknown>, 'tv'),
              )

              // 合并并按热度排序
              allResults = [...movieResults, ...tvResults].sort((a, b) => b.popularity - a.popularity)
              totalPages = Math.max(movieRes.total_pages, tvRes.total_pages)
              totalResults = movieRes.total_results + tvRes.total_results
            } else {
              // 单一类型
              const res =
                mediaType === 'movie'
                  ? await client.discover.movie(movieParams)
                  : await client.discover.tvShow({ ...discoverParams, with_networks: networks })

              allResults = res.results.map((i: unknown) =>
                normalizeToMediaItem(i as Record<string, unknown>, mediaType),
              )
              totalPages = res.total_pages
              totalResults = res.total_results
            }

            set(state => {
              state.discoverResults = page > 1 ? [...state.discoverResults, ...allResults] : allResults
              state.discoverPagination = {
                page,
                totalPages,
                totalResults,
              }
              state.loading.discover = false
            })
          } catch (err: unknown) {
            console.error('Discover failed:', err)
            set(state => {
              state.error = (err as Error).message || 'Discover failed'
              state.loading.discover = false
            })
          }
        },

        fetchNowPlaying: async () => {
          if (get().nowPlayingMovies.length > 0) return
          const client = getTmdbClient()
          set(state => {
            state.loading.nowPlaying = true
          })

          try {
            // 并行获取电影热映和剧集热门
            const [moviesRes, tvRes] = await Promise.all([
              client.movies.nowPlaying({ language: getTmdbLanguage() }),
              client.tvShows.popular({ language: getTmdbLanguage() }),
            ])

            set(state => {
              state.nowPlayingMovies = moviesRes.results.map(i =>
                normalizeToMediaItem(i as unknown as Record<string, unknown>, 'movie'),
              )
              state.popularTv = tvRes.results.map(i =>
                normalizeToMediaItem(i as unknown as Record<string, unknown>, 'tv'),
              )
              state.loading.nowPlaying = false
            })
          } catch (err: unknown) {
            set(state => {
              state.error = (err as Error).message
              state.loading.nowPlaying = false
            })
          }
        },

        // 电影：最受欢迎
        fetchPopularMovies: async () => {
          if (get().popularMovies.length > 0) return
          const client = getTmdbClient()
          set(state => {
            state.loading.popularMovies = true
          })

          try {
            const res = await client.movies.popular({ language: getTmdbLanguage() })
            set(state => {
              state.popularMovies = res.results.map(i =>
                normalizeToMediaItem(i as unknown as Record<string, unknown>, 'movie'),
              )
              state.loading.popularMovies = false
            })
          } catch (err: unknown) {
            set(state => {
              state.error = (err as Error).message
              state.loading.popularMovies = false
            })
          }
        },

        // 电影：口碑最佳
        fetchTopRatedMovies: async () => {
          if (get().topRatedMovies.length > 0) return
          const client = getTmdbClient()
          set(state => {
            state.loading.topRatedMovies = true
          })

          try {
            const res = await client.movies.topRated({ language: getTmdbLanguage() })
            set(state => {
              state.topRatedMovies = res.results.map(i =>
                normalizeToMediaItem(i as unknown as Record<string, unknown>, 'movie'),
              )
              state.loading.topRatedMovies = false
            })
          } catch (err: unknown) {
            set(state => {
              state.error = (err as Error).message
              state.loading.topRatedMovies = false
            })
          }
        },

        // 电影：即将上映
        fetchUpcomingMovies: async () => {
          if (get().upcomingMovies.length > 0) return
          const client = getTmdbClient()
          set(state => {
            state.loading.upcomingMovies = true
          })

          try {
            const res = await client.movies.upcoming({ language: getTmdbLanguage() })
            set(state => {
              state.upcomingMovies = res.results.map(i =>
                normalizeToMediaItem(i as unknown as Record<string, unknown>, 'movie'),
              )
              state.loading.upcomingMovies = false
            })
          } catch (err: unknown) {
            set(state => {
              state.error = (err as Error).message
              state.loading.upcomingMovies = false
            })
          }
        },

        // 剧集：最受欢迎
        fetchPopularTv: async () => {
          if (get().popularTv.length > 0) return
          const client = getTmdbClient()
          set(state => {
            state.loading.popularTv = true
          })

          try {
            const res = await client.tvShows.popular({ language: getTmdbLanguage() })
            set(state => {
              state.popularTv = res.results.map(i =>
                normalizeToMediaItem(i as unknown as Record<string, unknown>, 'tv'),
              )
              state.loading.popularTv = false
            })
          } catch (err: unknown) {
            set(state => {
              state.error = (err as Error).message
              state.loading.popularTv = false
            })
          }
        },

        // 剧集：口碑最佳
        fetchTopRatedTv: async () => {
          if (get().topRatedTv.length > 0) return
          const client = getTmdbClient()
          set(state => {
            state.loading.topRatedTv = true
          })

          try {
            const res = await client.tvShows.topRated({ language: getTmdbLanguage() })
            set(state => {
              state.topRatedTv = res.results.map(i =>
                normalizeToMediaItem(i as unknown as Record<string, unknown>, 'tv'),
              )
              state.loading.topRatedTv = false
            })
          } catch (err: unknown) {
            set(state => {
              state.error = (err as Error).message
              state.loading.topRatedTv = false
            })
          }
        },

        // 剧集：今日播出
        fetchAiringTodayTv: async () => {
          if (get().airingTodayTv.length > 0) return
          const client = getTmdbClient()
          set(state => {
            state.loading.airingTodayTv = true
          })

          try {
            const res = await client.tvShows.airingToday({ language: getTmdbLanguage() })
            set(state => {
              state.airingTodayTv = res.results.map(i =>
                normalizeToMediaItem(i as unknown as Record<string, unknown>, 'tv'),
              )
              state.loading.airingTodayTv = false
            })
          } catch (err: unknown) {
            set(state => {
              state.error = (err as Error).message
              state.loading.airingTodayTv = false
            })
          }
        },

        fetchTrending: async (timeWindow = 'day') => {
          if (get().trending.length > 0) return
          const client = getTmdbClient()
          set(state => {
            state.loading.trending = true
          })

          try {
            const res = await client.trending.trending('all', timeWindow as 'day' | 'week', {
              language: getTmdbLanguage(),
            })

            const baseResults = res.results
              .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
              .map(item =>
                normalizeToMediaItem(item as unknown as Record<string, unknown>, item.media_type),
              )

            // 并行获取每个项目的 logo
            await fillItemLogos(client, baseResults)

            set(state => {
              state.trending = baseResults
              state.loading.trending = false
            })
          } catch (err: unknown) {
            set(state => {
              state.loading.trending = false
              state.error = (err as Error).message
            })
          }
        },

        // 发现页数据：按用户偏好平台获取，不区分区域
        fetchRegionalDiscover: async () => {
          const { regionCache, cachedNetworks } = get()
          const networks = useSettingStore.getState().system.varietyNetworks
          if (regionCache.default && cachedNetworks === networks) return
          const client = getTmdbClient()
          set(s => { s.regionalLoading = true; s.error = null })

          try {
            const tmdbLang = getTmdbLanguage() as string
            const networkIds = networks.split('|').filter(Boolean)
            const hasWestern = networkIds.includes('213') || networkIds.includes('2552')
            const hasChinese = networkIds.includes('1330') || networkIds.includes('2007')

            // 电影/动漫按平台分组查询后合并
            const movieCalls: Promise<{ results: unknown[] }>[] = []
            const animeCalls: Promise<{ results: unknown[] }>[] = []
            if (hasWestern) {
              movieCalls.push(
                client.discover.movie({
                  language: tmdbLang, sort_by: 'vote_average.desc',
                  with_watch_providers: '8|350',
                  'primary_release_date.gte': '2020-01-01', // ponytail: 评分降序，只取近年
                  'vote_count.gte': 200,
                }),
              )
              animeCalls.push(
                client.discover.movie({
                  language: tmdbLang, sort_by: 'popularity.desc',
                  with_genres: '16', with_watch_providers: '8|350',
                  'vote_count.gte': 30,
                }),
              )
            }
            if (hasChinese) {
              movieCalls.push(
                client.discover.movie({
                  language: tmdbLang, sort_by: 'vote_average.desc',
                  with_original_language: 'zh',
                  'primary_release_date.gte': '2020-01-01',
                  'vote_count.gte': 30,
                }),
              )
              animeCalls.push(
                client.discover.movie({
                  language: tmdbLang, sort_by: 'popularity.desc',
                  with_genres: '16', with_original_language: 'zh',
                  'vote_count.gte': 20,
                }),
              )
            }

            const mCount = movieCalls.length
            const [tvRes, varietyRes, ...rest] = await Promise.all([
              client.discover.tvShow({
                language: tmdbLang, sort_by: 'popularity.desc',
                with_networks: networks, 'vote_count.gte': 50,
              }),
              client.discover.tvShow({
                language: tmdbLang, sort_by: 'popularity.desc',
                with_networks: networks, with_genres: '10764', 'vote_count.gte': 5,
              }),
              ...movieCalls,
              ...animeCalls,
            ])

            const movieResults = rest.slice(0, mCount).flatMap(r => r.results)
            const animeResults = rest.slice(mCount).flatMap(r => r.results)

            const normMovie = (i: unknown) => normalizeToMediaItem(i as Record<string, unknown>, 'movie')
            const normTv = (i: unknown) => normalizeToMediaItem(i as Record<string, unknown>, 'tv')

            const movieItems = movieResults.map(normMovie)
            // 从动漫列表中排除已出现在电影列表中的条目，避免动画电影跨区重复
            const movieKeySet = new Set(movieItems.map(i => `${i.mediaType}-${i.id}`))
            const animeItems = animeResults
              .map(normMovie)
              .filter(i => !movieKeySet.has(`${i.mediaType}-${i.id}`))
            const tvItems = tvRes.results.map(normTv)
            const varietyItems = varietyRes.results.map(normTv)
            const featured = [...new Map(
                [...tvItems, ...movieItems, ...animeItems].map(i => [i.id + i.mediaType, i])
              ).values()]
              .sort((a, b) => b.popularity - a.popularity)
              .slice(0, 10)

            // 批量拉取 logo，TMDB discover 不返回 logo_path
            await fillItemLogos(client, featured)

            set(s => {
              s.regionCache.default = {
                regionalTvShows: tvItems,
                regionalMovies: movieItems,
                regionalAnimated: animeItems,
                regionalVariety: varietyItems,
                regionalFeatured: featured,
                regionalNowPlaying: [], // ponytail: 首页未使用，留空避免与 movies 重复
                regionalPopularMovies: [],
                regionalTopRatedMovies: [],
                regionalUpcoming: [],
                regionalPopularTv: [],
                regionalTopRatedTv: [],
              }
              s.cachedNetworks = networks
              s.regionalLoading = false
            })
          } catch (err) {
            console.error('Regional discover failed:', err)
            set(s => {
              s.error = (err as Error).message || 'Regional discover failed'
              s.regionalLoading = false
            })
          }
        },

        // 推荐：根据指定的 movie/tv 获取推荐列表
        fetchRecommendations: async (id: number, mediaType: 'movie' | 'tv') => {
          const client = getTmdbClient()
          const { recommendationSourceId, recommendationSourceMediaType } = get()

          // 如果推荐来源未变化，不重新获取
          if (recommendationSourceId === id && recommendationSourceMediaType === mediaType) return

          set(state => {
            state.loading.recommendations = true
          })

          try {
            const res =
              mediaType === 'movie'
                ? await client.movies.recommendations(id, { language: getTmdbLanguage() })
                : await client.tvShows.recommendations(id, { language: getTmdbLanguage() })

            set(state => {
              state.recommendations = res.results.map(i =>
                normalizeToMediaItem(i as unknown as Record<string, unknown>, mediaType),
              )
              state.recommendationSourceId = id
              state.recommendationSourceMediaType = mediaType
              state.loading.recommendations = false
            })
          } catch (err: unknown) {
            set(state => {
              state.error = (err as Error).message
              state.loading.recommendations = false
            })
          }
        },

        setFilter: options => {
          set(state => {
            state.filterOptions = { ...state.filterOptions, ...options }
          })
          get()._applyFilters()
        },

        clearFilter: () => {
          set(state => {
            state.filterOptions = { ...INITIAL_FILTER }
          })
          get()._applyFilters()
        },

        _updateAvailableYears: () => {
          set(state => {
            const years = new Set<number>()
            state.searchResults.forEach(item => {
              if (item.releaseDate) {
                const year = parseInt(item.releaseDate.substring(0, 4))
                if (!isNaN(year)) years.add(year)
              }
            })
            state.availableFilterOptions.years = Array.from(years).sort((a, b) => b - a)
          })
        },

        _applyFilters: () => {
          const { searchResults, filterOptions } = get()

          let filtered = [...searchResults]

          // 1. MediaType
          if (filterOptions.mediaType && filterOptions.mediaType !== 'all') {
            filtered = filtered.filter(item => item.mediaType === filterOptions.mediaType)
          }

          // 2. Genre (AND logic)
          if (filterOptions.genreIds && filterOptions.genreIds.length > 0) {
            filtered = filtered.filter(item =>
              filterOptions.genreIds!.every(gid => item.genreIds.includes(gid)),
            )
          }

          // 3. Score
          if (filterOptions.minVoteAverage && filterOptions.minVoteAverage > 0) {
            filtered = filtered.filter(item => item.voteAverage >= filterOptions.minVoteAverage!)
          }

          // 4. Year
          if (filterOptions.releaseYear) {
            filtered = filtered.filter(item => {
              if (!item.releaseDate) return false
              return item.releaseDate.startsWith(filterOptions.releaseYear!.toString())
            })
          }

          // 5. Country (Origin Country)
          if (filterOptions.originCountry) {
            filtered = filtered.filter(item => {
              // 电影可能没有originCountry列表，或者在其他字段，这里做尽力而为的匹配
              // 如果 originCountry 存在且非空，检查包含
              if (item.originCountry && item.originCountry.length > 0) {
                return item.originCountry.includes(filterOptions.originCountry!)
              }
              // 备选：如果 originalLanguage 匹配国家代码 (不准确，但有时有用，例如 'zh' != 'CN')
              // 暂时只过滤明确有产地信息的
              return false
            })
          }

          // 6. Sort
          if (filterOptions.sortBy) {
            filtered.sort((a, b) => {
              let valA: number | string, valB: number | string

              switch (filterOptions.sortBy) {
                case 'vote_average':
                  valA = a.voteAverage
                  valB = b.voteAverage
                  break
                case 'release_date':
                  valA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0
                  valB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0
                  break
                case 'popularity':
                default:
                  valA = a.popularity
                  valB = b.popularity
                  break
              }

              if (filterOptions.sortOrder === 'asc') {
                return valA > valB ? 1 : valA < valB ? -1 : 0
              } else {
                return valA < valB ? 1 : valA > valB ? -1 : 0
              }
            })
          }

          set(state => {
            state.filteredResults = filtered
          })
        },
      })),
      {
        name: 'ouonnki-tv-tmdb-home-cache-store',
        version: 1,
        storage: createJSONStorage(() => ({
          getItem: async (name) => (await get<string>(name)) ?? null,
          setItem: async (name, value) => await set(name, value),
          removeItem: async (name) => await del(name),
        })),
        partialize: (state) => ({
          nowPlayingMovies: state.nowPlayingMovies,
          popularMovies: state.popularMovies,
          topRatedMovies: state.topRatedMovies,
          upcomingMovies: state.upcomingMovies,
          popularTv: state.popularTv,
          topRatedTv: state.topRatedTv,
          airingTodayTv: state.airingTodayTv,
          trending: state.trending,
          regionCache: state.regionCache,
          movieGenres: state.movieGenres,
          tvGenres: state.tvGenres,
          genresLanguage: state.genresLanguage,
        }),
      }
    )
  ),
)
