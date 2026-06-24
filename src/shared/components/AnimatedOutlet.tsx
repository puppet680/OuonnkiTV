import { useLocation, useOutlet } from 'react-router'
import { AnimatePresence, motion, type Variants } from "motion/react"
import { pageVariants } from '@/shared/lib/animationVariants'

/**
 * AnimatedOutlet - 带页面过渡动画的 Outlet 包装组件
 *
 * 使用 motion 的 AnimatePresence 实现路由切换时的平滑过渡动画。
 * 动画效果：淡入淡出 + 轻微的垂直位移 + 模糊效果
 */
export default function AnimatedOutlet() {
  const location = useLocation()
  const outlet = useOutlet()

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="h-full"
        layout="position"
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * 可配置的动画 Outlet 组件
 * 支持自定义动画变体和类名
 */
interface CustomAnimatedOutletProps {
  variants?: Variants
  className?: string
  /** 是否启用动画，默认 true */
  enabled?: boolean
  /** 自定义路由动画 key，用于控制哪些路径共享同一动画容器 */
  routeKey?: string | ((pathname: string) => string)
}

export function CustomAnimatedOutlet({
  variants = pageVariants,
  className = 'h-full',
  enabled = true,
  routeKey,
}: CustomAnimatedOutletProps) {
  const location = useLocation()
  const outlet = useOutlet()
  const animationKey =
    typeof routeKey === 'function' ? routeKey(location.pathname) : (routeKey ?? location.pathname)

  if (!enabled) {
    return <>{outlet}</>
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={animationKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={className}
        layout="position"
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}
