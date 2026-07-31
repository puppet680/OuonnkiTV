import { useMemo } from 'react'
import type { CmsClient, VideoSource, VideoItem, CmsClientConfig } from '@ouonnki/cms-core'
import { useQuery } from '@tanstack/react-query'
import { useSettingStore } from '@/shared/store/settingStore'
import { getCmsClient } from '@/shared/lib/cms'
import { fetchCmsVideoList } from '@/shared/lib/api/cms'

/**
 * 获取 CmsClient 实例的 Hook（网络配置变化时重建）
 * @param config - 可选的客户端配置
 * @returns CmsClient 实例
 */
export function useCmsClient(config?: CmsClientConfig): CmsClient {
  const networkKey = useSettingStore(
    state =>
      `${state.network.concurrencyLimit}|${state.network.isProxyEnabled}|${state.network.proxyUrl}`,
  )
  return useMemo(() => {
    void networkKey
    return getCmsClient(config)
  }, [config, networkKey])
}

/** CMS 视频列表状态 */
export interface CmsVideoListState {
  /** 视频列表 */
  items: VideoItem[]
  /** 是否正在加载 */
  loading: boolean
  /** 错误信息 */
  error: string | null
}

/**
 * CMS 视频列表 Hook
 * 从指定视频源获取推荐/最新视频列表（不带搜索关键词）
 * @param source - 视频源（禁用或为空时不发起请求）
 * @returns 视频列表与加载/错误状态
 */
export function useCmsVideoList(source: VideoSource | null): CmsVideoListState {
  const networkKey = useSettingStore(
    state =>
      `${state.network.concurrencyLimit}|${state.network.isProxyEnabled}|${state.network.proxyUrl}`,
  )
  const query = useQuery({
    queryKey: ['cms', 'list', source?.id, networkKey],
    queryFn: () => fetchCmsVideoList(source!),
    enabled: !!source && source.isEnabled,
    staleTime: 60_000,
  })

  return {
    items: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message || '获取列表失败' : null,
  }
}
