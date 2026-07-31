import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { FavoriteList, FavoriteFilterOptions, FavoriteStats } from '../types/favorites'
import { FavoriteWatchStatus } from '../types/favorites'
import type { TmdbFavoriteItem, CmsFavoriteItem } from '../types/favorites'
import type { TmdbMediaItem } from '@/shared/types/tmdb'
import type { VideoItem } from '@/shared/types/video'
import {
  generateTmdbFavoriteId,
  generateCmsFavoriteId,
  createTmdbMediaSnapshot,
  createCmsMediaSnapshot,
} from './favorites.helpers'
import { applyFavoriteFilters } from './favorites.filters'

interface FavoritesState {
  /** 收藏列表 */
  favorites: FavoriteList
  /** 当前筛选器 */
  filterOptions: FavoriteFilterOptions
  /** 筛选后的列表 */
  filteredFavorites: FavoriteList
  /** 已选中的收藏项 ID 集合 */
  selectedIds: Set<string>
}

interface FavoritesActions {
  // === 基础 CRUD ===

  /** 添加 TMDB 媒体到收藏 */
  addTmdbFavorite: (media: TmdbMediaItem, watchStatus?: FavoriteWatchStatus) => void

  /** 添加 CMS 视频到收藏 */
  addCmsFavorite: (video: VideoItem, watchStatus?: FavoriteWatchStatus) => void

  /** 批量添加收藏 (去重) */
  addFavorites: (items: (TmdbMediaItem | VideoItem)[]) => void

  /** 删除收藏项 */
  removeFavorite: (id: string) => void

  /** 批量删除收藏项 */
  removeFavorites: (ids: string[]) => void

  /** 清空所有收藏 */
  clearFavorites: () => void

  // === 状态管理 ===

  /** 更新观看状态 */
  updateWatchStatus: (id: string, status: FavoriteWatchStatus) => void

  /** 批量更新观看状态 */
  updateWatchStatusBulk: (ids: string[], status: FavoriteWatchStatus) => void

  /** 设置评分 */
  setRating: (id: string, rating: number) => void

  /** 设置备注 */
  setNotes: (id: string, notes: string) => void

  /** 添加标签 */
  addTag: (id: string, tag: string) => void

  /** 移除标签 */
  removeTag: (id: string, tag: string) => void

  // === 查询 ===

  /** 检查是否已收藏 (TMDB) */
  isTmdbFavorited: (tmdbId: number, mediaType: 'movie' | 'tv') => boolean

  /** 检查是否已收藏 (CMS) */
  isCmsFavorited: (vodId: string, sourceCode: string) => boolean

  /** 获取收藏项 (TMDB) */
  getTmdbFavorite: (tmdbId: number, mediaType: 'movie' | 'tv') => TmdbFavoriteItem | undefined

  /** 获取收藏项 (CMS) */
  getCmsFavorite: (vodId: string, sourceCode: string) => CmsFavoriteItem | undefined

  /** 切换收藏状态 (有则删除，无则添加) */
  toggleTmdbFavorite: (media: TmdbMediaItem) => void

  /** 切换收藏状态 (CMS) */
  toggleCmsFavorite: (video: VideoItem) => void

  // === 筛选 ===

  /** 设置筛选器 */
  setFilter: (options: Partial<FavoriteFilterOptions>) => void

  /** 清除筛选器 */
  clearFilter: () => void

  /** 应用筛选 (内部方法) */
  _applyFilters: () => void

  // === 批量操作 ===

  /** 全选当前筛选后的收藏项 */
  selectAllFiltered: () => void

  /** 取消全选 */
  deselectAll: () => void

  /** 设置选中 ID 集合 */
  setSelectedIds: (ids: Set<string>) => void

  // === 统计 ===

  /** 获取统计信息 */
  getStats: () => FavoriteStats

  /** 获取所有标签 (去重) */
  getAllTags: () => string[]
}

type FavoritesStore = FavoritesState & FavoritesActions

export const useFavoritesStore = create<FavoritesStore>()(
  devtools(
    persist(
      immer<FavoritesStore>((set, get) => ({
        // 初始状态
        favorites: [],
        filterOptions: {
          sourceType: 'all',
          watchStatus: 'all',
          sortBy: 'addedAt',
          sortOrder: 'desc',
        },
        filteredFavorites: [],
        selectedIds: new Set<string>(),

        // === 基础 CRUD 实现 ===

        addTmdbFavorite: (media: TmdbMediaItem, watchStatus?: FavoriteWatchStatus) => {
          set(state => {
            const existingId = generateTmdbFavoriteId(media.id, media.mediaType)
            const existingIndex = state.favorites.findIndex(f => f.id === existingId)

            const newFavorite: TmdbFavoriteItem = {
              id: existingId,
              addedAt: Date.now(),
              updatedAt: Date.now(),
              sourceType: 'tmdb',
              watchStatus: watchStatus ?? FavoriteWatchStatus.NOT_WATCHED,
              tags: [],
              media: createTmdbMediaSnapshot(media),
            }

            if (existingIndex !== -1) {
              // 更新现有收藏（保留用户数据）
              const existing = state.favorites[existingIndex] as TmdbFavoriteItem
              state.favorites[existingIndex] = {
                ...existing,
                updatedAt: Date.now(),
                media: createTmdbMediaSnapshot(media), // 更新媒体数据
              }
            } else {
              // 添加到列表开头
              state.favorites.unshift(newFavorite)
            }
          })
          // 在 set 外部调用 _applyFilters
          get()._applyFilters()
        },

        addCmsFavorite: (video: VideoItem, watchStatus?: FavoriteWatchStatus) => {
          set(state => {
            const sourceCode = video.source_code || ''
            const existingId = generateCmsFavoriteId(video.vod_id, sourceCode)
            const existingIndex = state.favorites.findIndex(f => f.id === existingId)

            const newFavorite: CmsFavoriteItem = {
              id: existingId,
              addedAt: Date.now(),
              updatedAt: Date.now(),
              sourceType: 'cms',
              watchStatus: watchStatus ?? FavoriteWatchStatus.NOT_WATCHED,
              tags: [],
              media: createCmsMediaSnapshot(video),
            }

            if (existingIndex !== -1) {
              // 更新现有收藏
              const existing = state.favorites[existingIndex] as CmsFavoriteItem
              state.favorites[existingIndex] = {
                ...existing,
                updatedAt: Date.now(),
                media: createCmsMediaSnapshot(video),
              }
            } else {
              state.favorites.unshift(newFavorite)
            }
          })
          // 在 set 外部调用 _applyFilters
          get()._applyFilters()
        },

        addFavorites: (items: (TmdbMediaItem | VideoItem)[]) => {
          set(state => {
            items.forEach(item => {
              if ('mediaType' in item) {
                // TMDB item
                const existingId = generateTmdbFavoriteId(item.id, item.mediaType)
                if (!state.favorites.find(f => f.id === existingId)) {
                  const newFavorite: TmdbFavoriteItem = {
                    id: existingId,
                    addedAt: Date.now(),
                    updatedAt: Date.now(),
                    sourceType: 'tmdb',
                    watchStatus: FavoriteWatchStatus.NOT_WATCHED,
                    tags: [],
                    media: createTmdbMediaSnapshot(item),
                  }
                  state.favorites.push(newFavorite)
                }
              } else {
                // CMS item
                const sourceCode = item.source_code || ''
                const existingId = generateCmsFavoriteId(item.vod_id, sourceCode)
                if (!state.favorites.find(f => f.id === existingId)) {
                  const newFavorite: CmsFavoriteItem = {
                    id: existingId,
                    addedAt: Date.now(),
                    updatedAt: Date.now(),
                    sourceType: 'cms',
                    watchStatus: FavoriteWatchStatus.NOT_WATCHED,
                    tags: [],
                    media: createCmsMediaSnapshot(item),
                  }
                  state.favorites.push(newFavorite)
                }
              }
            })

            // 按 addedAt 降序排序
            state.favorites.sort((a, b) => b.addedAt - a.addedAt)
          })
          // 在 set 外部调用 _applyFilters
          get()._applyFilters()
        },

        removeFavorite: (id: string) => {
          set(state => {
            state.favorites = state.favorites.filter(f => f.id !== id)
          })
          get()._applyFilters()
        },

        removeFavorites: (ids: string[]) => {
          set(state => {
            const idSet = new Set(ids)
            state.favorites = state.favorites.filter(f => !idSet.has(f.id))
          })
          get()._applyFilters()
        },

        clearFavorites: () => {
          set(state => {
            state.favorites = []
          })
          get()._applyFilters()
        },

        // === 状态管理实现 ===

        updateWatchStatus: (id: string, status: FavoriteWatchStatus) => {
          set(state => {
            const item = state.favorites.find(f => f.id === id)
            if (item) {
              item.watchStatus = status
              item.updatedAt = Date.now()
            }
          })
          get()._applyFilters()
        },

        updateWatchStatusBulk: (ids: string[], status: FavoriteWatchStatus) => {
          set(state => {
            const idSet = new Set(ids)
            state.favorites.forEach(f => {
              if (idSet.has(f.id)) {
                f.watchStatus = status
                f.updatedAt = Date.now()
              }
            })
          })
          get()._applyFilters()
        },

        setRating: (id: string, rating: number) => {
          set(state => {
            const item = state.favorites.find(f => f.id === id)
            if (item) {
              item.rating = Math.max(1, Math.min(5, rating))
              item.updatedAt = Date.now()
            }
          })
          get()._applyFilters()
        },

        setNotes: (id: string, notes: string) => {
          set(state => {
            const item = state.favorites.find(f => f.id === id)
            if (item) {
              item.notes = notes
              item.updatedAt = Date.now()
            }
          })
          get()._applyFilters()
        },

        addTag: (id: string, tag: string) => {
          set(state => {
            const item = state.favorites.find(f => f.id === id)
            if (item && !item.tags.includes(tag)) {
              item.tags.push(tag)
              item.updatedAt = Date.now()
            }
          })
          get()._applyFilters()
        },

        removeTag: (id: string, tag: string) => {
          set(state => {
            const item = state.favorites.find(f => f.id === id)
            if (item) {
              item.tags = item.tags.filter(t => t !== tag)
              item.updatedAt = Date.now()
            }
          })
          get()._applyFilters()
        },

        // === 查询实现 ===

        isTmdbFavorited: (tmdbId: number, mediaType: 'movie' | 'tv') => {
          const id = generateTmdbFavoriteId(tmdbId, mediaType)
          return get().favorites.some(f => f.id === id)
        },

        isCmsFavorited: (vodId: string, sourceCode: string) => {
          const id = generateCmsFavoriteId(vodId, sourceCode)
          return get().favorites.some(f => f.id === id)
        },

        getTmdbFavorite: (tmdbId: number, mediaType: 'movie' | 'tv') => {
          const id = generateTmdbFavoriteId(tmdbId, mediaType)
          return get().favorites.find(f => f.id === id) as TmdbFavoriteItem
        },

        getCmsFavorite: (vodId: string, sourceCode: string) => {
          const id = generateCmsFavoriteId(vodId, sourceCode)
          return get().favorites.find(f => f.id === id) as CmsFavoriteItem
        },

        toggleTmdbFavorite: (media: TmdbMediaItem) => {
          const existingId = generateTmdbFavoriteId(media.id, media.mediaType)
          const exists = get().isTmdbFavorited(media.id, media.mediaType)

          if (exists) {
            get().removeFavorite(existingId)
          } else {
            get().addTmdbFavorite(media)
          }
        },

        toggleCmsFavorite: (video: VideoItem) => {
          const sourceCode = video.source_code || ''
          const exists = get().isCmsFavorited(video.vod_id, sourceCode)

          if (exists) {
            const id = generateCmsFavoriteId(video.vod_id, sourceCode)
            get().removeFavorite(id)
          } else {
            get().addCmsFavorite(video)
          }
        },

        // === 筛选实现 ===

        setFilter: (options: Partial<FavoriteFilterOptions>) => {
          set(state => {
            state.filterOptions = { ...state.filterOptions, ...options }
          })
          get()._applyFilters()
        },

        clearFilter: () => {
          set(state => {
            state.filterOptions = {
              sourceType: 'all',
              watchStatus: 'all',
              sortBy: 'addedAt',
              sortOrder: 'desc',
            }
          })
          get()._applyFilters()
        },

        _applyFilters: () => {
          set({ filteredFavorites: applyFavoriteFilters(get().favorites, get().filterOptions) })
        },

        // === 统计实现 ===

        getStats: () => {
          const favorites = get().favorites
          const stats: FavoriteStats = {
            total: favorites.length,
            tmdbCount: 0,
            cmsCount: 0,
            notWatchedCount: 0,
            watchingCount: 0,
            completedCount: 0,
          }

          favorites.forEach(f => {
            if (f.sourceType === 'tmdb') stats.tmdbCount++
            else stats.cmsCount++

            switch (f.watchStatus) {
              case FavoriteWatchStatus.NOT_WATCHED:
                stats.notWatchedCount++
                break
              case FavoriteWatchStatus.WATCHING:
                stats.watchingCount++
                break
              case FavoriteWatchStatus.COMPLETED:
                stats.completedCount++
                break
            }
          })

          return stats
        },

        getAllTags: () => {
          const favorites = get().favorites
          const tagSet = new Set<string>()
          favorites.forEach(f => {
            f.tags.forEach(tag => tagSet.add(tag))
          })
          return Array.from(tagSet).sort()
        },

        // === 批量操作实现 ===

        /** 全选当前筛选后的收藏项 */
        selectAllFiltered: () => {
          set(state => {
            state.filteredFavorites.forEach(f => {
              // 只更新不在已选中集合中的项
              if (!state.selectedIds?.has(f.id)) {
                state.selectedIds?.add(f.id)
              }
            })
          })
        },

        /** 取消全选 */
        deselectAll: () => {
          set(state => {
            state.selectedIds?.clear()
          })
        },

        /** 设置选中 ID 集合 */
        setSelectedIds: (ids: Set<string>) => {
          set(state => {
            state.selectedIds = ids
          })
        },
      })),
      {
        name: 'ouonnki-tv-favorites-store',
        version: 2,
        partialize: state => ({ favorites: state.favorites }),
        migrate: persistedState => {
          const state = persistedState as Partial<FavoritesState> | undefined
          return {
            favorites: Array.isArray(state?.favorites) ? state.favorites : [],
          }
        },
        onRehydrateStorage: () => state => {
          state?._applyFilters()
        },
      },
    ),
    {
      name: 'FavoritesStore',
    },
  ),
)
