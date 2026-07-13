import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

/** 监听主题变化，同步更新 theme-color meta 标签（PWA 状态栏颜色） */
export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme()
  const initedRef = useRef(false)

  useEffect(() => {
    // 初始化：清理 index.html 中可能残留的带 media 的标签，确保只有一个动态标签
    if (!initedRef.current) {
      initedRef.current = true
      const mediaMetas = document.querySelectorAll('meta[name="theme-color"][media]')
      mediaMetas.forEach(tag => tag.remove())
      // 如果一个都没有，创建一个
      if (mediaMetas.length === 0 && !document.querySelector('meta[name="theme-color"]:not([media])')) {
        const meta = document.createElement('meta')
        meta.setAttribute('name', 'theme-color')
        document.head.appendChild(meta)
      }
    }

    const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    if (!meta) return

    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue('--background')
      .trim()

    if (bg) {
      meta.setAttribute('content', bg)
    }
  }, [resolvedTheme])

  return null
}
