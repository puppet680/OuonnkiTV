import type { VideoSource, VideoItem, DetailResult } from '@ouonnki/cms-core'
import { getCmsClient, filterAdult } from '@/shared/hooks/useCmsCore'

/**
 * 获取指定视频源的推荐/最新视频列表
 * 注：cms-core 的 listVideos 无 signal 槽位，超时由 client 内部处理
 * @param source - 视频源
 * @returns 经成人关键词过滤后的视频列表
 * @throws 列表获取失败时抛出（error 为可读中文）
 */
export async function fetchCmsVideoList(source: VideoSource): Promise<VideoItem[]> {
  const client = getCmsClient()
  const result = await client.listVideos(source)
  if (!result.success) {
    throw new Error(result.error || '获取视频列表失败')
  }
  return filterAdult(result.items)
}

/**
 * 获取指定视频的详情
 * 注：cms-core 的 getDetail 无 signal 槽位，超时由 client 内部处理
 * @param id - 视频 ID
 * @param source - 视频源
 * @returns 详情结果（失败时返回 null）
 */
export async function fetchCmsDetail(id: string, source: VideoSource): Promise<DetailResult | null> {
  const client = getCmsClient()
  const result = await client.getDetail(id, source)
  return result.success ? result : null
}
