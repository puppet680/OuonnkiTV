import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Home, Star, History, Tv } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { useTmdbEnabled } from '@/shared/hooks/useTmdbMode'
import { cn } from '@/shared/lib'

const items = [
  { title: '主页', url: '/', icon: Home },
  { title: '番剧', url: '/bangumi', icon: Tv },
  { title: '收藏', url: '/favorites', icon: Star },
  { title: '记录', url: '/history', icon: History },
]

export default function BottomNav() {
  const isMobile = useIsMobile()
  const tmdbEnabled = useTmdbEnabled()
  const reducedMotion = useReducedMotion()
  const { pathname } = useLocation()
  const [visible, setVisible] = useState(true)
  const lastTouchY = useRef(0) // 🌟 改为记录手指触摸的 Y 轴绝对坐标

  // 🌟 核心改动：用原生的原生手势监听代替 scroll 监听
  useEffect(() => {
    if (!isMobile) return

    const handleTouchStart = (e: TouchEvent) => {
      // 记录手指刚接触屏幕时的起始位置
      lastTouchY.current = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY
      const deltaY = currentY - lastTouchY.current

      // 阈值设为 12px，避免手指轻微抖动导致误触发
      if (deltaY < -12) {
        // 手指向上划（页面内容往下滚）-> 隐藏底栏
        setVisible(false)
      } else if (deltaY > 12) {
        // 手指向下划（页面内容往上滚）-> 唤出底栏
        setVisible(true)
      }

      lastTouchY.current = currentY
    }

    // 绑定到全局 window 上，无视页面有没有滚动条，滑屏即可触发
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [isMobile])

  // 路由切换时自动恢复显示
  useEffect(() => {
    setVisible(true)
  }, [pathname])

  if (!isMobile) return null

  const filtered = items.filter(item => tmdbEnabled || item.url !== '/bangumi')

  return (
    <div
      className={cn(
        'fixed right-0 bottom-0 left-0 z-50 w-full transition-[opacity,transform] duration-300 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
      )}
    >
      <nav className="border-border/40 bg-background/80 border-t pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-md items-center justify-around px-4">
          {filtered.map(item => {
            const active = item.url === '/' ? pathname === '/' : pathname.startsWith(item.url)
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={cn(
                  'relative flex h-full min-w-0 flex-1 flex-col items-center justify-center transition-colors duration-200',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {active &&
                  (reducedMotion ? (
                    <div className="bg-primary absolute -top-2 h-0.5 w-6 rounded-full" />
                  ) : (
                    <motion.div
                      layoutId="bottomnav-selected"
                      className="bg-primary absolute -top-2 h-0.5 w-6 rounded-full"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  ))}

                <div className="relative flex h-full w-full flex-col items-center justify-center">
                  <item.icon
                    className={cn(
                      'size-5.5 transition-all duration-200 ease-out',
                      active
                        ? 'text-primary -translate-y-1 scale-105 stroke-[2.2]'
                        : 'translate-y-0 stroke-[1.8]',
                    )}
                  />

                  <span
                    className={cn(
                      'absolute bottom-0 text-[10px] font-semibold tracking-wide transition-all duration-200 ease-out',
                      active
                        ? 'text-primary translate-y-0 scale-100 opacity-100'
                        : 'pointer-events-none translate-y-2 scale-95 opacity-0',
                    )}
                  >
                    {item.title}
                  </span>
                </div>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
