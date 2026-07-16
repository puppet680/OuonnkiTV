import { useEffect, useRef } from 'react'
import { useContainer } from '@videojs/react'

const LONG_PRESS_MS = 400
const SPEED_UP_RATE = 2
const SPEED_DOWN_RATE = 0.5
const SEEK_SECS = 5

interface Props {
  onSpeedChange?: (rate: number) => void
}

/**
 * ←/→ 短按 seek 5s，长按倍速（释放恢复）
 * 全屏滚轮调音量 — 派发 KeyboardEvent 走 Video.js hotkey → volumeStep → VolumeIndicator
 */
export function DesktopSpeedKeys({ onSpeedChange }: Props) {
  const container = useContainer()
  const containerRef = useRef(container)
  containerRef.current = container
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const onSpeedChangeRef = useRef(onSpeedChange)
  onSpeedChangeRef.current = onSpeedChange

  useEffect(() => {
    const getVideo = () => document.querySelector<HTMLVideoElement>('video')

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (!getVideo()) return

      e.preventDefault()
      longPressFiredRef.current = false

      const isRight = e.key === 'ArrowRight'
      const rate = isRight ? SPEED_UP_RATE : SPEED_DOWN_RATE

      timerRef.current = setTimeout(() => {
        longPressFiredRef.current = true
        const video = getVideo()
        if (video) {
          video.playbackRate = rate
          onSpeedChangeRef.current?.(rate)
        }
      }, LONG_PRESS_MS)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      const video = getVideo()
      if (!video) return

      if (longPressFiredRef.current) {
        // 长按释放 → 恢复原速
        video.playbackRate = 1
        onSpeedChangeRef.current?.(1)
      } else {
        // 短按 → seek
        const isRight = e.key === 'ArrowRight'
        const target = Math.min(
          Math.max((video.currentTime || 0) + (isRight ? SEEK_SECS : -SEEK_SECS), 0),
          video.duration || 0,
        )
        video.currentTime = target
      }
    }

    const onWheel = (e: WheelEvent) => {
      if (!document.fullscreenElement) return
      const ct = containerRef.current
      if (!ct || !ct.contains(e.target as Node)) return
      // 忽略侧边栏/弹出层的滚轮事件
      if ((e.target as HTMLElement).closest('[data-slot="collapsible"], [role="dialog"], [data-radix-popper-content-wrapper], [role="menu"], [data-menu-viewport]')) return
      e.preventDefault()
      // 派发键盘事件走 Video.js hotkey 系统，触发 VolumeIndicator UI
      ct.dispatchEvent(new KeyboardEvent('keydown', {
        key: e.deltaY > 0 ? 'ArrowDown' : 'ArrowUp',
        bubbles: true,
        cancelable: true,
      }))
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('wheel', onWheel)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return null
}
