import type { FavoriteItem, FavoriteFilterOptions } from '../types/favorites'
import {
  getFavoriteTitle,
  getFavoriteRatingValue,
  getFavoriteReleaseDateValue,
} from './favorites.helpers'

/**
 * 收藏列表筛选与排序（来源/状态/标签/评分 + 排序），返回新数组
 * @param favorites - 全部收藏
 * @param options - 筛选条件
 * @returns 筛选并排序后的新数组
 */
export function applyFavoriteFilters(
  favorites: FavoriteItem[],
  options: FavoriteFilterOptions,
): FavoriteItem[] {
  let filtered = [...favorites]
  const { sourceType, watchStatus, tags, minRating, sortBy, sortOrder } = options

  if (sourceType && sourceType !== 'all') {
    filtered = filtered.filter(f => f.sourceType === sourceType)
  }
  if (watchStatus && watchStatus !== 'all') {
    filtered = filtered.filter(f => f.watchStatus === watchStatus)
  }
  if (tags && tags.length > 0) {
    filtered = filtered.filter(f => tags.some(tag => f.tags.includes(tag)))
  }
  if (minRating !== undefined && minRating > 0) {
    filtered = filtered.filter(f => f.rating !== undefined && f.rating >= minRating)
  }

  if (sortBy) {
    filtered.sort((a, b) => {
      if (sortBy === 'title') {
        const titleA = getFavoriteTitle(a)
        const titleB = getFavoriteTitle(b)
        return (sortOrder === 'asc' ? 1 : -1) * titleA.localeCompare(titleB, 'zh-CN')
      }

      let valA: number
      let valB: number
      switch (sortBy) {
        case 'updatedAt':
          valA = a.updatedAt
          valB = b.updatedAt
          break
        case 'rating':
          valA = getFavoriteRatingValue(a)
          valB = getFavoriteRatingValue(b)
          break
        case 'releaseDate':
          valA = getFavoriteReleaseDateValue(a)
          valB = getFavoriteReleaseDateValue(b)
          break
        case 'addedAt':
        default:
          valA = a.addedAt
          valB = b.addedAt
      }

      if (sortOrder === 'asc') return valA > valB ? 1 : valA < valB ? -1 : 0
      return valA < valB ? 1 : valA > valB ? -1 : 0
    })
  }

  return filtered
}
