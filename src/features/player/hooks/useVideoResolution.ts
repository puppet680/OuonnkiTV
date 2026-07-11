import { useState, useEffect, useCallback } from 'react'
import type Artplayer from 'artplayer'
import { getResolutionLabel, type ResolutionLabel } from '../lib/resolution-labels'

export interface VideoResolutionInfo extends ResolutionLabel {
  width: number
  height: number
}

/**
 * 检测实际视频播放分辨率
 * 监听 Artplayer 的 video:resize 事件（HLS 切换质量时触发）
 */
export function useVideoResolution(art: Artplayer | null): VideoResolutionInfo | null {
  const [resolution, setResolution] = useState<VideoResolutionInfo | null>(null)

  const detect = useCallback(() => {
    if (!art?.video) return
    const w = art.video.videoWidth
    const h = art.video.videoHeight
    if (w > 0 && h > 0) {
      const info = getResolutionLabel(w, h)
      setResolution({ width: w, height: h, ...info })
    }
  }, [art])

  useEffect(() => {
    if (!art) return

    // Artplayer ready 时 video metadata 已加载
    art.on('ready', detect)

    // HLS.js 切换质量时 video 尺寸会变
    art.on('video:resize', detect)

    // 已经就绪时直接检测
    if (art.video?.videoWidth > 0) detect()

    return () => {
      art.off('ready', detect)
      art.off('video:resize', detect)
    }
  }, [art, detect])

  return resolution
}
