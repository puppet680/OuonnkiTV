/* eslint-disable @typescript-eslint/no-explicit-any */
import type { M3u8Processor } from './processor'

/**
 * HLS加载器配置
 */
export interface HlsLoaderConfig {
  /** M3U8处理器 */
  m3u8Processor: M3u8Processor
  /** HLS.js 模块引用，用于获取默认加载器 */
  Hls: any
}

/**
 * 创建HLS.js兼容的加载器类
 * 注意：此函数返回一个类，需要在HLS.js配置中使用
 *
 * @example
 * ```typescript
 * import Hls from 'hls.js'
 * import { createM3u8Processor, createHlsLoaderClass } from '@ouonnki/cms-core/m3u8'
 *
 * const processor = createM3u8Processor({ filterAds: true })
 * const CustomLoader = createHlsLoaderClass({ m3u8Processor: processor, Hls })
 *
 * const hls = new Hls({
 *   loader: CustomLoader
 * })
 * ```
 */
/** 获取 M3U8 的基准 URL（用于补全相对路径） */
function getBaseUrl(m3u8Url: string): string {
  const idx = m3u8Url.lastIndexOf('/')
  return idx > 0 ? m3u8Url.slice(0, idx + 1) : m3u8Url
}

/** 补全 M3U8 内容中所有相对路径为绝对 URL */
function resolveRelativeUrls(content: string, baseUrl: string): string {
  if (!baseUrl) return content
  return content.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line
    try {
      new URL(trimmed) // 已经是绝对 URL
      return line
    } catch {
      return line.replace(trimmed, new URL(trimmed, baseUrl).toString())
    }
  }).join('\n')
}

export function createHlsLoaderClass(config: HlsLoaderConfig): any {
  const { m3u8Processor, Hls } = config

  // 获取默认加载器类
  const DefaultLoader = Hls.DefaultConfig.loader

  // 创建继承默认加载器的自定义类
  return class CustomHlsLoader extends DefaultLoader {
    constructor(hlsConfig: any) {
      super(hlsConfig)

      // 保存原始load方法
      const originalLoad = this.load.bind(this)

      // 重写load方法
      this.load = (context: any, loadConfig: any, callbacks: any) => {
        const isM3u8 = typeof context.url === 'string'
          && (context.url.includes('.m3u8') || context.url.includes('.M3U8'))

        // 对所有 M3U8 播放列表应用广告过滤（含 level 类型在 light 版本 type=undefined 的情况）
        if (context.type === 'manifest' || context.type === 'level' || isM3u8) {
          const originalOnSuccess = callbacks.onSuccess
          const baseUrl = getBaseUrl(context.url)

          callbacks.onSuccess = (response: any, stats: any, ctx: any, networkDetails: unknown) => {
            if (response.data && typeof response.data === 'string') {
              // 先把相对路径补全为绝对 URL，再交给过滤器处理
              const resolved = resolveRelativeUrls(response.data, baseUrl)
              response.data = m3u8Processor.process(resolved)
            }
            return originalOnSuccess(response, stats, ctx, networkDetails)
          }
        }

        originalLoad(context, loadConfig, callbacks)
      }
    }
  }
}

/**
 * 创建简化的M3U8处理回调
 * 用于不使用类继承的场景
 */
export function createM3u8LoaderCallback(
  m3u8Processor: M3u8Processor,
): (response: { data?: string }) => void {
  return response => {
    if (response.data && typeof response.data === 'string') {
      response.data = m3u8Processor.process(response.data)
    }
  }
}
