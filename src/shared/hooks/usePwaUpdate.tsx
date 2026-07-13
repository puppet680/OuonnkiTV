import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'

/**
 * 监听 SW 更新。当新 SW 接管页面后，弹出 toast 提示用户刷新。
 * vite-plugin-pwa 已配置 skipWaiting + clientsClaim，新 SW 会自动激活并接管。
 */
export function usePwaUpdate() {
  const [needsRefresh, setNeedsRefresh] = useState(false)

  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return

    // 新 SW 激活并接管所有页面后触发
    const onControllerChange = () => {
      // 只在已有 controller（非首次安装）时提示刷新
      if (sw.controller) {
        setNeedsRefresh(true)
      }
    }

    // 检查是否已经有 waiting 的 SW（页面加载时 SW 已更新）
    sw.ready.then((reg) => {
      if (reg.waiting) {
        setNeedsRefresh(true)
      }
    })

    sw.addEventListener('controllerchange', onControllerChange)
    return () => sw.removeEventListener('controllerchange', onControllerChange)
  }, [])

  // 弹出 toast 后重置，避免重复
  useEffect(() => {
    if (!needsRefresh) return

    toast('新版本已就绪', {
      description: '刷新页面即可使用最新版本',
      duration: Infinity,
      dismissible: false,
      action: {
        label: '刷新',
        onClick: () => window.location.reload(),
      },
      icon: <RefreshCw className="size-4" />,
    })

    setNeedsRefresh(false)
  }, [needsRefresh])

  const refresh = useCallback(() => window.location.reload(), [])

  return { needsRefresh, refresh }
}
