import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

/** 监听主题变化，同步更新 theme-color meta 标签（PWA 状态栏颜色） */
export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme()
  const metaRef = useRef<HTMLMetaElement | null>(null)

  useEffect(() => {
    if (!metaRef.current) {
      // 首次渲染时创建或复用已有的 theme-color meta（移除带 media 的双份，统一由 JS 接管）
      const existing = document.querySelectorAll('meta[name="theme-color"]')
      existing.forEach(m => m.remove())
      metaRef.current = document.createElement('meta')
      metaRef.current.name = 'theme-color'
      document.head.appendChild(metaRef.current)
    }

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
    if (!bg) return
    metaRef.current.setAttribute('content', bg)
  }, [resolvedTheme])
  return null
}
