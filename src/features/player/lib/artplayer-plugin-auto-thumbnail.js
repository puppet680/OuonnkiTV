/**
 * ArtPlayer Auto Thumbnail Plugin
 * 自动从视频中提取缩略图，用于进度条预览
 * 来源: https://github.com/zhw2590582/ArtPlayer/tree/master/packages/artplayer-plugin-auto-thumbnail
 */

const isM3u8 = (url) => /\.m3u8(\?|$)/i.test(url)

function createWithNative({ url, width, number }, callback) {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.src = url
  setupExtraction(video, { url, width, number }, callback)
}

async function createWithHls({ url, width, number }, callback) {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true

  try {
    const HlsClass = (await import('hls.js/dist/hls.light.mjs')).default
    if (!HlsClass.isSupported()) {
      // HLS.js 不支持，回退到原生
      createWithNative({ url, width, number }, callback)
      return
    }
    const hls = new HlsClass()
    hls.loadSource(url)
    hls.attachMedia(video)
    // loadedmetadata 在 HLS.js 加载清单后触发
    setupExtraction(video, { url, width, number }, callback)
  } catch {
    // 动态导入失败，尝试原生
    createWithNative({ url, width, number }, callback)
  }
}

function setupExtraction(video, { width, number }, callback) {
  video.onloadedmetadata = () => {
    const duration = video.duration
    if (!duration || !Number.isFinite(duration)) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const height = Math.floor((width * video.videoHeight) / video.videoWidth)
    if (height <= 0) return

    canvas.width = width * 10
    canvas.height = height * Math.ceil(number / 10)

    let blobUrl = null
    let aborted = false

    video.addEventListener('error', () => { aborted = true })

    function seekAndDraw(index) {
      if (aborted) return

      canvas.toBlob((blob) => {
        if (!blob || aborted) return
        URL.revokeObjectURL(blobUrl)
        blobUrl = URL.createObjectURL(blob)
        callback({ url: blobUrl, height })
      }, 'image/jpeg')

      if (index >= number) return
      video.currentTime = (duration * index) / number

      video.onseeked = () => {
        if (aborted) return
        ctx.drawImage(
          video,
          (index % 10) * width,
          Math.floor(index / 10) * height,
          width,
          height,
        )
        seekAndDraw(index + 1)
      }
    }

    seekAndDraw(0)
  }
}

function create(params, callback) {
  if (isM3u8(params.url)) {
    createWithHls(params, callback)
  } else {
    createWithNative(params, callback)
  }
}

export default function artplayerPluginAutoThumbnail(option = {}) {
  return async (art) => {
    art.on('video:loadedmetadata', () => {
      const url = option.url || art.option.url
      const width = option.width || 160
      const number = option.number || 100
      const scale = option.scale || 1
      create({ url, width, number }, (config) => {
        art.thumbnails = {
          ...config,
          column: 10,
          number,
          width,
          scale,
        }
      })
    })

    return {
      name: 'artplayerPluginAutoThumbnail',
    }
  }
}
