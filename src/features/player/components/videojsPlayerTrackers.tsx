import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import type { DetailResult } from '@ouonnki/cms-core'
import { useViewingHistoryStore } from '@/shared/store/viewingHistoryStore'
import { useSettingStore } from '@/shared/store/settingStore'
import { buildCmsPlayPath } from '@/shared/lib/routes'
import { isTmdbHistoryItem } from '@/shared/lib/viewingHistory'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import type { ViewingHistoryItem } from '@/shared/types'
import { getResolutionLabel, type VideoResolutionInfo } from '../lib/resolution-labels'
import type { VideoSourceTestResult } from '../lib/source-speed-test'
import { Player } from './videojsPlayerCore'

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
export function PlaybackTracker({
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
export function SourceAutoSwitch({
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
export function ResolutionTracker({ onResolution }: ResolutionTrackerProps) {
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

// ── Speed tracker: watch playbackrate and notify ──

/**
 * 轮询 playbackRate，变化时通知外部（显示倍速提示）
 */
export function SpeedTracker({ onChange }: { onChange: (rate: number) => void }) {
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

// ── Default volume setter ──

/**
 * 播放器初始化时将音量设为用户设置的默认值
 * 轮询等待 <video> 元素出现后直接设 volume，避免 store target 未就绪
 */
export function DefaultVolumeSetter() {
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
export function LoopSetter() {
  const loopEnabled = useSettingStore(s => s.playback.isLoopEnabled)

  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>('video')
    if (video) video.loop = loopEnabled
  }, [loopEnabled])

  return null
}
