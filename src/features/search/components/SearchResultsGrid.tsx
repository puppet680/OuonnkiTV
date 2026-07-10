import { memo } from 'react'
import type { TmdbMediaItem } from '@/shared/types/tmdb'
import type { VideoItem } from '@ouonnki/cms-core'
import { type AggregatedVideoItem, storeCmsSources } from '../hooks/directSearch.utils'
import { MediaPosterCard } from '@/shared/components/common/MediaPosterCard'
import { POSTER_GRID } from '@/shared/components/media'
import { StatePanel } from '@/shared/components/StatePanel'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'
import { AspectRatio } from '@/shared/components/ui/aspect-ratio'
import type { SearchMode } from './SearchModeToggle'
import { getSourceColorScheme } from '@/shared/lib/source-colors'
import { getPosterUrl } from '@/shared/lib/tmdb'
import { buildCmsPlayPath, buildTmdbDetailPath, buildTmdbPlayPath } from '@/shared/lib/routes'
import { useFavoritesStore } from '@/features/favorites/store/favoritesStore'
import { useNavigate } from 'react-router'

interface SearchResultsGridProps {
  /** 搜索模式 */
  mode: SearchMode
  /** TMDB 搜索结果 */
  tmdbResults?: TmdbMediaItem[]
  /** 直连搜索结果（原始） */
  directResults?: VideoItem[]
  /** 直连搜索聚合结果 */
  aggregatedDirectResults?: AggregatedVideoItem[]
  /** 是否加载中 */
  loading: boolean
  /** 总结果数量 */
  totalResults?: number
  /** 是否正在搜索新查询（用于显示骨架屏） */
  isSearchingNewQuery?: boolean
  /** 是否还有更多内容 */
  hasMore?: boolean
  /** 哨兵元素引用（用于滚动加载） */
  sentinelRef?: React.RefObject<HTMLDivElement | null>
  className?: string
}

// 骨架屏数量
const SKELETON_COUNT = 20

/**
 * ResultSkeleton - 结果骨架屏
 */
function ResultSkeleton() {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg">
        <AspectRatio ratio={2 / 3}>
          <Skeleton className="h-full w-full" />
        </AspectRatio>
      </div>
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}


/**
 * SearchResultsGrid - 搜索结果网格组件
 */
export const SearchResultsGrid = memo(function SearchResultsGrid({
  mode,
  tmdbResults = [],
  directResults = [],
  aggregatedDirectResults = [],
  loading,
  totalResults,
  isSearchingNewQuery,
  hasMore = false,
  sentinelRef,
  className,
}: SearchResultsGridProps) {
  const favoritesStore = useFavoritesStore()
  const navigate = useNavigate()

  // TMDB 模式：显示所有结果
  if (mode === 'tmdb') {
    const results = tmdbResults
    const hasResults = results.length > 0
    // 判断骨架屏显示：
    // 1. 正在加载且没有已有结果（首次加载）
    // 2. 正在搜索新查询（更换关键词或切换筛选）
    const showSkeleton = loading && (!hasResults || isSearchingNewQuery)

    return (
      <div className={cn('space-y-6', className)}>
        {/* 结果统计 - 固定占位，只更新数字避免布局抖动 */}
        <div className="text-muted-foreground h-5 text-sm">
          {hasResults && totalResults !== undefined ? (
            <>
              共找到 <span className="text-primary font-medium">{totalResults}</span> 个结果
              {results.length < totalResults && (
                <>，已显示 <span className="text-primary font-medium">{results.length}</span> 个</>
              )}
            </>
          ) : null}
        </div>

        {/* 内容区域 */}
        <div>
          {showSkeleton ? (
            <div className={POSTER_GRID}>
              {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                <ResultSkeleton key={index} />
              ))}
            </div>
          ) : hasResults ? (
            <div className={POSTER_GRID}>
              {results.map(item => (
                <div key={`${item.mediaType}-${item.id}`}>
                  <MediaPosterCard
                    to={buildTmdbDetailPath(item.mediaType, item.id)}
                    posterUrl={getPosterUrl(item.posterPath, 'w342') || null}
                    title={item.title}
                    year={item.releaseDate ? item.releaseDate.split('-')[0] : undefined}
                    rating={item.voteAverage}
                    overview={item.overview}
                    onToggleFavorite={() => favoritesStore.toggleTmdbFavorite(item)}
                    isFavorited={favoritesStore.isTmdbFavorited(item.id, item.mediaType)}
                    onPlayNow={() => navigate(buildTmdbPlayPath(item.mediaType, item.id))}
                    onViewDetail={() => navigate(buildTmdbDetailPath(item.mediaType, item.id))}
                  />
                </div>
              ))}
            </div>
          ) : (
            <StatePanel mode="empty" title="未找到" description="未找到相关内容，试试其他关键词" />
          )}
        </div>

        {/* 加载更多状态 - 哨兵元素始终渲染，但只在有结果时显示内容 */}
        <div ref={sentinelRef} className="py-8 flex justify-center min-h-[60px]">
          {hasResults ? (
            loading ? (
              <div className="text-muted-foreground text-sm flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                加载下一页...
              </div>
            ) : hasMore ? (
              <div className="text-muted-foreground text-sm">
                下滑加载更多
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                已加载全部内容
              </div>
            )
          ) : null}
        </div>
      </div>
    )
  }

  // Direct 模式：显示聚合后的结果
  const results = aggregatedDirectResults
  const hasResults = results.length > 0

  return (
    <div className={cn('space-y-6', className)}>
      {/* 结果统计 */}
      {hasResults && (
        <div className="text-muted-foreground text-sm">
          共聚合 <span className="text-primary font-medium">{results.length}</span> 个结果
          ，来自 <span className="text-primary font-medium">{directResults.length}</span> 条原始数据
        </div>
      )}

      {/* 内容区域 */}
      <div>
        {loading && !hasResults ? (
          <div className={POSTER_GRID}>
            {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
              <ResultSkeleton key={index} />
            ))}
          </div>
        ) : hasResults ? (
          <div className={POSTER_GRID}>
            {results.map((item) => {
              const { bestSource, sourceCount, sources } = item
              if (!bestSource.source_code || !bestSource.vod_id) return null

              const colorScheme = getSourceColorScheme(bestSource.source_code)
              const sourceLabel = sourceCount > 1
                ? `${bestSource.source_name} +${sourceCount - 1}`
                : bestSource.source_name

              const playSources = sources
                .filter(s => s.source_code && s.vod_id)
                .map(s => ({
                  sourceCode: s.source_code!,
                  vodId: s.vod_id!,
                  sourceName: s.source_name || '',
                }))

              // 存入内存 store，播放器按标题取
              storeCmsSources(bestSource.vod_name, playSources)

              return (
                <div key={bestSource.vod_name}>
                  <MediaPosterCard
                    to={buildCmsPlayPath(bestSource.source_code, bestSource.vod_id)}
                    posterUrl={bestSource.vod_pic || null}
                    title={bestSource.vod_name}
                    year={bestSource.vod_year}
                    topRightLabel={sourceLabel}
                    topRightLabelColorScheme={colorScheme}
                    rating={item.vod_douban_score}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <StatePanel mode="empty" title="未找到" description="换个关键词试试吧" />
        )}
      </div>

      {/* 加载更多状态 */}
      {hasResults && (
        <div ref={sentinelRef} className="py-8 flex justify-center">
          {!hasMore ? (
            <div className="text-muted-foreground text-sm">已加载全部内容</div>
          ) : loading ? (
            <div className="text-muted-foreground text-sm flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              加载下一页...
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">下滑加载更多</div>
          )}
        </div>
      )}
    </div>
  )
})
