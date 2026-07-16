import { useEffect, useRef } from 'react'
import { useContainer } from '@videojs/react'
import { useSettingStore } from '@/shared/store/settingStore'

// ── helpers ──

const isTouchDevice = () =>
  window.matchMedia('(hover: none) and (pointer: coarse)').matches || navigator.maxTouchPoints > 0

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const hasOpenMenu = () => document.querySelector('.media-menu--settings') !== null

const ACTIVATION_PX = 12
const SEEK_SECS_PER_100PX = 12
const VOLUME_FULL_RANGE = 0.9
const LONG_PRESS_MS = 380
const RATES = [0.2, 0.5, 0.7, 1, 1.2, 1.5, 1.7, 2, 3, 4] as const
const STEP_PX = 55

const nearestRateIndex = (rate: number) =>
  RATES.reduce((best, r, i) => Math.abs(r - rate) < Math.abs(RATES[best] - rate) ? i : best, 0)

interface Props {
  container: HTMLElement | null
  onSpeedChange?: (rate: number) => void
  onSeekPreview?: (time: number, duration: number) => void
  onSeekPreviewEnd?: () => void
}

/**
 * 移动端全屏手势：水平滑动 seek、垂直滑动音量、长按倍速
 */
export function VideojsMobileGestures({ container, onSpeedChange, onSeekPreview, onSeekPreviewEnd }: Props) {
  const sessionRef = useRef<{
    touchId: number
    startX: number; startY: number
    startTime: number; startVolume: number
    w: number; h: number
    axis: 'h' | 'v' | null
    longPressFired: boolean
    rateAtLongPress: number
    rateAdjusted: boolean
    lastSeekTarget: number
  } | null>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rateBeforeRef = useRef(1)
  const onSpeedChangeRef = useRef(onSpeedChange)
  onSpeedChangeRef.current = onSpeedChange
  const onSeekPreviewRef = useRef(onSeekPreview)
  onSeekPreviewRef.current = onSeekPreview
  const onSeekPreviewEndRef = useRef(onSeekPreviewEnd)
  onSeekPreviewEndRef.current = onSeekPreviewEnd
  const jsContainer = useContainer()
  const jsContainerRef = useRef(jsContainer)
  jsContainerRef.current = jsContainer

  const { longPressPlaybackRate, isMobileGestureEnabled } = useSettingStore(s => s.playback)
  const longPressRateRef = useRef(longPressPlaybackRate)
  longPressRateRef.current = longPressPlaybackRate
  const gestureEnabledRef = useRef(isMobileGestureEnabled)
  gestureEnabledRef.current = isMobileGestureEnabled

  useEffect(() => {
    if (!isTouchDevice() || !container || !gestureEnabledRef.current) return

    const getVideo = () => document.querySelector<HTMLVideoElement>('video')
    const isFullscreen = () => Boolean(document.fullscreenElement)
    const getPos = (touch: Touch) => {
      const r = container.getBoundingClientRect()
      return { x: touch.clientX - r.left, y: touch.clientY - r.top, w: r.width, h: r.height }
    }

    const clearSession = () => {
      if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
      const s = sessionRef.current
      if (s?.axis === 'h') onSeekPreviewEndRef.current?.()
      if (s?.longPressFired) {
        const video = getVideo()
        if (video) {
          if (s.rateAdjusted) {
            onSpeedChangeRef.current?.(video.playbackRate)
          } else {
            video.playbackRate = clamp(rateBeforeRef.current, 0.1, 16)
            onSpeedChangeRef.current?.(rateBeforeRef.current)
          }
        }
      }
      sessionRef.current = null
    }

    const onTouchStart = (e: TouchEvent) => {
      if (!isFullscreen() || sessionRef.current || hasOpenMenu()) return
      const touch = e.changedTouches.item(0)
      if (!touch) return
      const pos = getPos(touch)
      const video = getVideo()
      if (!video) return

      // 中间区域默认水平滑动(seek)，两侧为垂直滑动(音量)
      const isSide = pos.x < pos.w * 0.22 || pos.x > pos.w * 0.78

      sessionRef.current = {
        touchId: touch.identifier,
        startX: pos.x, startY: pos.y,
        startTime: video.currentTime || 0,
        startVolume: video.volume,
        w: pos.w, h: pos.h,
        axis: isSide ? 'v' : null,
        longPressFired: false,
        rateAtLongPress: longPressRateRef.current,
        rateAdjusted: false,
        lastSeekTarget: video.currentTime || 0,
      }

      rateBeforeRef.current = video.playbackRate || 1
      longPressRef.current = setTimeout(() => {
        const s = sessionRef.current
        if (!s) return
        s.longPressFired = true
        const v = getVideo()
        if (v) { v.playbackRate = longPressRateRef.current; onSpeedChangeRef.current?.(longPressRateRef.current) }
      }, LONG_PRESS_MS)
    }

    const onTouchMove = (e: TouchEvent) => {
      const s = sessionRef.current
      if (!s || hasOpenMenu()) return

      let touch: Touch | null = null
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches.item(i)?.identifier === s.touchId) { touch = e.changedTouches.item(i); break }
      }
      if (!touch) return

      const pos = getPos(touch)
      const dx = pos.x - s.startX

      // 长按倍速模式 → 左右滑动按预设档位切换倍速
      if (s.longPressFired) {
        e.preventDefault()
        const startIdx = nearestRateIndex(longPressRateRef.current)
        const idx = clamp(startIdx + Math.round(dx / STEP_PX), 0, RATES.length - 1)
        const newRate = RATES[idx]
        const video = getVideo()
        if (video && video.playbackRate !== newRate) {
          s.rateAdjusted = true
          video.playbackRate = newRate
          onSpeedChangeRef.current?.(newRate)
        }
        return
      }

      const dy = pos.y - s.startY

      if (!s.axis && (Math.abs(dx) > ACTIVATION_PX || Math.abs(dy) > ACTIVATION_PX)) {
        s.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
      // 轴确定后（不论此时刚确定还是 touchstart 已锁定）立即取消长按计时
      if (s.axis && longPressRef.current) {
        clearTimeout(longPressRef.current); longPressRef.current = null
      }

      const video = getVideo()
      if (!video || video.duration <= 0) return

      if (s.axis === 'h') {
        // 水平滑动 → seek：右滑前进，左滑后退
        const seekDelta = (dx / 100) * SEEK_SECS_PER_100PX
        const target = clamp(s.startTime + seekDelta, 0, video.duration)
        if (target !== s.lastSeekTarget) {
          s.lastSeekTarget = target
          video.currentTime = target
          onSeekPreviewRef.current?.(target, video.duration)
        }
      } else if (s.axis === 'v') {
        // 垂直滑动 → 音量（派发键盘事件触发 Video.js VolumeIndicator）
        const volDelta = -dy / (s.h * VOLUME_FULL_RANGE)
        const newVol = clamp(s.startVolume + volDelta, 0, 1)
        video.volume = newVol
        video.muted = false
        const jsct = jsContainerRef.current
        if (jsct) {
          jsct.dispatchEvent(new KeyboardEvent('keydown', {
            key: newVol > s.startVolume ? 'ArrowUp' : 'ArrowDown',
            bubbles: true, cancelable: true,
          }))
          // hotkey 也会调音量步进 0.05，覆盖回正确值
          video.volume = newVol
        }
      }
    }

    const onTouchEnd = () => clearSession()
    const onTouchCancel = () => clearSession()
    const onFullscreenChange = () => { if (!document.fullscreenElement) clearSession() }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd)
    container.addEventListener('touchcancel', onTouchCancel)
    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchCancel)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      clearSession()
    }
  }, [container])

  return null
}
