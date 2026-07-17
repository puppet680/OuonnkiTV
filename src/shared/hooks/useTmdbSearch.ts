import { useCallback, useEffect } from 'react'
import { useTmdbStore } from '../store/tmdbStore'

/**
 * 搜索功能 Hook
 */
export function useTmdbSearch() {
  const query = useTmdbStore(state => state.searchQuery)
  const results = useTmdbStore(state => state.searchResults)
  const filteredResults = useTmdbStore(s => s.filteredResults)
  const pagination = useTmdbStore(s => s.searchPagination)
  const loading = useTmdbStore(s => s.loading.search)
  const filterOptions = useTmdbStore(s => s.filterOptions)
  const availableOptions = useTmdbStore(s => s.availableFilterOptions)
  const error = useTmdbStore(s => s.error)

  const search = useTmdbStore(s => s.search)
  const setFilter = useTmdbStore(s => s.setFilter)
  const clearFilter = useTmdbStore(s => s.clearFilter)

  return {
    query,
    results,
    filteredResults,
    pagination,
    loading,
    filterOptions,
    availableOptions,
    error,
    search,
    setFilter,
    clearFilter,
  }
}

/**
 * 发现/浏览功能 Hook（无搜索词时使用）
 */
export function useTmdbDiscover() {
  const results = useTmdbStore(s => s.discoverResults)
  const pagination = useTmdbStore(s => s.discoverPagination)
  const loading = useTmdbStore(s => s.loading.discover)
  const filterOptions = useTmdbStore(s => s.filterOptions)
  const error = useTmdbStore(s => s.error)

  const fetchDiscover = useTmdbStore(s => s.fetchDiscover)
  const setFilter = useTmdbStore(s => s.setFilter)
  const clearFilter = useTmdbStore(s => s.clearFilter)

  return {
    results,
    pagination,
    loading,
    filterOptions,
    error,
    fetchDiscover,
    setFilter,
    clearFilter,
  }
}

/**
 * 分类/配置 Hook
 */
export function useTmdbGenres() {
  const movieGenres = useTmdbStore(s => s.movieGenres)
  const tvGenres = useTmdbStore(s => s.tvGenres)
  const loading = useTmdbStore(s => s.loading.genres)
  const fetchGenres = useTmdbStore(s => s.fetchGenresAndCountries)

  useEffect(() => {
    if (movieGenres.length === 0) {
      fetchGenres()
    }
  }, [fetchGenres, movieGenres.length])

  const getGenreName = useCallback(
    (id: number) => {
      const g = movieGenres.find(g => g.id === id) || tvGenres.find(g => g.id === id)
      return g ? g.name : 'Unknown'
    },
    [movieGenres, tvGenres],
  )

  return {
    movieGenres,
    tvGenres,
    loading,
    getGenreName,
  }
}
