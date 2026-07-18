import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import '@videojs/react/video/skin.css'
import { createPlayer } from '@videojs/react'
import { videoFeatures, Video } from '@videojs/react/video'
import { VideojsSkin, OrientationLocker } from './VideojsSkin'
import { VideojsMobileGestures } from './VideojsMobileGestures'
import { DesktopSpeedKeys } from './DesktopSpeedKeys'
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video'
import type { DetailResult, VideoItem as CmsVideoItem } from '@ouonnki/cms-core'
import { getCmsSources, storeCmsSources } from '@/features/search/hooks/directSearch.utils'
import type { HlsConfig } from 'hls.js'
import {
  createM3u8Processor,
  createNoopFilter,
  createCustomScriptFilter,
  createHlsLoaderClass,
} from '@ouonnki/cms-core/m3u8'
import { getCustomAdFilterCode } from '@/features/player/lib/custom-ad-filter'
import {
  ChevronDown,
  Camera,
  PictureInPicture2,
  ExternalLink,
  Globe,
  Heart,
  HeartOff,
  RefreshCw,
  Ban,
  Activity,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/shared/components/ui/context-menu'
import { Button } from '@/shared/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Spinner } from '@/shared/components/ui/spinner'
import { useApiStore } from '@/shared/store/apiStore'
import { useViewingHistoryStore } from '@/shared/store/viewingHistoryStore'
import { useGlobalContextMenuStore } from '@/shared/store/contextMenuStore'
import { useSettingStore } from '@/shared/store/settingStore'
import { useDocumentTitle, useCmsClient } from '@/shared/hooks'
import { useTmdbEnabled } from '@/shared/hooks/useTmdbMode'
import { cn } from '@/shared/lib/utils'
import { buildCmsPlayPath, buildTmdbDetailPath, buildTmdbPlayPath } from '@/shared/lib/routes'
import { isTmdbHistoryItem } from '@/shared/lib/viewingHistory'
import { getBackdropUrl } from '@/shared/lib/tmdb'
import { useFavoritesStore } from '@/features/favorites/store/favoritesStore'
import type { TmdbMediaItem, TmdbMediaType } from '@/shared/types/tmdb'
import type { ViewingHistoryItem } from '@/shared/types'
import type { VideoItem } from '@/shared/types/video'
import { useTmdbRecommendations } from '@/shared/hooks/useTmdbRecommendations'
import { getCertShort, isAdultCert } from '@/features/media/components'
import { normalizeProxyPrefix } from '@/shared/config/api.config'
import { getResolutionLabel, type VideoResolutionInfo } from '../lib/resolution-labels'
import { toast } from 'sonner'
import {
  CmsEpisodePanel,
  PlayerEpisodePanel,
  PlayerErrorState,
  PlayerHeroSection,
  PlayerInfoAndRecommendations,
  PlayerLoadingSkeleton,
} from '@/features/player/components'
import { useEpisodePagination, useTmdbPlayback } from '@/features/player/hooks'
import { useSourceSpeedTest } from '../hooks/useSourceSpeedTest'
import { SpeedTestBadge } from './SpeedTestBadge'
import type { VideoSourceTestResult } from '../lib/source-speed-test'

// 模块级：跨导航追踪语言的 label（用 label 比对，vodId 可能不匹配）
let __lastSelectedLangLabel = ''
import {
  buildTmdbSelectionScopeKey,
  derivePlayerViewState,
  getNextTmdbSelectionLock,
  resolvePlayerSelection,
  shouldFallbackEpisodeToFirst,
  type TmdbSelectionLock,
  validatePlayerRoute,
} from '@/features/player/lib'

// ── Video.js player instance ──
const Player = createPlayer({
  features: [
    ...videoFeatures,
    // 覆盖倍速选项，扩展至 4x
    { state: () => ({ playbackRates: [0.2, 0.5, 0.7, 1, 1.2, 1.5, 1.7, 2, 3, 4] }) },
  ],
})

// ── Ad filter ──

const m3u8Processor = createM3u8Processor({
  filterAds: true,
  customFilters: [createNoopFilter()],
})

/**
 * 加载 hls.js + 创建自定义 loader (去广告)，返回传给 HlsJsVideo 的 config
 * ponytail: 懒加载 hls.js light 构建，避免打包体积
 */
let hlsConstructorPromise: Promise<typeof import('hls.js').default> | null = null
let customLoaderClass: ReturnType<typeof createHlsLoaderClass> | null = null

async function getAdFilterHlsConfig(
  adFilteringEnabled: boolean,
  sourceCode: string,
): Promise<Partial<HlsConfig>> {
  if (!adFilteringEnabled) return {}

  // 自定义脚本过滤器
  const code = getCustomAdFilterCode()
  if (code.trim()) {
    const filter = createCustomScriptFilter(code, sourceCode)
    if (filter) m3u8Processor.addFilter(filter)
  }

  if (!hlsConstructorPromise) {
    hlsConstructorPromise = import('hls.js/dist/hls.light.mjs')
      .then(m => m.default as typeof import('hls.js').default)
      .catch(e => {
        hlsConstructorPromise = null
        throw e
      })
  }

  const HlsClass = await hlsConstructorPromise
  if (!customLoaderClass) {
    customLoaderClass = createHlsLoaderClass({ m3u8Processor, Hls: HlsClass })
  }

  // ponytail: cast through unknown — HlsConfig.loader type doesn't match createHlsLoaderClass return
  return { loader: customLoaderClass as unknown as Partial<HlsConfig>['loader'] }
}

// ── Media ──

/** 根据 URL 自动选 Video（mp4）或 HlsJsVideo（m3u8），透传 hls.js config */
function MediaElement({
  src,
  hlsConfig,
  autoPlay,
  playsInline,
  ...rest
}: {
  src: string
  playsInline?: boolean
  autoPlay?: boolean
  hlsConfig?: Partial<HlsConfig>
}) {
  if (src.endsWith('.m3u8') || src.includes('m3u8')) {
    return (
      <HlsJsVideo
        src={src}
        playsInline={playsInline}
        autoPlay={autoPlay}
        config={{ hlsJs: hlsConfig }}
        {...rest}
      />
    )
  }
  return <Video src={src} playsInline={playsInline} autoPlay={autoPlay} {...rest} />
}

// ── Playback tracker (inside Player.Provider, invisible) ──

interface PlaybackTrackerProps {
  resolvedSourceCode: string
  resolvedVodId: string
  detail: DetailResult
  episodes: string[]
  selectedEpisode: number
  canUseTmdbHistory: boolean
  tmdbMediaType: TmdbMediaType | null
  parsedTmdbId: number
  tmdbSeasonNumberForHistory: number | null
  backdropUrl: string
  onEnded: () => void
}

/**
 * 轮询 Video.js store，记录观看历史 + 恢复进度
 * ponytail: 2s 轮询代替 subscribe，简单可靠，必要时再换事件驱动
 */
function PlaybackTracker({
  resolvedSourceCode,
  resolvedVodId,
  detail,
  episodes,
  selectedEpisode,
  canUseTmdbHistory,
  tmdbMediaType,
  parsedTmdbId,
  tmdbSeasonNumberForHistory,
  backdropUrl,
  onEnded,
}: PlaybackTrackerProps) {
  const store = Player.usePlayer()
  const addHistory = useViewingHistoryStore(s => s.addViewingHistory)

  // Refs 保持最新，避免 interval 闭包过期
  const metaRef = useRef({
    resolvedSourceCode,
    resolvedVodId,
    detail,
    episodes,
    selectedEpisode,
    canUseTmdbHistory,
    tmdbMediaType,
    parsedTmdbId,
    tmdbSeasonNumberForHistory,
    backdropUrl,
  })
  metaRef.current = {
    resolvedSourceCode,
    resolvedVodId,
    detail,
    episodes,
    selectedEpisode,
    canUseTmdbHistory,
    tmdbMediaType,
    parsedTmdbId,
    tmdbSeasonNumberForHistory,
    backdropUrl,
  }

  const hasRestoredRef = useRef(false)
  const lastWriteRef = useRef(0)
  const prevPausedRef = useRef(true)
  const prevEndedRef = useRef(false)
  const prefetchedRef = useRef(false)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  // Reset on episode / source change
  useEffect(() => {
    hasRestoredRef.current = false
    lastWriteRef.current = 0
    prevPausedRef.current = true
    prefetchedRef.current = false
  }, [selectedEpisode, resolvedSourceCode, resolvedVodId])

  // Polling loop
  useEffect(() => {
    const writeSnapshot = (position: number, dur: number) => {
      const m = metaRef.current
      if (!m.resolvedSourceCode || !m.resolvedVodId || !m.detail.videoInfo) return

      const imageUrl = (m.canUseTmdbHistory ? m.backdropUrl : '') || m.detail.videoInfo.cover || ''

      addHistory({
        recordType: m.canUseTmdbHistory ? 'tmdb' : 'cms',
        title: m.detail.videoInfo.title || '未知视频',
        imageUrl,
        sourceCode: m.resolvedSourceCode,
        sourceName: m.detail.videoInfo.source_name || '',
        vodId: m.resolvedVodId,
        tmdbMediaType: m.canUseTmdbHistory ? m.tmdbMediaType || undefined : undefined,
        tmdbId: m.canUseTmdbHistory ? m.parsedTmdbId : undefined,
        tmdbSeasonNumber:
          m.canUseTmdbHistory && m.tmdbMediaType === 'tv'
            ? m.tmdbSeasonNumberForHistory
            : undefined,
        episodeIndex: m.selectedEpisode,
        episodeName: m.episodes[m.selectedEpisode],
        playbackPosition: position,
        duration: dur,
        timestamp: Date.now(),
      })
    }

    const tick = () => {
      const st = store as Record<string, unknown>
      const currentTime = (st.currentTime as number) ?? 0
      const duration = (st.duration as number) ?? 0
      const paused = (st.paused as boolean) ?? true
      const ended = (st.ended as boolean) ?? false
      const started = (st.started as boolean) ?? false

      // Progress restoration on first start
      if (!hasRestoredRef.current && started && currentTime < 1 && duration > 0) {
        hasRestoredRef.current = true
        const m = metaRef.current
        // Find existing history matching current episode
        const hist = useViewingHistoryStore.getState().viewingHistory
        let existing: ViewingHistoryItem | undefined
        if (m.canUseTmdbHistory && m.tmdbMediaType) {
          existing = hist.find(
            h =>
              h.episodeIndex === m.selectedEpisode &&
              isTmdbHistoryItem(h) &&
              h.tmdbMediaType === m.tmdbMediaType &&
              h.tmdbId === m.parsedTmdbId &&
              (h.tmdbSeasonNumber ?? null) === m.tmdbSeasonNumberForHistory,
          )
          if (!existing) {
            existing = hist.find(
              h =>
                h.recordType === 'cms' &&
                h.sourceCode === m.resolvedSourceCode &&
                h.vodId === m.resolvedVodId &&
                h.episodeIndex === m.selectedEpisode,
            )
          }
        } else {
          existing = hist.find(
            h =>
              h.sourceCode === m.resolvedSourceCode &&
              h.vodId === m.resolvedVodId &&
              h.episodeIndex === m.selectedEpisode,
          )
        }
        if (existing && existing.playbackPosition > 0) {
          ;(st.seek as (t: number) => void)?.(existing.playbackPosition)
        }
      }

      // Snapshot on play/pause transition
      if (prevPausedRef.current !== paused && currentTime > 0 && duration > 0) {
        writeSnapshot(currentTime, duration)
        lastWriteRef.current = Date.now()
      }
      prevPausedRef.current = paused

      // Periodic write while playing
      if (!paused && currentTime > 0 && duration > 0) {
        const now = Date.now()
        if (now - lastWriteRef.current > 5000) {
          writeSnapshot(currentTime, duration)
          lastWriteRef.current = now
        }
      }

      // 进度 ≥ 90% 时预加载下一集
      if (!prefetchedRef.current && currentTime > 0 && duration > 0) {
        const pct = currentTime / duration
        if (pct >= 0.9) {
          const m = metaRef.current
          const nextUrl = m.detail?.episodes?.[m.selectedEpisode + 1]
          if (nextUrl) {
            prefetchedRef.current = true
            fetch(nextUrl, { mode: 'no-cors', priority: 'low' }).catch(() => {})
          }
        }
      }

      // Ended → next episode (fire once per end event)
      if (ended && !prevEndedRef.current && currentTime > 0) {
        writeSnapshot(currentTime, duration)
        onEndedRef.current()
      }
      prevEndedRef.current = ended
    }

    const id = setInterval(tick, 2000)
    return () => clearInterval(id)
  }, [store, addHistory])

  return null
}

// ── Auto source switch on error / stall ──

interface SourceAutoSwitchProps {
  resolvedSourceCode: string
  isTmdbRoute: boolean
  isCmsRoute: boolean
  sourceOptions: Array<{ sourceCode: string; sourceName: string; bestVodId: string }>
  selectedEpisode: number
  speedResults: Map<string, VideoSourceTestResult>
  onNotice: (msg: string) => void
  onAllExhausted?: () => void
}

/**
 * 监听 Video.js store 的 error/waiting 状态，检测到卡顿或错误时自动切换下一个源
 * ponytail: polling store, same pattern as PlaybackTracker
 */
function SourceAutoSwitch({
  resolvedSourceCode,
  isTmdbRoute,
  isCmsRoute,
  sourceOptions,
  selectedEpisode,
  speedResults,
  onNotice,
  onAllExhausted,
}: SourceAutoSwitchProps) {
  const store = Player.usePlayer()
  const navigate = useNavigate()

  const metaRef = useRef<{
    resolvedSourceCode: string
    isTmdbRoute: boolean
    isCmsRoute: boolean
    sourceOptions: SourceAutoSwitchProps['sourceOptions']
    selectedEpisode: number
    speedResults: Map<string, VideoSourceTestResult>
    onAllExhausted?: () => void
  }>(null!)
  metaRef.current = {
    resolvedSourceCode,
    isTmdbRoute,
    isCmsRoute,
    sourceOptions,
    selectedEpisode,
    speedResults,
    onAllExhausted,
  }

  const exhaustedRef = useRef(false)
  const startedRef = useRef(false)
  const slowLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const switchedRef = useRef(false)

  // Reset on source change
  useEffect(() => {
    exhaustedRef.current = false
    startedRef.current = false
    startedRef.current = false
    switchedRef.current = false
    if (slowLoadTimerRef.current) {
      clearTimeout(slowLoadTimerRef.current)
      slowLoadTimerRef.current = null
    }
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }
    return () => {
      if (slowLoadTimerRef.current) clearTimeout(slowLoadTimerRef.current)
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
    }
  }, [resolvedSourceCode])

  useEffect(() => {
    const doSwitch = () => {
      if (switchedRef.current) return
      switchedRef.current = true
      const m = metaRef.current

      const tryNext = (next: { sourceCode: string; bestVodId: string } | null) => {
        if (next?.bestVodId) {
          onNotice('当前源无法播放，自动切换中...')
          return true
        }
        if (!exhaustedRef.current) {
          exhaustedRef.current = true
          metaRef.current.onAllExhausted?.()
        }
        return false
      }

      const curIdx = m.sourceOptions.findIndex(o => o.sourceCode === m.resolvedSourceCode)
      // 跳过测速失败的源，找第一个可用的
      const nextSafe = (m.sourceOptions ?? []).find((o, i) => {
        if (i <= curIdx) return false
        const r = m.speedResults.get(o.sourceCode)
        return !r || !(r.status === 'failed' || r.hasError)
      })
      // 如果所有后续源都测速失败 → 直接耗尽
      const allFailed = !nextSafe && (m.sourceOptions ?? []).slice(curIdx + 1).length > 0
      if (allFailed) {
        exhaustedRef.current = true
        m.onAllExhausted?.()
        return
      }
      const next =
        nextSafe ||
        (curIdx >= 0 && curIdx + 1 < m.sourceOptions.length ? m.sourceOptions[curIdx + 1] : null)

      if (m.isTmdbRoute) {
        if (tryNext(next)) {
          const params = new URLSearchParams(window.location.search)
          params.set('source', next!.sourceCode)
          params.set('id', next!.bestVodId)
          navigate(`${window.location.pathname}?${params.toString()}`, { replace: true })
        }
        return
      }

      if (m.isCmsRoute && tryNext(next)) {
        navigate(buildCmsPlayPath(next!.sourceCode, next!.bestVodId, m.selectedEpisode), {
          replace: true,
        })
      }
    }

    const tick = () => {
      const st = store as Record<string, unknown>
      const waiting = (st.waiting as boolean) ?? false
      const started = (st.started as boolean) ?? false
      const error = st.error as { fatal?: boolean } | null | undefined

      // Track playback start
      if (started && !startedRef.current) {
        startedRef.current = true
        if (slowLoadTimerRef.current) {
          clearTimeout(slowLoadTimerRef.current)
          slowLoadTimerRef.current = null
        }
      }

      // Slow load: 10s without any playback
      if (!startedRef.current && !slowLoadTimerRef.current && !switchedRef.current) {
        slowLoadTimerRef.current = setTimeout(() => {
          if (!startedRef.current && !switchedRef.current) doSwitch()
        }, 10000)
      }

      // Stall: 15s waiting after playback started
      if (waiting && startedRef.current && !stallTimerRef.current && !switchedRef.current) {
        stallTimerRef.current = setTimeout(() => {
          doSwitch()
        }, 15000)
      } else if (!waiting && stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }

      // Fatal error
      if (error && !switchedRef.current) {
        doSwitch()
      }
    }

    const id = setInterval(tick, 3000)
    return () => clearInterval(id)
  }, [store, navigate])

  return null
}

// ── Resolution display ──

interface ResolutionTrackerProps {
  onResolution: (info: VideoResolutionInfo | null) => void
}

/**
 * 监听 <video> 的 loadedmetadata / resize 事件，检测实际播放分辨率
 * 值不变时不重复通知。事件驱动，无需轮询。
 */
function ResolutionTracker({ onResolution }: ResolutionTrackerProps) {
  const onResolutionRef = useRef(onResolution)
  onResolutionRef.current = onResolution
  const prevRef = useRef('')

  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>('video')
    if (!video) return

    const detect = () => {
      const w = video.videoWidth
      const h = video.videoHeight
      if (w > 0 && h > 0) {
        const label = getResolutionLabel(w, h)
        const key = `${w}x${h}`
        if (key === prevRef.current) return
        prevRef.current = key
        onResolutionRef.current({ width: w, height: h, ...label })
      }
    }

    video.addEventListener('loadedmetadata', detect)
    video.addEventListener('resize', detect)
    // 如果 video 已加载元数据则立即检测
    if (video.readyState >= 1) detect()

    return () => {
      video.removeEventListener('loadedmetadata', detect)
      video.removeEventListener('resize', detect)
    }
  }, [])

  return null
}

// ── Resolution badge ──

function renderResolutionBadge(info: VideoResolutionInfo | null) {
  if (!info) return undefined
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${info.color}`}
    >
      {info.label}
      <span className="font-normal opacity-80">
        {info.width}x{info.height}
      </span>
    </span>
  )
}

// ── Default volume setter ──

/**
 * 播放器初始化时将音量设为用户设置的默认值
 * 轮询等待 <video> 元素出现后直接设 volume，避免 store target 未就绪
 */
function DefaultVolumeSetter() {
  const defaultVolume = useSettingStore(s => s.playback.defaultVolume)
  const appliedRef = useRef(false)

  useEffect(() => {
    if (appliedRef.current) return
    const id = setInterval(() => {
      if (appliedRef.current) {
        clearInterval(id)
        return
      }
      const video = document.querySelector<HTMLVideoElement>('video')
      if (!video || video.volume === defaultVolume) return
      clearInterval(id)
      appliedRef.current = true
      video.volume = defaultVolume
    }, 200)
    return () => clearInterval(id)
  }, [defaultVolume])

  return null
}

// ── Loop playback ──

/**
 * 根据设置同步 video.loop 属性
 */
function LoopSetter() {
  const loopEnabled = useSettingStore(s => s.playback.isLoopEnabled)

  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>('video')
    if (video) video.loop = loopEnabled
  }, [loopEnabled])

  return null
}

// ── Auto Picture-in-Picture ──

/**
 * 页面滚动时自动进入画中画模式（浏览器原生 PiP API）
 */
interface AutoPiPProps {
  playerSectionRef: React.RefObject<HTMLElement | null>
  enabled: boolean
  pipEnabled: boolean
  currentUrl: string
}

type PiPState = 'idle' | 'transitioning' | 'pip'

export function AutoPiP({
  playerSectionRef,
  enabled,
  pipEnabled,
  currentUrl,
}: AutoPiPProps) {
  const stateRef = useRef<{
    status: PiPState
    lockTimer: NodeJS.Timeout | null
  }>({
    status: 'idle',
    lockTimer: null,
  })

  useEffect(() => {
    const playerSection = playerSectionRef.current
    if (!enabled || !pipEnabled || !playerSection || !document.pictureInPictureEnabled) return

    const scrollViewport = document.querySelector(
      '[data-main-scroll-area] [data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null
    if (!scrollViewport) return

    const VISIBILITY_GAP = 60
    let currentVideo: HTMLVideoElement | null = null
    let initTimer: NodeJS.Timeout | null = null

    const clearLockTimer = () => {
      if (stateRef.current.lockTimer) {
        clearTimeout(stateRef.current.lockTimer)
        stateRef.current.lockTimer = null
      }
    }

    const forceResetStatus = (targetStatus: 'idle' | 'pip') => {
      clearLockTimer()
      stateRef.current.status = targetStatus
    }

    const onLeavePiP = () => {
      forceResetStatus('idle')
    }

    const onEnterPiP = () => {
      forceResetStatus('pip')
    }

    const getVideoElement = () => {
      if (currentVideo?.isConnected) return currentVideo

      currentVideo = playerSection.querySelector('video')
      if (currentVideo) {
        currentVideo.removeEventListener('leavepictureinpicture', onLeavePiP)
        currentVideo.removeEventListener('enterpictureinpicture', onEnterPiP)
        currentVideo.addEventListener('leavepictureinpicture', onLeavePiP)
        currentVideo.addEventListener('enterpictureinpicture', onEnterPiP)

        if (initTimer) {
          clearInterval(initTimer)
          initTimer = null
        }
      }
      return currentVideo
    }

    let rafId: number | null = null
    const checkVisibility = () => {
      if (rafId) return

      rafId = requestAnimationFrame(() => {
        rafId = null
        const state = stateRef.current

        if (state.status === 'transitioning') return

        const video = getVideoElement()
        if (!video || video.readyState < 2) return

        const rect = playerSection.getBoundingClientRect()
        const isVisible =
          rect.bottom > VISIBILITY_GAP && rect.top < window.innerHeight - VISIBILITY_GAP

        if (!isVisible && state.status === 'idle') {
          if (!document.pictureInPictureElement) {
            state.status = 'transitioning'

            state.lockTimer = setTimeout(() => {
              console.warn('AutoPiP: enter event timeout safety net triggered.')
              forceResetStatus('idle')
            }, 3000)

            video.requestPictureInPicture().catch((err) => {
              console.warn('AutoPiP enter failed:', err)
              forceResetStatus('idle')
            })
          } else {
            state.status = 'pip'
          }
        }
        else if (isVisible && state.status === 'pip') {
          if (document.pictureInPictureElement === video) {
            state.status = 'transitioning'

            state.lockTimer = setTimeout(() => {
              console.warn('AutoPiP: leave event timeout safety net triggered.')
              forceResetStatus('pip')
            }, 3000)

            document.exitPictureInPicture().catch((err) => {
              console.warn('AutoPiP exit failed:', err)
              forceResetStatus('pip')
            })
          } else {
            state.status = 'idle'
          }
        }
      })
    }

    scrollViewport.addEventListener('scroll', checkVisibility, { passive: true })
    initTimer = setInterval(checkVisibility, 1000)
    checkVisibility()

    return () => {
      clearLockTimer()
      if (initTimer) clearInterval(initTimer)
      if (rafId) cancelAnimationFrame(rafId)

      scrollViewport.removeEventListener('scroll', checkVisibility)

      if (currentVideo) {
        currentVideo.removeEventListener('leavepictureinpicture', onLeavePiP)
        currentVideo.removeEventListener('enterpictureinpicture', onEnterPiP)
      }

      if (document.pictureInPictureElement && stateRef.current.status === 'pip') {
        document.exitPictureInPicture().catch(() => {})
      }
    }
  }, [playerSectionRef, enabled, pipEnabled, currentUrl])

  return null
}
// ── Speed tracker: watch playbackrate and notify ──

function SpeedTracker({ onChange }: { onChange: (rate: number) => void }) {
  const store = Player.usePlayer()
  const prevRef = useRef(1)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const id = setInterval(() => {
      const rate = ((store as Record<string, unknown>).playbackRate as number) ?? 1
      if (rate !== prevRef.current) {
        prevRef.current = rate
        onChangeRef.current(rate)
      }
    }, 500)
    return () => clearInterval(id)
  }, [store])

  return null
}

// ── helpers ──

interface PlayerRouteParams {
  [key: string]: string | undefined
  type?: string
  tmdbId?: string
  sourceCode?: string
  vodId?: string
}

const parseEpisodeIndex = (value: string | null): number => {
  const parsed = Number.parseInt(value || '0', 10)
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
}

const parsePositiveNumber = (value: string | null): number | null => {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed) || parsed <= 0) return null
  return parsed
}

const buildDetailRequestKey = (sourceCode: string, vodId: string) => `${sourceCode}::${vodId}`

const stripHtmlTags = (value: string) => {
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

const matchesTmdbHistory = (
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

const TMDB_SEARCH_PATH = '/search?mode=tmdb'

// 分辨率标签 → Tailwind 背景色
const RES_COLORS: Record<string, string> = {
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

// ── component ──

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
  const detailRef = useRef<DetailResult | null>(null)
  const detailRequestSeqRef = useRef(0)
  const loadedDetailKeyRef = useRef('')
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
  const toggleCmsFavorite = useFavoritesStore(state => state.toggleCmsFavorite)
  const toggleTmdbFavorite = useFavoritesStore(state => state.toggleTmdbFavorite)

  // ── state ──
  const [detail, setDetail] = useState<DetailResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allExhausted, setAllExhausted] = useState(false)
  const [isDetailRefreshing, setIsDetailRefreshing] = useState(false)
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

  useEffect(() => {
    detailRef.current = detail
  }, [detail])

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

  // ── navigation helpers ──
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
  useEffect(() => {
    const requestSeq = detailRequestSeqRef.current + 1
    detailRequestSeqRef.current = requestSeq
    let disposed = false
    const canCommit = () => !disposed && detailRequestSeqRef.current === requestSeq

    const fetchVideoDetail = async () => {
      if (routeError) {
        if (!canCommit()) return
        setDetail(null)
        setLoading(false)
        setIsDetailRefreshing(false)
        setError(routeError)
        return
      }

      const hasResolvedTmdbSelection = Boolean(resolvedSourceCode && resolvedVodId)
      const shouldWaitForTmdbSelection =
        isTmdbRoute &&
        !hasExplicitTmdbSelection &&
        !hasResolvedTmdbSelection &&
        (tmdbPlayback.tmdbLoading ||
          tmdbPlayback.playlist.loading ||
          !tmdbPlayback.playlist.searched)

      if (shouldWaitForTmdbSelection) {
        if (!canCommit()) return
        if (detailRef.current) setIsDetailRefreshing(true)
        else setLoading(true)
        setError(null)
        return
      }

      if (!resolvedSourceCode || !resolvedVodId) {
        if (isTmdbRoute && tmdbPlayback.playlist.searched) {
          if (!canCommit()) return
          setDetail(null)
          setLoading(false)
          setIsDetailRefreshing(false)
          setError('没有匹配到可播放资源，请返回详情页重新匹配')
          return
        }
        if (!canCommit()) return
        setDetail(null)
        setLoading(false)
        setIsDetailRefreshing(false)
        setError('缺少必要的播放参数')
        return
      }

      const detailRequestKey = buildDetailRequestKey(resolvedSourceCode, resolvedVodId)
      if (detailRef.current && loadedDetailKeyRef.current === detailRequestKey) return

      if (!canCommit()) return
      if (detailRef.current) setIsDetailRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        if (!sourceConfig) throw new Error('未找到对应视频源配置，请检查源设置')
        const response = await cmsClient.getDetail(resolvedVodId, sourceConfig)
        if (!canCommit()) return
        if (response.success && response.episodes?.length > 0) {
          loadedDetailKeyRef.current = detailRequestKey
          setDetail(response)
          setError(null)
          return
        }
        throw new Error(response.error || '获取视频详情失败')
      } catch (fetchError) {
        if (!canCommit()) return
        console.error('获取视频详情失败:', fetchError)

        if (isTmdbRoute && tmdbMediaType) {
          tmdbSelectionLockRef.current = null
          navigate(
            buildTmdbPlayPath(tmdbMediaType, parsedTmdbId, {
              episodeIndex: selectedEpisode,
              seasonNumber: tmdbPlayback.selectedSeasonNumber || undefined,
            }),
            { replace: true },
          )
          return
        }

        const msg = fetchError instanceof Error ? fetchError.message : '获取视频详情失败'
        setDetail(null)
        setError(msg)
      } finally {
        if (canCommit()) {
          setLoading(false)
          setIsDetailRefreshing(false)
        }
      }
    }

    void fetchVideoDetail()
    return () => {
      disposed = true
    }
  }, [
    cmsClient,
    hasExplicitTmdbSelection,
    isTmdbRoute,
    routeError,
    resolvedSourceCode,
    resolvedVodId,
    sourceConfig,
    tmdbPlayback.playlist.loading,
    tmdbPlayback.playlist.searched,
    tmdbPlayback.tmdbLoading,
  ])

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

  const episodePagination = useEpisodePagination({
    episodes,
    selectedEpisode,
    defaultDescOrder: playback.defaultEpisodeOrder === 'desc',
  })

  // ── episode progress ──
  const episodeProgressMap = useMemo(() => {
    if (!playback.isViewingHistoryVisible || !resolvedSourceCode || !resolvedVodId) return null

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
    parsedTmdbId,
    playback.isViewingHistoryVisible,
    resolvedSourceCode,
    resolvedVodId,
    tmdbMediaType,
    tmdbSeasonNumberForHistory,
    viewingHistory,
  ])

  // CMS matched sources (declared before sourceOptions useMemo)
  const [cmsMatchedSources, setCmsMatchedSources] = useState<
    Array<{ sourceCode: string; sourceName: string; vodId: string }>
  >([])
  const cmsMatchFiredRef = useRef(false)

  // ── source options ──
  const sourceOptions = useMemo(() => {
    if (isTmdbRoute) return tmdbPlayback.sourceOptions
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
    tmdbPlayback.sourceOptions,
    detail?.videoInfo?.source_name,
    detail?.videoInfo?.title,
    sourceConfig?.name,
    routeSourceCode,
    resolvedSourceCode,
    resolvedVodId,
    cmsMatchedSources,
  ])

  // ── handlers ──
  const handleEpisodeChange = (displayIndex: number) => {
    const actualIndex = episodePagination.toActualIndex(displayIndex)
    if (actualIndex === selectedEpisode) return
    navigate(buildCurrentPlayPath(actualIndex), { replace: true })
  }

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

  const handleToggleCmsFavorite = useCallback(() => {
    if (!isCmsRoute || !resolvedVodId || !resolvedSourceCode) return
    const video: VideoItem = {
      vod_id: resolvedVodId,
      vod_name: detail?.videoInfo?.title || '未知视频',
      vod_pic: detail?.videoInfo?.cover,
      vod_year: detail?.videoInfo?.year,
      vod_area: detail?.videoInfo?.area,
      vod_remarks: detail?.videoInfo?.remarks,
      vod_content: detail?.videoInfo?.desc,
      type_name: detail?.videoInfo?.type,
      source_code: resolvedSourceCode,
      source_name: detail?.videoInfo?.source_name || '',
    }
    toggleCmsFavorite(video)
    toast.success(cmsFavoriteActive ? '已取消收藏' : '已加入收藏')
  }, [
    cmsFavoriteActive,
    detail?.videoInfo,
    isCmsRoute,
    resolvedSourceCode,
    resolvedVodId,
    toggleCmsFavorite,
  ])

  const handleToggleTmdbFavorite = useCallback(() => {
    if (!isTmdbRoute || !tmdbMediaType || parsedTmdbId <= 0) return
    const tmdbMedia: TmdbMediaItem = {
      id: parsedTmdbId,
      mediaType: tmdbMediaType,
      title: tmdbPlayback.tmdbDetail?.title || '未知视频',
      originalTitle:
        tmdbPlayback.tmdbDetail?.originalTitle || tmdbPlayback.tmdbDetail?.title || '未知视频',
      overview: tmdbPlayback.tmdbDetail?.overview || '',
      posterPath: tmdbPlayback.tmdbDetail?.posterPath || null,
      backdropPath: tmdbPlayback.tmdbDetail?.backdropPath || null,
      logoPath: tmdbPlayback.tmdbDetail?.logoPath || null,
      releaseDate: tmdbPlayback.tmdbDetail?.releaseDate || '',
      voteAverage: tmdbPlayback.tmdbDetail?.voteAverage || 0,
      voteCount: tmdbPlayback.tmdbDetail?.voteCount || 0,
      popularity: tmdbPlayback.tmdbDetail?.popularity || 0,
      genreIds: tmdbPlayback.tmdbDetail?.genreIds || [],
      originalLanguage: tmdbPlayback.tmdbDetail?.originalLanguage || '',
      originCountry: tmdbPlayback.tmdbDetail?.originCountry || [],
    }
    toggleTmdbFavorite(tmdbMedia)
    toast.success(tmdbFavoriteActive ? '已取消收藏' : '已加入收藏')
  }, [
    isTmdbRoute,
    parsedTmdbId,
    tmdbFavoriteActive,
    tmdbMediaType,
    tmdbPlayback.tmdbDetail,
    toggleTmdbFavorite,
  ])

  // ── derived data ──
  const title = detail?.videoInfo?.title || tmdbPlayback.tmdbDetail?.title || '未知视频'
  const heroTitle = tmdbPlayback.tmdbDetail?.title || detail?.videoInfo?.title || '未知视频'
  const sourceName =
    detail?.videoInfo?.source_name ||
    sourceOptions.find(o => o.sourceCode === resolvedSourceCode)?.sourceName ||
    '未知来源'
  const rawOverview = tmdbPlayback.tmdbDetail?.overview || detail?.videoInfo?.desc || ''
  const overview = isCmsRoute ? stripHtmlTags(rawOverview) : rawOverview
  const certShort = getCertShort(
    tmdbPlayback.tmdbRichDetail?.adult,
    tmdbPlayback.tmdbRichDetail?.release_dates,
    tmdbPlayback.tmdbRichDetail?.content_ratings,
  )
  useDocumentTitle(title || '视频播放')

  const recommendationItems = isTmdbRoute
    ? tmdbPlayback.recommendations.length > 0
      ? tmdbPlayback.recommendations
      : fallbackRecommendations
    : []
  const detailLink =
    isTmdbRoute && tmdbMediaType ? buildTmdbDetailPath(tmdbMediaType, parsedTmdbId) : undefined
  const seasonCount =
    tmdbMediaType === 'tv'
      ? tmdbPlayback.tmdbRichDetail?.number_of_seasons || tmdbPlayback.seasonOptions.length
      : undefined
  const episodeCount =
    tmdbMediaType === 'tv'
      ? tmdbPlayback.tmdbRichDetail?.number_of_episodes || detail?.episodes.length
      : undefined
  const hasSeasonPanel = !isCmsRoute && tmdbPlayback.seasonOptions.length > 0

  // ── CMS match: search other APIs for same title ──
  const [, startCmsMatch] = useTransition()
  useEffect(() => {
    if (!isCmsRoute || !detail?.videoInfo?.title || !resolvedSourceCode || !resolvedVodId) return
    if (cmsMatchFiredRef.current) return
    cmsMatchFiredRef.current = true

    const title = detail.videoInfo.title.trim()
    if (!title) return
    const enabledSources = useApiStore.getState().videoAPIs.filter(s => s.isEnabled)
    if (enabledSources.length === 0) return

    const controller = new AbortController()
    cmsClient
      .aggregatedSearch(title, enabledSources, 1, controller.signal)
      .then((results: CmsVideoItem[]) => {
        const matched = results
          .filter(r => r.vod_name.trim() === title && r.source_code && r.vod_id)
          .map(r => ({
            sourceCode: r.source_code!,
            vodId: r.vod_id!,
            sourceName: r.source_name || '',
          }))
        if (matched.length > 0) {
          storeCmsSources(title, matched)
          startCmsMatch(() => setCmsMatchedSources(matched))
        }
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') console.warn('CMS 匹配失败:', err)
      })

    return () => controller.abort()
  }, [
    isCmsRoute,
    detail?.videoInfo?.title,
    resolvedSourceCode,
    resolvedVodId,
    cmsClient,
    startCmsMatch,
  ])

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

  // ── language options (multi-language alternatives for current source) ──
  const languageOptions = useMemo(() => {
    const current = sourceOptions.find(o => o.sourceCode === resolvedSourceCode)
    if (!current) return []
    const all = [
      { vodId: current.bestVodId, label: current.bestLabel || '默认', score: current.bestScore },
      ...current.alternatives,
    ]
    return all.filter((a, i, arr) => a.label && arr.findIndex(x => x.vodId === a.vodId) === i)
  }, [sourceOptions, resolvedSourceCode])

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

  // ── better source notice (TMDB) ──
  const bestSourceOption = useMemo(() => {
    if (!isTmdbRoute || sourceOptions.length === 0) return null
    return sourceOptions.reduce(
      (best, o) => (o.bestScore > best.bestScore ? o : best),
      sourceOptions[0],
    )
  }, [isTmdbRoute, sourceOptions])

  const currentSourceScore =
    sourceOptions.find(o => o.sourceCode === resolvedSourceCode)?.bestScore ?? -1
  const shouldShowBetterSource = Boolean(
    isTmdbRoute &&
      bestSourceOption &&
      bestSourceOption.sourceCode !== resolvedSourceCode &&
      bestSourceOption.bestScore > currentSourceScore,
  )

  // ── Video.js player URL（m3u8 走代理） ──
  const rawEpisodeUrl = detail?.episodes?.[selectedEpisode] ?? null
  const proxyPrefix =
    network.isProxyEnabled && network.proxyUrl && network.proxyUrl !== '/proxy?url='
      ? normalizeProxyPrefix(network.proxyUrl)
      : ''
  const proxiedEpisodeUrl =
    rawEpisodeUrl && proxyPrefix ? proxyPrefix + encodeURIComponent(rawEpisodeUrl) : rawEpisodeUrl
  // ponytail: 不含 selectedEpisode — 切集时保持 Player.Provider 挂载，不退出全屏
  const playerKey = `${resolvedSourceCode}:${resolvedVodId}`

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

  const renderErrorState = (message: string) => {
    const isNoMatch = message.includes('没有匹配到可播放资源')
    const isRouteInvalid = message.includes('无效的播放地址')
    const isSourceConfigIssue = message.includes('未找到对应视频源配置')
    const errorTitle = isRouteInvalid
      ? '这个播放地址不可用'
      : isNoMatch
        ? '找不到匹配播放源'
        : '视频暂时无法播放'
    const tag = isRouteInvalid ? '路由校验失败' : isNoMatch ? '匹配结果为空' : '播放链路异常'
    const isCustomProxy = network.proxyUrl && network.proxyUrl !== '/proxy?url='

    return (
      <PlayerErrorState
        title={errorTitle}
        description={message}
        tag={tag}
        primaryAction={{ label: '返回上一页', onClick: () => navigate(-1) }}
        secondaryAction={
          isNoMatch && detailLink
            ? { label: '返回详情页重试', to: detailLink, variant: 'outline' as const }
            : isSourceConfigIssue
              ? { label: '视频源设置', to: '/settings/source', variant: 'outline' as const }
              : detailLink
                ? { label: '查看影视详情', to: detailLink, variant: 'outline' as const }
                : undefined
        }
        extraAction={
          isCustomProxy
            ? {
                label: network.isProxyEnabled ? '切换为直连' : '切换为代理',
                variant: 'outline' as const,
                onClick: () => {
                  setNetworkSettings({ isProxyEnabled: !network.isProxyEnabled })
                  Object.keys(localStorage)
                    .filter(k => k.startsWith('ouonnki-speed::'))
                    .forEach(k => localStorage.removeItem(k))
                  window.location.reload()
                },
              }
            : undefined
        }
      />
    )
  }

  const collapsibleContentClassName = 'overflow-hidden border-t border-border/45 p-3 md:p-4'
  const getPanelClassName = (panel: 'source' | 'season' | 'episode') =>
    cn(
      'overflow-hidden rounded-lg border border-border/60 bg-card/55 transition-all',
      activeRightPanel === panel && 'xl:flex xl:min-h-0 xl:flex-1 xl:flex-col',
    )

  // ── context menu ──
  const favToggleRef = useRef<() => void>(() => {})
  favToggleRef.current = isCmsRoute ? handleToggleCmsFavorite : handleToggleTmdbFavorite
  const favActiveRef = useRef(false)
  favActiveRef.current = isCmsRoute ? cmsFavoriteActive : tmdbFavoriteActive
  const detailLinkRef = useRef(detailLink)
  detailLinkRef.current = detailLink
  const homepageRef = useRef(tmdbPlayback.tmdbRichDetail?.homepage)
  homepageRef.current = tmdbPlayback.tmdbRichDetail?.homepage
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const contextMenuIdsRef = useRef<string[]>([])
  useEffect(() => {
    const { registerItems, unregisterItems } = useGlobalContextMenuStore.getState()
    if (contextMenuIdsRef.current.length > 0) {
      unregisterItems(...contextMenuIdsRef.current)
    }

    const { playback } = useSettingStore.getState()
    const items = []
    if (playback.isScreenshotEnabled)
      items.push({
        id: 'player-screenshot',
        label: '截取画面',
        icon: <Camera className="size-4" />,
        onClick: () => {
          const video = document.querySelector<HTMLVideoElement>('video')
          if (!video || video.videoWidth === 0) return
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          ctx.drawImage(video, 0, 0)
          canvas.toBlob(blob => {
            if (!blob) return
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `screenshot-${Date.now()}.png`
            a.click()
            URL.revokeObjectURL(url)
          }, 'image/png')
        },
      })
    if (playback.isPipEnabled)
      items.push({
        id: 'player-pip',
        label: '画中画',
        icon: <PictureInPicture2 className="size-4" />,
        onClick: () => {
          const video = document.querySelector<HTMLVideoElement>('video')
          if (!video) return
          try {
            if (document.pictureInPictureElement) {
              void document.exitPictureInPicture()
            } else {
              void video.requestPictureInPicture()
            }
          } catch {
            /* noop */
          }
        },
      })
    items.push({
      id: 'player-favorite',
      label: favActiveRef.current ? '取消收藏' : '加入收藏',
      icon: favActiveRef.current ? <HeartOff className="size-4" /> : <Heart className="size-4" />,
      onClick: () => favToggleRef.current(),
    })
    if (detailLinkRef.current) {
      items.push({
        id: 'player-detail',
        label: '查看详情',
        icon: <ExternalLink className="size-4" />,
        onClick: () => navigateRef.current(detailLinkRef.current!),
      })
    }
    if (homepageRef.current) {
      items.push({
        id: 'player-official',
        label: '官方页面',
        icon: <Globe className="size-4" />,
        onClick: () => window.open(homepageRef.current!, '_blank', 'noopener'),
      })
    }

    const ids = registerItems(items)
    contextMenuIdsRef.current = ids
    return () => {
      unregisterItems(...ids)
      contextMenuIdsRef.current = []
    }
  }, [
    isCmsRoute,
    isTmdbRoute,
    cmsFavoriteActive,
    tmdbFavoriteActive,
    detailLink,
    tmdbPlayback.tmdbRichDetail?.homepage,
  ])

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
          <section
            ref={playerSectionRef}
            style={{ '--media-color-primary': playback.playerThemeColor } as React.CSSProperties}
            className={cn(
              'border-border/60 group/player relative overflow-hidden rounded-lg border bg-black/95 shadow-lg',
              'aspect-video min-h-[180px] w-full sm:aspect-auto sm:h-[clamp(240px,56vw,74vh)] sm:min-h-[220px]',
            )}
          >
            {/* Player overlays — 左上角 */}
            <div className="pointer-events-none absolute top-3 left-3 z-30 flex flex-col gap-1.5">
              {/* TMDB 持续匹配提示 */}
              {isTmdbRoute && tmdbPlayback.playlist.loading && tmdbPlayback.playlist.searched && (
                <span className="pointer-events-auto w-fit rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] text-white/70 backdrop-blur-sm">
                  持续匹配中 {tmdbPlayback.playlist.progress.completed}/
                  {tmdbPlayback.playlist.progress.total}
                  {tmdbPlayback.playlist.progress.currentSourceName
                    ? ` · ${tmdbPlayback.playlist.progress.currentSourceName}`
                    : ''}
                </span>
              )}
              {/* Better source notice */}
              {shouldShowBetterSource && bestSourceOption && (
                <button
                  type="button"
                  onClick={() => handleSourceChange(bestSourceOption.sourceCode)}
                  className="pointer-events-auto flex w-fit items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400 backdrop-blur-sm transition-colors hover:bg-amber-500/20"
                >
                  推荐切换到 {bestSourceOption.sourceName} ({bestSourceOption.bestScore})
                  <ChevronDown className="size-3 -rotate-90" />
                </button>
              )}
            </div>
            {proxiedEpisodeUrl ? (
              <Player.Provider key={playerKey}>
                <VideojsSkin
                  languageOptions={languageOptions.length > 1 ? languageOptions : undefined}
                  languageValue={
                    languageOptions.length > 1
                      ? __lastSelectedLangLabel &&
                        languageOptions.some(o => o.label === __lastSelectedLangLabel)
                        ? __lastSelectedLangLabel
                        : languageOptions[0].label
                      : ''
                  }
                  onLanguageChange={(vodId, label) => {
                    __lastSelectedLangLabel = label
                    handleLanguageChange(vodId, label)
                  }}
                  poster={
                    getBackdropUrl(tmdbPlayback.tmdbDetail?.backdropPath || null, 'w1280') ||
                    detail?.videoInfo?.cover ||
                    undefined
                  }
                  title={title}
                  currentEpisode={episodes.length > 1 ? `第 ${selectedEpisode + 1} 集` : undefined}
                  resolutionBadge={
                    resolutionInfo ? (
                      renderResolutionBadge(resolutionInfo)
                    ) : (
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] text-white/30">
                        ···
                      </span>
                    )
                  }
                  episodes={episodes}
                  selectedEpisode={selectedEpisode}
                  onEpisodeSelect={i => handleEpisodeChange(i)}
                  onPrevEpisode={
                    episodes.length > 1 && selectedEpisode > 0
                      ? () =>
                          handleEpisodeChange(
                            episodePagination.isReversed
                              ? episodes.length - 1 - (selectedEpisode - 1)
                              : selectedEpisode - 1,
                          )
                      : undefined
                  }
                  onNextEpisode={
                    episodes.length > 1 && selectedEpisode < episodes.length - 1
                      ? () =>
                          handleEpisodeChange(
                            episodePagination.isReversed
                              ? episodes.length - 1 - (selectedEpisode + 1)
                              : selectedEpisode + 1,
                          )
                      : undefined
                  }
                >
                  <MediaElement
                    src={proxiedEpisodeUrl}
                    playsInline
                    autoPlay
                    hlsConfig={hlsConfig}
                  />
                  {/* Overlays — inside Container, visible in fullscreen */}
                  {playerNotice && (
                    <div className="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2">
                      <span className="rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-xs whitespace-nowrap text-white shadow-lg backdrop-blur-sm">
                        {playerNotice}
                      </span>
                    </div>
                  )}
                  {speedNotice && (
                    <div className="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2">
                      <span className="rounded-full bg-black/70 px-3 py-1.5 text-sm font-bold text-white shadow-lg backdrop-blur-sm">
                        {speedNotice}
                      </span>
                    </div>
                  )}
                  {seekPreview && (
                    <div className="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2">
                      <span className="rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-xs text-white tabular-nums shadow-lg backdrop-blur-sm">
                        {seekPreview}
                      </span>
                    </div>
                  )}
                </VideojsSkin>
                <PlaybackTracker
                  resolvedSourceCode={resolvedSourceCode}
                  resolvedVodId={resolvedVodId}
                  detail={detail}
                  episodes={episodes}
                  selectedEpisode={selectedEpisode}
                  canUseTmdbHistory={canUseTmdbHistory}
                  tmdbMediaType={tmdbMediaType}
                  parsedTmdbId={parsedTmdbId}
                  tmdbSeasonNumberForHistory={tmdbSeasonNumberForHistory}
                  backdropUrl={
                    getBackdropUrl(tmdbPlayback.tmdbDetail?.backdropPath || null, 'w1280') || ''
                  }
                  onEnded={() => {
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
                  }}
                />
                <SourceAutoSwitch
                  resolvedSourceCode={resolvedSourceCode}
                  isTmdbRoute={isTmdbRoute}
                  isCmsRoute={isCmsRoute}
                  sourceOptions={sourceOptions.map(o => ({
                    sourceCode: o.sourceCode,
                    sourceName: o.sourceName,
                    bestVodId: o.bestVodId,
                  }))}
                  selectedEpisode={selectedEpisode}
                  speedResults={speedResults}
                  onNotice={showPlayerNotice}
                  onAllExhausted={() => setAllExhausted(true)}
                />
                <ResolutionTracker onResolution={setResolutionInfo} />
                <DefaultVolumeSetter />
                <LoopSetter />
                <AutoPiP
                  playerSectionRef={playerSectionRef}
                  enabled={playback.isAutoMiniEnabled}
                  pipEnabled={playback.isPipEnabled}
                  currentUrl={proxiedEpisodeUrl}
                />
                <OrientationLocker />
                <VideojsMobileGestures
                  playerSectionRef={playerSectionRef}
                  onSpeedChange={handleSpeedChange}
                  onSeekPreview={handleSeekPreview}
                  onSeekPreviewEnd={handleSeekPreviewEnd}
                />
                <SpeedTracker onChange={handleSpeedChange} />
                <DesktopSpeedKeys onSpeedChange={handleSpeedChange} />
              </Player.Provider>
            ) : (
              <div className="text-muted-foreground flex aspect-video items-center justify-center text-sm">
                暂无播放地址
              </div>
            )}
            {isDetailRefreshing && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
                <div className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-sm text-white">
                  <Spinner size="sm" />
                  正在切换资源...
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ── Right panels ── */}
        <aside className="min-w-0 xl:sticky xl:top-20 xl:h-[clamp(240px,56vw,74vh)] xl:min-h-[220px] xl:pr-1">
          {!hasSourcePanel && isCmsRoute ? (
            <CmsEpisodePanel
              totalEpisodes={detail.episodes.length}
              selectedEpisode={selectedEpisode}
              isReversed={episodePagination.isReversed}
              onToggleOrder={() => episodePagination.setIsReversed(prev => !prev)}
              pageRanges={episodePagination.pageRanges}
              currentPageRange={episodePagination.currentPageRange}
              onPageRangeChange={episodePagination.setCurrentPageRange}
              episodes={episodePagination.currentPageEpisodes}
              onEpisodeSelect={handleEpisodeChange}
              episodeProgressMap={episodeProgressMap}
            />
          ) : (
            <div className="space-y-3 xl:flex xl:h-full xl:flex-col xl:gap-3 xl:space-y-0">
              {/* Source panel */}
              {hasSourcePanel && (
                <Collapsible
                  open={activeRightPanel === 'source'}
                  onOpenChange={open => setActiveRightPanel(open ? 'source' : null)}
                  className={getPanelClassName('source')}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-label="展开或收起换源面板"
                      className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-3 text-sm font-semibold md:px-4"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate">换源</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {sourceOptions.length} 源
                        </span>
                      </span>
                      <ChevronDown
                        className={`size-4 transition-transform ${activeRightPanel === 'source' ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    className={cn(
                      collapsibleContentClassName,
                      activeRightPanel === 'source' && 'xl:flex xl:min-h-0 xl:flex-1 xl:flex-col',
                    )}
                  >
                    <ContextMenu key="source-panel">
                      <ContextMenuTrigger asChild>
                        <ScrollArea className="max-h-44 sm:max-h-56 xl:h-full xl:max-h-none">
                          <div className="grid grid-cols-2 gap-2 pr-2">
                            {sourceOptions
                              .filter(
                                o =>
                                  videoAPIs.find(s => s.id === o.sourceCode)?.isEnabled !== false,
                              )
                              .map(option => {
                                const active = option.sourceCode === resolvedSourceCode
                                const hasMultiLang = option.alternatives.length > 0
                                return (
                                  <ContextMenu key={option.sourceCode}>
                                    <ContextMenuTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant={active ? 'default' : 'secondary'}
                                        className="relative max-w-full min-w-0 justify-start gap-1.5 overflow-hidden rounded-full sm:w-auto sm:max-w-[260px]"
                                        aria-current={active ? 'true' : undefined}
                                        aria-label={`切换到视频源 ${option.sourceName}`}
                                        onClick={() => handleSourceChange(option.sourceCode)}
                                      >
                                        <span className="truncate text-xs font-medium">
                                          {option.sourceName}
                                        </span>
                                        {isTmdbRoute && (
                                          <span className="shrink-0 text-[11px] opacity-70">
                                            {option.bestScore}
                                          </span>
                                        )}
                                        <div className="ml-auto flex shrink-0 flex-col items-end gap-0.5">
                                          {/* 上方：分辨率标签（测速中隐藏，测速结果优先，兜底 bestQuality） */}
                                          {!speedTesting.has(option.sourceCode) &&
                                            (() => {
                                              const testQuality = speedResults.get(
                                                option.sourceCode,
                                              )?.quality
                                              const label = testQuality?.label || option.bestQuality
                                              if (!label) return null
                                              const color =
                                                testQuality?.color ||
                                                RES_COLORS[label] ||
                                                'bg-foreground/10'
                                              return (
                                                <span
                                                  className={`${color} rounded px-1.5 py-0.5 text-[10px] leading-none text-white`}
                                                >
                                                  {label}
                                                </span>
                                              )
                                            })()}
                                          {/* 下方：速度 badge（无结果时不显示） */}
                                          {(speedResults.get(option.sourceCode) ||
                                            speedTesting.has(option.sourceCode)) && (
                                            <SpeedTestBadge
                                              result={speedResults.get(option.sourceCode) ?? null}
                                              testing={speedTesting.has(option.sourceCode)}
                                            />
                                          )}
                                        </div>
                                        {hasMultiLang && (
                                          <span
                                            className="pointer-events-none absolute inset-0 opacity-30"
                                            style={{
                                              backgroundImage:
                                                'linear-gradient(45deg, transparent 80%, currentColor 80%, currentColor 90%, transparent 90%)',
                                            }}
                                            title="多语言"
                                          />
                                        )}
                                      </Button>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent>
                                      <ContextMenuItem
                                        onClick={() => speedTestSingle(option.sourceCode)}
                                      >
                                        <Activity className="mr-2 size-3.5" />
                                        {speedResults.has(option.sourceCode) ? '重新检测' : '检测'}
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        variant="destructive"
                                        onClick={() => setApiEnabled(option.sourceCode, false)}
                                      >
                                        <Ban className="mr-2 size-3.5" />
                                        禁用源
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenu>
                                )
                              })}
                          </div>
                        </ScrollArea>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        {isTmdbRoute && (
                          <ContextMenuItem onClick={() => tmdbPlayback.playlist.retry()}>
                            <RefreshCw className="mr-2 size-3.5" />
                            重新匹配源
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem onClick={() => speedTestAll()}>
                          <Activity className="mr-2 size-3.5" />
                          源质量重测
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Season panel */}
              {hasSeasonPanel && (
                <Collapsible
                  open={activeRightPanel === 'season'}
                  onOpenChange={open => setActiveRightPanel(open ? 'season' : null)}
                  className={getPanelClassName('season')}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-label="展开或收起选季面板"
                      className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-3 text-sm font-semibold md:px-4"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate">选季</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {tmdbPlayback.seasonOptions.length} 季
                        </span>
                      </span>
                      <ChevronDown
                        className={`size-4 transition-transform ${activeRightPanel === 'season' ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    className={cn(
                      collapsibleContentClassName,
                      activeRightPanel === 'season' && 'xl:min-h-0 xl:flex-1',
                    )}
                  >
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {tmdbPlayback.seasonOptions.map(option => {
                        const active = option.seasonNumber === tmdbPlayback.selectedSeasonNumber
                        return (
                          <Button
                            key={option.seasonNumber}
                            size="sm"
                            variant={active ? 'default' : 'secondary'}
                            className="max-w-full min-w-0 justify-between rounded-full sm:w-auto sm:max-w-[240px]"
                            aria-current={active ? 'true' : undefined}
                            onClick={() => handleSeasonChange(option.seasonNumber)}
                          >
                            <span className="truncate">S{option.seasonNumber}</span>
                            <span className="shrink-0 text-[11px] opacity-70">
                              {option.matchedSourceCount}
                            </span>
                          </Button>
                        )
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Episode panel */}
              {episodes.length > 0 && (
                <Collapsible
                  open={activeRightPanel === 'episode'}
                  onOpenChange={open => setActiveRightPanel(open ? 'episode' : null)}
                  className={getPanelClassName('episode')}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-label="展开或收起选集面板"
                      className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-3 text-sm font-semibold md:px-4"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0">选集</span>
                        <span className="text-muted-foreground truncate text-xs">
                          第 {selectedEpisode + 1} 集 / 共 {detail.episodes.length} 集
                        </span>
                      </span>
                      <ChevronDown
                        className={`size-4 transition-transform ${activeRightPanel === 'episode' ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    className={cn(
                      collapsibleContentClassName,
                      activeRightPanel === 'episode' && 'xl:min-h-0 xl:flex-1',
                    )}
                  >
                    <div className={activeRightPanel === 'episode' ? 'xl:h-full' : undefined}>
                      <PlayerEpisodePanel
                        totalEpisodes={detail.episodes.length}
                        selectedEpisode={selectedEpisode}
                        isReversed={episodePagination.isReversed}
                        onToggleOrder={() => episodePagination.setIsReversed(prev => !prev)}
                        pageRanges={episodePagination.pageRanges}
                        currentPageRange={episodePagination.currentPageRange}
                        onPageRangeChange={episodePagination.setCurrentPageRange}
                        episodes={episodePagination.currentPageEpisodes}
                        onEpisodeSelect={handleEpisodeChange}
                        episodeProgressMap={episodeProgressMap}
                        compact
                        fillHeight={activeRightPanel === 'episode'}
                        hideHeader
                        className="border-0 bg-transparent p-0 md:p-0"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
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
