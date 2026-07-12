/**
 * M3U8 源测速 —— 从 LunaTV 移植，精简首版
 * 创建隐藏 video + HLS.js 加载 M3U8，测量 ping/分辨率/下载速度
 */
import Hls from 'hls.js'
import { getResolutionLabel, type ResolutionLabel } from './resolution-labels'

export interface VideoSourceTestResult {
  quality: ResolutionLabel | null
  loadSpeed: string        // "1.23 MB/s" | "456.78 KB/s" | "未知"
  pingTime: number         // ms
  speedKBps?: number
  hasError?: boolean
  status?: 'ok' | 'partial' | 'failed'
  message?: string
  playable?: boolean
  testedAt?: number
}

function formatSpeed(speedKBps: number): string {
  if (!Number.isFinite(speedKBps) || speedKBps <= 0) return '未知'
  if (speedKBps >= 1024) return `${(speedKBps / 1024).toFixed(2)} MB/s`
  return `${speedKBps.toFixed(2)} KB/s`
}

/**
 * 从 M3U8 地址获取视频分辨率 + 网络速度
 * @param m3u8Url m3u8 播放列表 URL
 * @param timeoutMs 超时毫秒，默认 8000
 * @returns Promise<VideoSourceTestResult>
 */
export async function testM3u8Source(
  m3u8Url: string,
  timeoutMs = 8000,
): Promise<VideoSourceTestResult> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'metadata'
    video.style.position = 'absolute'
    video.style.left = '-9999px'
    video.style.width = '32px'
    video.style.height = '18px'

    // ping
    const pingStart = performance.now()
    let pingTime = 0
    const pingPromise = fetch(m3u8Url, { method: 'HEAD', mode: 'no-cors' })
      .then(() => { pingTime = performance.now() - pingStart })
      .catch(() => { pingTime = performance.now() - pingStart })

    const hls = new Hls({
      debug: false,
      enableWorker: true,
      lowLatencyMode: false,
      fragLoadingRetryDelay: 300,
      fragLoadingMaxRetry: 2,
      maxBufferLength: 8,
      maxBufferSize: 5 * 1024 * 1024,
      abrEwmaDefaultEstimate: 3_000_000,
    })

    const timeout = setTimeout(() => {
      cleanup()
      resolve({
        quality: null,
        loadSpeed: '未知',
        pingTime: Math.round(pingTime) || 9999,
        status: 'failed',
        message: '测速超时',
        hasError: true,
        playable: false,
        testedAt: Date.now(),
      })
    }, timeoutMs)

    const cleanup = () => {
      clearTimeout(timeout)
      try { hls.destroy() } catch { /* ignore */ }
      try { video.remove() } catch { /* ignore */ }
    }

    video.onerror = () => {
      cleanup()
      resolve({
        quality: null,
        loadSpeed: '未知',
        pingTime: Math.round(pingTime) || 9999,
        status: 'failed',
        message: '视频加载失败',
        hasError: true,
        playable: false,
        testedAt: Date.now(),
      })
    }

    let actualLoadSpeed = '未知'
    let actualSpeedKBps = 0
    let hasSpeedCalculated = false
    let hasMetadataLoaded = false
    let fragmentStartTime = 0

    const checkAndResolve = async () => {
      if (hasMetadataLoaded && (hasSpeedCalculated || actualLoadSpeed !== '未知')) {
        await pingPromise
        const quality = getResolutionLabel(video.videoWidth, video.videoHeight)

        cleanup()
        resolve({
          quality,
          loadSpeed: actualLoadSpeed,
          pingTime: Math.round(pingTime),
          speedKBps: actualSpeedKBps > 0 ? actualSpeedKBps : undefined,
          status: 'ok',
          message: '测速完成',
          hasError: false,
          playable: true,
          testedAt: Date.now(),
        })
      }
    }

    hls.on(Hls.Events.FRAG_LOADING, () => {
      if (!hasSpeedCalculated) fragmentStartTime = performance.now()
    })

    hls.on(Hls.Events.FRAG_LOADED, (_event: unknown, data: { payload?: { byteLength?: number } }) => {
      if (fragmentStartTime > 0 && data?.payload && !hasSpeedCalculated) {
        const loadTime = performance.now() - fragmentStartTime
        const size = data.payload.byteLength || 0
        if (loadTime > 0 && size > 0) {
          actualSpeedKBps = size / 1024 / (loadTime / 1000)
          actualLoadSpeed = formatSpeed(actualSpeedKBps)
          hasSpeedCalculated = true
          checkAndResolve()
        }
      }
    })

    video.addEventListener('loadedmetadata', () => {
      hasMetadataLoaded = true
      checkAndResolve()
    })

    hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean }) => {
      if (data.fatal) {
        cleanup()
        resolve({
          quality: null,
          loadSpeed: '未知',
          pingTime: Math.round(pingTime) || 9999,
          status: 'failed',
          message: 'HLS 错误',
          hasError: true,
          playable: false,
          testedAt: Date.now(),
        })
      }
    })

    // 破缓存
    hls.config.xhrSetup = (xhr: XMLHttpRequest, url: string) => {
      const sep = url.includes('?') ? '&' : '?'
      xhr.open('GET', `${url}${sep}_t=${Date.now()}`, true)
    }

    try {
      hls.loadSource(m3u8Url)
      hls.attachMedia(video)
      // 追加到 DOM（有些浏览器需要元素在文档中才能触发 loadedmetadata）
      document.body.appendChild(video)
    } catch {
      cleanup()
      resolve({
        quality: null,
        loadSpeed: '未知',
        pingTime: 9999,
        status: 'failed',
        message: 'HLS 加载失败',
        hasError: true,
        playable: false,
        testedAt: Date.now(),
      })
    }
  })
}
