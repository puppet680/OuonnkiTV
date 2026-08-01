import { useState, useCallback, useEffect, memo } from 'react'
import { Play, Heart, HeartOff, Maximize, ExternalLink, Copy } from 'lucide-react'
import { NavLink } from 'react-router'
import { toast } from 'sonner'
import { AspectRatio } from '@/shared/components/ui/aspect-ratio'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/shared/components/ui/hover-card'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/shared/components/ui/context-menu'
import { useIsMobile } from '@/shared/hooks/use-mobile'
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
export const MediaPosterCard = memo(function MediaPosterCard({
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuKey, setMenuKey] = useState(0)
  const handleMenuOpenChange = useCallback((open: boolean) => {
    setMenuOpen(open)
    if (open) setMenuKey((v) => v + 1)
  }, [])

  // 3秒后自动关闭上下文菜单（移动端抽屉无 hover 且需点选，不自动关）
  const isMobile = useIsMobile()
  useEffect(() => {
    if (!menuOpen || isMobile) return
    const timer = setTimeout(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }, 3000)
    return () => clearTimeout(timer)
  }, [menuOpen, menuKey, isMobile])

  const copyTitle = useCallback(() => {
    const execCopy = () => {
      // contentEditable + selectAll — iOS Safari 兼容 execCommand('copy')
      const el = document.createElement('div')
      el.contentEditable = 'true'
      el.textContent = title
      el.style.cssText =
        'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;-webkit-user-select:text;'
      document.body.appendChild(el)
      el.focus()
      document.execCommand('selectAll', false)
      let ok = false
      try { ok = document.execCommand('copy') } catch { /* noop */ }
      document.body.removeChild(el)
      return ok
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(title).then(
        () => toast.success('已复制标题'),
        () => {
          const ok = execCopy()
          toast[ok ? 'success' : 'error'](ok ? '已复制标题' : '复制失败，请重试')
        },
      )
    } else {
      const ok = execCopy()
      toast[ok ? 'success' : 'error'](ok ? '已复制标题' : '复制失败，请重试')
    }
  }, [title])

  const labelColor = topRightLabelColorScheme || {
    bg: '250, 204, 21',
    text: '120, 53, 15',
  }
  const labelStyle = {
    backgroundColor: `rgb(${labelColor.bg})`,
    color: `rgb(${labelColor.text})`,
  }

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
              decoding="async"
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
          <img src={posterUrl} alt={title} className="w-14 shrink-0 rounded object-cover" loading="lazy" />
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

  const menuItems = (
    <ContextMenuContent
      key={menuKey}
      title={title}
      description={
        overview
          ? {
              posterUrl,
              year: year !== undefined && year !== '' ? String(year) : undefined,
              rating,
              overview,
            }
          : undefined
      }
    >
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
      <ContextMenuItem onClick={copyTitle}>
        <Copy className="size-4" />
        复制标题
      </ContextMenuItem>
    </ContextMenuContent>
  )

  // ContextMenu + HoverCard 共存：两个 trigger 链式嵌套到 NavLink
  // ContextMenuTrigger asChild → (HoverCardTrigger asChild) → NavLink，各自事件直达 DOM
  // 移动端不渲染 HoverCard：触屏本就不会 hover 打开（Radix excludeTouch），
  // 且其 Trigger 的 onTouchStart preventDefault 在 passive 监听里会报错
  return (
    <ContextMenu onOpenChange={handleMenuOpenChange}>
      {overview && !isMobile ? (
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
})
