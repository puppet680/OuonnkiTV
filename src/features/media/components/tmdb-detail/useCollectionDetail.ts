import { useEffect, useState } from 'react'
import { getTmdbClient } from '@/shared/lib/tmdb'
import { useSettingStore } from '@/shared/store/settingStore'
import type { LanguageOption } from 'tmdb-ts'
import type { DetailCollectionFull } from './types'

/**
 * 获取 TMDB 系列/合集详情
 * @param collectionId - TMDB collection ID
 * @returns 详情数据、加载状态、错误信息
 */
export function useCollectionDetail(collectionId: number) {
  const [collection, setCollection] = useState<DetailCollectionFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchCollection = async () => {
      setLoading(true)
      setError(null)
      try {
        const client = getTmdbClient()
        const language = useSettingStore.getState().system.tmdbLanguage
        const data = await client.collections.details(collectionId, { language } as LanguageOption)
        if (cancelled) return
        setCollection({
          name: data.name,
          overview: data.overview,
          poster_path: data.poster_path,
          backdrop_path: data.backdrop_path,
          parts: (data.parts || [])
            .map(m => ({
              id: m.id,
              title: m.title || '',
              poster_path: m.poster_path,
              release_date: m.release_date,
              overview: m.overview,
            }))
            .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || '')),
        })
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError((e as Error).message || 'Failed to fetch collection')
        setLoading(false)
      }
    }
    fetchCollection()
    return () => { cancelled = true }
  }, [collectionId])

  return { collection, loading, error }
}
