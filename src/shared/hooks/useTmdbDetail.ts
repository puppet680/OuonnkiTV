import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTmdbDetail, fetchTmdbPerson } from '../lib/api/tmdb-detail'
import { useSettingStore } from '../store/settingStore'
import type { TmdbMediaType, TmdbMovieDetail, TmdbTvDetail } from '../types/tmdb'

/**
 * 详情 Hook - 核心数据先渲染，次要数据后台静默合并（两阶段）
 * 次要阶段完成后把合并结果写回核心 query 缓存，detail 始终指向最新合并值
 */
export function useTmdbDetail<T extends TmdbMovieDetail | TmdbTvDetail>(
  id: number | undefined,
  mediaType: TmdbMediaType,
  language = useSettingStore.getState().system.tmdbLanguage,
) {
  const queryClient = useQueryClient()
  const coreKey = ['tmdb', 'detail', mediaType, id, language, 'core'] as const

  const coreQuery = useQuery({
    queryKey: coreKey,
    queryFn: () => fetchTmdbDetail(id!, mediaType, language, 'core'),
    enabled: !!id,
    staleTime: 30 * 60_000,
    retry: 2,
  })

  // 次要数据静默后台拉取，完成后合并写回 core 缓存
  useQuery({
    queryKey: [...coreKey.slice(0, -1), 'secondary'],
    queryFn: async () => {
      const secondary = await fetchTmdbDetail(id!, mediaType, language, 'secondary')
      queryClient.setQueryData<Record<string, unknown>>(coreKey, old => ({ ...(old ?? {}), ...secondary }))
      return secondary
    },
    enabled: !!id && coreQuery.isSuccess,
    staleTime: 30 * 60_000,
  })

  return {
    detail: (coreQuery.data ?? null) as unknown as T | null,
    loading: coreQuery.isLoading,
    error: coreQuery.error ? (coreQuery.error as Error).message || '加载失败' : null,
    refetch: () => void coreQuery.refetch(),
  }
}

/**
 * 人物详情 Hook
 */
export function useTmdbPerson(personId: number | undefined) {
  const language = useSettingStore.getState().system.tmdbLanguage
  const query = useQuery({
    queryKey: ['tmdb', 'person', personId, language],
    queryFn: () => fetchTmdbPerson(personId!, language),
    enabled: !!personId,
    staleTime: 30 * 60_000,
    retry: 2,
  })

  return {
    person: query.data?.person ?? null,
    credits: query.data?.credits ?? { cast: [], crew: [] },
    images: query.data?.images ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message || '获取人物详情失败' : null,
    refetch: () => void query.refetch(),
  }
}
