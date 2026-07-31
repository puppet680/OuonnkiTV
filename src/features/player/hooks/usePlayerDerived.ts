import { useMemo } from 'react'
import type { DetailResult } from '@ouonnki/cms-core'
import { getCmsSources } from '@/features/search/hooks/directSearch.utils'
import { getCertShort, type TmdbRichDetail } from '@/features/media/components'
import { normalizeProxyPrefix } from '@/shared/config/api.config'
import { buildTmdbDetailPath } from '@/shared/lib/routes'
import type { TmdbMediaItem, TmdbMediaType } from '@/shared/types/tmdb'
import { stripHtmlTags } from '../components/videojsPlayerHelpers'
import type { PlayerSourceOption } from './useTmdbPlayback'
import type { CmsMatchedSource } from './usePlayerCmsMatch'

interface UsePlayerDerivedParams {
  isCmsRoute: boolean
  isTmdbRoute: boolean
  tmdbMediaType: TmdbMediaType | null
  parsedTmdbId: number
  routeSourceCode: string
  resolvedSourceCode: string
  resolvedVodId: string
  detail: DetailResult | null
  sourceConfig: { name?: string } | undefined
  cmsMatchedSources: CmsMatchedSource[]
  sourceOptions: PlayerSourceOption[]
  network: { isProxyEnabled: boolean; proxyUrl: string }
  selectedEpisode: number
  fallbackRecommendations: TmdbMediaItem[]
  tmdbRecommendations: TmdbMediaItem[]
  tmdbDetail: TmdbRichDetail | null
  tmdbRichDetail: TmdbRichDetail | null
}

interface UsePlayerDerivedResult {
  sourceOptions: PlayerSourceOption[]
  title: string
  heroTitle: string
  sourceName: string
  overview: string
  certShort: string
  recommendationItems: TmdbMediaItem[]
  detailLink: string | undefined
  seasonCount: number | undefined
  episodeCount: number | undefined
  hasSeasonPanel: boolean
  languageOptions: Array<{ vodId: string; label: string; score: number }>
  bestSourceOption: PlayerSourceOption | null
  shouldShowBetterSource: boolean
  proxiedEpisodeUrl: string | null
  playerKey: string
}

/**
 * 播放页纯派生数据：源选项、标题/描述、推荐、语言、更优源提示、代理 URL
 */
export function usePlayerDerived({
  isCmsRoute,
  isTmdbRoute,
  tmdbMediaType,
  parsedTmdbId,
  routeSourceCode,
  resolvedSourceCode,
  resolvedVodId,
  detail,
  sourceConfig,
  cmsMatchedSources,
  sourceOptions,
  network,
  selectedEpisode,
  fallbackRecommendations,
  tmdbRecommendations,
  tmdbDetail,
  tmdbRichDetail,
}: UsePlayerDerivedParams): UsePlayerDerivedResult {
  const mergedSourceOptions = useMemo(() => {
    if (isTmdbRoute) return sourceOptions
    const sourceName =
      detail?.videoInfo?.source_name ||
      sourceConfig?.name ||
      routeSourceCode ||
      resolvedSourceCode ||
      '直连源'
    // Merge stored CMS sources + matched sources
    const storedSources = getCmsSources(detail?.videoInfo?.title || '')
    const allExtra = [...storedSources, ...cmsMatchedSources]
    const extraOptions = allExtra
      .filter(s => s.sourceCode !== resolvedSourceCode)
      .map(s => ({
        sourceCode: s.sourceCode,
        sourceName: s.sourceName,
        bestVodId: s.vodId,
        bestScore: 0,
        bestLabel: '',
        bestQuality: '',
        alternatives: [],
      }))
    return [
      {
        sourceCode: resolvedSourceCode,
        sourceName,
        bestVodId: resolvedVodId,
        bestScore: 0,
        bestLabel: '',
        bestQuality: '',
        alternatives: [],
      },
      ...extraOptions,
    ]
  }, [
    isTmdbRoute,
    sourceOptions,
    detail?.videoInfo?.source_name,
    detail?.videoInfo?.title,
    sourceConfig?.name,
    routeSourceCode,
    resolvedSourceCode,
    resolvedVodId,
    cmsMatchedSources,
  ])

  const title = detail?.videoInfo?.title || tmdbDetail?.title || '未知视频'
  const heroTitle = tmdbDetail?.title || detail?.videoInfo?.title || '未知视频'
  const sourceName =
    detail?.videoInfo?.source_name ||
    mergedSourceOptions.find(o => o.sourceCode === resolvedSourceCode)?.sourceName ||
    '未知来源'
  const rawOverview = tmdbDetail?.overview || detail?.videoInfo?.desc || ''
  const overview = isCmsRoute ? stripHtmlTags(rawOverview) : rawOverview
  const certShort = getCertShort(
    tmdbDetail?.adult,
    tmdbDetail?.release_dates,
    tmdbDetail?.content_ratings,
  )

  const recommendationItems = isTmdbRoute
    ? tmdbRecommendations.length > 0
      ? tmdbRecommendations
      : fallbackRecommendations
    : []
  const detailLink =
    isTmdbRoute && tmdbMediaType ? buildTmdbDetailPath(tmdbMediaType, parsedTmdbId) : undefined
  const seasonCount =
    tmdbMediaType === 'tv'
      ? tmdbRichDetail?.number_of_seasons || sourceOptions.length
      : undefined
  const episodeCount =
    tmdbMediaType === 'tv'
      ? tmdbRichDetail?.number_of_episodes || detail?.episodes.length
      : undefined
  const hasSeasonPanel = !isCmsRoute && sourceOptions.length > 0

  const languageOptions = useMemo(() => {
    const current = mergedSourceOptions.find(o => o.sourceCode === resolvedSourceCode)
    if (!current) return []
    const all = [
      { vodId: current.bestVodId, label: current.bestLabel || '默认', score: current.bestScore },
      ...current.alternatives,
    ]
    return all.filter((a, i, arr) => a.label && arr.findIndex(x => x.vodId === a.vodId) === i)
  }, [mergedSourceOptions, resolvedSourceCode])

  const bestSourceOption = useMemo(() => {
    if (!isTmdbRoute || mergedSourceOptions.length === 0) return null
    return mergedSourceOptions.reduce(
      (best, o) => (o.bestScore > best.bestScore ? o : best),
      mergedSourceOptions[0],
    )
  }, [isTmdbRoute, mergedSourceOptions])

  const currentSourceScore =
    mergedSourceOptions.find(o => o.sourceCode === resolvedSourceCode)?.bestScore ?? -1
  const shouldShowBetterSource = Boolean(
    isTmdbRoute &&
      bestSourceOption &&
      bestSourceOption.sourceCode !== resolvedSourceCode &&
      bestSourceOption.bestScore > currentSourceScore,
  )

  // Video.js player URL（m3u8 走代理）
  const rawEpisodeUrl = detail?.episodes?.[selectedEpisode] ?? null
  const proxyPrefix =
    network.isProxyEnabled && network.proxyUrl && network.proxyUrl !== '/proxy?url='
      ? normalizeProxyPrefix(network.proxyUrl)
      : ''
  const proxiedEpisodeUrl =
    rawEpisodeUrl && proxyPrefix ? proxyPrefix + encodeURIComponent(rawEpisodeUrl) : rawEpisodeUrl
  // ponytail: 不含 selectedEpisode — 切集时保持 Player.Provider 挂载，不退出全屏
  const playerKey = `${resolvedSourceCode}:${resolvedVodId}`

  return {
    sourceOptions: mergedSourceOptions,
    title,
    heroTitle,
    sourceName,
    overview,
    certShort,
    recommendationItems,
    detailLink,
    seasonCount,
    episodeCount,
    hasSeasonPanel,
    languageOptions,
    bestSourceOption,
    shouldShowBetterSource,
    proxiedEpisodeUrl,
    playerKey,
  }
}
