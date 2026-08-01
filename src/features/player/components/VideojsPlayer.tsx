import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import '@videojs/react/video/skin.css'
import type { HlsConfig } from 'hls.js'
import { useApiStore } from '@/shared/store/apiStore'
import { useViewingHistoryStore } from '@/shared/store/viewingHistoryStore'
import { useSettingStore } from '@/shared/store/settingStore'
import { useDocumentTitle, useCmsClient } from '@/shared/hooks'
import { useTmdbEnabled } from '@/shared/hooks/useTmdbMode'
import { buildTmdbPlayPath } from '@/shared/lib/routes'
import { getBackdropUrl } from '@/shared/lib/tmdb'
import { useFavoritesStore } from '@/features/favorites/store/favoritesStore'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import type { VideoResolutionInfo } from '../lib/resolution-labels'
import { useTmdbRecommendations } from '@/shared/hooks/useTmdbRecommendations'
import { isAdultCert } from '@/features/media/components'
import {
  PlayerErrorState,
  PlayerHeroSection,
  PlayerInfoAndRecommendations,
  PlayerLoadingSkeleton,
} from '@/features/player/components'
import { useEpisodePagination, usePlayerSourceEpisodes, useTmdbPlayback } from '@/features/player/hooks'
import { usePlayerContextMenu } from '@/features/player/hooks/usePlayerContextMenu'
import { usePlayerDetailFetch } from '@/features/player/hooks/usePlayerDetailFetch'
import { usePlayerEpisodeProgress } from '@/features/player/hooks/usePlayerEpisodeProgress'
import { usePlayerCmsMatch } from '@/features/player/hooks/usePlayerCmsMatch'
import { usePlayerFavorites } from '@/features/player/hooks/usePlayerFavorites'
import { usePlayerNavigation } from '@/features/player/hooks/usePlayerNavigation'
import { usePlayerDerived } from '@/features/player/hooks/usePlayerDerived'
import { useSourceSpeedTest } from '../hooks/useSourceSpeedTest'
import { getAdFilterHlsConfig } from './videojsPlayerCore'
import {
  parseEpisodeIndex,
  parsePositiveNumber,
  TMDB_SEARCH_PATH,
  type PlayerRouteParams,
} from './videojsPlayerHelpers'
import { PlayerRightPanels } from './PlayerRightPanels'
import { PlayerVideoStage } from './PlayerVideoStage'
import { PlayerErrorRender } from './PlayerErrorRender'
import {
  buildTmdbSelectionScopeKey,
  derivePlayerViewState,
  getNextTmdbSelectionLock,
  resolvePlayerSelection,
  shouldFallbackEpisodeToFirst,
  type TmdbSelectionLock,
  validatePlayerRoute,
} from '@/features/player/lib'

// 模块级：跨导航追踪语言的 label（用 label 比对，vodId 可能不匹配）
let __lastSelectedLangLabel = ''

// ── component ──

/**
 * 播放页主组件：解析路由 → 拉取详情 → 组装播放器/右侧面板/推荐区
 * 支持 TMDB 智能模式与 CMS 直连模式，含换源/换季/选集/测速/收藏/右键菜单
 */
export default function VideojsPlayer() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const {
    type = '',
    tmdbId = '',
    sourceCode: routeSourceCode = '',
    vodId: routeVodId = '',
  } = useParams<PlayerRouteParams>()

  const cmsClient = useCmsClient()
  const tmdbEnabled = useTmdbEnabled()
  const { videoAPIs, adFilteringEnabled, setApiEnabled } = useApiStore()
  const { viewingHistory } = useViewingHistoryStore()
  const {
    playback,
    network,
    system: { isAdultFilterEnabled },
    setNetworkSettings,
  } = useSettingStore()

  const isCustomProxy = network.proxyUrl && network.proxyUrl !== '/proxy?url='
  const proxyStatus = isCustomProxy ? { usingProxy: network.isProxyEnabled, canToggle: true } : null

  const viewingHistoryRef = useRef(viewingHistory)
  const tmdbSelectionLockRef = useRef<TmdbSelectionLock | null>(null)

  useEffect(() => {
    viewingHistoryRef.current = viewingHistory
  }, [viewingHistory])

  const querySourceCode = searchParams.get('source') || ''
  const queryVodId = searchParams.get('id') || ''
  const querySeasonNumber = parsePositiveNumber(searchParams.get('season'))
  const episodeIndexParam = searchParams.get('ep')

  // ── route validation ──
  const routeValidation = useMemo(
    () => validatePlayerRoute({ type, tmdbId, sourceCode: routeSourceCode, vodId: routeVodId }),
    [routeSourceCode, routeVodId, tmdbId, type],
  )
  const isTmdbRoute = routeValidation.isValid && routeValidation.mode === 'tmdb'
  const isCmsRoute = routeValidation.isValid && routeValidation.mode === 'cms'
  const routeError = routeValidation.isValid ? null : routeValidation.message
  const tmdbMediaType: TmdbMediaType | null =
    routeValidation.isValid && routeValidation.mode === 'tmdb'
      ? routeValidation.tmdbMediaType
      : null
  const parsedTmdbId =
    routeValidation.isValid && routeValidation.mode === 'tmdb' ? routeValidation.tmdbId : 0

  // ── TMDB playback pipeline ──
  const tmdbPlayback = useTmdbPlayback({
    enabled: isTmdbRoute,
    mediaType: tmdbMediaType,
    tmdbId: parsedTmdbId,
    querySourceCode,
    queryVodId,
    querySeasonNumber,
  })

  const { recommendations: fallbackRecommendations } = useTmdbRecommendations()

  // ── state ──
  const [activeRightPanel, setActiveRightPanel] = useState<'episode' | 'source' | 'season' | null>(
    'episode',
  )
  const [resolutionInfo, setResolutionInfo] = useState<VideoResolutionInfo | null>(null)
  const [playerNotice, setPlayerNotice] = useState<string | null>(null)
  const playerNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showPlayerNotice = useCallback((msg: string, duration = 3000) => {
    setPlayerNotice(msg)
    if (playerNoticeTimerRef.current) clearTimeout(playerNoticeTimerRef.current)
    playerNoticeTimerRef.current = setTimeout(() => setPlayerNotice(null), duration)
  }, [])
  const [speedNotice, setSpeedNotice] = useState<string | null>(null)
  const handleSpeedChange = useCallback((rate: number) => {
    if (rate === 1) {
      setSpeedNotice(null)
    } else {
      setSpeedNotice(`${rate}x`)
    }
  }, [])
  const [seekPreview, setSeekPreview] = useState<string | null>(null)
  const handleSeekPreview = useCallback((time: number, duration: number) => {
    const fmt = (s: number) => {
      const m = Math.floor(s / 60)
      const sec = Math.floor(s % 60)
      return `${m}:${sec.toString().padStart(2, '0')}`
    }
    setSeekPreview(`${fmt(time)} / ${fmt(duration)}`)
  }, [])
  const handleSeekPreviewEnd = useCallback(() => setSeekPreview(null), [])
  const playerSectionRef = useRef<HTMLElement>(null)
  const selectedEpisode = parseEpisodeIndex(episodeIndexParam)

  // ── source resolution ──
  const currentTmdbSelectionScopeKey = buildTmdbSelectionScopeKey(
    tmdbMediaType,
    parsedTmdbId,
    querySeasonNumber,
  )
  const { resolvedSourceCode, resolvedVodId, hasExplicitTmdbSelection } = resolvePlayerSelection({
    isCmsRoute,
    isTmdbRoute,
    routeSourceCode,
    routeVodId,
    querySourceCode,
    queryVodId,
    tmdbResolvedSourceCode: tmdbPlayback.resolvedSourceCode,
    tmdbResolvedVodId: tmdbPlayback.resolvedVodId,
    currentScopeKey: currentTmdbSelectionScopeKey,
    lock: tmdbSelectionLockRef.current,
  })

  const canUseTmdbHistory = Boolean(
    isTmdbRoute && tmdbMediaType && Number.isInteger(parsedTmdbId) && parsedTmdbId > 0,
  )
  const tmdbSeasonNumberForHistory =
    tmdbMediaType === 'tv' ? (tmdbPlayback.selectedSeasonNumber ?? querySeasonNumber ?? null) : null

  const cmsFavoriteActive = useFavoritesStore(state =>
    isCmsRoute && resolvedVodId && resolvedSourceCode
      ? state.isCmsFavorited(resolvedVodId, resolvedSourceCode)
      : false,
  )
  const tmdbFavoriteActive = useFavoritesStore(state =>
    isTmdbRoute && tmdbMediaType && parsedTmdbId > 0
      ? state.isTmdbFavorited(parsedTmdbId, tmdbMediaType)
      : false,
  )

  const sourceConfig = useMemo(
    () => videoAPIs.find(api => api.id === resolvedSourceCode),
    [resolvedSourceCode, videoAPIs],
  )

  // ── TMDB selection lock ──
  useEffect(() => {
    if (!isTmdbRoute) {
      tmdbSelectionLockRef.current = null
      return
    }
    tmdbSelectionLockRef.current = getNextTmdbSelectionLock({
      isTmdbRoute,
      currentScopeKey: currentTmdbSelectionScopeKey,
      querySourceCode,
      queryVodId,
      tmdbResolvedSourceCode: tmdbPlayback.resolvedSourceCode,
      tmdbResolvedVodId: tmdbPlayback.resolvedVodId,
      lock: tmdbSelectionLockRef.current,
    })
  }, [
    currentTmdbSelectionScopeKey,
    isTmdbRoute,
    querySourceCode,
    queryVodId,
    tmdbPlayback.resolvedSourceCode,
    tmdbPlayback.resolvedVodId,
  ])

  // ── sync URL params to resolution ──
  useEffect(() => {
    if (!location.pathname.startsWith('/play/')) return
    if (!isTmdbRoute || !tmdbMediaType) return
    if (tmdbPlayback.tmdbLoading) return
    if (!tmdbPlayback.playlist.searched) return
    if (!resolvedSourceCode || !resolvedVodId) return

    const currentSeason = parsePositiveNumber(searchParams.get('season'))
    const targetSeason = tmdbPlayback.selectedSeasonNumber || null
    const episodeFromUrl = parseEpisodeIndex(episodeIndexParam)

    if (
      querySourceCode === resolvedSourceCode &&
      queryVodId === resolvedVodId &&
      currentSeason === targetSeason
    )
      return

    navigate(
      buildTmdbPlayPath(tmdbMediaType, parsedTmdbId, {
        sourceCode: resolvedSourceCode,
        vodId: resolvedVodId,
        episodeIndex: episodeFromUrl,
        seasonNumber: targetSeason || undefined,
      }),
      { replace: true },
    )
  }, [
    isTmdbRoute,
    querySourceCode,
    queryVodId,
    episodeIndexParam,
    location.pathname,
    navigate,
    searchParams,
    parsedTmdbId,
    tmdbMediaType,
    tmdbPlayback.playlist.searched,
    resolvedSourceCode,
    resolvedVodId,
    tmdbPlayback.selectedSeasonNumber,
    tmdbPlayback.tmdbLoading,
  ])

  // ── fetch detail ──
  const onTmdbDetailError = useCallback(() => {
    tmdbSelectionLockRef.current = null
    if (isTmdbRoute && tmdbMediaType) {
      navigate(
        buildTmdbPlayPath(tmdbMediaType, parsedTmdbId, {
          episodeIndex: selectedEpisode,
          seasonNumber: tmdbPlayback.selectedSeasonNumber || undefined,
        }),
        { replace: true },
      )
    }
  }, [
    isTmdbRoute,
    navigate,
    parsedTmdbId,
    selectedEpisode,
    tmdbMediaType,
    tmdbPlayback.selectedSeasonNumber,
  ])

  const { detail, loading, error, allExhausted, isDetailRefreshing, setAllExhausted } =
    usePlayerDetailFetch({
      cmsClient,
      routeError,
      isTmdbRoute,
      tmdbMediaType,
      resolvedSourceCode,
      resolvedVodId,
      hasExplicitTmdbSelection,
      sourceConfig,
      tmdbLoading: tmdbPlayback.tmdbLoading,
      tmdbPlaylistLoading: tmdbPlayback.playlist.loading,
      tmdbPlaylistSearched: tmdbPlayback.playlist.searched,
      onTmdbDetailError,
    })

  // ── episode progress ──
  const episodeProgressMap = usePlayerEpisodeProgress({
    viewingHistory,
    resolvedSourceCode,
    resolvedVodId,
    canUseTmdbHistory,
    tmdbMediaType,
    parsedTmdbId,
    tmdbSeasonNumberForHistory,
    isViewingHistoryVisible: playback.isViewingHistoryVisible,
  })

  // CMS matched sources (declared before sourceOptions useMemo)
  const cmsMatchedSources = usePlayerCmsMatch({
    isCmsRoute,
    title: detail?.videoInfo?.title || '',
    resolvedSourceCode,
    resolvedVodId,
    cmsClient,
  })

  // ── derived data ──
  const {
    sourceOptions,
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
  } = usePlayerDerived({
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
    sourceOptions: tmdbPlayback.sourceOptions,
    network: { isProxyEnabled: network.isProxyEnabled, proxyUrl: network.proxyUrl },
    selectedEpisode,
    fallbackRecommendations,
    tmdbRecommendations: tmdbPlayback.recommendations,
    tmdbDetail: tmdbPlayback.tmdbDetail,
    tmdbRichDetail: tmdbPlayback.tmdbRichDetail,
  })

  // ── handlers ──
  const { buildCurrentPlayPath, handleSourceChange, handleSeasonChange, handleLanguageChange } =
    usePlayerNavigation({
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
      tmdbPlayback: {
        selectedSeasonNumber: tmdbPlayback.selectedSeasonNumber,
        sourceOptions: tmdbPlayback.sourceOptions,
        getSourceOptionsForSeason: tmdbPlayback.getSourceOptionsForSeason,
      },
    })

  // ── episodes ──
  const episodes = useMemo(() => {
    if (!detail) return []
    if (detail.videoInfo?.episodes_names?.length) return detail.videoInfo.episodes_names
    return detail.episodes.map((_, i) => `第 ${i + 1} 集`)
  }, [detail])

  useEffect(() => {
    if (!shouldFallbackEpisodeToFirst(episodes.length, selectedEpisode)) return
    navigate(buildCurrentPlayPath(0), { replace: true })
  }, [buildCurrentPlayPath, episodes.length, navigate, selectedEpisode])

  // ── source episode groups（主选集=默认完整条目，拆分条目常驻下方）──
  const { defaultGroup, splitGroups } = usePlayerSourceEpisodes({
    enabled: isTmdbRoute,
    candidates: tmdbPlayback.playlist.candidates,
    currentSourceCode: resolvedSourceCode,
    currentVodId: resolvedVodId,
    sourceConfig,
    cmsClient,
  })

  // 主选集集数：默认条目分组未就绪时兜底为当前条目集数（默认条目=当前条目时内容一致）
  const panelEpisodes = useMemo(
    () => (defaultGroup?.episodes?.length ? defaultGroup.episodes : episodes),
    [defaultGroup, episodes],
  )
  const defaultVodId = defaultGroup?.vodId

  const episodePagination = useEpisodePagination({
    episodes: panelEpisodes,
    selectedEpisode,
    defaultDescOrder: playback.defaultEpisodeOrder === 'desc',
  })

  // 当前条目（播放区）内的集数映射：皮肤菜单/上下集/自动连播按当前条目切集
  const toCurrentActualIndex = useCallback(
    (displayIndex: number) =>
      episodePagination.isReversed ? episodes.length - 1 - displayIndex : displayIndex,
    [episodePagination.isReversed, episodes.length],
  )
  const handleEpisodeChange = useCallback(
    (displayIndex: number) => {
      const actualIndex = toCurrentActualIndex(displayIndex)
      if (actualIndex === selectedEpisode) return
      navigate(buildCurrentPlayPath(actualIndex), { replace: true })
    },
    [buildCurrentPlayPath, navigate, selectedEpisode, toCurrentActualIndex],
  )

  // 主选集（默认条目）内点击集数：导航到默认条目对应集；默认条目未知时退回当前条目
  const handleMainEpisodeSelect = useCallback(
    (displayIndex: number) => {
      const actualIndex = episodePagination.toActualIndex(displayIndex)
      const targetVodId = defaultVodId || resolvedVodId
      if (!isTmdbRoute || !tmdbMediaType || !targetVodId) return
      if (targetVodId === resolvedVodId && actualIndex === selectedEpisode) return
      navigate(
        buildTmdbPlayPath(tmdbMediaType, parsedTmdbId, {
          sourceCode: resolvedSourceCode,
          vodId: targetVodId,
          episodeIndex: actualIndex,
          seasonNumber: tmdbPlayback.selectedSeasonNumber || undefined,
        }),
      )
    },
    [
      defaultVodId,
      episodePagination,
      isTmdbRoute,
      navigate,
      parsedTmdbId,
      resolvedSourceCode,
      resolvedVodId,
      selectedEpisode,
      tmdbMediaType,
      tmdbPlayback.selectedSeasonNumber,
    ],
  )

  // 拆分条目分组（含当前播放条目的集数高亮），主选集是否高亮取决于当前条目是否即默认条目
  const mainActive = !defaultGroup || defaultGroup.vodId === resolvedVodId
  const splitGroupsForPanel = useMemo(
    () =>
      splitGroups.map(group => ({
        ...group,
        activeEpisode: group.vodId === resolvedVodId ? selectedEpisode : null,
      })),
    [resolvedVodId, selectedEpisode, splitGroups],
  )

  const handleSplitSelect = useCallback(
    (vodId: string, episodeIndex: number) => {
      if (!isTmdbRoute || !tmdbMediaType) return
      navigate(
        buildTmdbPlayPath(tmdbMediaType, parsedTmdbId, {
          sourceCode: resolvedSourceCode,
          vodId,
          episodeIndex,
          seasonNumber: tmdbPlayback.selectedSeasonNumber || undefined,
        }),
      )
    },
    [
      isTmdbRoute,
      navigate,
      parsedTmdbId,
      resolvedSourceCode,
      tmdbMediaType,
      tmdbPlayback.selectedSeasonNumber,
    ],
  )

  // ── favorites ──
  const { handleToggleCmsFavorite, handleToggleTmdbFavorite } = usePlayerFavorites({
    isCmsRoute,
    isTmdbRoute,
    tmdbMediaType,
    parsedTmdbId,
    resolvedSourceCode,
    resolvedVodId,
    detail,
    cmsFavoriteActive,
    tmdbFavoriteActive,
    tmdbDetail: tmdbPlayback.tmdbDetail,
  })

  useDocumentTitle(title || '视频播放')

  // ── speed test ──
  const {
    results: speedResults,
    testingSet: speedTesting,
    testSingle: speedTestSingle,
    testAll: speedTestAll,
  } = useSourceSpeedTest(sourceOptions, videoAPIs, cmsClient)

  // ponytail: merge CMS matched sources into sourceOptions for CMS display
  const hasSourcePanel =
    isTmdbRoute || (isCmsRoute && (sourceOptions.length > 1 || cmsMatchedSources.length > 0))
  const modeLabel = isTmdbRoute ? 'TMDB 播放模式' : 'CMS 直连模式'

  // ── ad filter hls.js config ──
  const [hlsConfig, setHlsConfig] = useState<Partial<HlsConfig>>({})
  useEffect(() => {
    let disposed = false
    getAdFilterHlsConfig(adFilteringEnabled, resolvedSourceCode).then(config => {
      if (!disposed) setHlsConfig(config)
    })
    return () => {
      disposed = true
    }
  }, [adFilteringEnabled, resolvedSourceCode])

  // ── view state ──
  const { shouldShowLoading, primaryError } = derivePlayerViewState({
    hasDetail: Boolean(detail),
    loading,
    error,
    routeError,
    isTmdbRoute,
    tmdbLoading: tmdbPlayback.tmdbLoading,
    tmdbPlaylistLoading: tmdbPlayback.playlist.loading,
    tmdbError: tmdbPlayback.tmdbError,
    tmdbPlaylistSearched: tmdbPlayback.playlist.searched,
  })
  const loadingMode = isCmsRoute ? 'cms' : 'tmdb'

  const renderErrorState = (message: string) => (
    <PlayerErrorRender message={message} detailLink={detailLink} onBack={() => navigate(-1)} />
  )

  // ── context menu ──
  usePlayerContextMenu({
    isCmsRoute,
    isTmdbRoute,
    cmsFavoriteActive,
    tmdbFavoriteActive,
    onToggleCmsFavorite: handleToggleCmsFavorite,
    onToggleTmdbFavorite: handleToggleTmdbFavorite,
    title,
    detailLink,
    homepage: tmdbPlayback.tmdbRichDetail?.homepage,
  })

  // 拦截播放器内置右键菜单，用全局菜单替代
  useEffect(() => {
    const section = playerSectionRef.current
    if (!section) return
    const suppress = (e: Event) => {
      e.stopImmediatePropagation()
    }
    section.addEventListener('contextmenu', suppress, true)
    return () => section.removeEventListener('contextmenu', suppress, true)
  }, [])

  // ── panel auto-close when not applicable ──
  useEffect(() => {
    if (isCmsRoute) {
      if (!hasSourcePanel && activeRightPanel !== 'episode') setActiveRightPanel('episode')
      return
    }
    if (!hasSeasonPanel && activeRightPanel === 'season') setActiveRightPanel('episode')
  }, [activeRightPanel, hasSeasonPanel, hasSourcePanel, isCmsRoute])

  // ── guard states ──
  if (isTmdbRoute && !tmdbEnabled) {
    return (
      <PlayerErrorState
        title="TMDB 模式未启用"
        description="当前未开启 TMDB 智能模式，无法使用 TMDB 播放功能。请在设置中开启或返回首页。"
        tag="模式不可用"
        primaryAction={{ label: '返回首页', onClick: () => navigate('/') }}
        secondaryAction={{ label: '前往设置', to: '/settings/system', variant: 'outline' as const }}
      />
    )
  }

  if (isTmdbRoute && isAdultFilterEnabled && isAdultCert(certShort)) {
    return (
      <PlayerErrorState
        title="访问被拒绝"
        description={
          certShort
            ? `该内容分级为 ${certShort}，根据青少年保护设置已自动屏蔽`
            : '当前青少年模式已开启，该成人内容无法访问'
        }
        tag="内容受限"
        primaryAction={{ label: '返回搜索页', onClick: () => navigate(TMDB_SEARCH_PATH) }}
        secondaryAction={{ label: '返回上一页', onClick: () => navigate(-1) }}
      />
    )
  }

  if (allExhausted) return renderErrorState('所有视频源均无法播放，请稍后重试')
  if (shouldShowLoading) return <PlayerLoadingSkeleton mode={loadingMode} />
  if (primaryError) return renderErrorState(primaryError)
  if (!detail || detail.episodes.length === 0) return renderErrorState(error || '无法获取播放信息')

  // ── main render ──
  return (
    <div className="space-y-4 md:space-y-5">
      {/* Hero section (TMDB only) */}
      {isTmdbRoute && (
        <PlayerHeroSection
          modeLabel={modeLabel}
          sourceName={sourceName}
          title={heroTitle}
          overview={overview}
          posterPath={tmdbPlayback.tmdbDetail?.posterPath}
          backdropPath={tmdbPlayback.tmdbDetail?.backdropPath}
          tmdbMediaType={tmdbMediaType}
          currentEpisodeText={episodes[selectedEpisode] || `第 ${selectedEpisode + 1} 集`}
          totalEpisodeText={`${detail.episodes.length} 集`}
          adultLevel={certShort}
          proxyStatus={proxyStatus}
          onToggleProxy={() => {
            setNetworkSettings({ isProxyEnabled: !network.isProxyEnabled })
            // 切换代理后清除测速缓存，让新环境重新测速
            Object.keys(localStorage)
              .filter(k => k.startsWith('ouonnki-speed::'))
              .forEach(k => localStorage.removeItem(k))
            window.location.reload()
          }}
          onBack={() => navigate(-1)}
        />
      )}

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          {error && (
            <div className="rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </div>
          )}

          {/* ── Video.js Player ── */}
          <div className="group/player">
            <PlayerVideoStage
              sectionRef={playerSectionRef}
              player={{
                key: playerKey,
                url: proxiedEpisodeUrl,
                hlsConfig,
                title,
                poster:
                  getBackdropUrl(tmdbPlayback.tmdbDetail?.backdropPath || null, 'w1280') ||
                  detail?.videoInfo?.cover ||
                  undefined,
                currentEpisode: episodes.length > 1 ? `第 ${selectedEpisode + 1} 集` : undefined,
                resolutionInfo,
                themeColor: playback.playerThemeColor,
              }}
              skin={{
                languageOptions: languageOptions.length > 1 ? languageOptions : undefined,
                languageValue:
                  languageOptions.length > 1
                    ? __lastSelectedLangLabel &&
                      languageOptions.some(o => o.label === __lastSelectedLangLabel)
                      ? __lastSelectedLangLabel
                      : languageOptions[0].label
                    : '',
                onLanguageChange: (vodId, label) => {
                  __lastSelectedLangLabel = label
                  handleLanguageChange(vodId, label)
                },
                episodes,
                selectedEpisode,
                onEpisodeSelect: handleEpisodeChange,
                onPrevEpisode:
                  episodes.length > 1 && selectedEpisode > 0
                    ? () =>
                        handleEpisodeChange(
                          episodePagination.isReversed
                            ? episodes.length - 1 - (selectedEpisode - 1)
                            : selectedEpisode - 1,
                        )
                    : undefined,
                onNextEpisode:
                  episodes.length > 1 && selectedEpisode < episodes.length - 1
                    ? () =>
                        handleEpisodeChange(
                          episodePagination.isReversed
                            ? episodes.length - 1 - (selectedEpisode + 1)
                            : selectedEpisode + 1,
                        )
                    : undefined,
              }}
              trackers={{
                resolvedSourceCode,
                resolvedVodId,
                detail,
                episodes,
                selectedEpisode,
                canUseTmdbHistory,
                tmdbMediaType,
                parsedTmdbId,
                tmdbSeasonNumberForHistory,
                backdropUrl:
                  getBackdropUrl(tmdbPlayback.tmdbDetail?.backdropPath || null, 'w1280') || '',
                isTmdbRoute,
                isCmsRoute,
                sourceOptions: sourceOptions.map(o => ({
                  sourceCode: o.sourceCode,
                  sourceName: o.sourceName,
                  bestVodId: o.bestVodId,
                })),
                speedResults,
                onEnded: () => {
                  if (
                    !playback.isLoopEnabled &&
                    playback.isAutoPlayEnabled &&
                    selectedEpisode < episodes.length - 1
                  ) {
                    handleEpisodeChange(
                      episodePagination.isReversed
                        ? episodes.length - 1 - (selectedEpisode + 1)
                        : selectedEpisode + 1,
                    )
                  }
                },
                onNotice: showPlayerNotice,
                onAllExhausted: () => setAllExhausted(true),
                isLoopEnabled: playback.isLoopEnabled,
                isAutoPlayEnabled: playback.isAutoPlayEnabled,
                isAutoMiniEnabled: playback.isAutoMiniEnabled,
                isPipEnabled: playback.isPipEnabled,
                onSpeedChange: handleSpeedChange,
                onSeekPreview: handleSeekPreview,
                onSeekPreviewEnd: handleSeekPreviewEnd,
                onResolutionChange: setResolutionInfo,
              }}
              overlays={{
                isTmdbRoute,
                isMatching: Boolean(
                  tmdbPlayback.playlist.loading && tmdbPlayback.playlist.searched,
                ),
                matchingText: `持续匹配中 ${tmdbPlayback.playlist.progress.completed}/${tmdbPlayback.playlist.progress.total}${
                  tmdbPlayback.playlist.progress.currentSourceName
                    ? ` · ${tmdbPlayback.playlist.progress.currentSourceName}`
                    : ''
                }`,
                shouldShowBetterSource,
                betterSourceName: bestSourceOption?.sourceName || '',
                betterSourceScore: bestSourceOption?.bestScore || 0,
                onSwitchBetterSource: () =>
                  bestSourceOption && handleSourceChange(bestSourceOption.sourceCode),
                playerNotice,
                speedNotice,
                seekPreview,
                isDetailRefreshing,
              }}
            />
          </div>
        </div>

        {/* ── Right panels ── */}
        <aside className="min-w-0 xl:sticky xl:top-20 xl:h-[clamp(240px,56vw,74vh)] xl:min-h-[220px] xl:pr-1">
          <PlayerRightPanels
            isCmsRoute={isCmsRoute}
            isTmdbRoute={isTmdbRoute}
            hasSourcePanel={hasSourcePanel}
            hasSeasonPanel={hasSeasonPanel}
            activeRightPanel={activeRightPanel}
            onPanelChange={setActiveRightPanel}
            source={{
              options: sourceOptions,
              selectedCode: resolvedSourceCode,
              enabledSourceIds: videoAPIs
                .filter(s => s.isEnabled !== false)
                .map(s => s.id),
              speedResults,
              speedTesting,
              onSelect: handleSourceChange,
              onTestSingle: speedTestSingle,
              onTestAll: speedTestAll,
              onDisable: sourceCode => setApiEnabled(sourceCode, false),
              onRetryMatch: () => tmdbPlayback.playlist.retry(),
            }}
            season={{
              options: tmdbPlayback.seasonOptions,
              selectedNumber: tmdbPlayback.selectedSeasonNumber,
              onSelect: handleSeasonChange,
            }}
            episode={{
              totalEpisodes: panelEpisodes.length,
              selectedEpisode,
              isReversed: episodePagination.isReversed,
              onToggleOrder: () => episodePagination.setIsReversed(prev => !prev),
              pageRanges: episodePagination.pageRanges,
              currentPageRange: episodePagination.currentPageRange,
              onPageRangeChange: episodePagination.setCurrentPageRange,
              episodes: episodePagination.currentPageEpisodes,
              onEpisodeSelect: handleMainEpisodeSelect,
              episodeProgressMap: mainActive ? episodeProgressMap : null,
              mainLabel: splitGroupsForPanel.length > 0 ? defaultGroup?.title : undefined,
              mainActive,
              splitGroups: splitGroupsForPanel,
              onSplitSelect: handleSplitSelect,
            }}
          />
        </aside>
      </section>

      {/* Info & Recommendations */}
      <PlayerInfoAndRecommendations
        title={title}
        originalTitle={tmdbPlayback.tmdbDetail?.originalTitle}
        overview={overview}
        sourceName={sourceName}
        modeLabel={modeLabel}
        releaseDate={tmdbPlayback.tmdbDetail?.releaseDate}
        rating={tmdbPlayback.tmdbDetail?.voteAverage}
        posterPath={tmdbPlayback.tmdbDetail?.posterPath}
        cmsCover={detail.videoInfo?.cover}
        tmdbMediaType={tmdbMediaType}
        seasonCount={seasonCount}
        episodeCount={episodeCount}
        detailLink={detailLink}
        showRecommendations={isTmdbRoute}
        favoriteAction={
          isCmsRoute
            ? { active: cmsFavoriteActive, onToggle: handleToggleCmsFavorite }
            : isTmdbRoute && tmdbMediaType
              ? { active: tmdbFavoriteActive, onToggle: handleToggleTmdbFavorite }
              : undefined
        }
        collectionId={tmdbPlayback.tmdbRichDetail?.belongs_to_collection?.id}
        currentTmdbId={parsedTmdbId || undefined}
        recommendations={recommendationItems}
      />
    </div>
  )
}
