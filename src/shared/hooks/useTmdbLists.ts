import { useQuery } from '@tanstack/react-query'
import { fetchTmdbList } from '@/shared/lib/api/tmdb'
import { useSettingStore } from '@/shared/store/settingStore'
import { useTmdbTrending } from '@/shared/hooks/useTmdbTrending'
import type { TmdbMediaType } from '@/shared/types/tmdb'

/** 单个列表 query（每列表独立缓存，可独立刷新/失效） */
function useTmdbListQuery(
  mediaType: TmdbMediaType,
  endpoint: 'nowPlaying' | 'popular' | 'topRated' | 'upcoming' | 'airingToday',
) {
  const language = useSettingStore(s => s.system.tmdbLanguage)
  return useQuery({
    queryKey: ['tmdb', 'list', endpoint, mediaType, language],
    queryFn: ({ signal }) => fetchTmdbList(mediaType, endpoint, language, signal),
    staleTime: 30 * 60_000,
    retry: 2,
  })
}

const firstError = (...qs: { error: Error | null }[]) =>
  qs.map(q => q.error).find(Boolean)?.message ?? null

/**
 * 热映/热门 Hook（电影热映 + 剧集热门 + 综合趋势）
 */
export function useTmdbNowPlaying() {
  const movies = useTmdbListQuery('movie', 'nowPlaying')
  const tv = useTmdbListQuery('tv', 'popular')
  const trending = useTmdbTrending()

  return {
    movies: movies.data ?? [],
    tv: tv.data ?? [],
    trending: trending.data ?? [],
    loading: movies.isLoading || tv.isLoading || trending.isLoading,
    error: firstError(movies, tv, trending),
    refreshNowPlaying: () => void movies.refetch(),
    refreshTrending: () => void trending.refetch(),
  }
}

/**
 * 电影榜单 Hook (正在热映/最受欢迎/口碑最佳/即将上映)
 */
export function useTmdbMovieLists() {
  const nowPlaying = useTmdbListQuery('movie', 'nowPlaying')
  const popular = useTmdbListQuery('movie', 'popular')
  const topRated = useTmdbListQuery('movie', 'topRated')
  const upcoming = useTmdbListQuery('movie', 'upcoming')

  return {
    nowPlaying: nowPlaying.data ?? [],
    popular: popular.data ?? [],
    topRated: topRated.data ?? [],
    upcoming: upcoming.data ?? [],
    loading: nowPlaying.isLoading || popular.isLoading || topRated.isLoading || upcoming.isLoading,
    refreshNowPlaying: () => void nowPlaying.refetch(),
    refreshPopular: () => void popular.refetch(),
    refreshTopRated: () => void topRated.refetch(),
    refreshUpcoming: () => void upcoming.refetch(),
  }
}

/**
 * 剧集榜单 Hook (今日播出/最受欢迎/口碑最佳)
 */
export function useTmdbTvLists() {
  const airingToday = useTmdbListQuery('tv', 'airingToday')
  const popular = useTmdbListQuery('tv', 'popular')
  const topRated = useTmdbListQuery('tv', 'topRated')

  return {
    airingToday: airingToday.data ?? [],
    popular: popular.data ?? [],
    topRated: topRated.data ?? [],
    loading: airingToday.isLoading || popular.isLoading || topRated.isLoading,
    refreshAiringToday: () => void airingToday.refetch(),
    refreshPopular: () => void popular.refetch(),
    refreshTopRated: () => void topRated.refetch(),
  }
}
