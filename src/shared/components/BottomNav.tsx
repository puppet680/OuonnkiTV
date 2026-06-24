import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Home, Search, Star, History, Tv } from 'lucide-react'
import { motion, useReducedMotion } from "motion/react"
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { useTmdbEnabled } from '@/shared/hooks/useTmdbMode'
import { cn } from '@/shared/lib'

const items = [
  { title: '主页', url: '/', icon: Home },
  { title: '番剧', url: '/bangumi', icon: Tv },
  { title: '搜索', url: '/search', icon: Search },
  { title: '收藏', url: '/favorites', icon: Star },
  { title: '记录', url: '/history', icon: History },
]

export default function BottomNav() {
  const isMobile = useIsMobile()
  const tmdbEnabled = useTmdbEnabled()
  const reducedMotion = useReducedMotion()
  const { pathname } = useLocation()
  const [visible, setVisible] = useState(true)
  const lastScrollY = useRef(0)

  useEffect(() => {
    if (!isMobile) return
    const viewport = document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (!viewport) return

    const onScroll = () => {
      const y = viewport.scrollTop
      if (y < 0) return
      const down = y > lastScrollY.current + 8
      const up = y < lastScrollY.current - 4
      lastScrollY.current = y
      if (down) setVisible(false)
      else if (up) setVisible(true)
    }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', onScroll)
  }, [isMobile])

  // 路由切换时显示
  useEffect(() => {
    setVisible(true)
    lastScrollY.current = 0
  }, [pathname])

  if (!isMobile) return null

  const filtered = items.filter(item => tmdbEnabled || item.url !== '/bangumi')

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 w-full px-4 pb-4 transition-[opacity,transform] duration-220 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none',
      )}
    >
      <div className="pb-safe">
        <nav className="border-border bg-sidebar flex h-16 items-center justify-around rounded-lg border px-3 shadow-sm backdrop-blur-md">
        {filtered.map(item => {
          const active = item.url === '/' ? pathname === '/' : pathname.startsWith(item.url)
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 transition-colors',
                active ? 'text-sidebar-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {active && (
                reducedMotion ? (
                  <div className="bg-sidebar-primary absolute inset-0 rounded-md" />
                ) : (
                  <motion.div
                    layoutId="bottomnav-selected"
                    className="bg-sidebar-primary absolute inset-0 rounded-md"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )
              )}
              <item.icon className="relative z-10 size-5" />
              {active && <span className="relative z-10 text-[10px] leading-none">{item.title}</span>}
            </NavLink>
          )
        })}
        </nav>
      </div>
    </div>
  )
}
