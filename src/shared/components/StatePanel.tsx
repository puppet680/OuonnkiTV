import { Link } from 'react-router'
import { AlertCircle, Inbox } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

export interface StatePanelAction {
  label: string
  to?: string
  onClick?: () => void
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
}

export interface StatePanelProps {
  mode: 'error' | 'empty'
  title: string
  description: string
  tag?: string
  primaryAction?: StatePanelAction
  secondaryAction?: StatePanelAction
  extraAction?: StatePanelAction
  className?: string
}

/**
 * 统一状态面板 — 屏幕中心绝对居中版
 */
export function StatePanel({
  mode,
  title,
  description,
  tag,
  primaryAction,
  secondaryAction,
  extraAction,
  className,
}: StatePanelProps) {
  const isError = mode === 'error'
  const Icon = isError ? AlertCircle : Inbox

  // 渲染操作按钮
  const renderAction = (action: StatePanelAction, type: 'primary' | 'secondary') => {
    const defaultVariant = type === 'primary' ? (isError ? 'destructive' : 'secondary') : 'ghost'
    const variant = action.variant || defaultVariant

    return (
      <Button
        key={type}
        size="sm"
        variant={variant}
        asChild={!!action.to}
        onClick={action.onClick}
        className={cn(
          "h-8 rounded-md px-3 text-xs font-medium transition-all shadow-none",
          variant === 'ghost' && "text-muted-foreground hover:text-foreground"
        )}
      >
        {action.to ? <Link to={action.to}>{action.label}</Link> : action.label}
      </Button>
    )
  }

  return (
    <section
      className={cn(
        'flex flex-1 w-full min-h-[50vh] items-center justify-center px-4 py-12 animate-in fade-in-50 duration-300',
        className
      )}
    >
      <div
        className={cn(
          "w-full max-w-[380px] rounded-2xl p-6 flex flex-col items-center text-center",
          "shadow-sm backdrop-blur-[2px]",
          // 浅色模式
          "bg-card/60 border border-border/60",
          // 深色模式优化：稍微提亮卡片底色，使用半透明白边框和顶部微内高光
          "dark:bg-muted/30 dark:border-white/[0.08] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
        )}
      >
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full mb-4 ring-8 ring-offset-0',
            isError
              ? 'bg-destructive/10 text-destructive ring-destructive/5'
              : 'bg-muted text-muted-foreground ring-muted/20 dark:bg-muted/80'
          )}
        >
          <Icon className="h-5 w-5 stroke-[1.5]" />
        </div>

        {/* 标签 (Tag) */}
        {tag && (
          <span className="mb-2 text-[10px] font-bold tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 uppercase">
            {tag}
          </span>
        )}

        {/* 标题与描述 */}
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-1.5 text-xs text-muted-foreground/90 dark:text-muted-foreground/80 leading-relaxed max-w-[300px]">
          {description}
        </p>

        {/* 动作按钮组 */}
        {(primaryAction || secondaryAction || extraAction) && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 w-full">
            {primaryAction && renderAction(primaryAction, 'primary')}
            {secondaryAction && renderAction(secondaryAction, 'secondary')}
            {extraAction && renderAction(extraAction, 'secondary')}
          </div>
        )}
      </div>
    </section>
  )
}
