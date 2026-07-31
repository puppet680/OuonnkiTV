import { memo } from 'react'
import { Play, Info, Copy } from 'lucide-react'
import { NavLink } from 'react-router'

import { ClickToCopy } from '@/shared/components/ui/click-to-copy'
import { getBackdropUrl, getLogoUrl } from '@/shared/lib/tmdb'
import { buildTmdbDetailPath, buildTmdbPlayPath } from '@/shared/lib/routes'
import { buildHistoryPlayPath } from '@/shared/lib/viewingHistory'
import { Button } from '@/shared/components/ui/button'
import { CarouselItem } from '@/shared/components/ui/carousel'
import { AspectRatio } from '@/shared/components/ui/aspect-ratio'
import type { TmdbMediaItem } from '@/shared/types/tmdb'
import type { ViewingHistoryItem } from '@/shared/types/video'
import { toast } from 'sonner'

export interface FeaturedCarouselItemProps {
  item: TmdbMediaItem
  isActive: boolean
  getAspectRatio: () => number
  isMobile: boolean
  latestTmdbHistoryMap: Map<string, ViewingHistoryItem>
}

/**
 * FeaturedCarouselItem - 单个轮播项，memo 隔离使 activeIndex 变化只重渲染当前项
 */
export const FeaturedCarouselItem = memo(function FeaturedCarouselItem({
  item,
  isActive,
  getAspectRatio,
  isMobile,
  latestTmdbHistoryMap,
}: FeaturedCarouselItemProps) {
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
              <span className="group relative inline-block max-w-full">
                <img src={getLogoUrl(item.logoPath) || undefined} alt={item.title} className="max-h-12 max-w-[180px] object-contain md:max-h-16 md:max-w-[240px]" />
                <span
                  role="button" tabIndex={0} title="点击复制标题"
                  className="absolute top-0 right-0 cursor-pointer rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                  onClick={async e => { e.preventDefault(); await navigator.clipboard.writeText(item.title); toast.success(`已复制：${item.title}`) }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigator.clipboard.writeText(item.title); toast.success(`已复制：${item.title}`) } }}
                >
                  <Copy className="size-3.5 text-white drop-shadow" />
                </span>
              </span>
            ) : (
              <h2 className="text-xl font-bold text-white md:text-2xl">
                <ClickToCopy text={item.title} />
              </h2>
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
              <span className="group relative inline-block max-w-full">
                <img src={getLogoUrl(item.logoPath) || undefined} alt={item.title} className="max-h-35 max-w-md object-contain xl:max-h-40 xl:max-w-lg" />
                <span
                  role="button" tabIndex={0} title="点击复制标题"
                  className="absolute top-0 right-0 cursor-pointer rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                  onClick={async e => { e.preventDefault(); await navigator.clipboard.writeText(item.title); toast.success(`已复制：${item.title}`) }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigator.clipboard.writeText(item.title); toast.success(`已复制：${item.title}`) } }}
                >
                  <Copy className="size-4 text-white drop-shadow" />
                </span>
              </span>
            ) : (
              <h2 className="text-2xl font-bold text-white md:text-4xl lg:text-5xl">
                <ClickToCopy text={item.title} />
              </h2>
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
