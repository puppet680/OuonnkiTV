import type { VideoSource, VideoItem } from '@ouonnki/cms-core'

export interface SourcePaginationInfo {
  totalPages: number
  totalResults: number
}

export interface CmsPlaySourceEntry {
  sourceCode: string
  vodId: string
  sourceName: string
}

export interface AggregatedVideoItem {
  vod_name: string
  vod_pic?: string
  vod_year?: string
  vod_douban_score?: number
  type_name?: string
  /** 聚合后的来源列表，按豆瓣评分降序 */
  sources: VideoItem[]
  /** 最佳源（评分最高或第一个） */
  bestSource: VideoItem
  /** 来源数量 */
  sourceCount: number
}

// ==================== 内存 Store：片名 → 源列表映射 ====================
const cmsSourceCache = new Map<string, CmsPlaySourceEntry[]>()

export function storeCmsSources(title: string, sources: CmsPlaySourceEntry[]): void {
  cmsSourceCache.set(title, sources)
}

export function getCmsSources(title: string): CmsPlaySourceEntry[] {
  return cmsSourceCache.get(title) || []
}

/**
 * 按片名聚合同名结果，取评分最高的源作为 bestSource
 */
export function aggregateByTitle(items: VideoItem[]): AggregatedVideoItem[] {
  const map = new Map<string, VideoItem[]>()

  for (const item of items) {
    const key = item.vod_name.trim()
    const bucket = map.get(key)
    if (bucket) {
      bucket.push(item)
    } else {
      map.set(key, [item])
    }
  }

  const aggregated: AggregatedVideoItem[] = []
  for (const [, bucket] of map) {
    // 去重：同源同 vodId 只保留一条
    const seen = new Set<string>()
    const deduped: VideoItem[] = []
    for (const item of bucket) {
      const key = `${item.source_code || ''}:${item.vod_id || ''}`
      if (!seen.has(key)) {
        seen.add(key)
        deduped.push(item)
      }
    }
    deduped.sort((a, b) => {
      const sa = typeof a.vod_douban_score === 'number' ? a.vod_douban_score : parseFloat(a.vod_douban_score || '0')
      const sb = typeof b.vod_douban_score === 'number' ? b.vod_douban_score : parseFloat(b.vod_douban_score || '0')
      return sb - sa
    })
    const first = deduped[0]
    aggregated.push({
      vod_name: first.vod_name,
      vod_pic: first.vod_pic,
      vod_year: first.vod_year,
      vod_douban_score: first.vod_douban_score !== undefined
        ? typeof first.vod_douban_score === 'number'
          ? first.vod_douban_score
          : parseFloat(first.vod_douban_score as string)
        : undefined,
      type_name: first.type_name,
      sources: deduped,
      bestSource: first,
      sourceCount: deduped.length,
    })
  }

  // 按评分降序
  aggregated.sort((a, b) => (b.vod_douban_score || 0) - (a.vod_douban_score || 0))

  return aggregated
}

export function getSourcesToFetch(
  selectedAPIs: VideoSource[],
  cachedSources: Map<string, SourcePaginationInfo>,
  page: number,
): VideoSource[] {
  return selectedAPIs.filter(source => {
    const cached = cachedSources.get(source.id)
    if (!cached) return true
    return page <= cached.totalPages
  })
}
