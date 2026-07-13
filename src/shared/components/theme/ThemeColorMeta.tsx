import { useEffect, useRef } from 'react'

/** 监听主题变化，同步更新 theme-color meta 标签（PWA 状态栏颜色） */
export function ThemeColorMeta() {
  const initedRef = useRef(false)

  useEffect(() => {
    const updateMeta = () => {
      const meta = document.querySelector('meta[name="theme-color"]:not([media])')
      if (!meta) return
      // ponytail: --background 是 oklch()，Android theme-color 不识别。
      // body 有 bg-background，读它的 computed backgroundColor 得到 rgb()
      const bg = getComputedStyle(document.body).backgroundColor
      if (bg && bg !== 'rgba(0, 0, 0, 0)') meta.setAttribute('content', bg)
    }

    // 初始化：清理 index.html 中带 media 的残留标签，确保只有一个动态标签
    if (!initedRef.current) {
      initedRef.current = true
      const mediaMetas = document.querySelectorAll('meta[name="theme-color"][media]')
      mediaMetas.forEach(tag => tag.remove())
      if (!document.querySelector('meta[name="theme-color"]:not([media])')) {
        const meta = document.createElement('meta')
        meta.setAttribute('name', 'theme-color')
        document.head.appendChild(meta)
      }
    }

    // 首次立即更新
    updateMeta()

    // 监听 <html> class 变化（.dark 添加/移除），直接触发更新
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          updateMeta()
          return
        }
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  return null
}
