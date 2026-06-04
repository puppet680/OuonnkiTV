import { memo } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

interface PlayerTransientNotice {
  id: string
  message: string
  duration: number
  progress: number
}

interface PlayerOverlayNoticesProps {
  shouldShowMatchingNotice: boolean
  matchingNoticeText: string
  shouldShowBetterSourceNotice: boolean
  betterSourceNoticeKey: string
  bestSourceOption: {
    sourceCode: string
    sourceName: string
    bestVodId: string
    bestScore: number
  } | null
  betterNoticeProgress: number
  betterSourceNoticeDuration: number
  transientNotices: PlayerTransientNotice[]
  onSwitchToBetterSource: () => void
  onDismissBetterSourceNotice: () => void
}

export const PlayerOverlayNotices = memo(function PlayerOverlayNotices({
  shouldShowMatchingNotice,
  matchingNoticeText,
  shouldShowBetterSourceNotice,
  bestSourceOption,
  betterNoticeProgress,
  betterSourceNoticeDuration,
  transientNotices,
  onSwitchToBetterSource,
  onDismissBetterSourceNotice,
}: PlayerOverlayNoticesProps) {
  const shouldShowOverlayNotices =
    shouldShowMatchingNotice || shouldShowBetterSourceNotice || transientNotices.length > 0

  if (!shouldShowOverlayNotices) return null

  return (
    <div className="pointer-events-none absolute top-3 right-3 z-30 flex max-w-[min(92vw,420px)] flex-col items-end gap-2">
      {shouldShowMatchingNotice && (
        <div className="pointer-events-auto w-[min(86vw,320px)] overflow-hidden rounded-md border border-amber-300/35 bg-black/68 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-white">
            <span className="inline-flex size-3.5 animate-spin rounded-full border border-amber-200 border-t-transparent" />
            <span className="truncate">{matchingNoticeText}</span>
          </div>
        </div>
      )}

      {shouldShowBetterSourceNotice && bestSourceOption && (
        <div className="pointer-events-auto w-[min(90vw,360px)] overflow-hidden rounded-md border border-emerald-300/35 bg-black/72 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-white">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold">匹配到更优结果</p>
              <p className="mt-0.5 truncate text-[11px] text-white/80">
                {bestSourceOption.sourceName}（{bestSourceOption.bestScore} 分）
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 rounded-full px-3 text-[11px]"
                onClick={onSwitchToBetterSource}
              >
                切换
              </Button>
              <button
                type="button"
                className="text-white/70 transition-colors hover:text-white"
                aria-label="关闭更优匹配提示"
                onClick={onDismissBetterSourceNotice}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="h-0.5 border-t border-white/12 bg-white/20">
            <div
              className="h-full bg-emerald-400 transition-[width] ease-linear"
              style={{
                width: `${betterNoticeProgress}%`,
                transitionDuration: `${betterSourceNoticeDuration}ms`,
              }}
            />
          </div>
        </div>
      )}

      {transientNotices.map(notice => (
        <div
          key={notice.id}
          className="pointer-events-auto w-[min(78vw,340px)] overflow-hidden rounded-md border border-white/15 bg-black/65 shadow-lg backdrop-blur-sm"
        >
          <div className="px-3 py-1.5 text-xs text-white">{notice.message}</div>
          <div className="h-0.5 bg-white/20">
            <div
              className="h-full bg-red-500 transition-[width] ease-linear"
              style={{
                width: `${notice.progress}%`,
                transitionDuration: `${notice.duration}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
})
