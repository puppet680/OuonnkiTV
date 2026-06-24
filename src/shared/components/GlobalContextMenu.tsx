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
  const [focused, setFocused] = useState(false)

  const closeMenu = useCallback(() => {
    setOpen(false)
    setFocused(false)
  }, [])

  // 不聚焦时 3 秒后自动关闭；聚焦（hover）时取消计时
  useEffect(() => {
    if (!open || focused) return
    const timer = setTimeout(closeMenu, 3000)
    return () => clearTimeout(timer)
  }, [open, focused, closeMenu])

  useEffect(() => {
    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    let longPressPos = { x: 0, y: 0 }

    const showMenu = (_target: Element, x: number, y: number) => {
      // 卡片区域由 Radix ContextMenu 接管，全局菜单不介入
      if (_target.closest('[data-slot="context-menu-trigger"]')) return
      if (_target.closest('[role="menu"]')) return
      // 已打开旧菜单 → 先关再开（React 18 自动批量，同帧 close→open）
      setOpen(false)
      setPoint({ x, y })
      setOpen(true)
    }

    const onContextMenu = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Element)) return

      if (target.closest('[data-slot="context-menu-trigger"]')) return
      if (target.closest('[role="menu"]')) {
        e.preventDefault()
        return
      }

      e.preventDefault()
      showMenu(target, e.clientX, e.clientY)
    }

    // iOS touch long-press fallback：Safari 不会在普通元素上触发 contextmenu 事件
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      const touchedEl = e.target
      longPressPos = { x: touch.clientX, y: touch.clientY }
      longPressTimer = setTimeout(() => {
        const target = touchedEl
        if (!(target instanceof Element)) return

        // 卡片级 ContextMenuTrigger：补发合成 contextmenu 让 Radix 接管
        if (target.closest('[data-slot="context-menu-trigger"]')) {
          target.dispatchEvent(
            new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX: longPressPos.x,
              clientY: longPressPos.y,
            }),
          )
          return
        }

        showMenu(target, longPressPos.x, longPressPos.y)
      }, 500)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!longPressTimer) return
      const touch = e.touches[0]
      if (touch) {
        const dx = touch.clientX - longPressPos.x
        const dy = touch.clientY - longPressPos.y
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(longPressTimer)
          longPressTimer = null
        }
      }
    }

    const onTouchEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }

    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchEnd)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
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
          onMouseEnter={() => setFocused(true)}
          onMouseLeave={() => setFocused(false)}
          className={cn(
            'bg-popover text-popover-foreground fixed z-[9999]',
            'min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
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
