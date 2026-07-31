import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import { buildCmsPlayPath, buildTmdbPlayPath } from '@/shared/lib/routes'
import { toast } from 'sonner'
import type { PlayerSourceOption } from './useTmdbPlayback'

interface UsePlayerNavigationParams {
  isCmsRoute: boolean
  isTmdbRoute: boolean
  tmdbMediaType: TmdbMediaType | null
  parsedTmdbId: number
  selectedEpisode: number
  resolvedSourceCode: string
  resolvedVodId: string
  routeSourceCode: string
  routeVodId: string
  sourceOptions: PlayerSourceOption[]
  tmdbPlayback: {
    selectedSeasonNumber: number | null
    sourceOptions: PlayerSourceOption[]
    getSourceOptionsForSeason: (seasonNumber: number) => PlayerSourceOption[]
  }
}

/**
 * 播放页导航动作：切源 / 切季 / 切语言，统一跳转对应路由
 * @returns 各 handler + 当前播放路径构建函数
 */
export function usePlayerNavigation({
  isCmsRoute,
  isTmdbRoute,
  tmdbMediaType,
  parsedTmdbId,
  selectedEpisode,
  resolvedSourceCode,
  resolvedVodId,
  routeSourceCode,
  routeVodId,
  sourceOptions,
  tmdbPlayback,
}: UsePlayerNavigationParams) {
  const navigate = useNavigate()

  const buildCurrentPlayPath = useCallback(
    (
      episodeIndex: number,
      options?: { sourceCode?: string; vodId?: string; seasonNumber?: number },
    ) => {
      if (isCmsRoute) return buildCmsPlayPath(routeSourceCode, routeVodId, episodeIndex)
      if (isTmdbRoute && tmdbMediaType) {
        return buildTmdbPlayPath(tmdbMediaType, parsedTmdbId, {
          sourceCode: options?.sourceCode || resolvedSourceCode,
          vodId: options?.vodId || resolvedVodId,
          episodeIndex,
          seasonNumber: options?.seasonNumber ?? tmdbPlayback.selectedSeasonNumber ?? undefined,
        })
      }
      return buildCmsPlayPath(resolvedSourceCode, resolvedVodId, episodeIndex)
    },
    [
      isCmsRoute,
      isTmdbRoute,
      resolvedSourceCode,
      resolvedVodId,
      routeSourceCode,
      routeVodId,
      parsedTmdbId,
      tmdbMediaType,
      tmdbPlayback.selectedSeasonNumber,
    ],
  )

  const handleSourceChange = useCallback(
    (sourceCode: string) => {
      if (isTmdbRoute && tmdbMediaType) {
        const next = tmdbPlayback.sourceOptions.find(o => o.sourceCode === sourceCode)
        if (!next?.bestVodId) return
        navigate(
          buildTmdbPlayPath(tmdbMediaType, parsedTmdbId, {
            sourceCode: next.sourceCode,
            vodId: next.bestVodId,
            episodeIndex: selectedEpisode,
            seasonNumber: tmdbPlayback.selectedSeasonNumber || undefined,
          }),
          { replace: true },
        )
        return
      }
      if (isCmsRoute) {
        const next = sourceOptions.find(o => o.sourceCode === sourceCode)
        if (!next?.bestVodId) return
        navigate(buildCmsPlayPath(next.sourceCode, next.bestVodId, selectedEpisode), {
          replace: true,
        })
      }
    },
    [
      isTmdbRoute,
      isCmsRoute,
      navigate,
      parsedTmdbId,
      selectedEpisode,
      tmdbMediaType,
      tmdbPlayback.selectedSeasonNumber,
      tmdbPlayback.sourceOptions,
      sourceOptions,
    ],
  )

  const handleSeasonChange = (seasonNumber: number) => {
    if (!isTmdbRoute || tmdbMediaType !== 'tv') return
    const seasonSources = tmdbPlayback.getSourceOptionsForSeason(seasonNumber)
    if (seasonSources.length === 0) {
      toast.error('该季暂无可用源')
      return
    }
    const preferred =
      seasonSources.find(o => o.sourceCode === resolvedSourceCode) || seasonSources[0]
    navigate(
      buildTmdbPlayPath('tv', parsedTmdbId, {
        sourceCode: preferred.sourceCode,
        vodId: preferred.bestVodId,
        episodeIndex: 0,
        seasonNumber,
      }),
      { replace: true },
    )
  }

  const handleLanguageChange = useCallback(
    (vodId: string, _label: string) => {
      if (isTmdbRoute && tmdbMediaType) {
        navigate(
          buildTmdbPlayPath(tmdbMediaType, parsedTmdbId, {
            sourceCode: resolvedSourceCode,
            vodId,
            episodeIndex: selectedEpisode,
            seasonNumber: tmdbPlayback.selectedSeasonNumber || undefined,
          }),
          { replace: true },
        )
        return
      }
      if (isCmsRoute) {
        navigate(buildCmsPlayPath(resolvedSourceCode || '', vodId, selectedEpisode), {
          replace: true,
        })
      }
    },
    [
      isTmdbRoute,
      isCmsRoute,
      navigate,
      parsedTmdbId,
      resolvedSourceCode,
      selectedEpisode,
      tmdbMediaType,
      tmdbPlayback.selectedSeasonNumber,
    ],
  )

  return {
    buildCurrentPlayPath,
    handleSourceChange,
    handleSeasonChange,
    handleLanguageChange,
  }
}
