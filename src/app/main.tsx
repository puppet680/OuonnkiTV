import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@/app/styles/main.css'
import { ThemeProvider } from 'next-themes'
import AppRouter from './router'
import { queryClient } from './providers/query-client'
import { Toaster } from '@/shared/components/ui/sonner'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { GlobalContextMenu } from '@/shared/components/GlobalContextMenu'
import { ThemeColorMeta } from '@/shared/components/theme'
import { PwaUpdateNotifier } from '@/shared/components/PwaUpdateNotifier'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RefreshCw } from '@/components/animate-ui/icons/refresh-cw'

// ponytail: analytics 与首屏渲染无关，lazy-load 避免阻塞 INP/LCP
const Analytics =
  import.meta.env.OKI_DISABLE_ANALYTICS !== 'true'
    ? lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })))
    : null

const root = document.getElementById('root')!

// ponytail: 在 React 挂载前捕获 beforeinstallprompt，避免时序竞争导致丢失
let __deferredPrompt: Event | null = null
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  __deferredPrompt = e
})
// 暴露给 usePwaInstall hook 读取
;(window as unknown as Record<string, unknown>).__oki_deferredPrompt = {
  get current() {
    return __deferredPrompt
  },
  clear() {
    __deferredPrompt = null
  },
}

// 全局右键菜单内置项
const builtInContextMenuItems = [
  {
    id: 'refresh',
    label: '刷新页面',
    icon: <RefreshCw className="size-4" />,
    onClick: () => {
      window.location.reload()
    },
  },
]

const app = (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeColorMeta />
      <PwaUpdateNotifier />
      <TooltipProvider>
        <GlobalContextMenu builtInItems={builtInContextMenuItems}>
          <AppRouter />
        </GlobalContextMenu>
        <Toaster richColors position="top-center" />
        {Analytics && (
          <Suspense fallback={null}>
            <Analytics />
          </Suspense>
        )}
      </TooltipProvider>
    </ThemeProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
)

createRoot(root).render(import.meta.env.DEVELOPMENT ? <StrictMode>{app}</StrictMode> : app)
