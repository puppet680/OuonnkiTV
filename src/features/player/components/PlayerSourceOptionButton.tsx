import { Activity, Ban } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/shared/components/ui/context-menu'
import { Button } from '@/shared/components/ui/button'
import type { PlayerSourceOption } from '@/features/player/hooks'
import type { VideoSourceTestResult } from '../lib/source-speed-test'
import { SpeedTestBadge } from './SpeedTestBadge'
import { RES_COLORS } from './videojsPlayerHelpers'

interface SourceOptionButtonProps {
  option: PlayerSourceOption
  active: boolean
  isTmdbRoute: boolean
  speedResults: Map<string, VideoSourceTestResult>
  speedTesting: Set<string>
  onSelect: (sourceCode: string) => void
  onTestSingle: (sourceCode: string) => void
  onDisable: (sourceCode: string) => void
}

/** 换源面板单个源按钮：名称 + 分数 + 分辨率/测速徽章 + 右键测速/禁用 */
export function SourceOptionButton({
  option,
  active,
  isTmdbRoute,
  speedResults,
  speedTesting,
  onSelect,
  onTestSingle,
  onDisable,
}: SourceOptionButtonProps) {
  const hasMultiLang = option.alternatives.length > 0
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Button
          size="sm"
          variant={active ? 'default' : 'secondary'}
          className="relative max-w-full min-w-0 justify-start gap-1.5 overflow-hidden rounded-full sm:w-auto sm:max-w-[260px]"
          aria-current={active ? 'true' : undefined}
          aria-label={`切换到视频源 ${option.sourceName}`}
          onClick={() => onSelect(option.sourceCode)}
        >
          <span className="truncate text-xs font-medium">{option.sourceName}</span>
          {isTmdbRoute && <span className="shrink-0 text-[11px] opacity-70">{option.bestScore}</span>}
          <div className="ml-auto flex shrink-0 flex-col items-end gap-0.5">
            {/* 上方：分辨率标签（测速中隐藏，测速结果优先，兜底 bestQuality） */}
            {!speedTesting.has(option.sourceCode) &&
              (() => {
                const testQuality = speedResults.get(option.sourceCode)?.quality
                const label = testQuality?.label || option.bestQuality
                if (!label) return null
                const color = testQuality?.color || RES_COLORS[label] || 'bg-foreground/10'
                return (
                  <span className={`${color} rounded px-1.5 py-0.5 text-[10px] leading-none text-white`}>
                    {label}
                  </span>
                )
              })()}
            {/* 下方：速度 badge（无结果时不显示） */}
            {(speedResults.get(option.sourceCode) || speedTesting.has(option.sourceCode)) && (
              <SpeedTestBadge
                result={speedResults.get(option.sourceCode) ?? null}
                testing={speedTesting.has(option.sourceCode)}
              />
            )}
          </div>
          {hasMultiLang && (
            <span
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, transparent 80%, currentColor 80%, currentColor 90%, transparent 90%)',
              }}
              title="多语言"
            />
          )}
        </Button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onTestSingle(option.sourceCode)}>
          <Activity className="mr-2 size-3.5" />
          {speedResults.has(option.sourceCode) ? '重新检测' : '检测'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => onDisable(option.sourceCode)}>
          <Ban className="mr-2 size-3.5" />
          禁用源
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
