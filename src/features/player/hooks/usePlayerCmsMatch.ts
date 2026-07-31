import { useEffect, useRef, useState, useTransition } from 'react'
import type { CmsClient, VideoItem as CmsVideoItem } from '@ouonnki/cms-core'
import { useApiStore } from '@/shared/store/apiStore'
import { storeCmsSources } from '@/features/search/hooks/directSearch.utils'

interface UsePlayerCmsMatchParams {
  isCmsRoute: boolean
  title: string
  resolvedSourceCode: string
  resolvedVodId: string
  cmsClient: CmsClient
}

export interface CmsMatchedSource {
  sourceCode: string
  sourceName: string
  vodId: string
}

/**
 * CMS 直连模式下用标题聚合搜索其他源，收集同名匹配作为换源候选
 * 每个 detail 标题只触发一次（ref 去重）
 */
export function usePlayerCmsMatch({
  isCmsRoute,
  title,
  resolvedSourceCode,
  resolvedVodId,
  cmsClient,
}: UsePlayerCmsMatchParams) {
  const [cmsMatchedSources, setCmsMatchedSources] = useState<CmsMatchedSource[]>([])
  const cmsMatchFiredRef = useRef(false)
  const [, startCmsMatch] = useTransition()

  useEffect(() => {
    if (!isCmsRoute || !title || !resolvedSourceCode || !resolvedVodId) return
    if (cmsMatchFiredRef.current) return
    cmsMatchFiredRef.current = true

    const trimmed = title.trim()
    if (!trimmed) return
    const enabledSources = useApiStore.getState().videoAPIs.filter(s => s.isEnabled)
    if (enabledSources.length === 0) return

    const controller = new AbortController()
    cmsClient
      .aggregatedSearch(trimmed, enabledSources, 1, controller.signal)
      .then((results: CmsVideoItem[]) => {
        const matched = results
          .filter(r => r.vod_name.trim() === trimmed && r.source_code && r.vod_id)
          .map(r => ({
            sourceCode: r.source_code!,
            vodId: r.vod_id!,
            sourceName: r.source_name || '',
          }))
        if (matched.length > 0) {
          storeCmsSources(trimmed, matched)
          startCmsMatch(() => setCmsMatchedSources(matched))
        }
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') console.warn('CMS 匹配失败:', err)
      })

    return () => controller.abort()
  }, [isCmsRoute, title, resolvedSourceCode, resolvedVodId, cmsClient, startCmsMatch])

  return cmsMatchedSources
}
