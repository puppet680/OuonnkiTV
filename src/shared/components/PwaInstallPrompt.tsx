import { useState, useEffect } from 'react'
import { Download, Share2, PlusSquare, ArrowDown } from 'lucide-react'
import { usePwaInstall } from '@/shared/hooks/usePwaInstall'
import { useSettingStore } from '@/shared/store/settingStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'

export default function PwaInstallPrompt() {
  const { canInstall, install, isInstalled, platform } = usePwaInstall()
  const isDismissed = useSettingStore((s) => s.system.isPwaInstallDismissed)
  const setSystemSettings = useSettingStore((s) => s.setSystemSettings)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (canInstall && !isDismissed && !isInstalled) {
      setOpen(true)
    }
  }, [canInstall, isDismissed, isInstalled])

  const handleDismiss = () => {
    setSystemSettings({ isPwaInstallDismissed: true })
    setOpen(false)
  }

  const handleInstall = async () => {
    await install()
    setOpen(false)
  }

  if (!canInstall || isInstalled || isDismissed || !open) return null

  const isIOS = platform === 'ios-safari'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss() }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-sm gap-6"
        onEscapeKeyDown={handleDismiss}
        onInteractOutside={handleDismiss}
      >
        <DialogHeader className="items-center gap-3">
          <img
            src="/web-app-manifest-192x192.png"
            alt="I TV"
            className="size-16 rounded-2xl shadow-md"
          />
          {/* 💡 保持你原本的 space-y-1.5 text-center 不变 */}
          <div className="space-y-1.5 text-center w-full">
            <DialogTitle className="text-lg">安装 I TV</DialogTitle>
            {isIOS ? (
              <div className="space-y-3 pt-1">
                <DialogDescription className="text-sm">
                  只需简单两步，即可像原生 App 一样启动：
                </DialogDescription>

                <div className="w-full grid gap-2 text-left bg-muted/50 p-3.5 rounded-xl border text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                    <span>
                      点击下方 <Share2 className="size-3.5 text-blue-500 mx-0.5 inline align-text-bottom" /> <strong>「分享」</strong> 按钮
                    </span>
                  </div>
                  <div className="flex items-center gap-2 border-t pt-2 mt-1">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                    <span>
                      选择 <PlusSquare className="size-3.5 mx-0.5 inline align-text-bottom text-muted-foreground" /> <strong>「添加到主屏幕」</strong>
                    </span>
                  </div>
                </div>
                {/* 指向 Safari 底部栏的动态小箭头 */}
                <div className="flex justify-center pt-0.5 text-primary/60 animate-bounce">
                  <ArrowDown className="size-4" />
                </div>
              </div>
            ) : (
              <DialogDescription className="text-sm">
                添加到桌面，随时随地快速访问
              </DialogDescription>
            )}
          </div>
        </DialogHeader>

        <DialogFooter className="sm:flex-row-reverse sm:justify-center gap-2">
          {isIOS ? (
            <Button onClick={handleDismiss} className="gap-2">
              <PlusSquare className="size-4" />
              知道了
            </Button>
          ) : (
            <>
              <Button onClick={handleInstall} className="gap-2">
                <Download className="size-4" />
                安装
              </Button>
              <Button variant="ghost" onClick={handleDismiss}>
                暂不需要
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}