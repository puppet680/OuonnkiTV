import { QueryClient } from '@tanstack/react-query'

/**
 * 全局 React Query 客户端，默认参数见 CLAUDE.md「异步状态（React Query）」
 * 逐查询覆盖：详情类 staleTime 30min、genres 类 Infinity、订阅/在播类 1min、retry 2
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false, // TMDB 有频率限制，不开启
    },
  },
})
