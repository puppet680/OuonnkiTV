import { useMemo } from 'react'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import type { ViewingHistoryItem } from '@/shared/types'
import { matchesTmdbHistory } from '../components/videojsPlayerHelpers'

interface UsePlayerEpisodeProgressParams {
  viewingHistory: ViewingHistoryItem[]
  resolvedSourceCode: string
  resolvedVodId: string
  canUseTmdbHistory: boolean
  tmdbMediaType: TmdbMediaType | null
  parsedTmdbId: number
  tmdbSeasonNumberForHistory: number | null
  isViewingHistoryVisible: boolean
}

/**
 * 计算各集播放进度百分比（TMDB 模式合并 TMDB 与 CMS 两条历史线）
 * @returns episodeIndex → 进度百分比(0-100) 的映射；历史不可见或无源时返回 null
 */
export function usePlayerEpisodeProgress({
  viewingHistory,
  resolvedSourceCode,
  resolvedVodId,
  canUseTmdbHistory,
  tmdbMediaType,
  parsedTmdbId,
  tmdbSeasonNumberForHistory,
  isViewingHistoryVisible,
}: UsePlayerEpisodeProgressParams) {
  return useMemo(() => {
    if (!isViewingHistoryVisible || !resolvedSourceCode || !resolvedVodId) return null

    const append = (
      map: Map<number, { progress: number; timestamp: number }>,
      item: ViewingHistoryItem,
    ) => {
      const progress =
        item.duration > 0
          ? Math.min(100, Math.max(0, (item.playbackPosition / item.duration) * 100))
          : 0
      const prev = map.get(item.episodeIndex)
      if (!prev || item.timestamp > prev.timestamp)
        map.set(item.episodeIndex, { progress, timestamp: item.timestamp })
    }

    if (canUseTmdbHistory && tmdbMediaType) {
      const tmdbMap = new Map<number, { progress: number; timestamp: number }>()
      const cmsMap = new Map<number, { progress: number; timestamp: number }>()
      for (const item of viewingHistory) {
        if (matchesTmdbHistory(item, tmdbMediaType, parsedTmdbId, tmdbSeasonNumberForHistory)) {
          append(tmdbMap, item)
        } else if (
          item.recordType === 'cms' &&
          item.sourceCode === resolvedSourceCode &&
          item.vodId === resolvedVodId
        ) {
          append(cmsMap, item)
        }
      }
      const merged = new Map<number, number>()
      tmdbMap.forEach((v, i) => merged.set(i, v.progress))
      cmsMap.forEach((v, i) => {
        if (!merged.has(i)) merged.set(i, v.progress)
      })
      return merged
    }

    const map = new Map<number, { progress: number; timestamp: number }>()
    for (const item of viewingHistory) {
      if (item.sourceCode === resolvedSourceCode && item.vodId === resolvedVodId) append(map, item)
    }
    const result = new Map<number, number>()
    map.forEach((v, i) => result.set(i, v.progress))
    return result
  }, [
    canUseTmdbHistory,
    isViewingHistoryVisible,
    parsedTmdbId,
    resolvedSourceCode,
    resolvedVodId,
    tmdbMediaType,
    tmdbSeasonNumberForHistory,
    viewingHistory,
  ])
}
