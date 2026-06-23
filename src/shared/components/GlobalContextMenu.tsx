import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useGlobalContextMenuStore } from '@/shared/store/contextMenuStore'
import { cn } from '@/shared/lib/utils'

interface GlobalContextMenuProps {
  children: React.ReactNode
  builtInItems?: Array<{
    id: string
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: 'default' | 'destructive'
    disabled?: boolean
  }>
}

/**
 * 全局右键菜单。
 *
 * 不使用 Radix ContextMenu（其嵌套 Root + Trigger 的事件模型在菜单
 * 已打开时重复右键会泄漏浏览器原生菜单）。改为原生 document capture
 * 阶段监听 contextmenu，仅在非卡片区域弹出定位菜单。
 */
export function GlobalContextMenu({ children, builtInItems }: GlobalContextMenuProps) {
  const dynamicItems = useGlobalContextMenuStore((s) => s.items)
  const [open, setOpen] = useState(false)
  const [point, setPoint] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Element)) return

      // 如果目标在卡片自有 ContextMenu 内，交给卡片处理
      if (target.closest('[data-slot="context-menu-trigger"]')) return
      // 如果目标在已打开的上下文菜单上，只阻止浏览器菜单但不弹出全局菜单
      if (target.closest('[role="menu"]')) {
        e.preventDefault()
        return
      }

      e.preventDefault()
      // 存原始坐标，定位逻辑交给 style 用 left/right、top/bottom 动态锚定
      setPoint({ x: e.clientX, y: e.clientY })
      setOpen(true)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])

  const handleItemClick = useCallback((onClick: () => void) => {
    onClick()
    setOpen(false)
  }, [])

  const hasBuiltIn = (builtInItems?.length ?? 0) > 0
  const hasDynamic = dynamicItems.length > 0

  return (
    <>
      {children}
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            'bg-popover text-popover-foreground fixed z-[9999]',
            'min-w-[8rem] origin-[var(--radix-context-menu-content-transform-origin)]',
            'overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
            'animate-in fade-in-0 zoom-in-95',
          )}
          style={{
            ...(point.x > window.innerWidth - 200
              ? { right: `${window.innerWidth - point.x}px` }
              : { left: `${point.x}px` }),
            ...(point.y > window.innerHeight - 240
              ? { bottom: `${window.innerHeight - point.y}px` }
              : { top: `${point.y}px` }),
            maxHeight: 'var(--radix-context-menu-content-available-height, auto)',
          }}
        >
          {!hasBuiltIn && !hasDynamic ? (
            <MenuItem disabled>无可用操作</MenuItem>
          ) : (
            <>
              {builtInItems?.map((item) => (
                <MenuItem
                  key={item.id}
                  disabled={item.disabled}
                  variant={item.variant}
                  onClick={() => handleItemClick(item.onClick)}
                >
                  {item.icon}
                  {item.label}
                </MenuItem>
              ))}
              {hasBuiltIn && hasDynamic && <div className="bg-border -mx-1 my-1 h-px" />}
              {dynamicItems.map((item) => (
                <MenuItem
                  key={item.id}
                  disabled={item.disabled}
                  variant={item.variant}
                  onClick={() => handleItemClick(item.onClick)}
                >
                  {item.icon}
                  {item.label}
                </MenuItem>
              ))}
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}

/** 菜单项 — 复用 ContextMenuItem 的视觉样式 */
function MenuItem({
  children,
  disabled,
  variant = 'default',
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  variant?: 'default' | 'destructive'
  onClick?: () => void
}) {
  const handleClick = onClick
    ? (e: React.MouseEvent) => {
        if (e.button !== 0) return
        onClick()
      }
    : undefined

  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'focus:bg-accent focus:text-accent-foreground',
        'data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive',
        '[&_svg:not([class*="text-"])]:text-muted-foreground',
        'relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
      )}
      data-variant={variant}
    >
      {children}
    </button>
  )
}
