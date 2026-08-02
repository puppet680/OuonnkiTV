import * as React from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, CheckIcon, ChevronRightIcon, CircleIcon, Star, XIcon } from 'lucide-react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'

import { cn } from '@/shared/lib/utils'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { AnimateIcon } from '@/components/animate-ui/icons/icon'
import { Badge } from '@/shared/components/ui/badge'

/** 移动端抽屉影视介绍信息（参考播放页影视介绍，不含 tabs） */
export interface ContextMenuMediaInfo {
  /** 海报 URL（已含 base） */
  posterUrl?: string | null
  /** 年份 */
  year?: string
  /** 评分（0-10） */
  rating?: number
  /** 剧情介绍 */
  overview?: string
}

/** 移动端抽屉拖拽：上拉允许的最大面板高度（超出内容走滚动区） */
const MAX_SHEET_PCT = 75

function ContextMenu({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
}

function ContextMenuGroup({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
}

function ContextMenuPortal({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
}

function ContextMenuSub({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />
}

function ContextMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {
  return <ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </ContextMenuPrimitive.SubTrigger>
  )
}

function ContextMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.SubContent
      data-slot="context-menu-sub-content"
      className={cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg',
        className,
      )}
      {...props}
    />
  )
}

function ContextMenuContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content> & {
  title?: string
  /** 简介：纯文本，或影视介绍信息（海报/年份/评分/剧情），仅移动端抽屉显示 */
  description?: string | ContextMenuMediaInfo
}) {
  const isMobile = useIsMobile()
  // 移动端长按改底部抽屉，视觉与动画与详情页"匹配详情弹窗"（Dialog 移动端样式）一致：
  // 全宽底部抽屉 + 遮罩 + 关闭按钮 + fade/slide-from-bottom 进出场动画。
  // items 必须留在 Radix Content 内才能拿到菜单上下文，而 popper 外层 transform
  // wrapper 会让 fixed 定位失效，故用 .oki-cm-sheet + main.css 中和 wrapper。
  // Radix Content 只在菜单打开时挂载；抽屉必须常驻才能承接 Content 的挂载（否则
  // Content 永远无法挂载），ref 回调负责跟踪 Content 挂载并建立 MutationObserver。
  // 注意：ContextMenuPrimitive.Portal 自身也被 Presence 包裹（present=context.open），
  // 关闭时整个 .oki-cm-sheet 会被同步卸载，出场动画根本来不及跑（面板任何动画
  // class 都无效）。故这里不用 Radix Portal，改用 createPortal 把抽屉常驻挂到 body，
  // Content 不继承 forceMount、仍只在打开时挂载。
  // 面板显隐跟随 Content 的 data-state（Radix 在 Content 上切换 open/closed），
  // 不用「ref 挂载态」驱动：关闭时 Content 会因出场动画被 Presence 保持挂载，
  // 若按挂载态同步，面板要等 Content 卸载后才开始动画，造成「内容先消失、
  // 空面板再滑出」的错位。用 MutationObserver 把 data-state 同步到面板，保证
  // 面板与 Content 同时开始出场动画，内容随面板一起滑出（与详情页 Dialog 一致）。
  const [panelState, setPanelState] = React.useState<'open' | 'closed'>('closed')
  // Content 是否挂载中（含关闭动画）：挂载期间遮罩拦截点击防穿透，卸载后放行
  const [contentActive, setContentActive] = React.useState(false)
  // 首开标记：抽屉常驻渲染，需用静态 opacity-0 压住首帧；一旦打开过，
  // 显隐交给 animate-in/out 控制——出场动画若叠加静态 opacity-0，会在换 class
  // 瞬间把元素压到透明，让 fade/slide-out 全程不可见（表现为"点击直接消失"），
  // 故关闭分支改由 fill-mode-forwards 在动画结束后保持隐藏态。
  const [hasOpened, setHasOpened] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const observerRef = React.useRef<MutationObserver | null>(null)
  const handleContentRef = React.useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    contentRef.current = node
    if (node) {
      setContentActive(true)
      setPanelState(node.dataset.state === 'open' ? 'open' : 'closed')
      setHasOpened(true)
      // 打开即测量并固定到菜单高度（避免 auto 全内容瞬间铺满再回弹）
      measureSheetRef.current()
      const observer = new MutationObserver(() => {
        setPanelState(node.dataset.state === 'open' ? 'open' : 'closed')
      })
      observer.observe(node, { attributes: true, attributeFilter: ['data-state'] })
      observerRef.current = observer
    } else {
      // Content 卸载（菜单彻底关闭）→ 遮罩放行点击
      setContentActive(false)
    }
  }, [])
  // 组件卸载时断开 observer
  React.useEffect(() => () => observerRef.current?.disconnect(), [])

  // ── 移动端底部抽屉：默认高度 = 菜单项高度（不含简介），拖拽向上拉高到 min(内容总高, 92vh) ──
  // sheetHeightPct 为 null 时面板 height:auto；打开时测量并固定默认高度
  // 初始 0：打开后由 measureSheet 立即校正到菜单高度，避免 null(auto) 全内容铺满回弹
  const [sheetHeightPct, setSheetHeightPct] = React.useState<number | null>(0)
  // 拖拽中禁过渡（transition-none），保证跟手；松手恢复动画
  const [dragging, setDragging] = React.useState(false)
  // 拖把纯展示：面板有可滑动空间（最高 > 最低）时才显示
  const [canDrag, setCanDrag] = React.useState(false)
  const sheetHeightPctRef = React.useRef<number | null>(null)
  const defaultHeightPctRef = React.useRef(30)
  const maxDragPctRef = React.useRef(75)
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const descRef = React.useRef<HTMLDivElement | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const dragStartYRef = React.useRef<number | null>(null)
  const dragStartHRef = React.useRef(60)
  const dragWasAtMinRef = React.useRef(false)
  const applySheetHeight = (pct: number) => {
    setSheetHeightPct(pct)
    sheetHeightPctRef.current = pct
  }
  // 通过 ref 供 handleContentRef 调用（避免依赖顺序问题）
  const measureSheetRef = React.useRef<() => void>(() => {})
  // 打开时测量：临时 auto 量全内容高（同步 reflow，立即切回），固定到菜单高度，避免铺满回弹
  const measureSheet = () => {
    const panel = panelRef.current
    if (!panel) return
    const descH = descRef.current?.offsetHeight ?? 0
    panel.style.setProperty('--oki-cm-panel-h', 'auto')
    const totalH = panel.offsetHeight
    const totalPct = (totalH / window.innerHeight) * 100
    maxDragPctRef.current = Math.min(MAX_SHEET_PCT, totalPct)
    const menuPct = Math.min(MAX_SHEET_PCT, ((totalH - descH) / window.innerHeight) * 100)
    defaultHeightPctRef.current = menuPct
    setCanDrag(maxDragPctRef.current > menuPct + 1)
    panel.style.setProperty('--oki-cm-panel-h', `${menuPct}vh`)
    applySheetHeight(menuPct)
  }
  measureSheetRef.current = measureSheet

  // 兜底：打开动画帧内测量（与 handleContentRef 双保险，幂等）
  React.useEffect(() => {
    if (panelState !== 'open') return
    const id = requestAnimationFrame(() => measureSheetRef.current())
    return () => cancelAnimationFrame(id)
  }, [panelState])

  const onSheetDragStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    // 触摸在滚动区内且未到顶 → 交给滚动；滚动区外（把手/标题/空白）总是拖面板
    if (
      e.target instanceof Element &&
      e.target.closest('.oki-cm-scroll') &&
      scrollRef.current &&
      scrollRef.current.scrollTop > 0
    ) {
      return
    }
    dragStartYRef.current = e.touches[0].clientY
    dragStartHRef.current = sheetHeightPctRef.current ?? 60
    // 拖拽开始时已处于最低吸附 → 本次下拉直接关闭
    dragWasAtMinRef.current = dragStartHRef.current <= defaultHeightPctRef.current
    setDragging(true)
  }
  const onSheetDragMove = (_e: React.TouchEvent) => {
    // 不做跟手：滑动方向由 touchend 决定，松手后自动滑到端点
  }
  const onSheetDragEnd = (e: React.TouchEvent) => {
    if (dragStartYRef.current === null) return
    const startY = dragStartYRef.current
    dragStartYRef.current = null
    setDragging(false)
    const endY = e.changedTouches[0]?.clientY ?? startY
    const dy = startY - endY // 上拉为正
    if (dy > 0) {
      // 向上滑 → 自动展开到最高点
      applySheetHeight(maxDragPctRef.current)
    } else if (dy < 0) {
      // 向下滑 → 已最低则关闭，否则自动收起到最低点
      if (dragWasAtMinRef.current) {
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        return
      }
      applySheetHeight(defaultHeightPctRef.current)
    }
    // 无位移（点按）不动作
  }

  if (isMobile) {
    return createPortal(
      <div className="oki-cm-sheet">
        {/* 遮罩：仅菜单打开时可见；点击遮罩（在 Content 之外）走 Radix dismissable 自动关闭 */}
        <div
          className={cn(
            // z-50 与详情页 DialogOverlay 一致：导航栏是 sticky z-50，遮罩若低于它
            // 就压不暗导航，视觉上导航「高亮」地浮在遮罩上
            'fixed inset-0 z-50 bg-black/50',
            hasOpened
              ? panelState === 'open'
                ? 'animate-in fade-in-0'
                : 'animate-out fade-out-0 fill-mode-forwards'
              : 'pointer-events-none opacity-0',
            // Content 挂载期间（含关闭动画）遮罩拦截点击，防止穿透到下方媒体卡片；
            // Content 卸载（菜单彻底关闭）后才放行
            contentActive ? 'pointer-events-auto' : 'pointer-events-none',
          )}
        />
        {/* 面板：常驻渲染以承接 Radix Content 的挂载，panelState（跟随 Content data-state）控制显隐与进出场动画 */}
        <div
          // 关闭态下关闭按钮等仍在 DOM，opacity/pointer-events 不挡键盘焦点，inert 兜底
          ref={panelRef}
          inert={panelState !== 'open'}
          // ponytail: 拖拽高度需动态值，Tailwind 无法表达，用 CSS 变量（样式定义在 main.css）
          style={sheetHeightPct !== null ? ({ ['--oki-cm-panel-h' as string]: `${sheetHeightPct}vh` } as React.CSSProperties) : undefined}
          onTouchStart={onSheetDragStart}
          onTouchMove={onSheetDragMove}
          onTouchEnd={onSheetDragEnd}
          className={cn(
            // duration-400 与详情页 DialogContent 一致（tw-animate-css 默认仅 150ms）
            'oki-cm-panel bg-background text-foreground fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-xl rounded-b-none border border-b-0 shadow-lg',
            // 拖拽中禁过渡跟手；松手恢复 400ms 高度过渡（吸附动画，与出场入场一致）
            dragging ? 'transition-none' : 'transition-[height] duration-400',
            // Radix 打开时会给 body 设 pointer-events:none（继承属性），面板必须显式恢复 auto
            hasOpened
              ? panelState === 'open'
                ? 'animate-in fade-in-0 slide-in-from-bottom pointer-events-auto'
                : 'animate-out fade-out-0 slide-out-to-bottom fill-mode-forwards pointer-events-none'
              : 'pointer-events-none opacity-0',
          )}
        >
          {/* 拖把纯展示：下方有内容可展开（面板可滑动）时才显示 */}
          {canDrag && (
            <div className="oki-cm-handle shrink-0 cursor-grab py-2">
              <span className="bg-muted mx-auto block h-1 w-10 rounded-full" />
            </div>
          )}
          {title && (
            <div className={cn('mb-1 line-clamp-1 px-10 pb-1 text-center text-base font-semibold shrink-0', canDrag ? 'pt-1.5' : 'pt-3')}>
              {title}
            </div>
          )}
          {/* 关闭按钮：放在 Content 之外，点击走 Radix dismissable 关闭菜单 */}
          <button
            type="button"
            aria-label="关闭菜单"
            className="oki-cm-close text-muted-foreground hover:bg-accent hover:text-accent-foreground absolute top-2.5 right-2.5 z-10 rounded-xs p-1 transition-colors"
          >
            <XIcon className="size-4" />
          </button>
          {/* 菜单项滚动区：scrollTop>0 时让出滚动，到顶后拖拽面板；隐藏滚动条；拖拽中禁滚避免冲突 */}
          <div ref={scrollRef} className={cn('oki-cm-scroll flex-1 overflow-y-auto px-1.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', dragging && 'overflow-y-hidden')}>
            <ContextMenuPrimitive.Content
              ref={handleContentRef}
              data-slot="context-menu-content"
              // 让 Radix Presence 关闭时保持 Content 挂载到动画结束（否则立即卸载、
              // 内容瞬间消失）；只 fade 不 slide——位移由面板统一负责，避免双倍位移
              className={cn(
                'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-400',
                className,
              )}
              onInteractOutside={e => {
                // 点面板内（标题栏/留白）不关闭抽屉；关闭按钮除外（走 dismissable 关闭）
                const target = e.target
                if (
                  target instanceof Element &&
                  target.closest('.oki-cm-panel') &&
                  !target.closest('.oki-cm-close')
                ) {
                  e.preventDefault()
                }
              }}
              {...props}
            >
              {children}
            </ContextMenuPrimitive.Content>
            {/* 简介在菜单项末尾：纯文本，或影视介绍卡片（海报/年份/评分/剧情） */}
            {description && (
              <div
                ref={descRef}
                className="oki-cm-desc border-border border-t px-3 pt-2 pb-2"
              >
                {typeof description === 'string' ? (
                  <p className="text-center text-xs leading-5 text-muted-foreground">{description}</p>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    {description.posterUrl ? (
                      <img
                        src={description.posterUrl}
                        alt=""
                        loading="lazy"
                        className="aspect-[2/3] w-24 rounded-md border border-border/40 bg-muted/35 object-cover"
                      />
                    ) : null}
                    {(description.year || (description.rating ?? 0) > 0) && (
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {description.year ? (
                          <Badge variant="outline" className="h-5 rounded-full px-2 text-[11px]">
                            <CalendarDays className="size-3.5" />
                            {description.year}
                          </Badge>
                        ) : null}
                        {(description.rating ?? 0) > 0 ? (
                          <Badge variant="outline" className="h-5 rounded-full px-2 text-[11px]">
                            <Star className="size-3.5 text-amber-400" />
                            {description.rating!.toFixed(1)}
                          </Badge>
                        ) : null}
                      </div>
                    )}
                    {description.overview ? (
                      <p className="text-muted-foreground w-full text-xs leading-5">{description.overview}</p>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body,
    )
  }
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md data-[state=closed]:duration-200',
          className,
        )}
        {...props}
      >
        {title && (
          <div className="border-border text-muted-foreground mx-1 mb-1 border-b px-2 py-1.5 text-xs font-semibold">
            {title}
          </div>
        )}
        {children}
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean
  variant?: 'default' | 'destructive'
}) {
  return (
    <AnimateIcon animateOnHover>
      <ContextMenuPrimitive.Item
        data-slot="context-menu-item"
        data-inset={inset}
        data-variant={variant}
        className={cn(
          "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          // touch-manipulation：避免移动端第一次点击被聚焦/300ms 双击延迟消耗（需点两次的根源之一）
          'touch-manipulation',
          // 移动端抽屉加大点击区与字号，避免触摸目标过小
          "max-md:gap-2.5 max-md:px-3 max-md:py-3 max-md:text-base max-md:data-[inset]:pl-12 max-md:[&_svg:not([class*='size-'])]:size-5",
          className,
        )}
        {...props}
      />
    </AnimateIcon>
  )
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.Label
      data-slot="context-menu-label"
      data-inset={inset}
      className={cn('text-foreground px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', className)}
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn('bg-border -mx-1 my-1 h-px', className)}
      {...props}
    />
  )
}

function ContextMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)}
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
