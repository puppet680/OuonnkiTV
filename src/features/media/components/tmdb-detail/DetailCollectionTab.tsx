import { MediaPosterCard } from '@/shared/components/common'
import { getPosterUrl } from '@/shared/lib/tmdb'
import { buildTmdbDetailPath, buildTmdbPlayPath } from '@/shared/lib/routes'
import { useLocation, useNavigate } from 'react-router'
import { useFavoritesStore } from '@/features/favorites/store/favoritesStore'
import { useCollectionDetail } from './useCollectionDetail'
import { getReleaseYear } from './helpers'
import type { TmdbMediaItem } from '@/shared/types/tmdb'

interface DetailCollectionTabProps {
  collectionId: number
  /** 当前高亮的 TMDB ID，匹配到的卡片不跳转，显示 currentLabel */
  currentTmdbId?: number
  /** 当前卡片标签文字，默认"正在播放" */
  currentLabel?: string
}

/**
 * 系列/合集详情 Tab
 * 展示合集内所有作品，按上映日期排序
 */
export function DetailCollectionTab({ collectionId, currentTmdbId, currentLabel = '正在播放' }: DetailCollectionTabProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const favoritesStore = useFavoritesStore()
  const currentUrl = location.pathname + location.search
  const { collection, loading, error } = useCollectionDetail(collectionId)

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-48 bg-muted rounded-xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !collection) {
    return <p className="text-muted-foreground text-sm">系列信息加载失败</p>
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{collection.name}</h2>
        {collection.overview && (
          <p className="text-muted-foreground text-sm leading-relaxed">{collection.overview}</p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-medium">
          系列作品 · {collection.parts.length} 部
        </h3>
        {collection.parts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {collection.parts.map(movie => {
              const tmdbItem: TmdbMediaItem = {
                id: movie.id,
                mediaType: 'movie',
                title: movie.title,
                originalTitle: movie.title,
                overview: movie.overview || '',
                posterPath: movie.poster_path ?? null,
                backdropPath: null,
                logoPath: null,
                releaseDate: movie.release_date || '',
                voteAverage: 0,
                voteCount: 0,
                popularity: 0,
                genreIds: [],
                originalLanguage: '',
                originCountry: [],
              }
              const isCurrent = currentTmdbId !== undefined && movie.id === currentTmdbId
              return (
                <MediaPosterCard
                  key={movie.id}
                  to={isCurrent ? currentUrl : buildTmdbDetailPath('movie', movie.id)}
                  posterUrl={getPosterUrl(movie.poster_path ?? null, 'w342') || null}
                  title={movie.title}
                  year={getReleaseYear(movie.release_date)}
                  topRightLabel={isCurrent ? currentLabel : undefined}
                  overview={movie.overview}
                  onToggleFavorite={() => favoritesStore.toggleTmdbFavorite(tmdbItem)}
                  isFavorited={favoritesStore.isTmdbFavorited(movie.id, 'movie')}
                  onPlayNow={() => navigate(buildTmdbPlayPath('movie', movie.id))}
                  onViewDetail={() => navigate(buildTmdbDetailPath('movie', movie.id))}
                />
              )
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">当前系列暂无电影数据</p>
        )}
      </div>
    </section>
  )
}
