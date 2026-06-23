import { useState, useCallback } from 'react'
import { Play, Heart, HeartOff, Maximize, ExternalLink } from 'lucide-react'
import { NavLink } from 'react-router'
import { AspectRatio } from '@/shared/components/ui/aspect-ratio'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/shared/components/ui/hover-card'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/shared/components/ui/context-menu'
import type { SourceColorScheme } from '@/shared/lib/source-colors'

interface MediaPosterCardProps {
  /** 链接地址 */
  to: string
  /** 海报图片 URL */
  posterUrl?: string | null
  /** 标题 */
  title: string
  /** 海报比例，默认 2/3 */
  aspectRatio?: number
  /** 是否显示标题，默认 true */
  showTitle?: boolean
  /** 年份 - 显示在左上角 */
  year?: string | number
  /** 右上角标签 */
  topRightLabel?: string
  /** 右上角标签配色方案（不传则使用默认黄色） */
  topRightLabelColorScheme?: SourceColorScheme
  /** 评分 (0-10) - 显示在右下角 */
  rating?: number
  /** 简介文本 — 传入后 hover 海报卡片时展示 HoverCard */
  overview?: string | null
  /** "加入收藏"回调 — 传入后右键菜单出现收藏按钮 */
  onToggleFavorite?: () => void
  /** 是否已收藏，true 时按钮文案变为"取消收藏" */
  isFavorited?: boolean
  /** 立即播放回调 — 传入后右键菜单和 hover 遮罩出现"立即播放" */
  onPlayNow?: () => void
  /** 查看详情回调 — 传入后右键菜单出现"查看详情" */
  onViewDetail?: () => void
  /** 巨幕播放回调 — 传入后右键菜单出现"巨幕播放" */
  onCinemaMode?: () => void
}

/**
 * MediaPosterCard - 媒体海报卡片组件
 * 通用的海报卡片，支持海报显示、hover 效果、播放按钮遮罩。
 * 传入 onToggleFavorite / onPlayNow / onViewDetail / onCinemaMode 时自动启用右键菜单。
 * 传入 overview 时 hover 展示简介 HoverCard。
 */
export function MediaPosterCard({
  to,
  posterUrl,
  title,
  aspectRatio = 2 / 3,
  showTitle = true,
  year,
  topRightLabel,
  topRightLabelColorScheme,
  rating,
  overview,
  onToggleFavorite,
  isFavorited,
  onPlayNow,
  onViewDetail,
  onCinemaMode,
}: MediaPosterCardProps) {
  const [menuKey, setMenuKey] = useState(0)
  const handleMenuOpenChange = useCallback((open: boolean) => {
    if (open) setMenuKey((v) => v + 1)
  }, [])

  const labelColor = topRightLabelColorScheme || {
    bg: '250, 204, 21',
    text: '120, 53, 15',
  }
  const labelStyle = {
    backgroundColor: `rgb(${labelColor.bg})`,
    color: `rgb(${labelColor.text})`,
  }

  const hasContextMenu = !!onToggleFavorite || !!onPlayNow || !!onViewDetail || !!onCinemaMode

  const cardBody = (
    <div className="group cursor-pointer">
      <div className="relative overflow-hidden rounded-lg">
        <AspectRatio ratio={aspectRatio}>
          {posterUrl ? (
            <img
              className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
              src={posterUrl}
              alt={title}
              loading="lazy"
            />
          ) : (
            <div className="bg-muted flex h-full w-full items-center justify-center">
              <span className="text-muted-foreground text-sm">No Image</span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 group-hover:opacity-0" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 group-hover:opacity-0" />

          {year && (
            <div className="absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] items-center font-medium text-white/90 transition-opacity duration-300 group-hover:opacity-0">
              {year}
            </div>
          )}

          {topRightLabel && (
            <div
              className="absolute right-0 top-0 rounded-bl-md rounded-tr-lg px-2 py-0.5 text-[10px] font-medium shadow-sm transition-opacity duration-300 group-hover:opacity-0"
              style={labelStyle}
            >
              {topRightLabel}
            </div>
          )}

          {rating !== undefined && rating > 0 && (
            <div className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-yellow-400 transition-opacity duration-300 group-hover:opacity-0">
              <span>★</span>
              <span>{rating.toFixed(1)}</span>
            </div>
          )}
        </AspectRatio>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
            <Play className="size-6 fill-current" />
          </div>
        </div>
      </div>

      {showTitle && (
        <div className="mt-2 px-0.5">
          <p className="text-primary line-clamp-1 text-sm font-medium">{title}</p>
        </div>
      )}
    </div>
  )

  // ponytail: 仅在有数据时才包裹 ContextMenu，无 prop 时仍走原路径（零额外开销）
  const link = <NavLink to={to}>{cardBody}</NavLink>

  const hoverContent = overview ? (
    <HoverCardContent side="top" className="w-72 p-0 overflow-hidden">
      <div className="flex gap-3 p-3">
        {posterUrl && (
          <img src={posterUrl} alt={title} className="w-14 shrink-0 rounded object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{title}</p>
          {([year, rating && rating > 0 ? `★ ${rating.toFixed(1)}` : null].filter(Boolean) as string[]).length > 0 && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {[year, rating && rating > 0 ? `★ ${rating.toFixed(1)}` : null].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">{overview}</p>
        </div>
      </div>
    </HoverCardContent>
  ) : null

  // 无 ContextMenu，仅 HoverCard（或裸 NavLink）
  if (!hasContextMenu) {
    return overview ? (
      <HoverCard openDelay={1000}>
        <HoverCardTrigger asChild>{link}</HoverCardTrigger>
        {hoverContent}
      </HoverCard>
    ) : link
  }

  const menuItems = (
    <ContextMenuContent key={menuKey}>
      {onPlayNow && (
        <ContextMenuItem onClick={onPlayNow}>
          <Play className="size-4" />
          立即播放
        </ContextMenuItem>
      )}
      {onCinemaMode && (
        <ContextMenuItem onClick={onCinemaMode}>
          <Maximize className="size-4" />
          巨幕播放
        </ContextMenuItem>
      )}
      {onViewDetail && (
        <ContextMenuItem onClick={onViewDetail}>
          <ExternalLink className="size-4" />
          查看详情
        </ContextMenuItem>
      )}
      {onToggleFavorite && (
        <ContextMenuItem
          onClick={onToggleFavorite}
          variant={isFavorited ? 'destructive' : 'default'}
        >
          {isFavorited ? <HeartOff className="size-4" /> : <Heart className="size-4" />}
          {isFavorited ? '取消收藏' : '加入收藏'}
        </ContextMenuItem>
      )}
    </ContextMenuContent>
  )

  // ContextMenu + HoverCard 共存：两个 trigger 链式嵌套到 NavLink
  // ContextMenuTrigger asChild → (HoverCardTrigger asChild) → NavLink，各自事件直达 DOM
  return (
    <ContextMenu onOpenChange={handleMenuOpenChange}>
      {overview ? (
        <HoverCard openDelay={1000}>
          <ContextMenuTrigger
            asChild
            onContextMenu={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <HoverCardTrigger asChild>
              {link}
            </HoverCardTrigger>
          </ContextMenuTrigger>
          {hoverContent}
        </HoverCard>
      ) : (
        <ContextMenuTrigger
          asChild
          onContextMenu={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {link}
        </ContextMenuTrigger>
      )}
      {menuItems}
    </ContextMenu>
  )
}
