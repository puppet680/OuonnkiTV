import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { proxyMiddleware } from './src/middleware/proxy.dev'

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
    nonBlockingCssPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // 预缓存所有静态资源（JS/CSS/HTML/字体/图标）
        globPatterns: ['**/*.{js,css,html,woff2,ico,png,svg,webmanifest}'],
        runtimeCaching: [
          // 视频源 API — Network First，失败用缓存兜底
          {
            urlPattern: /^https?:\/\/.*\/api\.php\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-vod',
              expiration: { maxEntries: 200, maxAgeSeconds: 5 * 60 },
              networkTimeoutSeconds: 5,
            },
          },
          // TMDB API — Stale While Revalidate
          {
            urlPattern: /^https?:\/\/api\.themoviedb\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tmdb-api',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          // TMDB 图片 — Stale While Revalidate，长期缓存
          {
            urlPattern: /^https?:\/\/image\.tmdb\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tmdb-images',
              expiration: { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          // 内部代理路径 — Network First
          {
            urlPattern: /\/proxy\?.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'proxy-requests',
              expiration: { maxEntries: 100, maxAgeSeconds: 5 * 60 },
              networkTimeoutSeconds: 5,
            },
          },
          // 其他外部图片 — Stale While Revalidate
          {
            urlPattern: /^https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?.*)?$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'external-images',
              expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'I TV',
        short_name: 'I TV',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
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
            purpose: 'maskable',
          },
        ],
      },
      // 覆盖 public/site.webmanifest，由 vite-plugin-pwa 统一管理
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
          if (id.includes('/framer-motion/')) return 'motion-vendor'
          if (id.includes('/@radix-ui/')) return 'radix-vendor'

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
  },
})
