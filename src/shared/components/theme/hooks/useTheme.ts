import { useTheme } from 'next-themes'
import { useThemeStore } from '../store'
import { themeTransition, themeTransitionFromEvent } from '../transitions'
import { useCallback, useEffect } from 'react'

/**
 * 辅助函数：更新pwa状态栏颜色
 */
function updateAndroidStatusBar() {
  if (typeof window === 'undefined') return

  // 1. 移除 index.html 中带 media 查询的初始标签，避免干扰
  const mediaMetas = document.querySelectorAll('meta[name="theme-color"][media]')
  mediaMetas.forEach(tag => tag.remove())

  // 2. 查找或创建唯一的动态 theme-color 标签
  let metaTag = document.querySelector('meta[name="theme-color"]:not([media])')
  if (!metaTag) {
    metaTag = document.createElement('meta')
    metaTag.setAttribute('name', 'theme-color')
    document.head.appendChild(metaTag)
  }

  const computedBg = window.getComputedStyle(document.documentElement)
    .getPropertyValue('--background') // 或者是你的主题背景变量名，比如 --nextui-background
    .trim()

  if (computedBg) {
    metaTag.setAttribute('content', computedBg)
  }
}
/**
 * 主题控制 Hook
 * 整合 next-themes 和 themeStore，提供统一的主题控制接口
 */
export function useThemeControl() {
  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme()
  const { mode, setMode } = useThemeStore()

  /**
   * 监听 next-themes 解析出的最终主题 (resolvedTheme)
   * 确保无论是初始化、跟随系统变化、还是手动切换，都能实时同步状态栏
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      updateAndroidStatusBar()
    }, 0)
    return () => clearTimeout(timer)
  }, [resolvedTheme])
  /**
   * 切换主题模式 (带动画)
   */
  const changeMode = useCallback(
    (newMode: 'system' | 'light' | 'dark', event?: MouseEvent | React.MouseEvent) => {
      // 预先计算接下来要切换到的目标是否是暗色
      const targetIsDark =
        newMode === 'dark' ||
        (newMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

      const doChange = () => {
        setMode(newMode)
        setTheme(newMode)
      }

      // 判断动画方向: 切换到暗色=扩散, 切换到亮色=收缩
      const currentResolved = resolvedTheme || 'light'
      const direction = targetIsDark && currentResolved === 'light' ? 'expand' : 'contract'

      if (event) {
        themeTransitionFromEvent(event, doChange, direction as 'expand' | 'contract')
      } else {
        themeTransition(doChange, { direction: direction as 'expand' | 'contract' })
      }
    },
    [setMode, setTheme, resolvedTheme],
  )

  /**
   * 快速切换亮/暗模式
   */
  const toggleDarkMode = useCallback(
    (event?: MouseEvent | React.MouseEvent) => {
      const currentResolved = resolvedTheme || 'light'
      const newMode = currentResolved === 'dark' ? 'light' : 'dark'
      changeMode(newMode, event)
    },
    [resolvedTheme, changeMode],
  )

  /**
   * 当前是否为暗色模式
   */
  const isDark = resolvedTheme === 'dark'

  return {
    // 状态
    mode,
    theme,
    resolvedTheme,
    systemTheme,
    isDark,

    // 方法
    changeMode,
    toggleDarkMode,
    resetTheme: useThemeStore(state => state.resetTheme),
  }
}

/**
 * 获取当前主题状态的简化 Hook
 * 配合 ThemeToggle 使用以渲染对应的图标
 */
export function useThemeState() {
  const { isDark, resolvedTheme, mode } = useThemeControl()
  return { isDark, resolvedTheme, mode }
}
