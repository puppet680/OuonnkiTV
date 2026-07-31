import { useEffect, useRef, useState } from 'react'
import type { CmsClient, DetailResult, VideoSource } from '@ouonnki/cms-core'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import { buildDetailRequestKey } from '../components/videojsPlayerHelpers'

interface UsePlayerDetailFetchParams {
  cmsClient: CmsClient
  routeError: string | null
  isTmdbRoute: boolean
  tmdbMediaType: TmdbMediaType | null
  resolvedSourceCode: string
  resolvedVodId: string
  hasExplicitTmdbSelection: boolean
  sourceConfig: VideoSource | undefined
  tmdbLoading: boolean
  tmdbPlaylistLoading: boolean
  tmdbPlaylistSearched: boolean
  /** 详情拉取失败时的兜底：重置 TMDB 选源锁并跳转（TMDB 模式专用） */
  onTmdbDetailError: () => void
}

interface UsePlayerDetailFetchResult {
  detail: DetailResult | null
  loading: boolean
  error: string | null
  allExhausted: boolean
  isDetailRefreshing: boolean
  setAllExhausted: (value: boolean) => void
}

/**
 * 根据已解析的源/剧集拉取视频详情，管理 loading/error/刷新态
 * 自带竞态防护（请求序号）与重复请求跳过（loadedDetailKey）
 */
export function usePlayerDetailFetch({
  cmsClient,
  routeError,
  isTmdbRoute,
  tmdbMediaType,
  resolvedSourceCode,
  resolvedVodId,
  hasExplicitTmdbSelection,
  sourceConfig,
  tmdbLoading,
  tmdbPlaylistLoading,
  tmdbPlaylistSearched,
  onTmdbDetailError,
}: UsePlayerDetailFetchParams): UsePlayerDetailFetchResult {
  const [detail, setDetail] = useState<DetailResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allExhausted, setAllExhausted] = useState(false)
  const [isDetailRefreshing, setIsDetailRefreshing] = useState(false)

  const detailRef = useRef<DetailResult | null>(null)
  const detailRequestSeqRef = useRef(0)
  const loadedDetailKeyRef = useRef('')

  useEffect(() => {
    detailRef.current = detail
  }, [detail])

  useEffect(() => {
    const requestSeq = detailRequestSeqRef.current + 1
    detailRequestSeqRef.current = requestSeq
    let disposed = false
    const canCommit = () => !disposed && detailRequestSeqRef.current === requestSeq

    const fetchVideoDetail = async () => {
      if (routeError) {
        if (!canCommit()) return
        setDetail(null)
        setLoading(false)
        setIsDetailRefreshing(false)
        setError(routeError)
        return
      }

      const hasResolvedTmdbSelection = Boolean(resolvedSourceCode && resolvedVodId)
      const shouldWaitForTmdbSelection =
        isTmdbRoute &&
        !hasExplicitTmdbSelection &&
        !hasResolvedTmdbSelection &&
        (tmdbLoading || tmdbPlaylistLoading || !tmdbPlaylistSearched)

      if (shouldWaitForTmdbSelection) {
        if (!canCommit()) return
        if (detailRef.current) setIsDetailRefreshing(true)
        else setLoading(true)
        setError(null)
        return
      }

      if (!resolvedSourceCode || !resolvedVodId) {
        if (isTmdbRoute && tmdbPlaylistSearched) {
          if (!canCommit()) return
          setDetail(null)
          setLoading(false)
          setIsDetailRefreshing(false)
          setError('没有匹配到可播放资源，请返回详情页重新匹配')
          return
        }
        if (!canCommit()) return
        setDetail(null)
        setLoading(false)
        setIsDetailRefreshing(false)
        setError('缺少必要的播放参数')
        return
      }

      const detailRequestKey = buildDetailRequestKey(resolvedSourceCode, resolvedVodId)
      if (detailRef.current && loadedDetailKeyRef.current === detailRequestKey) return

      if (!canCommit()) return
      if (detailRef.current) setIsDetailRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        if (!sourceConfig) throw new Error('未找到对应视频源配置，请检查源设置')
        const response = await cmsClient.getDetail(resolvedVodId, sourceConfig)
        if (!canCommit()) return
        if (response.success && response.episodes?.length > 0) {
          loadedDetailKeyRef.current = detailRequestKey
          setDetail(response)
          setError(null)
          return
        }
        throw new Error(response.error || '获取视频详情失败')
      } catch (fetchError) {
        if (!canCommit()) return
        console.error('获取视频详情失败:', fetchError)

        if (isTmdbRoute && tmdbMediaType) {
          onTmdbDetailError()
          return
        }

        const msg = fetchError instanceof Error ? fetchError.message : '获取视频详情失败'
        setDetail(null)
        setError(msg)
      } finally {
        if (canCommit()) {
          setLoading(false)
          setIsDetailRefreshing(false)
        }
      }
    }

    void fetchVideoDetail()
    return () => {
      disposed = true
    }
  }, [
    cmsClient,
    hasExplicitTmdbSelection,
    isTmdbRoute,
    routeError,
    resolvedSourceCode,
    resolvedVodId,
    sourceConfig,
    tmdbPlaylistLoading,
    tmdbPlaylistSearched,
    tmdbLoading,
  ])

  return { detail, loading, error, allExhausted, isDetailRefreshing, setAllExhausted }
}
