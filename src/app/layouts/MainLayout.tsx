import Navigation from '@/shared/components/Navigation'
import { SidebarProvider, SidebarInset } from '@/shared/components/ui/sidebar'
import SideBar from '@/shared/components/SideBar'
import BottomNav from '@/shared/components/BottomNav'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { CustomAnimatedOutlet } from '@/shared/components/AnimatedOutlet'
import { KeepAliveTabs } from '@/shared/components/KeepAliveTabs'
import BackToTopButton from '@/shared/components/BackToTopButton'
import { Suspense, useEffect, useState } from 'react'
import { useSettingStore } from '@/shared/store/settingStore'
import { useApiStore } from '@/shared/store/apiStore'
import { useSubscriptionAutoRefresh } from '@/shared/hooks/useSubscriptionAutoRefresh'
import { useScrollChromeVisibility } from '@/shared/hooks'
import { useLocation, useNavigate } from 'react-router'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { OkiLogo } from '@/shared/components/KeepAliveTabs'

export default function MainLayout() {
  const isScrollChromeAnimationEnabled = useSettingStore(s => s.system.isScrollChromeAnimationEnabled)
  const isMobile = useIsMobile()
  const { initializeEnvSources } = useApiStore()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isChromeVisible = useScrollChromeVisibility({
    enabled: isScrollChromeAnimationEnabled,
    scrollRootSelector: '[data-main-scroll-area]',
    resetKey: location.pathname,
  })

  const navigate = useNavigate()
  // KeepAliveTabs 覆盖的路径（与 BottomNav 和 KeepAliveTabs.tsx 保持一致）
  const isKeepAliveRoute = ['/', '/bangumi', '/search', '/favorites', '/history'].some(
    p => location.pathname === p || location.pathname.startsWith(p + '?') || location.pathname.startsWith(p + '/'),
  )

  // 订阅源自动刷新
  useSubscriptionAutoRefresh()

  // 首次访问引导检测
  useEffect(() => {
    const hasCompletedGuide = localStorage.getItem('ouonnki-tv-guide-completed') === 'true'
    if (!hasCompletedGuide) {
      navigate('/guide', { replace: true })
    }
  }, [navigate])

  // 初始化逻辑 (从 MyRouter 迁移)
  useEffect(() => {
    const needsInitialization = localStorage.getItem('envSourcesInitialized') !== 'true'
    if (needsInitialization) {
      initializeEnvSources()
      localStorage.setItem('envSourcesInitialized', 'true')
    }
  }, [initializeEnvSources])

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={
        {
          '--sidebar-top': isChromeVisible ? '4rem' : '0rem',
        } as React.CSSProperties
      }
      className="flex h-dvh flex-col overflow-hidden"
    >
      <Navigation
        hidden={!isChromeVisible}
        enableScrollAnimation={isScrollChromeAnimationEnabled}
      />
      <div className="flex flex-1 overflow-hidden">
        <SideBar
          hidden={!isChromeVisible || isMobile}
          enableScrollAnimation={isScrollChromeAnimationEnabled}
        />
        <SidebarInset className="h-full overflow-hidden">
          <div className="h-full p-2 pb-3.5 md:p-2 md:pl-1">
            <div className="border-border bg-sidebar relative h-full rounded-lg border py-2 shadow-sm">
              <ScrollArea data-main-scroll-area className="h-full rounded-lg px-2">
                <Suspense fallback={
                  <div className="flex h-64 items-center justify-center">
                    <OkiLogo size={48} />
                  </div>
                }>
                  <KeepAliveTabs />
                </Suspense>
                {!isKeepAliveRoute && (
                  <CustomAnimatedOutlet
                    routeKey={pathname =>
                      pathname === '/settings' || pathname.startsWith('/settings/')
                        ? '/settings'
                        : pathname
                    }
                  />
                )}
              </ScrollArea>
              <BackToTopButton scrollRootSelector="[data-main-scroll-area]" />
            </div>
          </div>
        </SidebarInset>
      </div>
      <BottomNav />
    </SidebarProvider>
  )
}
