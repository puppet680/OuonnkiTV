import { useState, useRef, useCallback } from 'react'
import { getTmdbClient, normalizeToMediaItem } from '@/shared/lib/tmdb'
import { useSettingStore } from '@/shared/store/settingStore'
import { isTmdbEnabled } from '@/shared/hooks/useTmdbMode'
import type { TmdbMediaItem } from '@/shared/types/tmdb'

type TmdbSearchMultiParams = Parameters<ReturnType<typeof getTmdbClient>['search']['multi']>[0]
type TmdbSearchLanguage = NonNullable<TmdbSearchMultiParams['language']>

// 搜索建议最大数量
const MAX_SUGGESTIONS = 9
// 防抖延迟时间 (毫秒)
const DEBOUNCE_DELAY = 100

interface UseSearchSuggestionsReturn {
  suggestions: TmdbMediaItem[]
  isLoading: boolean
  fetchSuggestions: (query: string, type?: string) => void
  clearSuggestions: () => void
}

/**
 * 搜索建议 hook
 * 影视类型使用 search.multi，人物类型使用 search.people
 */
export function useSearchSuggestions(): UseSearchSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<TmdbMediaItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // 防抖定时器引用
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 用于取消过期请求的标识
  const requestIdRef = useRef(0)

  const fetchSuggestions = useCallback((query: string, type?: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    if (!isTmdbEnabled()) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    if (!query.trim()) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const isPerson = type === 'person'

    debounceTimerRef.current = setTimeout(async () => {
      const currentRequestId = ++requestIdRef.current

      try {
        const client = getTmdbClient()
        const language = useSettingStore.getState().system.tmdbLanguage as TmdbSearchLanguage
        const include_adult = !useSettingStore.getState().system.isAdultFilterEnabled

        let results: TmdbMediaItem[]

        if (isPerson) {
          const data = await client.search.people({
            query: query.trim(),
            page: 1,
            language,
            include_adult,
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = (data as any).results as Array<Record<string, unknown>>
          results = raw.slice(0, MAX_SUGGESTIONS).map(r => (({
            id: r.id as number,
            mediaType: 'person',
            title: (r.name as string) || '',
            originalTitle: (r.original_name as string) || '',
            overview: '',
            posterPath: (r.profile_path as string) || null,
            backdropPath: null,
            logoPath: null,
            releaseDate: '',
            voteAverage: 0,
            voteCount: 0,
            popularity: (r.popularity as number) || 0,
            genreIds: [],
            originalLanguage: '',
            originCountry: [],
          }) as unknown as TmdbMediaItem))
        } else {
          const res = await client.search.multi({
            query: query.trim(),
            page: 1,
            language,
            include_adult,
          })
          results = res.results
            .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
            .slice(0, MAX_SUGGESTIONS)
            .map(item =>
              normalizeToMediaItem(item as unknown as Record<string, unknown>, item.media_type),
            )
        }

        if (currentRequestId !== requestIdRef.current) return
        setSuggestions(results)
      } catch (error) {
        console.error('Failed to fetch search suggestions:', error)
        if (currentRequestId === requestIdRef.current) setSuggestions([])
      } finally {
        if (currentRequestId === requestIdRef.current) setIsLoading(false)
      }
    }, DEBOUNCE_DELAY)
  }, [])

  const clearSuggestions = useCallback(() => {
    // 清除定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    // 使请求过期
    requestIdRef.current++
    setSuggestions([])
    setIsLoading(false)
  }, [])

  return {
    suggestions,
    isLoading,
    fetchSuggestions,
    clearSuggestions,
  }
}
