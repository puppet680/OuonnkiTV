import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { proxyMiddleware } from './src/middleware/proxy.dev'
import panhubDevPlugin from './src/server/panhub/plugin'

// 将入口 CSS link 改为非阻塞预加载，避免渲染阻塞
function nonBlockingCssPlugin(): Plugin {
  return {
    name: 'non-blocking-css',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // 移除所有 modulepreload — v11 证明 FCP 可达 99 分
        html = html.replace(/<link rel="modulepreload"[^>]*>/g, '')
        // CSS 异步加载避免阻塞渲染
        return html.replace(
          /<link rel="stylesheet"([^>]*?)href="([^"]*?)"([^>]*?)>/g,
          (_, before, href, after) => {
            return `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet"${before}href="${href}"${after}></noscript>`
          },
        )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  envPrefix: 'OKI_',
  resolve: {
    conditions: ['development'],
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    proxyMiddleware(),
    panhubDevPlugin(),
    nonBlockingCssPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // 新 SW 立即激活 + 接管所有页面
        skipWaiting: true,
        clientsClaim: true,
        // 预缓存所有静态资源（JS/CSS/HTML/字体/图标）
        globPatterns: ['**/*.{js,css,html,woff2,ico,png,svg,webmanifest}'],
        // HLS 视频分片和播放列表不缓存，避免播放错误
        navigationPreload: false,
        // 导航请求离线时回退到离线页
        navigateFallback: '/offline.html',
        runtimeCaching: [
          // 同源请求（不含静态资源、m3u8、ts）— Network First，离线兜底
          {
            urlPattern: ({ sameOrigin, url, request }) =>
              sameOrigin && request.mode !== 'navigate' && !/\.(?:js|css|html|woff2|ico|png|svg|webmanifest|json|m3u8|ts)(?:\?.*)?$/i.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'same-origin-api',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
              networkTimeoutSeconds: 5,
            },
          },
          // 跨域 API 请求（不含 HLS 相关流媒体文件）— Stale While Revalidate
          {
            urlPattern: ({ sameOrigin, url }) =>
              !sameOrigin && !/\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2|css|js|m3u8|ts)(?:\?.*)?$/i.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'external-api',
              expiration: { maxEntries: 1000, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          // 跨域图片 — Stale While Revalidate
          {
            urlPattern: /^https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?.*)?$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'external-images',
              expiration: { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'I TV',
        short_name: 'ITV',
        description: '现代化视频聚合搜索与播放',
        start_url: '/',
        scope: '/',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // 由 vite-plugin-pwa 统一管理 manifest，不自动注入额外图标尺寸
      includeManifestIcons: false,
    }),
  ],
  build: {
    // 启用 CSS 代码分割（每个异步 chunk 独立 CSS）
    cssCodeSplit: true,
    // 减少 CSS 大小
    cssMinify: 'lightningcss',
    // 构建目标
    target: 'es2020',
    // 禁用源码映射
    sourcemap: false,
    // 最小化 chunk 大小警告
    chunkSizeWarningLimit: 500,
    // 减少预加载的 modulepreload 链接数，降低首屏下载量
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // 核心框架
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router/')) {
            return 'react-vendor'
          }

          // 播放器相关（拆分大包，避免单 chunk 过大）
          if (id.includes('/artplayer/')) return 'artplayer-vendor'
          if (id.includes('/hls.js/')) return 'hls-vendor'

          // UI 与动效
          if (id.includes('/motion/')) return 'motion-vendor'
          if (id.includes('/@radix-ui/')) return 'radix-vendor'

          // 搜索与文本匹配（仅在搜索引导页/播放列表匹配时加载）
          if (id.includes('/fuse.js/')) return 'fuse-vendor'

          // 拖拽排序（仅在设置页视频源排序时加载）
          if (id.includes('/@dnd-kit/')) return 'dnd-kit-vendor'

          // 轮播（首页轮播，独立缓存）
          if (id.includes('/embla-carousel/')) return 'embla-vendor'

          // 底部抽屉组件
          if (id.includes('/vaul/')) return 'vaul-vendor'

          // 图标库（多个页面共享，独立缓存）
          if (id.includes('/lucide-react/')) return 'icon-vendor'

          // 主题与元库
          if (id.includes('/next-themes/')) return 'ui-vendor'

          // Vercel 分析和速度检测
          if (id.includes('/@vercel/')) return 'analytic-vendor'

          // 其他常用库
          if (id.includes('/zustand/')) return 'state-vendor'
          if (id.includes('/tmdb-ts/')) return 'tmdb-vendor'
          if (id.includes('/dayjs/')) return 'dayjs-vendor'
        },
      },
    },
  },
  // CSS 优化
  css: {
    devSourcemap: false,
  },
  // 服务器配置
  server: {
    port: 3000,
    strictPort: false,
    proxy: {
      '/api/panhub': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/panhub/, '/api'),
      },
    },
  },
})
