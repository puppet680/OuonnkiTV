import { useEffect, useState, useCallback, useRef } from 'react'
import { useDirectSearch } from '../hooks/useDirectSearch'
import { SearchResultsGrid } from './SearchResultsGrid'
import { useInfiniteScroll } from '@/shared/hooks/useInfiniteScroll'

interface SearchDirectSectionProps {
  query: string
}

export function SearchDirectSection({ query }: SearchDirectSectionProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const lastQueryRef = useRef('')

  const {
    directResults,
    aggregatedResults,
    directLoading,
    hasMore,
    isCurrentPageComplete,
    canLoadMore,
    startDirectSearch,
    abortDirectSearch,
    clearDirectSearchState,
  } = useDirectSearch()

  // 监听 query 变化触发搜索，避免返回时重复搜索
  useEffect(() => {
    if (!query) {
      setCurrentPage(1)
      abortDirectSearch()
      clearDirectSearchState()
      lastQueryRef.current = ''
      return
    }

    if (query === lastQueryRef.current) return
    lastQueryRef.current = query
    setCurrentPage(1)
    startDirectSearch(query, 1)
  }, [query, startDirectSearch, abortDirectSearch, clearDirectSearchState])

  // 加载下一页
  const handleLoadMore = useCallback(async () => {
    if (!canLoadMore) return
    const nextPage = currentPage + 1
    setCurrentPage(nextPage)
    startDirectSearch(query, nextPage)
  }, [canLoadMore, currentPage, query, startDirectSearch])

  // 滚动加载 - 使用 canLoadMore 来控制是否允许触发
  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: directLoading,
    canLoadMore: isCurrentPageComplete && canLoadMore,
    onLoadMore: handleLoadMore,
  })

  // 如果没有 query，不渲染内容
  if (!query) return null

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SearchResultsGrid
          mode="direct"
          directResults={directResults}
          aggregatedDirectResults={aggregatedResults}
          loading={directLoading}
          totalResults={aggregatedResults.length}
          hasMore={hasMore}
          sentinelRef={sentinelRef}
        />
      </section>
    </div>
  )
}
