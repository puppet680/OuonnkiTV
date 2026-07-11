import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Play, Info } from 'lucide-react'
import Autoplay from 'embla-carousel-autoplay'
import { NavLink } from 'react-router'

import { getBackdropUrl, getLogoUrl, getPosterUrl } from '@/shared/lib/tmdb'
import { buildTmdbDetailPath, buildTmdbPlayPath } from '@/shared/lib/routes'
import { buildHistoryPlayPath, isTmdbHistoryItem } from '@/shared/lib/viewingHistory'
import { Button } from '@/shared/components/ui/button'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/shared/components/ui/carousel'
import { AspectRatio } from '@/shared/components/ui/aspect-ratio'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { useViewingHistoryStore } from '@/shared/store/viewingHistoryStore'
import type { TmdbMediaItem } from '@/shared/types/tmdb'
import type { ViewingHistoryItem } from '@/shared/types/video'

interface FeaturedCarouselProps {
  items: TmdbMediaItem[]
  loading?: boolean
  autoplayDelay?: number
}

/**
 * FeaturedCarouselItem - 单个轮播项，memo 隔离使 activeIndex 变化只重渲染当前项
 */
const FeaturedCarouselItem = memo(function FeaturedCarouselItem({
  item,
  isActive,
  getAspectRatio,
  isMobile,
  latestTmdbHistoryMap,
}: {
  item: TmdbMediaItem
  isActive: boolean
  getAspectRatio: () => number
  isMobile: boolean
  latestTmdbHistoryMap: Map<string, ViewingHistoryItem>
}) {
  const playPath = buildTmdbPlayPath(item.mediaType, item.id)
  const detailPath = buildTmdbDetailPath(item.mediaType, item.id)
  const latestTmdbHistory = latestTmdbHistoryMap.get(`${item.mediaType}-${item.id}`)
  const continueWatchingLabel = latestTmdbHistory
    ? latestTmdbHistory.episodeName || `第${latestTmdbHistory.episodeIndex + 1}集`
    : ''
  const continueWatchingProgressLabel = latestTmdbHistory
    ? latestTmdbHistory.duration > 0
      ? `已观看 ${Math.round(
          Math.min(
            100,
            Math.max(0, (latestTmdbHistory.playbackPosition / latestTmdbHistory.duration) * 100),
          ),
        )}%`
      : '已开始观看'
    : ''
  const continueWatchingPath = latestTmdbHistory
    ? latestTmdbHistory.sourceCode && latestTmdbHistory.vodId
      ? buildHistoryPlayPath(latestTmdbHistory)
      : buildTmdbPlayPath(item.mediaType, item.id, {
          episodeIndex: latestTmdbHistory.episodeIndex,
          seasonNumber: item.mediaType === 'tv' ? latestTmdbHistory.tmdbSeasonNumber ?? undefined : undefined,
        })
    : ''
  const playNowLabel = continueWatchingPath ? '从头播放' : '立即播放'

  return (
    <CarouselItem className="h-fit rounded-lg">
      <AspectRatio ratio={getAspectRatio()} className="bg-muted overflow-hidden rounded-lg">
        {/* 背景图片：始终加载 img，非 active 用 content-visibility 延迟解码 */}
        <img
          className="h-full w-full rounded-lg object-cover object-center md:object-top-right"
          src={getBackdropUrl(item.backdropPath) || undefined}
          alt={item.title}
          loading={isActive ? undefined : 'lazy'}
          fetchPriority={isActive ? 'high' : undefined}
          style={{ contentVisibility: isActive ? 'visible' : 'auto' }}
        />

        {/* 遮罩层 - 移动端/平板从下到上渐变 */}
        <div
          className={`absolute inset-0 flex min-h-0 flex-col justify-end rounded-lg bg-gradient-to-t from-black/90 via-black/50 via-60% to-transparent px-6 pt-4 pb-6 transition-opacity duration-500 ease-out md:px-8 md:pb-8 lg:hidden ${isActive ? 'opacity-100' : 'opacity-0'}`}
        >
          <div
            className={`mb-3 flex shrink-0 items-end transition-all delay-100 duration-500 ease-out md:mb-4 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          >
            {item.logoPath ? (
              <img src={getLogoUrl(item.logoPath) || undefined} alt={item.title} className="max-h-12 max-w-[180px] object-contain md:max-h-16 md:max-w-[240px]" />
            ) : (
              <h2 className="text-xl font-bold text-white md:text-2xl">{item.title}</h2>
            )}
          </div>
          <p className={`mb-2 line-clamp-2 min-h-0 shrink text-xs text-white/80 transition-all delay-150 duration-500 ease-out md:mb-4 md:line-clamp-3 md:max-w-md md:text-sm ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            {item.overview}
          </p>
          <div className={`shrink-0 transition-all delay-200 duration-500 ease-out ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            {isMobile ? (
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 min-w-0 flex-1 gap-1 rounded-full bg-[#E50914] px-2.5 text-xs font-semibold text-white hover:bg-[#ca0812]"
                  onClick={() => window.location.href = continueWatchingPath || playPath}>
                  <Play className="size-3.5 fill-current" />
                  {continueWatchingPath ? '继续观看' : playNowLabel}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 md:gap-3">
                {continueWatchingPath && (
                  <NavLink to={continueWatchingPath} className="group relative inline-flex h-8 rounded-full gap-1.5 bg-[#E50914] px-3 font-semibold text-white hover:bg-[#ca0812] md:h-9 md:gap-2 md:px-4 md:text-sm items-center">
                    <span className="inline-flex items-center gap-1.5 transition-opacity duration-200 group-hover:opacity-0 md:gap-2">
                      <Play className="size-3.5 fill-current md:size-4" />
                      继续观看{continueWatchingLabel ? <span className="hidden md:inline">· {continueWatchingLabel}</span> : null}
                    </span>
                    {continueWatchingProgressLabel && (
                      <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[11px] font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:flex">
                        {continueWatchingProgressLabel}
                      </span>
                    )}
                  </NavLink>
                )}
                <NavLink to={playPath} className="inline-flex h-8 rounded-full gap-1.5 bg-white px-3 font-semibold text-black hover:bg-white/90 md:h-9 md:gap-2 md:px-4 md:text-sm items-center">
                  <Play className="size-3.5 fill-current md:size-4" />
                  {playNowLabel}
                </NavLink>
                <NavLink to={detailPath} className="inline-flex h-8 rounded-full gap-1.5 bg-white/30 px-3 font-semibold text-white hover:bg-white/40 md:h-9 md:gap-2 md:px-4 md:text-sm items-center">
                  <Info className="size-3.5 md:size-4" />
                  查看详情
                </NavLink>
              </div>
            )}
          </div>
        </div>

        {/* 遮罩层 - 桌面端 */}
        <div className={`absolute inset-0 hidden flex-col justify-end rounded-lg bg-gradient-to-r from-black/90 via-black/50 via-40% to-transparent px-16 pt-25 pb-16 transition-opacity duration-500 ease-out lg:flex ${isActive ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`mb-8 flex h-35 items-end transition-all delay-100 duration-500 ease-out ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            {item.logoPath ? (
              <img src={getLogoUrl(item.logoPath) || undefined} alt={item.title} className="max-h-35 max-w-md object-contain xl:max-h-40 xl:max-w-lg" />
            ) : (
              <h2 className="text-2xl font-bold text-white md:text-4xl lg:text-5xl">{item.title}</h2>
            )}
          </div>
          <p className={`mb-5 line-clamp-3 max-w-xl text-[0.7rem] text-white/80 transition-all delay-150 duration-500 ease-out md:max-w-2xl md:text-base ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            {item.overview}
          </p>
          <div className={`flex gap-3 transition-all delay-200 duration-500 ease-out ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            {continueWatchingPath && (
              <NavLink to={continueWatchingPath} className="group relative inline-flex rounded-full gap-2 bg-[#E50914] font-semibold text-white hover:bg-[#ca0812] px-4 py-2 items-center">
                <span className="inline-flex items-center gap-2 transition-opacity duration-200 group-hover:opacity-0">
                  <Play className="size-5 fill-current" />
                  继续观看{continueWatchingLabel ? <span>· {continueWatchingLabel}</span> : null}
                </span>
                {continueWatchingProgressLabel && (
                  <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-xs font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100 xl:flex">
                    {continueWatchingProgressLabel}
                  </span>
                )}
              </NavLink>
            )}
            <NavLink to={playPath} className="inline-flex rounded-full gap-2 bg-white font-semibold text-black hover:bg-white/90 px-4 py-2 items-center">
              <Play className="size-5 fill-current" />
              {playNowLabel}
            </NavLink>
            <NavLink to={detailPath} className="inline-flex rounded-full gap-2 bg-white/30 font-semibold text-white hover:bg-white/40 px-4 py-2 items-center">
              <Info className="size-5" />
              查看详情
            </NavLink>
          </div>
        </div>
      </AspectRatio>
    </CarouselItem>
  )
})

/**
 * FeaturedCarousel - 精选内容轮播图组件
 */
export const FeaturedCarousel = memo(function FeaturedCarousel({
  items,
  loading = false,
  autoplayDelay = 5000,
}: FeaturedCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [activeIndex, setActiveIndex] = useState(0)
  // ponytail: 延迟轮播初始化，首屏先渲染静态图绕过 embla measure() 729ms 强制重排
  const [carouselReady, setCarouselReady] = useState(false)
  // 静态首屏文本淡入动画
  const [textVisible, setTextVisible] = useState(false)
  const miniApiRef = useRef<CarouselApi | null>(null)
  const isMobile = useIsMobile()
  const viewingHistory = useViewingHistoryStore(state => state.viewingHistory)

  useEffect(() => {
    const idle = 'requestIdleCallback' in window ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 0)
    const id = idle(() => setCarouselReady(true))
    return () => {
      if ('cancelIdleCallback' in window) cancelIdleCallback(id as number)
      else clearTimeout(id as ReturnType<typeof setTimeout>)
    }
  }, [])

  // 触发静态首屏文本淡入（下一帧 kick-off CSS transition）
  useEffect(() => {
    if (carouselReady) return
    const raf = requestAnimationFrame(() => setTextVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [carouselReady])

  // 缓存首张巨幕 URL 到 sessionStorage，下次访问 HTML 预加载跳过 React 渲染延迟
  useEffect(() => {
    if (items.length > 0) {
      const url = getBackdropUrl(items[0].backdropPath)
      if (url) {
        try { sessionStorage.setItem('lcp_backdrop', url) } catch (_) {}
      }
    }
  }, [items])

  const latestTmdbHistoryMap = useMemo(() => {
    const latestHistoryMap = new Map<string, ViewingHistoryItem>()
    const latestMappedHistoryMap = new Map<string, ViewingHistoryItem>()

    viewingHistory.forEach(historyItem => {
      if (!isTmdbHistoryItem(historyItem)) return

      const mediaKey = `${historyItem.tmdbMediaType}-${historyItem.tmdbId}`
      const latestHistory = latestHistoryMap.get(mediaKey)
      const latestMappedHistory = latestMappedHistoryMap.get(mediaKey)

      if (!latestHistory || historyItem.timestamp > latestHistory.timestamp) {
        latestHistoryMap.set(mediaKey, historyItem)
      }

      if (!historyItem.sourceCode || !historyItem.vodId) return

      if (!latestMappedHistory || historyItem.timestamp > latestMappedHistory.timestamp) {
        latestMappedHistoryMap.set(mediaKey, historyItem)
      }
    })

    const resultMap = new Map<string, ViewingHistoryItem>()
    latestHistoryMap.forEach((historyItem, mediaKey) => {
      resultMap.set(mediaKey, latestMappedHistoryMap.get(mediaKey) || historyItem)
    })
    return resultMap
  }, [viewingHistory])

  // 根据设备类型获取AspectRatio
  // 移动端: 4/3, 平板: 16/9, 桌面: 9/4
  const getAspectRatio = () => {
    if (isMobile) return 4 / 3
    if (window.innerWidth < 1024) return 16 / 9
    return 9 / 4
  }

  const MINI_PAGE_SIZE = 6

  // 监听 carousel 选择变化，按页滚动 mini 轮播
  useEffect(() => {
    if (!api) return

    const onSelect = () => {
      const idx = api.selectedScrollSnap()
      setActiveIndex(idx)
      const ma = miniApiRef.current
      if (ma) {
        const currentPage = Math.floor(idx / MINI_PAGE_SIZE)
        const miniIdx = currentPage * MINI_PAGE_SIZE
        const scrollSnap = ma.selectedScrollSnap()
        if (scrollSnap !== miniIdx) {
          ma.scrollTo(miniIdx)
        }
      }
    }

    onSelect()
    api.on('select', onSelect)
    return () => {
      api.off('select', onSelect)
    }
  }, [api])

  // 骨架屏
  if (loading) {
    return (
      <div>
        <AspectRatio ratio={getAspectRatio()} className="bg-muted overflow-hidden rounded-lg">
          <Skeleton className="h-full w-full rounded-lg" />
          {/* 骨架屏遮罩层 - 移动端/平板 */}
          <div className="absolute inset-0 flex min-h-0 flex-col justify-end rounded-lg bg-gradient-to-t from-black/90 via-black/50 via-60% to-transparent px-6 pt-4 pb-6 md:px-8 md:pb-8 lg:hidden">
            <Skeleton className="mb-3 h-8 w-36 md:mb-4 md:h-10 md:w-48" />
            <Skeleton className="mb-2 h-3 w-2/3 md:h-4" />
            <Skeleton className="mb-3 h-3 w-1/2 md:mb-4 md:h-4" />
            <div className="flex gap-2 md:gap-3">
              <Skeleton className="h-8 w-20 md:h-9 md:w-24" />
              <Skeleton className="h-8 w-20 md:h-9 md:w-24" />
            </div>
          </div>
          {/* 骨架屏遮罩层 - 桌面端 */}
          <div className="absolute inset-0 hidden flex-col justify-end rounded-lg bg-gradient-to-r from-black/90 via-black/50 via-40% to-transparent px-16 pt-25 pb-16 lg:flex">
            <Skeleton className="mb-8 h-20 w-80 xl:h-24 xl:w-96" />
            <Skeleton className="mb-2 h-4 w-2/3 max-w-2xl" />
            <Skeleton className="mb-5 h-4 w-1/2 max-w-xl" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        </AspectRatio>
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  // 首屏静态渲染：绕过 embla measure() 强制重排，LCP 图片直接上屏
  // 视觉与 FeaturedCarouselItem 完全一致（含观看记录按钮逻辑），避免切换闪烁
  if (!carouselReady) {
    const first = items[0]
    const playPath = buildTmdbPlayPath(first.mediaType, first.id)
    const detailPath = buildTmdbDetailPath(first.mediaType, first.id)
    const latestTmdbHistory = latestTmdbHistoryMap.get(`${first.mediaType}-${first.id}`)
    const continueWatchingLabel = latestTmdbHistory
      ? latestTmdbHistory.episodeName || `第${latestTmdbHistory.episodeIndex + 1}集`
      : ''
    const continueWatchingProgressLabel = latestTmdbHistory
      ? latestTmdbHistory.duration > 0
        ? `已观看 ${Math.round(Math.min(100, Math.max(0, (latestTmdbHistory.playbackPosition / latestTmdbHistory.duration) * 100)))}%`
        : '已开始观看'
      : ''
    const continueWatchingPath = latestTmdbHistory
      ? latestTmdbHistory.sourceCode && latestTmdbHistory.vodId
        ? buildHistoryPlayPath(latestTmdbHistory)
        : buildTmdbPlayPath(first.mediaType, first.id, {
            episodeIndex: latestTmdbHistory.episodeIndex,
            seasonNumber: first.mediaType === 'tv' ? latestTmdbHistory.tmdbSeasonNumber ?? undefined : undefined,
          })
      : ''
    const playNowLabel = continueWatchingPath ? '从头播放' : '立即播放'

    return (
      <div className="relative">
        <div className="min-w-0 shrink-0 grow-0 basis-full h-fit rounded-lg">
          <AspectRatio ratio={getAspectRatio()} className="bg-muted overflow-hidden rounded-lg">
            <img
              className="h-full w-full rounded-lg object-cover object-center md:object-top-right"
              src={getBackdropUrl(first.backdropPath) || undefined}
              alt={first.title}
              fetchPriority="high"
              style={{ contentVisibility: 'visible' }}
            />
            {/* 移动端/平板遮罩 — 与 FeaturedCarouselItem 完全一致 */}
            <div className="absolute inset-0 flex min-h-0 flex-col justify-end rounded-lg bg-gradient-to-t from-black/90 via-black/50 via-60% to-transparent px-6 pt-4 pb-6 transition-opacity duration-500 ease-out md:px-8 md:pb-8 lg:hidden">
              <div className={`mb-3 flex shrink-0 items-end transition-all delay-100 duration-500 ease-out md:mb-4 ${textVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                {first.logoPath ? (
                  <img src={getLogoUrl(first.logoPath) || undefined} alt={first.title} className="max-h-12 max-w-[180px] object-contain md:max-h-16 md:max-w-[240px]" />
                ) : (
                  <h2 className="text-xl font-bold text-white md:text-2xl">{first.title}</h2>
                )}
              </div>
              <p className={`mb-2 line-clamp-2 min-h-0 shrink text-xs text-white/80 transition-all delay-150 duration-500 ease-out md:mb-4 md:line-clamp-3 md:max-w-md md:text-sm ${textVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                {first.overview}
              </p>
              <div className={`shrink-0 transition-all delay-200 duration-500 ease-out ${textVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                {isMobile ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-7 min-w-0 flex-1 gap-1 rounded-full bg-[#E50914] px-2.5 text-xs font-semibold text-white hover:bg-[#ca0812]"
                      onClick={() => window.location.href = continueWatchingPath || playPath}>
                      <Play className="size-3.5 fill-current" />
                      {continueWatchingPath ? '继续观看' : playNowLabel}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {continueWatchingPath && (
                      <NavLink to={continueWatchingPath} className="group relative inline-flex h-8 rounded-full gap-1.5 bg-[#E50914] px-3 font-semibold text-white hover:bg-[#ca0812] md:h-9 md:gap-2 md:px-4 md:text-sm items-center">
                        <span className="inline-flex items-center gap-1.5 transition-opacity duration-200 group-hover:opacity-0 md:gap-2">
                          <Play className="size-3.5 fill-current md:size-4" />
                          继续观看{continueWatchingLabel ? <span className="hidden md:inline">· {continueWatchingLabel}</span> : null}
                        </span>
                        {continueWatchingProgressLabel && (
                          <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[11px] font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:flex">
                            {continueWatchingProgressLabel}
                          </span>
                        )}
                      </NavLink>
                    )}
                    <NavLink to={playPath} className="inline-flex h-8 rounded-full gap-1.5 bg-white px-3 font-semibold text-black hover:bg-white/90 md:h-9 md:gap-2 md:px-4 md:text-sm items-center">
                      <Play className="size-3.5 fill-current md:size-4" />
                      {playNowLabel}
                    </NavLink>
                    <NavLink to={detailPath} className="inline-flex h-8 rounded-full gap-1.5 bg-white/30 px-3 font-semibold text-white hover:bg-white/40 md:h-9 md:gap-2 md:px-4 md:text-sm items-center">
                      <Info className="size-3.5 md:size-4" />
                      查看详情
                    </NavLink>
                  </div>
                )}
              </div>
            </div>
            {/* 桌面端遮罩 — 与 FeaturedCarouselItem 完全一致 */}
            <div className="absolute inset-0 hidden flex-col justify-end rounded-lg bg-gradient-to-r from-black/90 via-black/50 via-40% to-transparent px-16 pt-25 pb-16 transition-opacity duration-500 ease-out lg:flex">
              <div className={`mb-8 flex h-35 items-end transition-all delay-100 duration-500 ease-out ${textVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                {first.logoPath ? (
                  <img src={getLogoUrl(first.logoPath) || undefined} alt={first.title} className="max-h-35 max-w-md object-contain xl:max-h-40 xl:max-w-lg" />
                ) : (
                  <h2 className="text-2xl font-bold text-white md:text-4xl lg:text-5xl">{first.title}</h2>
                )}
              </div>
              <p className={`mb-5 line-clamp-3 max-w-xl text-[0.7rem] text-white/80 transition-all delay-150 duration-500 ease-out md:max-w-2xl md:text-base ${textVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                {first.overview}
              </p>
              <div className={`flex gap-3 transition-all delay-200 duration-500 ease-out ${textVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                {continueWatchingPath && (
                  <NavLink to={continueWatchingPath} className="group relative inline-flex rounded-full gap-2 bg-[#E50914] font-semibold text-white hover:bg-[#ca0812] px-4 py-2 items-center">
                    <span className="inline-flex items-center gap-2 transition-opacity duration-200 group-hover:opacity-0">
                      <Play className="size-5 fill-current" />
                      继续观看{continueWatchingLabel ? <span>· {continueWatchingLabel}</span> : null}
                    </span>
                    {continueWatchingProgressLabel && (
                      <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-xs font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100 xl:flex">
                        {continueWatchingProgressLabel}
                      </span>
                    )}
                  </NavLink>
                )}
                <NavLink to={playPath} className="inline-flex rounded-full gap-2 bg-white font-semibold text-black hover:bg-white/90 px-4 py-2 items-center">
                  <Play className="size-5 fill-current" />
                  {playNowLabel}
                </NavLink>
                <NavLink to={detailPath} className="inline-flex rounded-full gap-2 bg-white/30 font-semibold text-white hover:bg-white/40 px-4 py-2 items-center">
                  <Info className="size-5" />
                  查看详情
                </NavLink>
              </div>
            </div>
          </AspectRatio>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <Carousel
        className="h-fit rounded-lg"
        opts={{
          align: 'center',
          loop: true,
        }}
        plugins={[
          Autoplay({
            delay: autoplayDelay,
            stopOnInteraction: true,
            stopOnMouseEnter: true,
          }),
        ]}
        setApi={setApi}
      >
        <CarouselContent>
          {items.map((item, index) => (
            <FeaturedCarouselItem
              key={`${item.mediaType}-${item.id}`}
              item={item}
              isActive={index === activeIndex}
              getAspectRatio={getAspectRatio}
              isMobile={isMobile}
              latestTmdbHistoryMap={latestTmdbHistoryMap}
            />
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  )
})
