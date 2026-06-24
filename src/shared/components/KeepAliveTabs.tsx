import { lazy, type ComponentType } from 'react'
import { useLocation } from 'react-router'
import { OkiLogo } from '@/shared/components/icons'

// 底部导航对应的 tab 页面（懒加载，首访时才下载 chunk）
const HomeView = lazy(() => import('@/features/home/views/HomeView'))
const BangumiView = lazy(() => import('@/features/bangumi/views/BangumiView'))
const SearchHubView = lazy(() => import('@/features/search/views/SearchHubView'))
const FavoritesView = lazy(() => import('@/features/favorites/views/FavoritesView'))
const HistoryView = lazy(() => import('@/features/history/views/HistoryView'))

interface TabRoute {
  path: string
  component: ComponentType
}

// 与 BottomNav.tsx 的 items 保持一致
const TABS: TabRoute[] = [
  { path: '/', component: HomeView },
  { path: '/bangumi', component: BangumiView },
  { path: '/search', component: SearchHubView },
  { path: '/favorites', component: FavoritesView },
  { path: '/history', component: HistoryView },
]

/**
 * KeepAliveTabs — 将底部导航对应的页面全部挂载，仅通过 hidden 属性切换可见性。
 *
 * 路由切换 INP 504ms 的根本原因：React 卸载旧页面 + 挂载新页面（embla init / DOM layout）
 * hidden 属性保留 DOM + React 组件树，切换 = CSS toggle ≈ 5ms。
 *
 * 非 tab 路由（/play /media /settings）不受影响，由 AnimatedOutlet 继续处理。
 */
export function KeepAliveTabs() {
  const { pathname } = useLocation()

  // 非底部导航页面不走 keep-alive（播放页/详情页/设置页）
  const isTabRoute = TABS.some(t => pathname === t.path || pathname.startsWith(t.path + '?'))

  if (!isTabRoute) return null

  return (
    <>
      {TABS.map(({ path, component: View }) => {
        const active = path === '/' ? pathname === '/' : pathname.startsWith(path)
        return (
          <div
            key={path}
            hidden={!active}
            className={active ? 'h-full' : ''}
          >
            <View />
          </div>
        )
      })}
    </>
  )
}

// 给 KeepAlive 模式的 fallback（与 router/index.tsx 共用风格）
export { OkiLogo }
