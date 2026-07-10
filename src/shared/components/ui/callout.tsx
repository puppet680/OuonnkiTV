import { type ReactNode } from 'react'
import { AlertTriangle, Info, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type CalloutVariant = 'default' | 'info' | 'warning' | 'error' | 'success'

export interface CalloutProps {
  variant?: CalloutVariant
  icon?: ReactNode
  title?: string
  description?: string
  children?: ReactNode
  className?: string
}

const variantStyles: Record<CalloutVariant, { wrapper: string; icon: string }> = {
  default: {
    wrapper: 'border-border bg-card text-card-foreground',
    icon: 'text-muted-foreground',
  },
  info: {
    wrapper: 'border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300',
    icon: 'text-blue-500',
  },
  warning: {
    wrapper: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300',
    icon: 'text-amber-500',
  },
  error: {
    wrapper: 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300',
    icon: 'text-red-500',
  },
  success: {
    wrapper: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
    icon: 'text-emerald-500',
  },
}

const defaultIcons: Record<CalloutVariant, ReactNode> = {
  default: <Info className="size-5" />,
  info: <Info className="size-5" />,
  warning: <AlertTriangle className="size-5" />,
  error: <XCircle className="size-5" />,
  success: <CheckCircle className="size-5" />,
}

/**
 * Callout — 提示卡片，用于错误/警告/信息展示。
 * ponytail: Radix-based card callout pattern
 */
export function Callout({
  variant = 'default',
  icon,
  title,
  description,
  children,
  className,
}: CalloutProps) {
  const styles = variantStyles[variant]

  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border p-4',
        styles.wrapper,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 pt-0.5', styles.icon)}>
          {icon ?? defaultIcons[variant]}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {title && <h5 className="text-sm font-semibold leading-tight">{title}</h5>}
          {description && <p className="text-sm opacity-85">{description}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}

// ---- Alert variant: centered hero-style ----

export interface AlertHeroProps {
  variant?: 'error' | 'empty'
  icon?: ReactNode
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

const heroIconMap: Record<string, ReactNode> = {
  error: <AlertCircle className="size-12" />,
  empty: <Info className="size-12" />,
}

export function AlertHero({
  variant = 'error',
  icon,
  title,
  description,
  children,
  className,
}: AlertHeroProps) {
  const isError = variant === 'error'
  const iconColor = isError ? 'text-red-500/80' : 'text-muted-foreground/60'

  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-8 text-center', className)}>
      <div className={iconColor}>
        {icon ?? heroIconMap[variant]}
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-muted-foreground max-w-md text-sm leading-6">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
