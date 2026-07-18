import { memo, useCallback, useMemo, useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MediaPosterCard } from '@/shared/components/common'
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/shared/components/ui/carousel'
import { AspectRatio } from '@/shared/components/ui/aspect-ratio'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { getPosterUrl } from '@/shared/lib/tmdb'
import { buildTmdbDetailPath, buildTmdbPlayPath } from '@/shared/lib/routes'
import { useFavoritesStore } from '@/features/favorites/store/favoritesStore'
import { useNavigate } from 'react-router'
import type { TmdbMediaItem } from '@/shared/types/tmdb'

// ---- helpers ----

function CarouselSkeleton({ title }: { title: string }) {
  const isMobile = useIsMobile()
  const skeletonCount = isMobile ? 3 : typeof window !== 'undefined' && window.innerWidth < 1024 ? 4 : 6

  return (
    <div>
      <div className="px-1">
        <h2 className="text-primary text-xl font-semibold">{title}</h2>
      </div>
      <div className="flex gap-4 pt-2">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="flex-1">
            <AspectRatio ratio={2 / 3}>
              <Skeleton className="size-full rounded-lg" />
            </AspectRatio>
            <Skeleton className="mt-2 h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- default TmdbMediaItem renderer ----

function TmdbCard({ item }: { item: TmdbMediaItem }) {
  const favoritesStore = useFavoritesStore()
  const navigate = useNavigate()

  return (
    <MediaPosterCard
      to={buildTmdbDetailPath(item.mediaType, item.id)}
      posterUrl={getPosterUrl(item.posterPath, 'w342')}
      title={item.title}
      year={item.releaseDate ? item.releaseDate.split('-')[0] : undefined}
      rating={item.voteAverage}
      overview={item.overview}
      onToggleFavorite={() => favoritesStore.toggleTmdbFavorite(item)}
      isFavorited={favoritesStore.isTmdbFavorited(item.id, item.mediaType)}
      onPlayNow={() => navigate(buildTmdbPlayPath(item.mediaType, item.id))}
      onViewDetail={() => navigate(buildTmdbDetailPath(item.mediaType, item.id))}
    />
  )
}

// ---- main ----

export interface MediaCarouselProps<T = TmdbMediaItem> {
  title: string
  items: T[]
  loading?: boolean
  linkTo?: string
  /** 自定义卡片渲染，不传则使用默认 TmdbMediaItem 卡片 */
  renderItem?: (item: T, index: number) => ReactNode
  /** item key 提取器，用于 CarouselItem key */
  itemKey?: (item: T, index: number) => string
  /** 自定义每页滑动数量，默认根据屏幕宽度自动计算 */
  slidesToScroll?: number
}

function MediaCarouselInner<T>({
  title,
  items,
  loading = false,
  linkTo,
  renderItem,
  itemKey,
  slidesToScroll: slidesToScrollProp,
}: MediaCarouselProps<T>) {
  const isMobile = useIsMobile()
  const isTablet = !isMobile && typeof window !== 'undefined' && window.innerWidth < 1024
  const visibleCount = isMobile ? 3 : isTablet ? 4 : 6
  const slidesToScroll = slidesToScrollProp ?? visibleCount
  const canDrag = items.length > visibleCount

  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  useEffect(() => {
    if (!carouselApi) return
    const onSelect = () => {
      setCanScrollPrev(carouselApi.canScrollPrev())
      setCanScrollNext(carouselApi.canScrollNext())
    }
    onSelect()
    carouselApi.on('select', onSelect)
    carouselApi.on('reInit', onSelect)
    return () => {
      carouselApi.off('select', onSelect)
      carouselApi.off('reInit', onSelect)
    }
  }, [carouselApi])

  const defaultRender = useCallback(
    (item: T) => <TmdbCard item={item as unknown as TmdbMediaItem} />,
    [],
  )
  const render = (renderItem ?? defaultRender) as (item: T, index: number) => ReactNode

  // ponytail: memo cards to avoid re-renders on carousel scroll
  const cards = useMemo(
    () =>
      items.map((item, idx) => (
        <CarouselItem
          key={itemKey ? itemKey(item, idx) : `${idx}`}
          className="h-fit basis-1/3 md:basis-1/4 lg:basis-1/6"
        >
          {render(item, idx)}
        </CarouselItem>
      )),
    [items, render, itemKey],
  )

  if (loading) return <CarouselSkeleton title={title} />
  if (items.length === 0) return null

  // ponytail: content-visibility 跳过不可见区域样式计算，主题切换时首屏以下不 recalc
  return (
    <div className="group/carousel" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 320px' }}>
      <div className="px-1">
        {linkTo ? (
          <NavLink className="group/title inline-flex items-center gap-1" to={linkTo}>
            <h2 className="text-primary text-xl font-semibold">{title}</h2>
            <ChevronRight className="text-primary/50 group-hover/title:text-primary size-5 transition-transform duration-200 group-hover/title:translate-x-1" />
          </NavLink>
        ) : (
          <h2 className="text-primary text-xl font-semibold">{title}</h2>
        )}
      </div>
      <div className="pt-2">
        <Carousel opts={{ watchDrag: canDrag, slidesToScroll }} setApi={setCarouselApi}>
          <CarouselContent>{cards}</CarouselContent>
          {canDrag && canScrollPrev && (
            <Button
              variant="outline"
              size="icon"
              className="absolute top-1/2 -left-5 size-10 -translate-y-1/2 rounded-full transition-opacity duration-300 md:size-12 lg:opacity-0 lg:group-hover/carousel:opacity-100 dark:bg-zinc-800"
              onClick={() => carouselApi?.scrollPrev()}
              aria-label="上一个"
            >
              <ChevronLeft className="size-4 translate-x-1.5 md:size-6 md:translate-x-0.5" />
            </Button>
          )}
          {canDrag && canScrollNext && (
            <Button
              variant="outline"
              size="icon"
              className="absolute top-1/2 -right-5 size-10 -translate-y-1/2 rounded-full transition-opacity duration-300 md:size-12 lg:opacity-0 lg:group-hover/carousel:opacity-100 dark:bg-zinc-800"
              onClick={() => carouselApi?.scrollNext()}
              aria-label="下一个"
            >
              <ChevronRight className="size-4 -translate-x-1.5 md:size-6 md:-translate-x-0.5" />
            </Button>
          )}
        </Carousel>
      </div>
    </div>
  )
}

// cast memo to preserve generic
export const MediaCarousel = memo(MediaCarouselInner) as typeof MediaCarouselInner
