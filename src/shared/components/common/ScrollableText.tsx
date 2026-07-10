import { useCallback, useRef, useState, useEffect } from 'react'
import { cn } from '@/shared/lib/utils'

interface ScrollableTextProps {
  children: React.ReactNode
  /** 最大高度，默认 max-h-28 (~7 lines) */
  maxHeight?: string
  className?: string
  /** 渐变起始位置百分比，默认 60% */
  fadeStart?: string
}

/**
 * 可滚动文本 — 隐藏滚动条，底部 CSS mask 渐变提示可继续滚动。
 * 滚到底部时渐变自动消失。
 */
export function ScrollableText({
  children,
  maxHeight = 'max-h-28',
  className,
  fadeStart = '60%',
}: ScrollableTextProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [atTop, setAtTop] = useState(false)
  const [atBottom, setAtBottom] = useState(false)
  const [overflow, setOverflow] = useState(false)

  const checkScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    setAtTop(el.scrollTop < 4)
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 4)
    setOverflow(el.scrollHeight > el.clientHeight)
  }, [])

  useEffect(() => {
    checkScroll()
  }, [children, checkScroll])

  const maskStops: string[] = []
  if (overflow) {
    if (!atTop) maskStops.push(`transparent 0%`, `black 15%`)
    else maskStops.push(`black 0%`)
    if (!atBottom) maskStops.push(`black ${fadeStart}`, `transparent 100%`)
    else maskStops.push(`black 100%`)
  }

  const gradient = maskStops.length > 0 ? `linear-gradient(to bottom, ${maskStops.join(', ')})` : undefined
  const maskStyle = gradient ? { WebkitMaskImage: gradient, maskImage: gradient } : undefined

  return (
    <div
      ref={ref}
      onScroll={checkScroll}
      style={maskStyle}
      className={cn('overflow-y-auto scrollbar-hide', maxHeight, className)}
    >
      {children}
    </div>
  )
}
