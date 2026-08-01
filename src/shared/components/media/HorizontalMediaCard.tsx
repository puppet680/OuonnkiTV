import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { getPosterUrl } from '@/shared/lib/tmdb'
import { cn } from '@/shared/lib/utils'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  type ContextMenuMediaInfo,
} from '@/shared/components/ui/context-menu'
import { useIsMobile } from '@/shared/hooks/use-mobile'

/** 上下文菜单项 */
export interface ContextMenuAction {
  id: string
  label: string
  icon?: ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

export interface HorizontalMediaCardProps {
  posterPath?: string | null
  posterAlt: string
  /** 点击跳转，不传则渲染为普通 div */
  to?: string
  className?: string
  /** 传入后启用右键/长按上下文菜单（菜单标题取 posterAlt） */
  contextMenuItems?: ContextMenuAction[]
  /** 移动端抽屉菜单标题下方显示的简介（纯文本或影视介绍信息） */
  contextMenuDescription?: string | ContextMenuMediaInfo
  children: ReactNode
}

/**
 * 横向媒体卡片 — 左侧 2:3 海报 + 右侧自定义内容。
 * 传入 contextMenuItems 时启用右键/长按上下文菜单，逻辑与 MediaPosterCard 一致。
 * @param contextMenuItems - 菜单项列表，为空时不渲染 ContextMenu（零开销）
 */
export function HorizontalMediaCard({
  posterPath,
  posterAlt,
  to,
  className,
  contextMenuItems,
  contextMenuDescription,
  children,
}: HorizontalMediaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuKey, setMenuKey] = useState(0)
  const handleMenuOpenChange = useCallback((open: boolean) => {
    setMenuOpen(open)
    if (open) setMenuKey(v => v + 1)
  }, [])

  // 3秒后自动关闭上下文菜单（移动端抽屉需点选，不自动关）
  const isMobile = useIsMobile()
  useEffect(() => {
    if (!menuOpen || isMobile) return
    const timer = setTimeout(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }, 3000)
    return () => clearTimeout(timer)
  }, [menuOpen, menuKey, isMobile])

  const poster = (
    <div className="border-border/35 aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg border bg-zinc-200/40 dark:bg-zinc-800/40">
      {posterPath ? (
        <img
          src={getPosterUrl(posterPath, 'w185')}
          alt={posterAlt}
          className="block h-full w-full object-cover object-top"
          loading="lazy"
        />
      ) : (
        <div className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px]">无海报</div>
      )}
    </div>
  )

  const inner = (
    <>
      {poster}
      <div className="min-w-0 flex-1">{children}</div>
    </>
  )

  const card = to ? (
    <Link
      to={to}
      className={cn('border-border/40 hover:border-primary/30 flex gap-3 rounded-lg border p-3 transition-colors', className)}
    >
      {inner}
    </Link>
  ) : (
    <article className={cn('border-border/40 flex gap-3 rounded-lg border p-3', className)}>
      {inner}
    </article>
  )

  // 无菜单项时零开销，直接返回
  if (!contextMenuItems?.length) return card

  return (
    <ContextMenu onOpenChange={handleMenuOpenChange}>
      <ContextMenuTrigger asChild onContextMenu={(e: React.MouseEvent) => e.stopPropagation()}>
        {card}
      </ContextMenuTrigger>
      <ContextMenuContent key={menuKey} title={posterAlt} description={contextMenuDescription}>
        {contextMenuItems.map(item => (
          <ContextMenuItem
            key={item.id}
            variant={item.variant}
            disabled={item.disabled}
            onClick={item.onClick}
          >
            {item.icon}
            {item.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}
