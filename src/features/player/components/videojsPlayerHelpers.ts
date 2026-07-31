import { isTmdbHistoryItem } from '@/shared/lib/viewingHistory'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import type { ViewingHistoryItem } from '@/shared/types'

/** 播放页路由参数（/play/:type/:tmdbId/:sourceCode/:vodId） */
export interface PlayerRouteParams {
  [key: string]: string | undefined
  type?: string
  tmdbId?: string
  sourceCode?: string
  vodId?: string
}

/**
 * 解析路由 ep 参数为集数索引，非法值回退 0
 */
export const parseEpisodeIndex = (value: string | null): number => {
  const parsed = Number.parseInt(value || '0', 10)
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
}

/**
 * 解析正整数路由参数，非法/非正数返回 null
 */
export const parsePositiveNumber = (value: string | null): number | null => {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed) || parsed <= 0) return null
  return parsed
}

/**
 * 生成详情请求 key，用于跳过重复请求
 */
export const buildDetailRequestKey = (sourceCode: string, vodId: string) =>
  `${sourceCode}::${vodId}`

/**
 * 去掉 CMS 富文本描述中的 HTML 标签与 HTML 实体
 */
export const stripHtmlTags = (value: string) => {
  const stripped = value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return stripped
}

/**
 * 判断历史记录是否匹配当前 TMDB 媒体（剧集需季号一致）
 */
export const matchesTmdbHistory = (
  item: ViewingHistoryItem,
  mediaType: TmdbMediaType,
  tmdbId: number,
  seasonNumber: number | null,
) => {
  if (!isTmdbHistoryItem(item)) return false
  if (item.tmdbMediaType !== mediaType || item.tmdbId !== tmdbId) return false
  if (mediaType === 'tv') return (item.tmdbSeasonNumber ?? null) === seasonNumber
  return true
}

/** TMDB 搜索页路由（成人内容拦截的返回目标） */
export const TMDB_SEARCH_PATH = '/search?mode=tmdb'

// 分辨率标签 → Tailwind 背景色
/** 分辨率标签 → 徽章背景色 class 映射 */
export const RES_COLORS: Record<string, string> = {
  '8K': 'bg-rose-500',
  '4K': 'bg-amber-500',
  '2K': 'bg-emerald-500',
  '1080P': 'bg-green-500',
  '720P': 'bg-teal-500',
  '540P': 'bg-cyan-500',
  '480P': 'bg-sky-500',
  '360P': 'bg-gray-500',
  '240P': 'bg-gray-500',
}
