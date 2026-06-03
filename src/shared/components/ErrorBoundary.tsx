import { Component, type ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { OkiLogo } from '@/shared/components/icons'
import { ChangelogDialog } from '@/shared/components/changelog'
import { useVersionStore } from '@/shared/store/versionStore'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
  isChunkError: boolean
}

function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    error.message.includes('Failed to fetch dynamically imported module')
  )
}

/** 开发/测试用：?chunk-error 触发模拟 chunk 加载失败 */
function DevChunkErrorTrigger({ enabled }: { enabled: boolean }) {
  if (enabled) {
    throw new TypeError('Failed to fetch dynamically imported module: /assets/UnifiedPlayer-test.js')
  }
  return null
}

/** chunk 加载失败时展示版本日志，关闭后重载 */
function ChunkErrorFallback({ onReload }: { onReload: () => void }) {
  const [isOpen, setIsOpen] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const { updateHistory, loadUpdateHistory } = useVersionStore()

  useEffect(() => {
    loadUpdateHistory().finally(() => setLoaded(true))
  }, [loadUpdateHistory])

  if (!loaded) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <OkiLogo size={64} className="animate-pulse" />
      </div>
    )
  }

  return (
    <ChangelogDialog
      isOpen={isOpen}
      onClose={() => {
        setIsOpen(false)
        onReload()
      }}
      versions={updateHistory}
    />
  )
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, isChunkError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, isChunkError: isChunkLoadError(error) }
  }

  handleReload = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister())
        window.location.reload()
      })
    } else {
      window.location.reload()
    }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback

      if (this.state.isChunkError) {
        return <ChunkErrorFallback onReload={this.handleReload} />
      }

      return (
        <div className="flex h-dvh items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <OkiLogo size={64} />
            <div>
              <p className="text-lg font-semibold text-foreground">出了点问题</p>
              <p className="text-muted-foreground mt-1 text-sm">
                页面遇到了意外错误，请尝试刷新
              </p>
            </div>
            <button
              onClick={this.handleReload}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2 text-sm font-medium transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return (
      <>
        <DevChunkErrorTrigger enabled={window.location.search.includes('chunk-error')} />
        {this.props.children}
      </>
    )
  }
}
