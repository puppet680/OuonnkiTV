import { useQuery } from '@tanstack/react-query'
import { fetchBangumiData } from '@/shared/lib/api/bangumi'
import { useSettingStore } from '@/shared/store/settingStore'
import type { TmdbMediaItem } from '@/shared/types/tmdb'

interface BangumiData {
  newAnime: TmdbMediaItem[]
  series: TmdbMediaItem[]
  movies: TmdbMediaItem[]
  featured: TmdbMediaItem[]
  loading: boolean
  error: string | null
}

/**
 * 番剧首页数据 Hook
 * 从 TMDB 获取新番、番剧、剧场版及巨幕推荐数据
 * @returns 番剧首页所需的所有数据及状态
 */
export function useBangumi(): BangumiData {
  const language = useSettingStore(s => s.system.tmdbLanguage)
  const query = useQuery({
    queryKey: ['tmdb', 'bangumi', language],
    queryFn: ({ signal }) => fetchBangumiData(language, signal),
    staleTime: 30 * 60_000,
    retry: 2,
  })

  return {
    newAnime: query.data?.newAnime ?? [],
    series: query.data?.series ?? [],
    movies: query.data?.movies ?? [],
    featured: query.data?.featured ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message || '获取番剧数据失败' : null,
  }
}
