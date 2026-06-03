import { useEffect, useRef, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface UsePwaInstallReturn {
  /** 是否可以展示安装提示 */
  canInstall: boolean
  /** 触发系统安装：Chromium → prompt()，iOS → 返回 null（由 UI 展示引导） */
  install: () => Promise<{ outcome: 'accepted' | 'dismissed' } | null>
  /** 是否已安装（standalone 模式） */
  isInstalled: boolean
  /** 当前平台：'chromium' | 'ios-safari' | null */
  platform: 'chromium' | 'ios-safari' | null
}

/** 检测是否为 iOS Safari（非 standalone） */
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iOS Safari 的 UA 包含 "Safari" 但不包含 "CriOS"（Chrome for iOS）或 "FxiOS"（Firefox）
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua)
}

/**
 * 捕获浏览器 beforeinstallprompt 事件（Chromium）或检测 iOS Safari，
 * 暴露 PWA 安装能力。
 *
 * Chromium：等待 beforeinstallprompt → canInstall = true → install() 弹出系统对话框
 * iOS Safari：延迟 2s 后 canInstall = true → UI 展示 Share → "添加到桌面" 引导
 */
export function usePwaInstall(): UsePwaInstallReturn {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  const [platform, setPlatform] = useState<UsePwaInstallReturn['platform']>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(() => isStandalone)

  useEffect(() => {
    if (isStandalone) return

    // iOS Safari：没有 beforeinstallprompt，延迟触发引导
    if (isIosSafari()) {
      setPlatform('ios-safari')
      const timer = setTimeout(() => setCanInstall(true), 2000)
      return () => clearTimeout(timer)
    }

    // Chromium：等待 beforeinstallprompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setPlatform('chromium')
      setCanInstall(true)
    }

    const onAppInstalled = () => {
      setIsInstalled(true)
      setCanInstall(false)
      deferredPromptRef.current = null
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [isStandalone])

  const install = useCallback(async () => {
    if (platform === 'ios-safari') return null // iOS 无法程序化触发，UI 展示引导

    const prompt = deferredPromptRef.current
    if (!prompt) return null

    await prompt.prompt()
    const result = await prompt.userChoice
    deferredPromptRef.current = null
    setCanInstall(false)
    return result
  }, [platform])

  return { canInstall, install, isInstalled, platform }
}
