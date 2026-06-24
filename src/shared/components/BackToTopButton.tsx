import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronUp } from 'lucide-react'
import { useLocation } from 'react-router'
import { Button } from '@/shared/components/ui/button'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib'

interface BackToTopButtonProps {
  /** 触发显示按钮的滚动阈值（像素） */
  threshold?: number
  /** ScrollArea 根节点选择器 */
  scrollRootSelector: string
  className?: string
}

const getScrollTop = (target: HTMLElement | Window): number => {
  return target instanceof Window ? target.scrollY : target.scrollTop
}

const scrollToTop = (target: HTMLElement | Window) => {
  if (target instanceof Window) {
    target.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  target.scrollTo({ top: 0, behavior: 'smooth' })
}

/**
 * BackToTopButton - 全局回到顶部按钮
 * 监听主滚动容器，在滚动超过阈值后显示
 */
export default function BackToTopButton({
  threshold = 280,
  scrollRootSelector,
  className,
}: BackToTopButtonProps) {
  const location = useLocation()
  const isMobile = useIsMobile()
  const reducedMotion = useReducedMotion()
  const [scrollTarget, setScrollTarget] = useState<HTMLElement | Window | null>(null)
  const [visible, setVisible] = useState(false)
  const [navVisible, setNavVisible] = useState(true)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(scrollRootSelector)
    const viewport = root?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
    setScrollTarget(viewport ?? window)
  }, [scrollRootSelector])

  useEffect(() => {
    if (!scrollTarget) return

    const handleScroll = () => {
      const y = getScrollTop(scrollTarget)
      setVisible(y > threshold)
      if (isMobile) {
        if (y < 0) return
        if (y > lastScrollY.current + 8) setNavVisible(false)
        else if (y < lastScrollY.current - 4) setNavVisible(true)
        lastScrollY.current = y
      }
    }

    handleScroll()
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      scrollTarget.removeEventListener('scroll', handleScroll)
    }
  }, [scrollTarget, threshold])

  useEffect(() => {
    if (!scrollTarget) return

    if (scrollTarget instanceof Window) {
      scrollTarget.scrollTo({ top: 0 })
    } else {
      scrollTarget.scrollTop = 0
    }

    setVisible(false)
  }, [location.pathname, scrollTarget])

  return (
    <div
      className={cn(
        'pointer-events-none absolute right-4 z-40 transition-[bottom] duration-220 ease-out md:right-6',
        isMobile ? (navVisible ? 'bottom-20' : 'bottom-6') : 'bottom-6 md:bottom-8',
        className,
      )}
    >
      <AnimatePresence>
        {visible && scrollTarget && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.92 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto"
          >
            <Button
              type="button"
              size="icon-lg"
              variant="outline"
              aria-label="回到顶部"
              title="回到顶部"
              className="bg-background/90 rounded-full shadow-lg backdrop-blur-sm"
              onClick={() => scrollToTop(scrollTarget)}
            >
              <ChevronUp className="size-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
