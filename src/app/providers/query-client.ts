import { QueryClient } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

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

// 持久化版本号：只在持久化数据结构变化时手动 bump（不与 package.json 版本同步）
const PERSIST_BUSTER = '1'

// IndexedDB 异步存储（idb-keyval），对应原 tmdbStore persist 的离线缓存能力
const persister = createAsyncStoragePersister({
  storage: {
    getItem: async name => (await get<string>(name)) ?? null,
    setItem: async (name, value) => await set(name, value),
    removeItem: async name => await del(name),
  },
})

// 仅持久化首页列表/配置类查询；搜索/详情/分页等瞬态数据不持久化
const PERSIST_RESOURCES = ['list', 'trending', 'regional', 'discover', 'recommendations', 'genres']

function shouldPersistQuery({ queryKey }: { queryKey: readonly unknown[] }): boolean {
  const [domain, resource] = queryKey as [string, string]
  return domain === 'tmdb' && PERSIST_RESOURCES.includes(resource)
}

void persistQueryClient({
  queryClient,
  persister,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
  buster: PERSIST_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
  },
})
