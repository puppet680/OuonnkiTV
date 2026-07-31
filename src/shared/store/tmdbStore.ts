import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { TmdbFilterOptions } from '../types/tmdb'

const INITIAL_FILTER: TmdbFilterOptions = {
  mediaType: 'all',
  sortOrder: 'desc',
  // sortBy 默认为 undefined，表示按 TMDB 返回顺序不做排序
}

interface TmdbState {
  filterOptions: TmdbFilterOptions
}

interface TmdbActions {
  setFilter: (options: Partial<TmdbFilterOptions>) => void
  clearFilter: () => void
}

type TmdbStore = TmdbState & TmdbActions

/**
 * TMDB 客户端状态 store
 * 服务端数据已迁移 React Query，此 store 仅存搜索/发现的筛选条件（纯内存，不持久化）
 */
export const useTmdbStore = create<TmdbStore>()(
  devtools((set, get) => ({
    filterOptions: { ...INITIAL_FILTER },
    setFilter: options => set({ filterOptions: { ...get().filterOptions, ...options } }),
    clearFilter: () => set({ filterOptions: { ...INITIAL_FILTER } }),
  })),
)
