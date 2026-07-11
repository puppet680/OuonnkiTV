import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowUpDown, X } from 'lucide-react'
import { useTmdbSearch, useTmdbDiscover } from '@/shared/hooks/useTmdb'
import { useTmdbStore } from '@/shared/store/tmdbStore'
import { SearchResultsGrid } from './SearchResultsGrid'
import { useInfiniteScroll } from '@/shared/hooks/useInfiniteScroll'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'
import { MEDIA_TYPE_OPTIONS, SORT_OPTIONS, MEDIA_TYPE_LABELS } from '../constants'
import type { TmdbFilterOptions } from '@/shared/types/tmdb'

interface SearchTmdbSectionProps {
  query: string
}

/** 解析 query 中的 y:YYYY 年份筛选，返回 cleanQuery 和 year */
function parseQueryWithYear(rawQuery: string): { cleanQuery: string; year: number | undefined } {
  const match = rawQuery.match(/y:(\d{4})/)
  if (!match) return { cleanQuery: rawQuery, year: undefined }
  const clean = rawQuery.replace(/\s*y:\d{4}\s*/, ' ').trim()
  return { cleanQuery: clean, year: parseInt(match[1], 10) }
}

/** 构建带年份筛选的 query 字符串 */
function buildQueryWithYear(cleanQuery: string, year: number): string {
  return cleanQuery ? `${cleanQuery} y:${year}` : `y:${year}`
}

/** 静态年份列表：当前年份 ± 覆盖近 15 年 */
function getRecentYears(): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 15 }, (_, i) => currentYear - i)
}

export function SearchTmdbSection({ query }: SearchTmdbSectionProps) {
  const [, setSearchParams] = useSearchParams()
  const { cleanQuery, year } = useMemo(() => parseQueryWithYear(query), [query])

  const [currentPage, setCurrentPage] = useState(1)
  const reducedMotion = useReducedMotion()

  const {
    search: tmdbSearch,
    filteredResults: tmdbFilteredResults,
    filterOptions,
    loading: tmdbLoading,
    pagination: tmdbPagination,
    setFilter,
  } = useTmdbSearch()

  const {
    results: discoverResults,
    loading: discoverLoading,
    pagination: discoverPagination,
    fetchDiscover,
  } = useTmdbDiscover()

  const fetchGenresAndCountries = useTmdbStore(s => s.fetchGenresAndCountries)
  const findById = useTmdbStore(s => s.findById)

  // 年份快捷按钮：固定近 15 年，不依赖搜索结果
  const yearChips = useMemo(() => getRecentYears(), [])

  // 点击年份芯片 → 更新 URL
  const handleYearClick = useCallback((clickedYear: number) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      if (year === clickedYear) {
        // 再次点击同一年份 → 清除
        params.set('q', cleanQuery || '')
        if (!cleanQuery) params.delete('q')
      } else {
        params.set('q', buildQueryWithYear(cleanQuery, clickedYear))
      }
      return params
    }, { replace: true })
  }, [cleanQuery, year, setSearchParams])

  const [isSearchingNewQuery, setIsSearchingNewQuery] = useState(false)
  const [isDiscoverFiltering, setIsDiscoverFiltering] = useState(false)

  // 初始化 genres/countries（discover 筛选仍然需要 genres 语义信息，但不展示 UI）
  useEffect(() => {
    fetchGenresAndCountries()
  }, [fetchGenresAndCountries])

  // 筛选条件变化时重置分页 + refetch discover（无搜索词时）
  useEffect(() => {
    setCurrentPage(1)
    if (!cleanQuery) {
      setIsDiscoverFiltering(true)
      fetchDiscover(1).then(() => setIsDiscoverFiltering(false))
    }
  }, [filterOptions, cleanQuery, fetchDiscover])

  // 执行搜索（year 传给 API 做服务端过滤）
  useEffect(() => {
    if (cleanQuery) {
      const isNumericId = /^\d{1,10}$/.test(cleanQuery)
      setIsSearchingNewQuery(true)
      setCurrentPage(1)
      const promise = isNumericId ? findById(Number(cleanQuery)) : tmdbSearch(cleanQuery, 1, year)
      promise.then(() => setIsSearchingNewQuery(false))
    }
  }, [cleanQuery, year, tmdbSearch, findById])

  // 分页
  const pagination = cleanQuery ? tmdbPagination : discoverPagination
  const hasMore = pagination.page < pagination.totalPages

  const handleLoadMore = useCallback(async () => {
    const nextPage = currentPage + 1
    if (cleanQuery) {
      await tmdbSearch(cleanQuery, nextPage, year)
    } else {
      await fetchDiscover(nextPage)
    }
    setCurrentPage(nextPage)
  }, [currentPage, cleanQuery, year, tmdbSearch, fetchDiscover])

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: tmdbLoading || discoverLoading,
    onLoadMore: handleLoadMore,
  })

  // 清除年份：更新 URL 去掉 y: 部分，search effect 会自动用无 year 重新搜索
  const handleClearYear = useCallback(() => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      params.set('q', cleanQuery)
      return params
    }, { replace: true })
  }, [cleanQuery, setSearchParams])

  return (
    <motion.div
      className="flex flex-col gap-6"
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: 20 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
    >
      {/* 第一行：媒体类型 + 排序 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {MEDIA_TYPE_OPTIONS.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setFilter({ mediaType: type === 'all' ? undefined : type })}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                filterOptions.mediaType === type || (!filterOptions.mediaType && type === 'all')
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-primary',
              )}
            >
              {MEDIA_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Select
            value={filterOptions.sortBy || 'default'}
            onValueChange={value =>
              setFilter({
                sortBy: value === 'default' ? undefined : (value as TmdbFilterOptions['sortBy']),
              })
            }
          >
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-1"
            onClick={() =>
              setFilter({ sortOrder: filterOptions.sortOrder === 'asc' ? 'desc' : 'asc' })
            }
          >
            <ArrowUpDown
              className={cn(
                'size-4 transition-transform',
                filterOptions.sortOrder === 'asc' && 'rotate-180',
              )}
            />
          </button>
        </div>
      </div>

      {/* 第二行：年份快捷按钮 / 选中后显示单个芯片 */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={year ? 'chip' : 'chips'}
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
          className="flex flex-wrap items-center gap-2"
        >
          {year ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1.5">
              <span className="text-sm">
                年份：<span className="text-primary font-medium">{year}</span>
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground p-0.5"
                onClick={handleClearYear}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled
                className="rounded-full border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              >
                全部
              </button>
              {yearChips.map(y => (
                <button
                  key={y}
                  type="button"
                  onClick={() => handleYearClick(y)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {y}
                </button>
              ))}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* 搜索结果区域 */}
      <section>
        {cleanQuery ? (
          <SearchResultsGrid
            mode="tmdb"
            tmdbResults={tmdbFilteredResults}
            loading={tmdbLoading}
            totalResults={tmdbPagination.totalResults}
            isSearchingNewQuery={isSearchingNewQuery}
            hasMore={hasMore}
            sentinelRef={sentinelRef}
          />
        ) : (
          <SearchResultsGrid
            mode="tmdb"
            tmdbResults={discoverResults}
            loading={discoverLoading}
            isSearchingNewQuery={isDiscoverFiltering}
            hasMore={hasMore}
            sentinelRef={sentinelRef}
          />
        )}
      </section>
    </motion.div>
  )
}
