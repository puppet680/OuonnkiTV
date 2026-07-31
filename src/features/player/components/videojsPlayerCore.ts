import { createPlayer } from '@videojs/react'
import { videoFeatures } from '@videojs/react/video'
import type { HlsConfig } from 'hls.js'
import {
  createM3u8Processor,
  createNoopFilter,
  createCustomScriptFilter,
  createHlsLoaderClass,
} from '@ouonnki/cms-core/m3u8'
import { getCustomAdFilterCode } from '@/features/player/lib/custom-ad-filter'

// ── Video.js player instance ──

/** 全局 Video.js 播放器实例（倍速扩展至 4x），Provider/usePlayer 均经此 */
export const Player = createPlayer({
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

/**
 * 加载 hls.js 去广告 loader（懒加载 light 构建），返回 HlsJsVideo config
 * @param adFilteringEnabled - 是否启用去广告（关闭时直接返回空对象）
 * @param sourceCode - 当前视频源编码，用于自定义脚本过滤器
 * @returns 含自定义 loader 的 HlsConfig 子集
 */
export async function getAdFilterHlsConfig(
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
