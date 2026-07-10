import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppendToResponseMovieKey, AppendToResponseTvKey } from 'tmdb-ts'
import { useTmdbStore } from '../store/tmdbStore'
import { getTmdbClient, normalizeToMediaItem } from '../lib/tmdb'
import { useSettingStore } from '../store/settingStore'
import type { TmdbMediaType, TmdbMovieDetail, TmdbTvDetail } from '../types/tmdb'
import type { PersonCombinedCredits, PersonDetails, PersonImages } from '../types/person'

interface RecommendationSource {
  id: number
  mediaType: TmdbMediaType
}

const EMPTY_RECOMMENDATION_SOURCES: RecommendationSource[] = []

const buildRecommendationSourceKey = (source: RecommendationSource) => `${source.mediaType}:${source.id}`

export function selectRecommendationSource(
  previous: RecommendationSource | null,
  candidates: RecommendationSource[],
  randomFn: () => number = Math.random,
): RecommendationSource | null {
  if (candidates.length === 0) return null

  if (previous) {
    const previousKey = buildRecommendationSourceKey(previous)
    const exists = candidates.some(candidate => buildRecommendationSourceKey(candidate) === previousKey)
    if (exists) return previous
  }

  const randomIndex = Math.floor(randomFn() * candidates.length)
  const safeIndex = Math.max(0, Math.min(candidates.length - 1, randomIndex))
  return candidates[safeIndex]
}

export function findNextRecommendationSource(
  candidates: RecommendationSource[],
  attemptedSourceKeys: Set<string>,
): RecommendationSource | null {
  const next = candidates.find(candidate => !attemptedSourceKeys.has(buildRecommendationSourceKey(candidate)))
  return next || null
}

/**
 * 搜索功能 Hook
 */
export function useTmdbSearch() {
  const query = useTmdbStore(state => state.searchQuery)
  const results = useTmdbStore(state => state.searchResults)
  const filteredResults = useTmdbStore(s => s.filteredResults)
  const pagination = useTmdbStore(s => s.searchPagination)
  const loading = useTmdbStore(s => s.loading.search)
  const filterOptions = useTmdbStore(s => s.filterOptions)
  const availableOptions = useTmdbStore(s => s.availableFilterOptions)

  const search = useTmdbStore(s => s.search)
  const setFilter = useTmdbStore(s => s.setFilter)
  const clearFilter = useTmdbStore(s => s.clearFilter)

  return {
    query,
    results,
    filteredResults,
    pagination,
    loading,
    filterOptions,
    availableOptions,
    search,
    setFilter,
    clearFilter,
  }
}

/**
 * 发现/浏览功能 Hook（无搜索词时使用）
 */
export function useTmdbDiscover() {
  const results = useTmdbStore(s => s.discoverResults)
  const pagination = useTmdbStore(s => s.discoverPagination)
  const loading = useTmdbStore(s => s.loading.discover)
  const filterOptions = useTmdbStore(s => s.filterOptions)

  const fetchDiscover = useTmdbStore(s => s.fetchDiscover)
  const setFilter = useTmdbStore(s => s.setFilter)
  const clearFilter = useTmdbStore(s => s.clearFilter)

  return {
    results,
    pagination,
    loading,
    filterOptions,
    fetchDiscover,
    setFilter,
    clearFilter,
  }
}

/**
 * 区域发现 Hook — 按用户偏好（欧美/大陆）获取首页数据
 */
export function useTmdbRegionalDiscover() {
  const cache = useTmdbStore(s => s.regionCache['default'])
  const loading = useTmdbStore(s => s.regionalLoading)
  const fetchRegionalDiscover = useTmdbStore(s => s.fetchRegionalDiscover)

  useEffect(() => {
    fetchRegionalDiscover()
  }, [fetchRegionalDiscover])

  return {
    tvShows: cache?.regionalTvShows ?? [],
    movies: cache?.regionalMovies ?? [],
    animated: cache?.regionalAnimated ?? [],
    variety: cache?.regionalVariety ?? [],
    featured: cache?.regionalFeatured ?? [],
    nowPlaying: cache?.regionalNowPlaying ?? [],
    popularMovies: cache?.regionalPopularMovies ?? [],
    topRatedMovies: cache?.regionalTopRatedMovies ?? [],
    upcoming: cache?.regionalUpcoming ?? [],
    popularTv: cache?.regionalPopularTv ?? [],
    topRatedTv: cache?.regionalTopRatedTv ?? [],
    loading,
  }
}

/**
 * 热映/热门 Hook
 */
export function useTmdbNowPlaying() {
  const movies = useTmdbStore(s => s.nowPlayingMovies)
  const tv = useTmdbStore(s => s.popularTv)
  const trending = useTmdbStore(s => s.trending)
  const loading = useTmdbStore(s => s.loading)

  const fetchNowPlaying = useTmdbStore(s => s.fetchNowPlaying)
  const fetchTrending = useTmdbStore(s => s.fetchTrending)

  useEffect(() => {
    // 惰性加载，如果有数据暂不刷新，或者可以添加 forceRefresh 参数
    if (movies.length === 0) fetchNowPlaying()
    if (trending.length === 0) fetchTrending()
  }, [fetchNowPlaying, fetchTrending, movies.length, trending.length])

  return {
    movies,
    tv,
    trending,
    loading,
    refreshNowPlaying: fetchNowPlaying,
    refreshTrending: fetchTrending,
  }
}

/**
 * 电影榜单 Hook (正在热映/最受欢迎/口碑最佳/即将上映)
 */
export function useTmdbMovieLists() {
  const nowPlaying = useTmdbStore(s => s.nowPlayingMovies)
  const popular = useTmdbStore(s => s.popularMovies)
  const topRated = useTmdbStore(s => s.topRatedMovies)
  const upcoming = useTmdbStore(s => s.upcomingMovies)
  const loading = useTmdbStore(s => s.loading)

  const fetchNowPlaying = useTmdbStore(s => s.fetchNowPlaying)
  const fetchPopular = useTmdbStore(s => s.fetchPopularMovies)
  const fetchTopRated = useTmdbStore(s => s.fetchTopRatedMovies)
  const fetchUpcoming = useTmdbStore(s => s.fetchUpcomingMovies)

  useEffect(() => {
    if (nowPlaying.length === 0) fetchNowPlaying()
    if (popular.length === 0) fetchPopular()
    if (topRated.length === 0) fetchTopRated()
    if (upcoming.length === 0) fetchUpcoming()
  }, [
    nowPlaying.length,
    popular.length,
    topRated.length,
    upcoming.length,
    fetchNowPlaying,
    fetchPopular,
    fetchTopRated,
    fetchUpcoming,
  ])

  return {
    nowPlaying,
    popular,
    topRated,
    upcoming,
    loading,
    refreshNowPlaying: fetchNowPlaying,
    refreshPopular: fetchPopular,
    refreshTopRated: fetchTopRated,
    refreshUpcoming: fetchUpcoming,
  }
}

/**
 * 剧集榜单 Hook (今日播出/最受欢迎/口碑最佳)
 */
export function useTmdbTvLists() {
  const airingToday = useTmdbStore(s => s.airingTodayTv)
  const popular = useTmdbStore(s => s.popularTv)
  const topRated = useTmdbStore(s => s.topRatedTv)
  const loading = useTmdbStore(s => s.loading)

  const fetchAiringToday = useTmdbStore(s => s.fetchAiringTodayTv)
  const fetchPopular = useTmdbStore(s => s.fetchPopularTv)
  const fetchTopRated = useTmdbStore(s => s.fetchTopRatedTv)

  useEffect(() => {
    if (airingToday.length === 0) fetchAiringToday()
    if (popular.length === 0) fetchPopular()
    if (topRated.length === 0) fetchTopRated()
  }, [
    airingToday.length,
    popular.length,
    topRated.length,
    fetchAiringToday,
    fetchPopular,
    fetchTopRated,
  ])

  return {
    airingToday,
    popular,
    topRated,
    loading,
    refreshAiringToday: fetchAiringToday,
    refreshPopular: fetchPopular,
    refreshTopRated: fetchTopRated,
  }
}

/**
 * 猜你喜欢 Hook
 * 优先从传入的 TMDB 候选来源中随机选择一条；若没有候选来源则回退到 trending。
 * 为避免重渲染时随机抖动，候选集合不变时会优先复用上一次已选中的来源。
 */
export function useTmdbRecommendations(
  preferredSources: RecommendationSource[] = EMPTY_RECOMMENDATION_SOURCES,
) {
  const recommendations = useTmdbStore(s => s.recommendations)
  const loading = useTmdbStore(s => s.loading.recommendations)
  const trending = useTmdbStore(s => s.trending)

  const fetchRecommendations = useTmdbStore(s => s.fetchRecommendations)
  // 从 Zustand 读取上次缓存的推荐源（拆成三个独立 selector，避免对象引用变化导致死循环）
  const cachedSourceId = useTmdbStore(s => s.recommendationSourceId)
  const cachedSourceMediaType = useTmdbStore(s => s.recommendationSourceMediaType)
  const cachedHasRecommendations = useTmdbStore(s => s.recommendations.length > 0)
  const attemptedSourceKeysRef = useRef<Set<string>>(new Set())

  const sourceCandidates = useMemo<RecommendationSource[]>(() => {
    const sourceMap = new Map<string, RecommendationSource>()

    if (preferredSources.length > 0) {
      preferredSources.forEach(source => {
        sourceMap.set(buildRecommendationSourceKey(source), source)
      })
      return Array.from(sourceMap.values())
    }

    trending.forEach(item => {
      sourceMap.set(buildRecommendationSourceKey({ id: item.id, mediaType: item.mediaType }), {
        id: item.id,
        mediaType: item.mediaType,
      })
    })
    return Array.from(sourceMap.values())
  }, [preferredSources, trending])

  // 初始化 selectedSource：优先复用 Zustand 缓存的上次选中源，避免随机重抽
  const [selectedSource, setSelectedSource] = useState<RecommendationSource | null>(() => {
    if (cachedHasRecommendations && cachedSourceId && cachedSourceMediaType) {
      const cached = { id: cachedSourceId, mediaType: cachedSourceMediaType as 'movie' | 'tv' }
      return sourceCandidates.some(
        c => c.id === cached.id && c.mediaType === cached.mediaType,
      )
        ? cached
        : null
    }
    return null
  })

  useEffect(() => {
    attemptedSourceKeysRef.current = new Set()
    setSelectedSource(previous => selectRecommendationSource(previous, sourceCandidates))
  }, [sourceCandidates])

  useEffect(() => {
    if (!selectedSource) return

    const sourceKey = buildRecommendationSourceKey(selectedSource)
    if (attemptedSourceKeysRef.current.has(sourceKey)) {
      return
    }

    const currentState = useTmdbStore.getState()
    const sourceUnchangedAndHasData =
      currentState.recommendationSourceId === selectedSource.id &&
      currentState.recommendationSourceMediaType === selectedSource.mediaType &&
      currentState.recommendations.length > 0
    if (sourceUnchangedAndHasData) {
      attemptedSourceKeysRef.current.add(sourceKey)
      return
    }

    attemptedSourceKeysRef.current.add(sourceKey)
    let cancelled = false

    const fetchBySource = async () => {
      try {
        await fetchRecommendations(selectedSource.id, selectedSource.mediaType)
      } catch {
        // fetchRecommendations 已在 store 内处理错误状态，这里仅做降级切源。
      }

      if (cancelled) return

      const latestState = useTmdbStore.getState()
      const hasDataFromSelectedSource =
        latestState.recommendationSourceId === selectedSource.id &&
        latestState.recommendationSourceMediaType === selectedSource.mediaType &&
        latestState.recommendations.length > 0
      if (hasDataFromSelectedSource) {
        return
      }

      const nextSource = findNextRecommendationSource(sourceCandidates, attemptedSourceKeysRef.current)
      if (nextSource) {
        setSelectedSource(nextSource)
      }
    }

    void fetchBySource()

    return () => {
      cancelled = true
    }
  }, [
    selectedSource,
    fetchRecommendations,
    sourceCandidates,
  ])

  return {
    recommendations,
    loading,
    refreshRecommendations: fetchRecommendations,
  }
}

const detailCache = new Map<string, unknown>();

/**
 * 详情 Hook - 引入核心数据与次要数据分阶段加载及缓存机制
 */
export function useTmdbDetail<T extends TmdbMovieDetail | TmdbTvDetail>(
  id: number | undefined,
  mediaType: TmdbMediaType,
  language = useSettingStore.getState().system.tmdbLanguage,
) {
  const cacheKey = `${mediaType}-${id}-${language}`;
  
  const [detail, setDetail] = useState<T | null>((detailCache.get(cacheKey) as T) || null);
  const [loading, setLoading] = useState(!detailCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (isInitial = true) => {
    if (!id) return;

    if (isInitial && !detailCache.has(cacheKey)) {
      setLoading(true);
    }
    setError(null);
    const client = getTmdbClient();

    try {
      // 1. 核心数据类型定义
      const coreAppendMovie: AppendToResponseMovieKey[] = ['credits', 'images', 'external_ids', 'release_dates'];
      const coreAppendTv: AppendToResponseTvKey[] = ['aggregate_credits', 'images', 'external_ids', 'content_ratings'];

      // 2. 次要数据类型定义
      const secondaryAppendMovie: AppendToResponseMovieKey[] = [
        'videos', 'reviews', 'recommendations', 'keywords', 'alternative_titles', 'watch/providers', 'similar'
      ];
      const secondaryAppendTv: AppendToResponseTvKey[] = [
        'videos', 'reviews', 'recommendations', 'keywords', 'alternative_titles', 'watch/providers', 'similar'
      ];

      // 执行核心请求
      const data = mediaType === 'movie' 
        ? await client.movies.details(id, coreAppendMovie, language)
        : await client.tvShows.details(id, coreAppendTv, language);

      const rawData = data as Record<string, unknown>;
      const base = normalizeToMediaItem(rawData, mediaType);
      const fullDetail = { ...rawData, ...base } as T;

      setDetail(fullDetail);
      detailCache.set(cacheKey, fullDetail);
      setLoading(false);

      // 3. 异步静默加载剩余数据
      void (async () => {
        try {
          const secondaryData = mediaType === 'movie'
            ? await client.movies.details(id, secondaryAppendMovie, language)
            : await client.tvShows.details(id, secondaryAppendTv, language);
          
          const merged = { ...fullDetail, ...(secondaryData as Record<string, unknown>) } as T;
          setDetail(merged);
          detailCache.set(cacheKey, merged);
        } catch (e) {
          console.warn('[TMDB] Secondary data fetch failed', e);
        }
      })();

    } catch (err: unknown) {
      setError((err as Error).message || 'Fetch detail failed');
      setLoading(false);
    }
  }, [id, mediaType, language, cacheKey]);

  useEffect(() => {
    if (id) fetchDetail(true);
  }, [id, fetchDetail]);

  return { detail, loading, error, refetch: () => fetchDetail(false) };
}

const personCache = new Map<string, unknown>()

/**
 * 人物详情 Hook
 */
export function useTmdbPerson(personId: number | undefined) {
  const language = useSettingStore.getState().system.tmdbLanguage
  const cacheKey = `person-${personId}-${language}`

  const [person, setPerson] = useState<PersonDetails | null>(
    (personCache.get(cacheKey) as PersonDetails) || null,
  )
  const [credits, setCredits] = useState<PersonCombinedCredits>({ cast: [], crew: [] })
  const [images, setImages] = useState<PersonImages | null>(null)
  const [loading, setLoading] = useState(!personCache.has(cacheKey))
  const [error, setError] = useState<string | null>(null)

  const fetchPerson = useCallback(async () => {
    if (!personId) return
    setLoading(true)
    setError(null)

    try {
      const client = getTmdbClient()
      const data = await client.people.details(
        personId,
        ['combined_credits', 'images'],
        language,
      ) as Record<string, unknown>

      // 提取 person details
      const details: PersonDetails = {
        id: data.id as number,
        name: (data.name as string) || '',
        original_name: (data.original_name as string) || '',
        profile_path: (data.profile_path as string) || null,
        adult: Boolean(data.adult),
        known_for_department: (data.known_for_department as string) || '',
        gender: (data.gender as number) || 0,
        popularity: (data.popularity as number) || 0,
        birthday: (data.birthday as string) || null,
        deathday: (data.deathday as string) || null,
        also_known_as: Array.isArray(data.also_known_as) ? data.also_known_as as string[] : [],
        biography: (data.biography as string) || '',
        place_of_birth: (data.place_of_birth as string) || null,
        imdb_id: (data.imdb_id as string) || null,
        homepage: (data.homepage as string) || null,
      }

      // 提取 combined_credits
      const rawCredits = data.combined_credits as Record<string, unknown> | undefined
      const rawCast = (rawCredits?.cast as Array<Record<string, unknown>>) || []
      const rawCrew = (rawCredits?.crew as Array<Record<string, unknown>>) || []

      const normalizeCast = (items: Array<Record<string, unknown>>) =>
        items.map(item => {
          const mediaType: TmdbMediaType = item.media_type === 'tv' ? 'tv' : 'movie'
          return {
            id: item.id as number,
            mediaType,
            title: ((mediaType === 'movie' ? item.title : item.name) as string) || '',
            originalTitle: ((mediaType === 'movie' ? item.original_title : item.original_name) as string) || '',
            character: (item.character as string) || '',
            overview: (item.overview as string) || '',
            posterPath: (item.poster_path as string) || null,
            backdropPath: (item.backdrop_path as string) || null,
            releaseDate: ((mediaType === 'movie' ? item.release_date : item.first_air_date) as string) || '',
            voteAverage: (item.vote_average as number) || 0,
            voteCount: (item.vote_count as number) || 0,
            popularity: (item.popularity as number) || 0,
            genreIds: Array.isArray(item.genre_ids) ? item.genre_ids as number[] : [],
            originalLanguage: (item.original_language as string) || '',
            originCountry: Array.isArray(item.origin_country) ? item.origin_country as string[] : [],
            episodeCount: (item.episode_count as number) || undefined,
          }
        })

      const cast = normalizeCast(rawCast)
      const crew = normalizeCast(rawCrew)

      // 提取 images
      const rawImages = data.images as { profiles?: Array<Record<string, unknown>> } | undefined
      const profileImages: PersonImages = {
        id: personId,
        profiles: (rawImages?.profiles || []).map(p => ({
          file_path: (p.file_path as string) || '',
          width: (p.width as number) || 0,
          height: (p.height as number) || 0,
          vote_average: (p.vote_average as number) || 0,
          vote_count: (p.vote_count as number) || 0,
        })),
      }

      setPerson(details)
      setCredits({ cast, crew })
      setImages(profileImages)
      personCache.set(cacheKey, details)
      setLoading(false)
    } catch (err: unknown) {
      setError((err as Error).message || '获取人物详情失败')
      setLoading(false)
    }
  }, [personId, language, cacheKey])

  useEffect(() => {
    if (personId) fetchPerson()
  }, [personId, fetchPerson])

  return { person, credits, images, loading, error, refetch: fetchPerson }
}

/**
 * 分类/配置 Hook
 */
export function useTmdbGenres() {
  const movieGenres = useTmdbStore(s => s.movieGenres)
  const tvGenres = useTmdbStore(s => s.tvGenres)
  const loading = useTmdbStore(s => s.loading.genres)
  const fetchGenres = useTmdbStore(s => s.fetchGenresAndCountries)

  useEffect(() => {
    if (movieGenres.length === 0) {
      fetchGenres()
    }
  }, [fetchGenres, movieGenres.length])

  const getGenreName = useCallback(
    (id: number) => {
      const g = movieGenres.find(g => g.id === id) || tvGenres.find(g => g.id === id)
      return g ? g.name : 'Unknown'
    },
    [movieGenres, tvGenres],
  )

  return {
    movieGenres,
    tvGenres,
    loading,
    getGenreName,
  }
}
