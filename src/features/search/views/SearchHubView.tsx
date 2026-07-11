import { useState, useEffect, useCallback, useTransition } from 'react'
import { useSearchParams } from 'react-router'
import { motion, useReducedMotion } from "motion/react"
import { useDocumentTitle } from '@/shared/hooks'
import { useTmdbEnabled } from '@/shared/hooks/useTmdbMode'
import { useTmdbNowPlaying } from '@/shared/hooks/useTmdb'
import { useSearchStore } from '@/shared/store/searchStore'
import { OkiLogo } from '@/shared/components/icons'
import { normalizeSearchMode } from '../lib/searchMode'
import {
  SearchModeToggle,
  SearchHubInput,
  SearchTrending,
  SearchTmdbSection,
  SearchDirectSection,
  SearchPersonSection,
  type SearchMode,
  type SearchType,
} from '../components'

export default function SearchHubView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const modeParam = searchParams.get('mode')
  const tmdbEnabled = useTmdbEnabled()
  const reducedMotion = useReducedMotion()

  const mode: SearchMode = normalizeSearchMode(modeParam, tmdbEnabled)
  const defaultMode = tmdbEnabled ? 'tmdb' : 'direct'
  const typeParam = searchParams.get('type')
  const initialType: SearchType = typeParam === 'person' ? 'person' : 'media'

  const [searchType, setSearchType] = useState<SearchType>(initialType)
  const [isDirectCentered, setIsDirectCentered] = useState(false)

  useEffect(() => {
    const shouldBeCentered = mode === 'direct' && !query
    if (shouldBeCentered) {
      const timer = setTimeout(() => setIsDirectCentered(true), 400)
      return () => clearTimeout(timer)
    }
    setIsDirectCentered(false)
  }, [mode, query])

  const { addSearchHistoryItem } = useSearchStore()
  const { trending } = useTmdbNowPlaying()

  useEffect(() => {
    if (modeParam === 'tmdb' || modeParam === 'direct') return
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.set('mode', defaultMode)
      return params
    }, { replace: true })
  }, [modeParam, defaultMode, setSearchParams])

  useDocumentTitle(query ? `${query} - 搜索` : '搜索中心')

  const handleModeChange = useCallback((newMode: SearchMode) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.set('mode', newMode)
      return params
    })
  }, [setSearchParams])

  const [, startSearchTransition] = useTransition()

  const handleSearch = useCallback((searchQuery: string, type: SearchType) => {
    const normalizedQuery = searchQuery.trim().replace(/\s+/g, ' ')
    if (!normalizedQuery) return

    startSearchTransition(() => {
      addSearchHistoryItem(normalizedQuery, type)
      setSearchType(type)
      setSearchParams(prev => {
        const params = new URLSearchParams(prev)
        params.set('q', normalizedQuery)
        params.set('mode', mode)
        if (type !== 'media') params.set('type', type)
        else params.delete('type')
        return params
      })
    })
  }, [addSearchHistoryItem, mode, setSearchParams])

  const handleClear = useCallback(() => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.delete('q')
      return params
    })
  }, [setSearchParams])

  const hasSearch = Boolean(query)

  return (
    <div className={`flex flex-col gap-6 p-4 pb-8 transition-all duration-300 ${!hasSearch && isDirectCentered ? 'min-h-[60vh] justify-center' : ''}`}>
      <motion.div
        layout={!reducedMotion || undefined}
        className="flex w-full flex-col items-center gap-4"
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
      >
        <motion.div layout={!reducedMotion || undefined} className="flex flex-col items-center gap-2">
          <OkiLogo size={56} />
          <span className="text-muted-foreground text-sm tracking-wide">发现你的下一部好剧</span>
        </motion.div>
        {tmdbEnabled && (
          <motion.div layout={!reducedMotion || undefined}>
            <SearchModeToggle mode={mode} onChange={handleModeChange} />
          </motion.div>
        )}

        <motion.div layout={!reducedMotion || undefined} className="flex w-full justify-center">
          <SearchHubInput
            initialQuery={query}
            initialSearchType={searchType}
            onSearch={handleSearch}
            onClear={handleClear}
            searchMode={mode}
            trending={trending}
          />
        </motion.div>

        {tmdbEnabled && mode === 'direct' && !hasSearch && (
          <SearchTrending
            trending={trending}
            onSearch={(q) => handleSearch(q, 'media')}
            isLoading={trending.length === 0}
          />
        )}
      </motion.div>

      {mode === 'tmdb' && searchType === 'media' && (
        <SearchTmdbSection query={query} />
      )}
      {mode === 'tmdb' && searchType === 'person' && hasSearch && (
        <SearchPersonSection query={query} />
      )}
      {mode === 'direct' && hasSearch && (
        <SearchDirectSection query={query} />
      )}
    </div>
  )
}
