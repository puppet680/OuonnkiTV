import type { ReactNode } from 'react'

/**
 * 移动端右键菜单底部抽屉壳：遮罩 + 底部浮层。
 * 供 Radix ContextMenuContent（context-menu.tsx）与全局右键菜单
 * （GlobalContextMenu）共用，保证移动端菜单视觉一致。
 *
 * @param title - 抽屉标题（如媒体名）；不传则不显示标题栏
 * @param onOverlayClick - 点击遮罩回调；Radix 场景不传（由 Radix dismissable 自动关闭）
 */
export function MobileMenuSheet({
  children,
  title,
  onOverlayClick,
}: {
  children: ReactNode
  title?: string
  onOverlayClick?: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onOverlayClick} />
      {/* Radix 会设 body pointer-events:none，面板必须显式恢复 auto，否则标题/留白区点击穿透被当作外部点击 */}
      <div className="oki-cm-panel pointer-events-auto bg-popover text-popover-foreground fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-50 max-h-[75vh] overflow-y-auto rounded-2xl border p-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-2xl">
        {/* 顶部拖拽条，强化"悬浮卡片"视觉 */}
        <div className="mx-auto mt-1 mb-1 h-1.5 w-9 rounded-full bg-muted-foreground/25" />
        {title && (
          <div className="line-clamp-1 px-3 pt-1.5 pb-1 text-center text-sm font-semibold text-muted-foreground">
            {title}
          </div>
        )}
        {children}
      </div>
    </>
  )
}
