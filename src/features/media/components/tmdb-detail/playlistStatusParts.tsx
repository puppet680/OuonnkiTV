import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Spinner } from '@/shared/components/ui/spinner'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import type { PlaylistMatchesProgress } from './usePlaylistMatches'

/** 折叠容器（动画高度过渡） */
export function MotionCollapse({
  open,
  children,
}: {
  open: boolean
  children: React.ReactNode
}) {
  const reducedMotion = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={reducedMotion ? false : { height: 0, opacity: 0 }}
          animate={reducedMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
          exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="pt-3">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** 轮播式提示文本 */
function SlidingText({
  messages,
  intervalMs = 1600,
}: {
  messages: string[]
  intervalMs?: number
}) {
  const [index, setIndex] = useState(0)
  const reducedMotion = useReducedMotion()

  const messagesKey = messages.join('')

  useEffect(() => {
    setIndex(0)
  }, [messagesKey])

  useEffect(() => {
    if (messages.length <= 1) return
    const timer = window.setInterval(() => {
      setIndex(prev => (prev + 1) % messages.length)
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs, messagesKey, messages.length])

  const active = messages[index] || messages[0] || '正在准备匹配任务...'

  if (reducedMotion) {
    return (
      <div className="relative h-5 min-w-[220px] max-w-[320px] overflow-hidden">
        <p className="absolute inset-0 flex h-5 items-center">
          <span className="block w-full truncate">{active}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-5 min-w-[220px] max-w-[320px] overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={active}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="absolute inset-0 flex h-5 items-center"
        >
          <span className="block w-full truncate">{active}</span>
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

/** 匹配进度/完成胶囊 */
export function ProgressPill({
  tmdbType,
  loading,
  progress,
  showComplete,
  candidatesCount,
  startedAt,
  completedAt,
}: {
  tmdbType: TmdbMediaType
  loading: boolean
  progress: PlaylistMatchesProgress
  showComplete: boolean
  candidatesCount: number
  startedAt: number | null
  completedAt: number | null
}) {
  const containerClass =
    'inline-flex items-center gap-2 rounded-full border border-border/45 bg-background/70 px-3 py-1.5 text-xs text-foreground/85 backdrop-blur-sm'

  if (loading) {
    const currentSearch =
      progress.currentSourceName
        ? `正在检索：${progress.currentSourceName}`
        : progress.lastEvent === 'start'
          ? '正在初始化检索任务...'
          : '正在等待源响应...'

    const searchProgress =
      progress.total > 0 ? `检索进度：${progress.completed}/${progress.total}` : '检索进度：0/0'

    const lastResult =
      progress.lastEvent === 'result' && progress.lastResultSourceName
        ? `收到 ${progress.lastResultSourceName} 返回 ${progress.lastResultCount} 条`
        : progress.lastResultSourceName
          ? `最近返回：${progress.lastResultSourceName}（${progress.lastResultCount} 条）`
          : ''

    const matchStep =
      progress.phase === 'match'
        ? tmdbType === 'tv'
          ? `正在按季计算匹配（候选 ${candidatesCount}）`
          : `正在计算匹配（候选 ${candidatesCount}）`
        : ''

    const messages = [currentSearch, searchProgress, lastResult, matchStep].filter(Boolean)

    return (
      <div className={containerClass}>
        <Spinner size="sm" />
        <SlidingText messages={messages} />
      </div>
    )
  }

  if (!showComplete) return null

  const durationMs = startedAt && completedAt ? Math.max(0, completedAt - startedAt) : 0
  const durationText = durationMs > 0 ? `（用时 ${(durationMs / 1000).toFixed(1)}s）` : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={containerClass.replace('text-foreground/85', 'text-green-600')}
    >
      <Check className="size-4" />
      <span>匹配完成{durationText}</span>
    </motion.div>
  )
}
