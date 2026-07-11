import { useState, useEffect, useRef, useCallback } from 'react'
import type { VideoResolutionInfo } from './useVideoResolution'

const AUTO_HIDE_DELAY = 5000 // 5 秒后自动隐藏

/**
 * 分辨率标签自动隐藏 Hook
 * - 分辨率首次检测到或变化时显示
 * - 5 秒后自动隐藏
 * - 鼠标移动 / 触摸时重新显示
 */
export function useResolutionBadge(resolution: VideoResolutionInfo | null) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startHideTimer = useCallback(() => {
    clearTimer()
    timerRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_DELAY)
  }, [clearTimer])

  // 分辨率变化时显示并启动计时器
  useEffect(() => {
    if (resolution) {
      setVisible(true)
      startHideTimer()
    } else {
      setVisible(false)
      clearTimer()
    }
  }, [resolution, startHideTimer, clearTimer])

  // 用户交互时短暂展示
  const flashBadge = useCallback(() => {
    if (!resolution) return
    setVisible(true)
    startHideTimer()
  }, [resolution, startHideTimer])

  // 清理
  useEffect(() => clearTimer, [clearTimer])

  return { badgeVisible: visible, flashBadge }
}
