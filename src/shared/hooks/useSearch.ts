import { useNavigate } from 'react-router'
import { useSearchStore } from '@/shared/store/searchStore'
import { trackEvent } from '@/shared/config/analytics.config'

export const useSearch = () => {
  const navigate = useNavigate()

  // 从 zustand store 获取状态和操作
  const { query: search, setQuery: setSearch, addSearchHistoryItem, clearQuery } = useSearchStore()

  const searchMovie = (query: string, isNavigating: boolean = true, type?: string) => {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ')
    if (normalizedQuery.length > 0) {
      setSearch(normalizedQuery)
      addSearchHistoryItem(normalizedQuery, type)

      trackEvent('search', {
        query: normalizedQuery,
        timestamp: new Date().toISOString(),
      })

      if (isNavigating) {
        const typeParam = type && type !== 'media' ? `&type=${encodeURIComponent(type)}` : ''
        navigate(`/search?q=${encodeURIComponent(normalizedQuery)}${typeParam}`)
      }
    }
  }

  const clearSearch = () => {
    clearQuery()
  }

  return {
    search,
    setSearch,
    searchMovie,
    clearSearch,
  }
}
