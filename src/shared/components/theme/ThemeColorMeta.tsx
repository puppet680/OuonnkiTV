import { useEffect, useRef } from 'react'
import { useThemeStore } from './store'

const updateMeta = () => {
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
  if (!meta) return
  // ponytail: 用 sidebar 背景色（与顶部导航栏一致），body 暗色背景太黑不适合状态栏
  const probe = document.createElement('div')
  probe.className = 'bg-sidebar'
  probe.style.cssText = 'position:fixed;top:-100%;visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const bg = getComputedStyle(probe).backgroundColor
  document.body.removeChild(probe)
  if (bg && bg !== 'rgba(0, 0, 0, 0)') meta.setAttribute('content', bg)
}

/** 监听主题变化，同步更新 theme-color meta 标签（PWA 状态栏颜色） */
export function ThemeColorMeta() {
  const initedRef = useRef(false)
  const mode = useThemeStore(s => s.mode)

  // 初始化：清理 index.html 中带 media 的残留标签，确保只有一个动态标签
  useEffect(() => {
    initedRef.current = true
    const mediaMetas = document.querySelectorAll('meta[name="theme-color"][media]')
    mediaMetas.forEach(tag => tag.remove())
    if (!document.querySelector('meta[name="theme-color"]:not([media])')) {
      const meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
  }, [])

  // 用户手动切换主题（light/dark/system）→ 立即更新
  useEffect(() => {
    if (!initedRef.current) return
    // ponytail: next-themes 设置 class 是异步的，等一帧再读颜色
    requestAnimationFrame(() => updateMeta())
  }, [mode])

  // 系统主题变化（mode === 'system' 时）→ 跟随更新
  useEffect(() => {
    if (mode !== 'system') return
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => requestAnimationFrame(() => updateMeta())
    darkQuery.addEventListener('change', handler)
    return () => darkQuery.removeEventListener('change', handler)
  }, [mode])

  return null
}
