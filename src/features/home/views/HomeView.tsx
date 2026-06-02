import {
  useTmdbNowPlaying,
  useTmdbRecommendations,
  useTmdbRegionalDiscover,
} from '@/shared/hooks/useTmdb'
import { useSettingStore } from '@/shared/store/settingStore'
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
  const isMainland = useSettingStore(s => s.system.tmdbRegion) === 'mainland'
  const { trending, loading: trendingLoading } = useTmdbNowPlaying()
  const favorites = useFavoritesStore(state => state.favorites)
  const viewingHistory = useViewingHistoryStore(state => state.viewingHistory)
  const {
    popularMovies,
    topRatedMovies,
    upcoming,
    popularTv,
    topRatedTv,
    tvShows: regionalTvShows,
    movies: regionalMovies,
    animated: regionalAnimated,
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
        items={isMainland ? regionalFeatured : trending}
        loading={isMainland ? regionalLoading : trendingLoading.trending}
      />
      {/* 影视偏好快捷切换 */}
      <div className="flex items-center gap-2 px-1">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            isMainland
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
          onClick={() => useSettingStore.getState().setSystemSettings({ tmdbRegion: 'mainland' })}
        >
          大陆
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !isMainland
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
          onClick={() => useSettingStore.getState().setSystemSettings({ tmdbRegion: 'international' })}
        >
          欧美
        </button>
      </div>
      {/* 继续观看 */}
      <ContinueWatching />
      {/* 猜你喜欢 */}
      <MediaCarousel title="猜你喜欢" items={recommendations} loading={recommendationsLoading} />
      {/* 平台热门剧集 */}
      <MediaCarousel title="热门剧集" items={regionalTvShows} loading={regionalLoading} />
      {/* 平台热门电影 */}
      <MediaCarousel title="热门电影" items={regionalMovies} loading={regionalLoading} />
      {/* 动画 */}
      <MediaCarousel title="动画" items={regionalAnimated} loading={regionalLoading} />
      {/* 最受欢迎 */}
      <MediaCarousel title="最受欢迎" items={popularMovies} loading={regionalLoading} />
      {/* 口碑最佳 */}
      <MediaCarousel title="口碑最佳" items={topRatedMovies} loading={regionalLoading} />
      {/* 即将上映 */}
      <MediaCarousel title="即将上映" items={upcoming} loading={regionalLoading} />
      {/* 最受欢迎的剧集 */}
      <MediaCarousel title="最受欢迎的剧集" items={popularTv} loading={regionalLoading} />
      {/* 口碑最佳的剧集 */}
      <MediaCarousel title="口碑最佳的剧集" items={topRatedTv} loading={regionalLoading} />
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
