import { Link } from 'react-router'
import { Button } from '@/shared/components/ui/button'
import { AlertHero, Callout } from '@/shared/components/ui/callout'
import { cn } from '@/shared/lib/utils'

export interface StatePanelAction {
  label: string
  to?: string
  onClick?: () => void
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
}

export interface StatePanelProps {
  mode: 'error' | 'empty'
  title: string
  description: string
  tag?: string
  primaryAction?: StatePanelAction
  secondaryAction?: StatePanelAction
  compact?: boolean
  className?: string
}

/**
 * 统一状态面板 — 错误/空状态占位，全项目共用。
 */
export function StatePanel({
  mode,
  title,
  description,
  tag,
  primaryAction,
  secondaryAction,
  compact = false,
  className,
}: StatePanelProps) {
  const renderAction = (action: StatePanelAction, key: string) => {
    const variant = action.variant || (key === 'primary' ? 'secondary' : 'ghost')
    if (action.to) {
      return (
        <Button key={key} asChild size="sm" variant={variant} className="h-8 rounded-full px-3.5">
          <Link to={action.to}>{action.label}</Link>
        </Button>
      )
    }
    return (
      <Button key={key} size="sm" variant={variant} className="h-8 rounded-full px-3.5" onClick={action.onClick}>
        {action.label}
      </Button>
    )
  }

  const actions = (primaryAction || secondaryAction) ? (
    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
      {primaryAction ? renderAction(primaryAction, 'primary') : null}
      {secondaryAction ? renderAction(secondaryAction, 'secondary') : null}
    </div>
  ) : null

  if (compact) {
    return (
      <Callout
        variant={mode === 'error' ? 'error' : 'default'}
        className={className}
        title={tag ? `${tag} · ${title}` : title}
        description={description}
      >
        {actions}
      </Callout>
    )
  }

  return (
    <section
      className={cn(
        'flex w-full flex-col items-center justify-center gap-4 px-4 py-6 text-center md:px-6',
        compact ? 'min-h-[280px]' : 'min-h-[50vh]',
        className,
      )}
    >
      {tag && <p className="text-muted-foreground/60 text-[11px] tracking-[0.12em] uppercase">{tag}</p>}
      <AlertHero variant={mode} title={title} description={description}>
        {actions}
      </AlertHero>
    </section>
  )
}
