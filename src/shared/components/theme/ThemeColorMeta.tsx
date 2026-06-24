import { useEffect } from 'react'
import { useTheme } from 'next-themes'

/** 监听主题变化，同步更新 theme-color meta 标签（PWA 状态栏颜色） */
export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    const metas = document.querySelectorAll('meta[name="theme-color"]')
    if (metas.length === 0) return
    // ponytail: 直接读 CSS 变量 --background，与 main.css 保持单一真相来源
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
    if (!bg) return
    metas.forEach(m => {
      m.setAttribute('content', bg)
      // 移除 media 属性，由 JS 接管控制权
      m.removeAttribute('media')
    })
  }, [resolvedTheme])
  return null
}
