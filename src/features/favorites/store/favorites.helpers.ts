import type { FavoriteItem, TmdbFavoriteItem, CmsFavoriteItem } from '../types/favorites'
import type { TmdbMediaItem } from '@/shared/types/tmdb'
import type { VideoItem } from '@/shared/types/video'

/**
 * 生成 TMDB 收藏项的唯一标识
 */
export function generateTmdbFavoriteId(tmdbId: number, mediaType: 'movie' | 'tv'): string {
  return `tmdb_${mediaType}_${tmdbId}`
}

/**
 * 字符串转 Base64（UTF-8 安全，分块避免栈溢出）
 */
function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }

  return btoa(binary)
}

/**
 * 生成 CMS 收藏项的唯一标识
 */
export function generateCmsFavoriteId(vodId: string, sourceCode: string): string {
  const combined = `${sourceCode}::${vodId}`
  return `cms_${utf8ToBase64(combined)}`
}

/**
 * 从 TmdbMediaItem 创建轻量化媒体快照
 */
export function createTmdbMediaSnapshot(media: TmdbMediaItem): TmdbFavoriteItem['media'] {
  return {
    id: media.id,
    mediaType: media.mediaType,
    title: media.title,
    originalTitle: media.originalTitle,
    posterPath: media.posterPath,
    backdropPath: media.backdropPath,
    releaseDate: media.releaseDate,
    voteAverage: media.voteAverage,
  }
}

/**
 * 从 VideoItem 创建轻量化媒体快照
 */
export function createCmsMediaSnapshot(video: VideoItem): CmsFavoriteItem['media'] {
  return {
    vodId: video.vod_id,
    vodName: video.vod_name,
    vodPic: video.vod_pic,
    typeName: video.type_name,
    vodYear: video.vod_year,
    vodArea: video.vod_area,
    sourceCode: video.source_code || '',
    sourceName: video.source_name || '',
  }
}

/** 获取收藏项标题（用于名称排序） */
export function getFavoriteTitle(item: FavoriteItem): string {
  return item.sourceType === 'tmdb' ? item.media.title : item.media.vodName
}

/** 获取收藏项评分（排序值，优先用户评分） */
export function getFavoriteRatingValue(item: FavoriteItem): number {
  if (item.rating !== undefined) return item.rating
  if (item.sourceType === 'tmdb') return item.media.voteAverage ?? 0
  return 0
}

/** 获取收藏项上映日期时间戳（排序值） */
export function getFavoriteReleaseDateValue(item: FavoriteItem): number {
  if (item.sourceType !== 'tmdb' || !item.media.releaseDate) return 0
  const timestamp = new Date(item.media.releaseDate).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}
