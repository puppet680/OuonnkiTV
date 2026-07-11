import { useState, useEffect, useCallback } from 'react'
import { getTmdbClient } from '../lib/tmdb'
import { useSettingStore } from '../store/settingStore'
import type { TmdbMediaItem } from '../types/tmdb'

export interface TmdbPersonResult {
  id: number
  name: string
  profilePath: string | null
  knownFor: string
  knownForItems: TmdbMediaItem[]
  popularity: number
  adult: boolean
}

function normalizePerson(raw: Record<string, unknown>): TmdbPersonResult {
  const knownFor = (raw.known_for as Array<Record<string, unknown>>) || []
  const knownForItems: TmdbMediaItem[] = knownFor.map(item => ({
    id: item.id as number,
    mediaType: (item.media_type as 'movie' | 'tv') || 'movie',
    title: ((item.media_type === 'tv' ? item.name : item.title) as string) || '',
    originalTitle: ((item.media_type === 'tv' ? item.original_name : item.original_title) as string) || '',
    overview: '',
    posterPath: (item.poster_path as string) || null,
    backdropPath: (item.backdrop_path as string) || null,
    logoPath: null,
    releaseDate: ((item.media_type === 'tv' ? item.first_air_date : item.release_date) as string) || '',
    voteAverage: (item.vote_average as number) || 0,
    voteCount: (item.vote_count as number) || 0,
    popularity: (item.popularity as number) || 0,
    genreIds: (item.genre_ids as number[]) || [],
    originalLanguage: (item.original_language as string) || '',
    originCountry: (item.origin_country as string[]) || [],
  }))

  return {
    id: raw.id as number,
    name: (raw.name as string) || '',
    profilePath: (raw.profile_path as string) || null,
    knownFor: knownForItems.slice(0, 3).map(i => i.title).join('、'),
    knownForItems,
    popularity: (raw.popularity as number) || 0,
    adult: Boolean(raw.adult),
  }
}

export function useTmdbPersonSearch(query: string) {
  const [results, setResults] = useState<TmdbPersonResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const search = useCallback(async (p = 1) => {
    if (!query.trim()) { setResults([]); return }
    if (p === 1) setLoading(true)
    else setLoadingMore(true)
    setError(null)

    try {
      const client = getTmdbClient()
      const include_adult = !useSettingStore.getState().system.isAdultFilterEnabled
      const data = await client.search.people({ query: query.trim(), language: 'zh-CN', page: p, include_adult })
      const raw = (data as unknown as { results: Array<Record<string, unknown>>; total_pages: number }).results || []
      const items = raw.map(normalizePerson)
      setResults(p === 1 ? items : prev => [...prev, ...items])
      setPage(p)
      setHasMore(p < (data as unknown as { total_pages: number }).total_pages)
    } catch (err) {
      setError((err as Error).message || '搜索人物失败')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [query])

  useEffect(() => { search(1) }, [search])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) search(page + 1)
  }, [loadingMore, hasMore, page, search])

  return { results, loading, loadingMore, error, hasMore, loadMore }
}
