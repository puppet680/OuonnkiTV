import { useState, useRef, useEffect } from 'react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/shared/components/ui/context-menu'
import { useGlobalContextMenuStore } from '@/shared/store/contextMenuStore'

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
 * 全局右键菜单 — 与卡片菜单共用同一套 Radix ContextMenu（含移动端底部抽屉）。
 *
 * 不用「包裹整个 App 的 Root + Trigger」：那会让卡片区域与全局同时响应
 * 长按/右键。改用不可见的 anchor trigger，由 document capture 监听
 * contextmenu / iOS 长按 fallback 决定何时打开；卡片区域仍由卡片各自的
 * ContextMenuTrigger 接管，长按开始时已有菜单打开则跳过，互不冲突。
 */
export function GlobalContextMenu({ children, builtInItems }: GlobalContextMenuProps) {
  const dynamicItems = useGlobalContextMenuStore((s) => s.items)
  const menuTitle = useGlobalContextMenuStore((s) => s.menuTitle)
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    let longPressPos = { x: 0, y: 0 }

    // 任一卡片菜单已打开 → 不开全局（排除自身 anchor，保证右键别处可重新定位）
    const anyCardMenuOpen = () =>
      Boolean(
        document.querySelector(
          '[data-slot="context-menu-trigger"][data-state="open"]:not(.oki-global-menu-anchor)',
        ),
      )
    // 任一菜单（含全局自己）已打开 → 长按 fallback 跳过，避免叠两层
    const anyMenuOpen = () =>
      Boolean(document.querySelector('[data-slot="context-menu-trigger"][data-state="open"]'))

    const openGlobal = (x: number, y: number) => {
      if (anyCardMenuOpen()) return
      // 走 Radix Trigger 的 contextmenu 路径，Content 据此定位到 (x, y)
      anchorRef.current?.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
      )
    }

    const onContextMenu = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Element)) return
      // 卡片区域由各自的 Radix 接管
      if (target.closest('[data-slot="context-menu-trigger"]')) return
      if (target.closest('[role="menu"]')) {
        e.preventDefault()
        return
      }
      e.preventDefault()
      openGlobal(e.clientX, e.clientY)
    }

    // iOS long-press fallback：Safari 普通元素不触发 contextmenu
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      const target = e.target
      longPressPos = { x: touch.clientX, y: touch.clientY }
      const menuOpenAtStart = anyMenuOpen()
      longPressTimer = setTimeout(() => {
        if (!(target instanceof Element)) return
        // 长按开始时已有菜单（卡片或全局）打开 → 不重复开
        if (menuOpenAtStart) return
        // 长按后的 touchend 会触发 click，连带触发按钮 onClick（换源/导航/测速）。
        // 在 capture 阶段吃掉这次 click，让"长按出菜单"不误触底层操作。
        document.addEventListener(
          'click',
          (ev: MouseEvent) => {
            ev.preventDefault()
            ev.stopImmediatePropagation()
          },
          { capture: true, once: true },
        )
        // 卡片区域：补发合成 contextmenu 让卡片 Radix 接管
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
        openGlobal(longPressPos.x, longPressPos.y)
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

    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchEnd)

    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  const hasBuiltIn = (builtInItems?.length ?? 0) > 0
  const hasDynamic = dynamicItems.length > 0

  return (
    <>
      {children}
      <ContextMenu open={open} onOpenChange={setOpen}>
        <ContextMenuTrigger asChild>
          <span
            ref={anchorRef}
            className="oki-global-menu-anchor pointer-events-none absolute size-0"
          />
        </ContextMenuTrigger>
        <ContextMenuContent title={menuTitle || undefined}>
          {!hasBuiltIn && !hasDynamic ? (
            <ContextMenuItem disabled>无可用操作</ContextMenuItem>
          ) : (
            <>
              {builtInItems?.map((item) => (
                <ContextMenuItem
                  key={item.id}
                  variant={item.variant}
                  disabled={item.disabled}
                  onClick={item.onClick}
                >
                  {item.icon}
                  {item.label}
                </ContextMenuItem>
              ))}
              {hasBuiltIn && hasDynamic && <ContextMenuSeparator />}
              {dynamicItems.map((item) => (
                <ContextMenuItem
                  key={item.id}
                  variant={item.variant}
                  disabled={item.disabled}
                  onClick={item.onClick}
                >
                  {item.icon}
                  {item.label}
                </ContextMenuItem>
              ))}
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
}
