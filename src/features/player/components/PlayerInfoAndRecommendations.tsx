import { memo, useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { useReducedMotion, motion } from 'motion/react'
import { Star, CalendarDays, Clapperboard, Tv, Heart, Layers, MessageCircle, HardDrive } from 'lucide-react'
import type { TmdbMediaItem, TmdbMediaType } from '@/shared/types/tmdb'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { MediaPosterCard } from '@/shared/components/common'
import { getPosterUrl } from '@/shared/lib/tmdb'
import { buildTmdbDetailPath, buildTmdbPlayPath } from '@/shared/lib/routes'
import { useFavoritesStore } from '@/features/favorites/store/favoritesStore'
import { DetailCollectionTab } from '@/features/media/components/tmdb-detail'
import PlayerResourcesTab from './PlayerResourcesTab'
import PlayerCommentsTab from './PlayerCommentsTab'

type PlayerInfoTab = 'overview' | 'comments' | 'resources'

const TAB_ITEMS: Array<{ key: PlayerInfoTab; label: string; icon: React.ReactNode }> = [
  { key: 'overview', label: '剧情介绍', icon: <Clapperboard className="size-3.5" /> },
  { key: 'comments', label: '评论', icon: <MessageCircle className="size-3.5" /> },
  { key: 'resources', label: '网盘资源', icon: <HardDrive className="size-3.5" /> },
]

interface PlayerInfoAndRecommendationsProps {
  title: string
  originalTitle?: string
  overview: string
  sourceName: string
  modeLabel: string
  releaseDate?: string
  rating?: number
  posterPath?: string | null
  cmsCover?: string
  tmdbMediaType: TmdbMediaType | null
  seasonCount?: number
  episodeCount?: number
  detailLink?: string
  showRecommendations?: boolean
  collectionId?: number
  currentTmdbId?: number
  favoriteAction?: {
    active: boolean
    onToggle: () => void
  }
  recommendations: TmdbMediaItem[]
}

export const PlayerInfoAndRecommendations = memo(function PlayerInfoAndRecommendations({
  title,
  originalTitle,
  overview,
  sourceName,
  modeLabel,
  releaseDate,
  rating,
  posterPath,
  cmsCover,
  tmdbMediaType,
  seasonCount,
  episodeCount,
  detailLink,
  showRecommendations = true,
  collectionId,
  currentTmdbId,
  favoriteAction,
  recommendations,
}: PlayerInfoAndRecommendationsProps) {
  const favoritesStore = useFavoritesStore()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const infoPoster = posterPath ? getPosterUrl(posterPath, 'w342') : cmsCover || ''

  const [activeTab, setActiveTab] = useState<PlayerInfoTab>('overview')
  const tabListRef = useRef<HTMLDivElement | null>(null)
  const [tabIndicator, setTabIndicator] = useState({ x: 0, width: 0, ready: false })

  const updateTabIndicator = useCallback(() => {
    const listEl = tabListRef.current
    if (!listEl) return
    const activeEl = listEl.querySelector<HTMLButtonElement>(`button[data-tab='${activeTab}']`)
    if (!activeEl) {
      setTabIndicator(prev => (prev.ready ? { ...prev, ready: false } : prev))
      return
    }
    const listRect = listEl.getBoundingClientRect()
    const activeRect = activeEl.getBoundingClientRect()
    setTabIndicator({ x: activeRect.left - listRect.left, width: activeRect.width, ready: true })
  }, [activeTab])

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => updateTabIndicator())
    return () => window.cancelAnimationFrame(frameId)
  }, [updateTabIndicator])

  useEffect(() => {
    const onResize = () => updateTabIndicator()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [updateTabIndicator])

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card/45 p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">影视介绍</h2>
          <div className="flex items-center gap-2">
            {favoriteAction ? (
              <Button
                size="sm"
                variant={favoriteAction.active ? 'default' : 'secondary'}
                className="h-7 rounded-full px-2.5 text-xs"
                onClick={favoriteAction.onToggle}
              >
                <Heart className={favoriteAction.active ? 'size-3.5 fill-current' : 'size-3.5'} />
                {favoriteAction.active ? '已收藏' : '收藏'}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-3.5 md:space-y-4">
          <div className="flex flex-col gap-3 md:grid md:grid-cols-[180px_minmax(0,1fr)] md:gap-4">
            <div className="w-full">
              <div className="relative mx-auto aspect-[2/3] w-32 overflow-hidden rounded-lg border border-border/50 bg-muted/35 md:mx-0 md:w-full">
                {infoPoster ? (
                  <img
                    src={infoPoster}
                    alt={title}
                    className="absolute inset-0 block h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">暂无海报</div>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 md:hidden">
                <Badge variant="secondary" className="h-6 rounded-full px-2 text-[11px]">
                  {sourceName}
                </Badge>
                <Badge variant="outline" className="h-6 rounded-full px-2 text-[11px]">
                  {modeLabel}
                </Badge>
                {tmdbMediaType && (
                  <Badge variant="outline" className="h-6 rounded-full px-2 text-[11px]">
                    {tmdbMediaType === 'tv' ? '剧集内容' : '电影内容'}
                  </Badge>
                )}
                {releaseDate && (
                  <Badge variant="outline" className="h-6 rounded-full px-2 text-[11px]">
                    <CalendarDays className="size-3.5" />
                    {releaseDate.slice(0, 10)}
                  </Badge>
                )}
                {rating && rating > 0 ? (
                  <Badge variant="outline" className="h-6 rounded-full px-2 text-[11px]">
                    <Star className="size-3.5 text-amber-400" />
                    {rating.toFixed(1)}
                  </Badge>
                ) : null}
                {tmdbMediaType === 'tv' && seasonCount && episodeCount ? (
                  <Badge variant="outline" className="h-6 rounded-full px-2 text-[11px]">
                    <Tv className="size-3.5" />
                    共 {seasonCount} 季 / {episodeCount} 集
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2.5 md:gap-3">
              <div className="space-y-1 text-center md:text-left">
                <h2 className="line-clamp-2 text-lg font-semibold md:text-2xl">{title}</h2>
                {originalTitle && originalTitle !== title && (
                  <p className="text-muted-foreground line-clamp-1 text-xs md:text-sm">{originalTitle}</p>
                )}
              </div>

              <div className="hidden flex-wrap items-center gap-2 md:flex">
                <Badge variant="secondary" className="px-2.5 text-xs">
                  {sourceName}
                </Badge>
                <Badge variant="outline" className="px-2.5 text-xs">
                  {modeLabel}
                </Badge>
                {tmdbMediaType && (
                  <Badge variant="outline" className="px-2.5 text-xs">
                    {tmdbMediaType === 'tv' ? '剧集内容' : '电影内容'}
                  </Badge>
                )}
                {releaseDate && (
                  <Badge variant="outline" className="px-2.5 text-xs">
                    <CalendarDays className="size-3.5" />
                    {releaseDate.slice(0, 10)}
                  </Badge>
                )}
                {rating && rating > 0 ? (
                  <Badge variant="outline" className="px-2.5 text-xs">
                    <Star className="size-3.5 text-amber-400" />
                    {rating.toFixed(1)}
                  </Badge>
                ) : null}
                {tmdbMediaType === 'tv' && seasonCount && episodeCount ? (
                  <Badge variant="outline" className="px-2.5 text-xs">
                    <Tv className="size-3.5" />
                    共 {seasonCount} 季 / {episodeCount} 集
                  </Badge>
                ) : null}
              </div>

              <div className="mt-1 space-y-3">
                <div className="relative border-b border-border/50">
                  <div ref={tabListRef} className="flex items-center gap-4 md:gap-6">
                    {TAB_ITEMS.map(tab => {
                      const isActive = activeTab === tab.key
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          data-tab={tab.key}
                          className="relative shrink-0 whitespace-nowrap px-1 py-2.5 text-sm font-medium"
                          onClick={() => setActiveTab(tab.key)}
                        >
                          <span className={`flex items-center gap-1.5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {tab.icon}
                            {tab.label}
                          </span>
                        </button>
                      )
                    })}
                    {tabIndicator.ready && (
                      <motion.div
                        className="bg-primary pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full"
                        initial={false}
                        animate={{ x: tabIndicator.x, width: tabIndicator.width }}
                        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38, mass: 0.35 }}
                      />
                    )}
                  </div>
                </div>

                <div className="min-h-[4rem]">
                  {activeTab === 'overview' && (
                    <p className="text-muted-foreground text-sm leading-6">{overview || '暂无剧情介绍'}</p>
                  )}
                  {activeTab === 'comments' && (
                    <PlayerCommentsTab
                      title={title}
                      year={releaseDate ? releaseDate.slice(0, 4) : undefined}
                    />
                  )}
                  {activeTab === 'resources' && (
                    <PlayerResourcesTab keyword={title} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {detailLink ? (
            <div className="mt-auto flex justify-end pt-0.5">
              <NavLink to={detailLink} className="text-muted-foreground text-xs hover:text-foreground">
                查看详情
              </NavLink>
            </div>
          ) : null}
        </div>
      </section>

      {collectionId ? (
        <section className="space-y-3 rounded-lg border border-border/60 bg-card/45 p-4 md:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Layers className="size-4" />
            <h2 className="text-lg font-semibold">系列作品</h2>
          </div>
          <DetailCollectionTab collectionId={collectionId} currentTmdbId={currentTmdbId} />
        </section>
      ) : null}

      {showRecommendations && (
        <section className="space-y-3 rounded-lg border border-border/60 bg-card/45 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Clapperboard className="size-4" />
              猜你还喜欢
            </h2>
            <NavLink to="/" className="text-muted-foreground text-xs hover:text-foreground">
              去首页查看更多
            </NavLink>
          </div>

          {recommendations.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {recommendations.slice(0, 12).map(item => (
                <MediaPosterCard
                  key={`${item.mediaType}-${item.id}`}
                  to={buildTmdbDetailPath(item.mediaType, item.id)}
                  posterUrl={getPosterUrl(item.posterPath, 'w342')}
                  title={item.title}
                  showTitle
                  overview={item.overview}
                  onToggleFavorite={() => favoritesStore.toggleTmdbFavorite(item)}
                  isFavorited={favoritesStore.isTmdbFavorited(item.id, item.mediaType)}
                  onPlayNow={() => navigate(buildTmdbPlayPath(item.mediaType, item.id))}
                  onViewDetail={() => navigate(buildTmdbDetailPath(item.mediaType, item.id))}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">暂无推荐内容</p>
          )}
        </section>
      )}
    </div>
  )
})
