import { cn } from '@/shared/lib'
import { Loader2 } from 'lucide-react'
import { useHealthStore, type HealthStatus } from '@/shared/store/healthStore'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/shared/components/ui/tooltip'

interface HealthBadgeProps {
  /** healthStore key */
  healthKey: string
  /** badge = 边框标签, dot = 圆点+文字+Tooltip */
  variant?: 'badge' | 'dot'
}

const STATUS_LABELS: Record<HealthStatus, string> = {
  idle: '',
  testing: '检测中',
  online: '可达',
  offline: '不可达',
  timeout: '超时',
  error: '异常',
}

const STATUS_BADGE_COLORS: Record<HealthStatus, string> = {
  idle: '',
  testing: '',
  online: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
  offline: 'border-red-500/30 text-red-600 dark:text-red-400',
  timeout: 'border-amber-500/30 text-amber-600 dark:text-amber-400',
  error: 'border-red-500/30 text-red-600 dark:text-red-400',
}

function latencyTextColor(ms: number) {
  if (ms < 500) return 'text-emerald-600 dark:text-emerald-400'
  if (ms < 1500) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function dotColor(status: HealthStatus, ms: number | null) {
  if (status === 'online' && ms !== null) {
    if (ms < 500) return 'bg-emerald-500'
    if (ms < 1500) return 'bg-amber-500'
    return 'bg-red-500'
  }
  return ({
    online: 'bg-emerald-500',
    offline: 'bg-red-500',
    timeout: 'bg-amber-500',
    error: 'bg-red-500',
  } as Record<string, string>)[status] || ''
}

export function HealthBadge({ healthKey, variant = 'badge' }: HealthBadgeProps) {
  const result = useHealthStore(state => state.results[healthKey])

  if (!result || result.status === 'idle') return null

  if (result.status === 'testing') {
    return <Loader2 className="text-muted-foreground size-3 shrink-0 animate-spin" />
  }

  const inner = (
    <span className="inline-flex shrink-0 items-center gap-1">
      {variant === 'dot' && (
        <span className={cn('inline-block size-1.5 rounded-full', dotColor(result.status, result.latency))} />
      )}
      <span
        className={cn(
          'text-xs tabular-nums',
          variant === 'badge'
            ? STATUS_BADGE_COLORS[result.status]
            : result.status === 'online' && result.latency !== null
              ? latencyTextColor(result.latency)
              : ({
                offline: 'text-red-600 dark:text-red-400',
                timeout: 'text-amber-600 dark:text-amber-400',
                error: 'text-red-600 dark:text-red-400',
              } as Record<string, string>)[result.status] || '',
        )}
      >
        {result.latency !== null ? `${result.latency}ms` : STATUS_LABELS[result.status]}
      </span>
    </span>
  )

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
          STATUS_BADGE_COLORS[result.status],
        )}
      >
        {STATUS_LABELS[result.status]}
        {result.latency !== null && <span className="tabular-nums">{result.latency}ms</span>}
      </span>
    )
  }

  const tooltipText =
    result.latency !== null
      ? `${result.latency}ms`
      : result.errorMessage || STATUS_LABELS[result.status]

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="top">{tooltipText}</TooltipContent>
    </Tooltip>
  )
}
