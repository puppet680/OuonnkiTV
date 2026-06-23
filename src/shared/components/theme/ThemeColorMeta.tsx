import { useEffect } from 'react'
import { useTheme } from 'next-themes'

/** 监听主题变化，同步更新 theme-color meta 标签（PWA 状态栏颜色） */
export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return
    // ponytail: 直接读 CSS 变量 --background，与 main.css 保持单一真相来源
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
    if (bg) meta.setAttribute('content', bg)
  }, [resolvedTheme])
  return null
}
