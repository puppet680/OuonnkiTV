import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchTmdbPersonSearch } from '@/shared/lib/api/tmdb'
import { useSettingStore } from '@/shared/store/settingStore'

/**
 * 人物搜索 Hook（分页加载）
 * @param query - 搜索关键词，空串时不发起请求
 * @returns 人物搜索结果与分页状态（loadMore 追加下一页）
 */
export function useTmdbPersonSearch(query: string) {
  const language = 'zh-CN'
  const includeAdult = !useSettingStore.getState().system.isAdultFilterEnabled

  const infinite = useInfiniteQuery({
    queryKey: ['tmdb', 'person-search', query, language],
    queryFn: ({ pageParam }) => fetchTmdbPersonSearch(query, pageParam, language, includeAdult),
    initialPageParam: 1,
    getNextPageParam: last =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    enabled: query.trim().length > 0,
    staleTime: 5 * 60_000,
  })

  return {
    results: infinite.data?.pages.flatMap(page => page.items) ?? [],
    loading: infinite.isLoading,
    loadingMore: infinite.isFetchingNextPage,
    error: infinite.error ? (infinite.error as Error).message || '搜索人物失败' : null,
    hasMore: infinite.hasNextPage ?? false,
    loadMore: () => void infinite.fetchNextPage(),
  }
}
