import { useCallback, useState } from 'react'
import { Copy, CopyCheck } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { toast } from 'sonner'

interface ClickToCopyProps {
  text: string
  label?: string
  className?: string
}

export function ClickToCopy({ text, label, className }: ClickToCopyProps) {
  const [copied, setCopied] = useState(false)

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    toast.success(`已复制：${label || text}`)
    setTimeout(() => setCopied(false), 1500)
  }, [text, label])

  const Icon = copied ? CopyCheck : Copy

  return (
    <span className={cn('group inline-flex items-start gap-0.5 max-w-full', className)}>
      <span className="select-none">{text}</span>
      <span
        role="button"
        tabIndex={0}
        className={cn(
          'shrink-0 rounded p-0.5 opacity-0 transition-opacity',
          'group-hover:opacity-100',
          'focus-visible:opacity-100 focus-visible:outline-none',
          copied && 'opacity-100',
        )}
        title="点击复制"
        onClick={handleClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick(e as unknown as React.MouseEvent)
          }
        }}
      >
        <Icon
          className={cn(
            'size-3.5 text-muted-foreground transition-colors',
            copied && 'text-green-500',
          )}
        />
      </span>
    </span>
  )
}
