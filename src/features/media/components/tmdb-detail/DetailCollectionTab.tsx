import { useEffect, useState } from 'react'
import { MediaPosterCard } from '@/shared/components/common'
import { getPosterUrl, getTmdbClient } from '@/shared/lib/tmdb'
import { buildTmdbDetailPath, buildTmdbPlayPath } from '@/shared/lib/routes'
import { useSettingStore } from '@/shared/store/settingStore'
import { getReleaseYear } from './helpers'
import { useLocation, useNavigate } from 'react-router'
import type { LanguageOption } from 'tmdb-ts'
import type { DetailCollectionFull, DetailCollectionMovie } from './types'
import type { TmdbMediaItem } from '@/shared/types/tmdb'
import { useFavoritesStore } from '@/features/favorites/store/favoritesStore'

interface DetailCollectionTabProps {
  collectionId: number
  /** 当前高亮的 TMDB ID，匹配到的卡片不跳转，显示 currentLabel */
  currentTmdbId?: number
  /** 当前卡片标签文字，默认"正在播放" */
  currentLabel?: string
}

export function DetailCollectionTab({ collectionId, currentTmdbId, currentLabel = '正在播放' }: DetailCollectionTabProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const favoritesStore = useFavoritesStore()
  const currentUrl = location.pathname + location.search
  const [collection, setCollection] = useState<DetailCollectionFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchCollection = async () => {
      setLoading(true)
      setError(null)
      try {
        const client = getTmdbClient()
        const language = useSettingStore.getState().system.tmdbLanguage
        const data = await client.collections.details(collectionId, { language } as LanguageOption)
        if (cancelled) return
        setCollection({
          name: data.name,
          overview: data.overview,
          poster_path: data.poster_path,
          backdrop_path: data.backdrop_path,
          parts: (data.parts || [])
            .map((m): DetailCollectionMovie => ({
              id: m.id,
              title: m.title || '',
              poster_path: m.poster_path,
              release_date: m.release_date,
              overview: m.overview,
            }))
            .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || '')),
        })
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError((e as Error).message || 'Failed to fetch collection')
        setLoading(false)
      }
    }
    fetchCollection()
    return () => { cancelled = true }
  }, [collectionId])

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
