import {
  useTmdbRecommendations,
  useTmdbRegionalDiscover,
} from '@/shared/hooks/useTmdb'
import { useFavoritesStore } from '@/features/favorites/store/favoritesStore'
import { useViewingHistoryStore } from '@/shared/store'
import { isTmdbHistoryItem } from '@/shared/lib/viewingHistory'
import { useTmdbEnabled } from '@/shared/hooks/useTmdbMode'
import type { TmdbFavoriteItem } from '@/features/favorites/types/favorites'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import { FeaturedCarousel } from '../components/FeaturedCarousel'
import { ContinueWatching } from '../components/ContinueWatching'
import { MediaCarousel } from '../components/MediaCarousel'
import { CmsHomeContent } from '../components/CmsHomeContent'
import { useMemo } from 'react'

/**
 * TmdbHomeContent - TMDB 模式首页内容
 */
function TmdbHomeContent() {
  const favorites = useFavoritesStore(state => state.favorites)
  const viewingHistory = useViewingHistoryStore(state => state.viewingHistory)
  const {
    tvShows: regionalTvShows,
    movies: regionalMovies,
    animated: regionalAnimated,
    variety: regionalVariety,
    featured: regionalFeatured,
    loading: regionalLoading,
  } = useTmdbRegionalDiscover()

  const tmdbRecommendationCandidates = useMemo(() => {
    const tmdbFavorites = favorites.filter(
      (item): item is TmdbFavoriteItem => item.sourceType === 'tmdb',
    )

    const favoriteSources = tmdbFavorites.map(item => ({
      id: item.media.id,
      mediaType: item.media.mediaType,
    }))

    const historySources = viewingHistory
      .filter(isTmdbHistoryItem)
      .map(item => ({
        id: item.tmdbId,
        mediaType: item.tmdbMediaType,
      }))

    const sourceMap = new Map<string, { id: number; mediaType: TmdbMediaType }>()
      ;[...favoriteSources, ...historySources].forEach(source => {
        sourceMap.set(`${source.mediaType}-${source.id}`, source)
      })

    return Array.from(sourceMap.values())
  }, [favorites, viewingHistory])
  const { recommendations, loading: recommendationsLoading } =
    useTmdbRecommendations(tmdbRecommendationCandidates)

  return (
    <div className="flex flex-col gap-6">
      {/* 首页趋势轮播 */}
      <FeaturedCarousel
        items={regionalFeatured}
        loading={regionalLoading}
      />
      {/* 继续观看 */}
      <ContinueWatching />
      {/* 猜你喜欢 */}
      <MediaCarousel title="猜你喜欢" items={recommendations} loading={recommendationsLoading} />
      {/* 列表 */}
      <MediaCarousel title="电影" items={regionalMovies} loading={regionalLoading} />
      <MediaCarousel title="连续剧" items={regionalTvShows} loading={regionalLoading} />
      <MediaCarousel title="综艺" items={regionalVariety} loading={regionalLoading} />
      <MediaCarousel title="动漫" items={regionalAnimated} loading={regionalLoading} />
    </div>
  )
}

/**
 * HomeView - 首页视图
 * 根据 TMDB 模式状态条件渲染不同的首页内容
 */
export default function HomeView() {
  const tmdbEnabled = useTmdbEnabled()

  if (!tmdbEnabled) {
    return <CmsHomeContent />
  }

  return <TmdbHomeContent />
}
