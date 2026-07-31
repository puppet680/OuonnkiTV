import { useQuery } from '@tanstack/react-query'
import { fetchTmdbTrending } from '@/shared/lib/api/tmdb'
import { useSettingStore } from '@/shared/store/settingStore'

/**
 * TMDB 综合趋势 hook（含 logo 填充）
 * @param timeWindow - day | week
 * @returns RQ query 结果，data 为趋势条目列表
 */
export function useTmdbTrending(timeWindow: 'day' | 'week' = 'day') {
  const language = useSettingStore(s => s.system.tmdbLanguage)
  return useQuery({
    queryKey: ['tmdb', 'trending', timeWindow, language],
    queryFn: ({ signal }) => fetchTmdbTrending(timeWindow, language, signal),
    staleTime: 30 * 60_000,
    retry: 2,
  })
}
