import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@/app/styles/main.css'
import { ThemeProvider } from 'next-themes'
import AppRouter from './router'
import { Toaster } from '@/shared/components/ui/sonner'
import { TooltipProvider } from '@/shared/components/ui/tooltip'

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

// PWA: 注册 Service Worker，实现离线缓存与更新提示
function registerServiceWorker() {
  if (typeof window === 'undefined' || 'serviceWorker' in navigator === false) return
  if (import.meta.env.DEV) return

  import('workbox-window').then(({ Workbox }) => {
    const wb = new Workbox('/sw.js')

    wb.addEventListener('installed', (event) => {
      if (event.isUpdate && event.type === 'installed') {
        import('sonner').then(({ toast }) => {
          toast('检测到新版本', {
            description: '点击立即刷新',
            action: {
              label: '刷新',
              onClick: () => {
                wb.addEventListener('controlling', () => {
                  window.location.reload()
                })
                wb.messageSkipWaiting()
              },
            },
            duration: 0,
          })
        })
      }
    })

    wb.register()
  })
}

const root = document.getElementById('root')!

const app = (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <TooltipProvider>
      <AppRouter />
      <Toaster richColors position="top-center" />
      {import.meta.env.OKI_DISABLE_ANALYTICS !== 'true' && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
    </TooltipProvider>
  </ThemeProvider>
)

createRoot(root).render(import.meta.env.DEVELOPMENT ? <StrictMode>{app}</StrictMode> : app)

registerServiceWorker()
