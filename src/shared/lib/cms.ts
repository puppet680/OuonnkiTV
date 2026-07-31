import { createCmsClient, createUrlPrefixProxyStrategy } from '@ouonnki/cms-core'
import type { CmsClient, CmsClientConfig, VideoItem } from '@ouonnki/cms-core'
import { useSettingStore } from '@/shared/store/settingStore'
import { normalizeProxyPrefix } from '@/shared/config/api.config'

/**
 * 成人内容过滤：根据关键词名单过滤 CMS 视频
 * @param items - 待过滤视频列表
 * @returns 过滤后的列表（未开启过滤时原样返回）
 */
export function filterAdult(items: VideoItem[]): VideoItem[] {
  const { isAdultFilterEnabled, cmsFilterKeywords } = useSettingStore.getState().system
  if (!isAdultFilterEnabled) return items
  // 环境变量优先，解决 localStorage 缓存旧值的问题
  const rawKeywords: string = import.meta.env.OKI_CMS_FILTER_KEYWORDS || cmsFilterKeywords
  const keywords = rawKeywords.split(',').map((k: string) => k.trim()).filter(Boolean)
  if (keywords.length === 0) return items
  return items.filter(item => {
    const haystack = [item.vod_name, item.vod_remarks, item.type_name, item.vod_content, item.vod_sub]
      .filter(Boolean)
      .join(' ')
    return !keywords.some(kw => haystack.includes(kw))
  })
}

let globalClient: CmsClient | null = null
let globalNetworkKey: string | null = null

/**
 * 获取全局 CmsClient 单例（网络设置变化时重建）
 * @param config - 可选客户端配置
 * @returns CmsClient 实例
 */
export function getCmsClient(config?: CmsClientConfig): CmsClient {
  const { network } = useSettingStore.getState()
  const proxyUrl = network.isProxyEnabled
    ? normalizeProxyPrefix(network.proxyUrl)
    : normalizeProxyPrefix('') // 关闭时使用默认 /proxy?url=
  const networkKey = [network.concurrencyLimit, proxyUrl].join('|')

  // 当网络设置变化时重建单例
  if (globalClient && globalNetworkKey !== networkKey) {
    globalClient.destroy()
    globalClient = null
  }

  if (!globalClient) {
    globalNetworkKey = networkKey
    globalClient = createCmsClient({
      proxyStrategy: createUrlPrefixProxyStrategy(proxyUrl),
      concurrencyLimit: network.concurrencyLimit,
      ...config,
    })
  }
  return globalClient
}

/**
 * 销毁全局 CmsClient
 */
export function destroyCmsClient(): void {
  if (globalClient) {
    globalClient.destroy()
    globalClient = null
    globalNetworkKey = null
  }
}
