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
        // const ctxUrl = context.url
        // const ctxType = context.type || (ctxUrl?.endsWith('.ts') ? 'frag' : (ctxUrl?.endsWith('.m3u8') ? 'manifest' : 'unknown'))

        // debug: 打印片段播放
        // if (ctxType === 'frag') {
        //   console.log(`▶️ 播放片段: ${String(ctxUrl).slice(-60)}`)
        // }

        const isM3u8 = typeof context.url === 'string'
          && (context.url.includes('.m3u8') || context.url.includes('.M3U8'))

        // 对所有 M3U8 播放列表应用广告过滤（含 level 类型在 light 版本 type=undefined 的情况）
        if (context.type === 'manifest' || context.type === 'level' || isM3u8) {
          const originalOnSuccess = callbacks.onSuccess

          callbacks.onSuccess = (response: any, stats: any, ctx: any, networkDetails: unknown) => {
            // 处理M3U8内容
            if (response.data && typeof response.data === 'string') {
              response.data = m3u8Processor.process(response.data)
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
