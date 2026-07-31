import type { TmdbMediaItem, TmdbFilterOptions } from '@/shared/types/tmdb'

/**
 * 成人关键词过滤（存量行为：开启时按关键词名单过滤标题/原名/简介）
 * @param items - 待过滤条目
 * @param isAdultFilterEnabled - 是否开启成人过滤
 * @param cmsFilterKeywords - 配置的关键词名单（环境变量优先）
 * @returns 过滤后的新数组
 */
export function filterAdultKeywords(
  items: TmdbMediaItem[],
  isAdultFilterEnabled: boolean,
  cmsFilterKeywords: string,
): TmdbMediaItem[] {
  if (!isAdultFilterEnabled) return items
  const rawKeywords: string = import.meta.env.OKI_CMS_FILTER_KEYWORDS || cmsFilterKeywords
  const keywords = rawKeywords.split(',').map(k => k.trim()).filter(Boolean)
  if (keywords.length === 0) return items
  return items.filter(item => {
    const haystack = [item.title, item.originalTitle, item.overview].filter(Boolean).join(' ')
    return !keywords.some(kw => haystack.includes(kw))
  })
}

/**
 * 客户端筛选（媒体类型/分类/评分/年份/产地/排序），返回新数组
 * 从 RQ 搜索结果派生时使用，不修改原数组
 * @param items - 待筛选条目
 * @param options - 筛选条件
 * @returns 筛选并排序后的新数组
 */
export function applyTmdbFilters(items: TmdbMediaItem[], options: TmdbFilterOptions): TmdbMediaItem[] {
  let filtered = [...items]

  if (options.mediaType && options.mediaType !== 'all') {
    filtered = filtered.filter(item => item.mediaType === options.mediaType)
  }
  if (options.genreIds && options.genreIds.length > 0) {
    filtered = filtered.filter(item => options.genreIds!.every(gid => item.genreIds.includes(gid)))
  }
  if (options.minVoteAverage && options.minVoteAverage > 0) {
    filtered = filtered.filter(item => item.voteAverage >= options.minVoteAverage!)
  }
  if (options.releaseYear) {
    filtered = filtered.filter(item => item.releaseDate?.startsWith(options.releaseYear!.toString()))
  }
  if (options.originCountry) {
    filtered = filtered.filter(item => item.originCountry.includes(options.originCountry!))
  }
  if (options.sortBy) {
    filtered.sort((a, b) => {
      let valA: number | string
      let valB: number | string
      switch (options.sortBy) {
        case 'vote_average':
          valA = a.voteAverage
          valB = b.voteAverage
          break
        case 'release_date':
          valA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0
          valB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0
          break
        case 'popularity':
        default:
          valA = a.popularity
          valB = b.popularity
          break
      }
      if (options.sortOrder === 'asc') return valA > valB ? 1 : valA < valB ? -1 : 0
      return valA < valB ? 1 : valA > valB ? -1 : 0
    })
  }
  return filtered
}
