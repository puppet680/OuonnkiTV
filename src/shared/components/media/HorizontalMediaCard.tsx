import { type ReactNode } from 'react'
import { Link } from 'react-router'
import { getPosterUrl } from '@/shared/lib/tmdb'
import { cn } from '@/shared/lib/utils'

export interface HorizontalMediaCardProps {
  posterPath?: string | null
  posterAlt: string
  /** 点击跳转，不传则渲染为普通 div */
  to?: string
  className?: string
  children: ReactNode
}

/**
 * 横向媒体卡片 — 左侧 2:3 海报 + 右侧自定义内容。
 * ponytail: shared shell for season cards, credit cards, etc.
 * Context menu / actions are handled by callers via children.
 */
export function HorizontalMediaCard({
  posterPath,
  posterAlt,
  to,
  className,
  children,
}: HorizontalMediaCardProps) {
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

  if (to) {
    return (
      <Link
        to={to}
        className={cn('border-border/40 hover:border-primary/30 flex gap-3 rounded-lg border p-3 transition-colors', className)}
      >
        {inner}
      </Link>
    )
  }

  return (
    <article className={cn('border-border/40 flex gap-3 rounded-lg border p-3', className)}>
      {inner}
    </article>
  )
}
