import { useMemo } from 'react'
import { useApiStore } from '@/shared/store/apiStore'
import { useTmdbDetail } from '@/shared/hooks/useTmdb'
import type { TmdbMediaType, TmdbMovieDetail, TmdbTvDetail, TmdbMediaItem } from '@/shared/types/tmdb'
import {
  augmentSeasonsFromTitles,
  extractRecommendations,
  extractTranslationTitles,
  type SourceBestMatch,
  type TmdbRichDetail,
  usePlaylistMatches,
} from '@/features/media/components'

interface TmdbPlaybackParams {
  enabled: boolean
  mediaType: TmdbMediaType | null
  tmdbId: number
  querySourceCode: string
  queryVodId: string
  querySeasonNumber: number | null
}

export interface PlayerSourceOption {
  sourceCode: string
  sourceName: string
  bestVodId: string
  bestScore: number
  bestLabel: string
  bestQuality: string
  alternatives: { vodId: string; label: string; score: number }[]
}

export interface PlayerSeasonOption {
  seasonNumber: number
  seasonName: string
  matchedSourceCount: number
}

const LANG_PATTERN = /国语|日语|粤语|普通话|英语|台配|中配|日配|英配|国配|原声|配音|韩语|泰语|越南语|俄语|德语|法语|西语|葡语|意语/g
const QUALITY_PATTERN = /4K|2160[Pp]|1080[Pp]|720[Pp]|蓝光|超清|高清|HDR|杜比|Dolby|BD(?!\w)|TC|TS|CAM|DVD|HDTV|WEB-DL|HD|SCR|枪版/g

const extractLangLabel = (item: { vod_name?: string; type_name?: string }): string => {
  const text = `${item.vod_name || ''} ${item.type_name || ''}`
  const matches = text.match(LANG_PATTERN)
  return matches ? [...new Set(matches)].slice(0, 2).join('·') : ''
}

const extractQualityLabel = (item: { vod_name?: string; type_name?: string; vod_remarks?: string }): string => {
  const text = `${item.vod_name || ''} ${item.type_name || ''} ${item.vod_remarks || ''}`
  const matches = text.match(QUALITY_PATTERN)
  if (!matches) return ''
  const normalized = matches.map(m => m.toUpperCase().replace(/^BD$/i, '蓝光'))
  return [...new Set(normalized)].slice(0, 2).join(' ')
}

const toSourceOptions = (matches: SourceBestMatch[]): PlayerSourceOption[] => {
  return matches
    .filter(match => Boolean(match.bestMatch?.item.vod_id))
    .map(match => ({
      sourceCode: match.sourceCode,
      sourceName: match.sourceName,
      bestVodId: match.bestMatch?.item.vod_id || '',
      bestScore: match.bestMatch?.score || 0,
      bestLabel: extractLangLabel(match.bestMatch!.item),
      bestQuality: extractQualityLabel(match.bestMatch!.item),
      alternatives: match.alternatives
        .filter(a => a.score >= 80 && a.item.vod_id && extractLangLabel(a.item))
        .map(a => ({
          vodId: a.item.vod_id || '',
          label: extractLangLabel(a.item),
          score: a.score,
        })),
    }))
}

export function useTmdbPlayback({
  enabled,
  mediaType,
  tmdbId,
  querySourceCode,
  queryVodId,
  querySeasonNumber,
}: TmdbPlaybackParams) {
  const validTmdbId = Number.isInteger(tmdbId) && tmdbId > 0
  const shouldEnableTmdbPlayback = enabled && validTmdbId && Boolean(mediaType)
  const tmdbType = mediaType || 'movie'

  const { detail, loading, error } = useTmdbDetail<TmdbMovieDetail | TmdbTvDetail>(
    shouldEnableTmdbPlayback ? tmdbId : undefined,
    tmdbType,
  )

  const richDetail = detail as TmdbRichDetail | null

  const alternativeTitles = useMemo(() => {
    if (!detail) return []
    return extractTranslationTitles(
      richDetail?.alternative_titles,
      [detail.title, detail.originalTitle],
    ).map(entry => entry.title)
  }, [detail, richDetail?.alternative_titles])

  const seasons = useMemo(
    () =>
      mediaType === 'tv'
        ? augmentSeasonsFromTitles(
            (richDetail?.seasons || []).filter(season => season.season_number > 0),
            alternativeTitles,
          )
        : [],
    [mediaType, richDetail?.seasons, alternativeTitles],
  )

  const playlist = usePlaylistMatches({
    active: shouldEnableTmdbPlayback && Boolean(detail),
    tmdbType,
    tmdbId,
    title: detail?.title || '',
    alternativeTitles,
    releaseDate: detail?.releaseDate || '',
    seasons,
    originCountry: detail?.originCountry,
    genres: (detail as { genres?: Array<{ id: number; name: string }> } | null)?.genres,
  })

  const seasonSourceMap = useMemo(() => {
    const map = new Map<number, SourceBestMatch[]>()
    playlist.seasonSourceMatches.forEach(seasonMatch => {
      map.set(seasonMatch.season.season_number, seasonMatch.sourceMatches)
    })
    return map
  }, [playlist.seasonSourceMatches])

  const selectedSeasonNumber = useMemo(() => {
    if (mediaType !== 'tv' || seasons.length === 0) return null

    if (querySeasonNumber && seasons.some(season => season.season_number === querySeasonNumber)) {
      return querySeasonNumber
    }

    // querySeasonNumber 在 seasons 中找不到时（如补全季尚未生成），
    // 返回 querySeasonNumber 而不是 fallback，避免错误 navigate
    if (querySeasonNumber) {
      return querySeasonNumber
    }

    const firstPlayableSeason = playlist.seasonSourceMatches.find(seasonMatch =>
      seasonMatch.sourceMatches.some(sourceMatch => Boolean(sourceMatch.bestMatch)),
    )

    return firstPlayableSeason?.season.season_number || seasons[0].season_number
  }, [mediaType, playlist.seasonSourceMatches, querySeasonNumber, seasons])

  const activeSourceMatches = useMemo(() => {
    if (mediaType === 'movie') {
      return playlist.movieSourceMatches
    }

    if (mediaType === 'tv' && selectedSeasonNumber) {
      return seasonSourceMap.get(selectedSeasonNumber) || []
    }

    return []
  }, [mediaType, playlist.movieSourceMatches, seasonSourceMap, selectedSeasonNumber])

  const sourceOptions = useMemo(() => {
    const options = toSourceOptions(activeSourceMatches)

    // 如果 querySourceCode 不在 playlist 匹配结果中（如来自历史记录），
    // 也将其加入选项列表，避免后续自动切源逻辑找不到当前源
    if (querySourceCode && !options.some(o => o.sourceCode === querySourceCode)) {
      const apiSource = useApiStore.getState().videoAPIs.find(api => api.id === querySourceCode)
      if (apiSource && apiSource.isEnabled) {
        options.push({
          sourceCode: querySourceCode,
          sourceName: apiSource.name || querySourceCode,
          bestVodId: queryVodId || '',
          bestScore: 0,
          bestLabel: '',
          bestQuality: '',
          alternatives: [],
        })
      }
    }

    return options
  }, [activeSourceMatches, querySourceCode, queryVodId])

  const selectedSource = useMemo(() => {
    if (sourceOptions.length === 0) return null
    const matchedFromQuery = sourceOptions.find(option => option.sourceCode === querySourceCode)
    return matchedFromQuery || sourceOptions[0]
  }, [querySourceCode, sourceOptions])

  const resolvedSourceCode = selectedSource?.sourceCode || ''
  const resolvedVodId = selectedSource?.bestVodId || ''

  const seasonOptions = useMemo<PlayerSeasonOption[]>(() => {
    if (mediaType !== 'tv') return []

    return seasons.map(season => {
      const sourceMatches = seasonSourceMap.get(season.season_number) || []
      const matchedSourceCount = sourceMatches.filter(m => m.bestMatch !== null).length

      return {
        seasonNumber: season.season_number,
        seasonName: season.name || `第 ${season.season_number} 季`,
        matchedSourceCount,
      }
    })
  }, [mediaType, seasonSourceMap, seasons])

  const recommendations = useMemo<TmdbMediaItem[]>(() => {
    if (!richDetail || !mediaType) return []
    return extractRecommendations(richDetail, mediaType)
  }, [mediaType, richDetail])

  const getSourceOptionsForSeason = (seasonNumber: number) => {
    const matches = seasonSourceMap.get(seasonNumber) || []
    return toSourceOptions(matches)
  }

  return {
    tmdbDetail: detail,
    tmdbRichDetail: richDetail,
    tmdbLoading: loading,
    tmdbError: error,
    playlist,
    recommendations,
    seasonOptions,
    selectedSeasonNumber,
    sourceOptions,
    resolvedSourceCode,
    resolvedVodId,
    getSourceOptionsForSeason,
  }
}
