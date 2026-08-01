import { memo } from 'react'
import { ArrowDownUp, ArrowUpDown } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { cn } from '@/shared/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import type { EpisodePageItem, SplitEpisodeGroup } from '@/features/player/hooks'

interface EpisodeRange {
  label: string
  value: string
}

interface PlayerEpisodePanelProps {
  totalEpisodes: number
  selectedEpisode: number
  isReversed: boolean
  onToggleOrder: () => void
  pageRanges: EpisodeRange[]
  currentPageRange: string
  onPageRangeChange: (value: string) => void
  episodes: EpisodePageItem[]
  onEpisodeSelect: (displayIndex: number) => void
  compact?: boolean
  fillHeight?: boolean
  hideHeader?: boolean
  className?: string
  /** 集数播放进度映射：episodeIndex → 进度百分比(0-100)，null 或 undefined 表示不显示 */
  episodeProgressMap?: Map<number, number> | null
  /** 主选集标签（默认条目的名字），仅在存在拆分条目时传入 */
  mainLabel?: string
  /** 主选集是否高亮当前集；当前播放条目不是默认条目时为 false */
  mainActive?: boolean
  /** 同源拆分条目（Part.2/下部/后篇 等）的分组，渲染在主选集下方 */
  splitGroups?: SplitEpisodeGroup[]
  /** 点击拆分条目某集：vodId + 该条目内集数下标 */
  onSplitSelect?: (vodId: string, episodeIndex: number) => void
}

export const PlayerEpisodePanel = memo(function PlayerEpisodePanel({
  totalEpisodes,
  selectedEpisode,
  isReversed,
  onToggleOrder,
  pageRanges,
  currentPageRange,
  onPageRangeChange,
  episodes,
  onEpisodeSelect,
  compact = false,
  fillHeight = false,
  hideHeader = false,
  className,
  episodeProgressMap,
  mainLabel,
  mainActive = true,
  splitGroups,
  onSplitSelect,
}: PlayerEpisodePanelProps) {
  const sectionClassName = fillHeight
    ? 'h-full space-y-3 rounded-lg border border-border/60 bg-card/50 p-3 md:flex md:flex-col md:space-y-3 md:p-4'
    : 'space-y-3 rounded-lg border border-border/60 bg-card/50 p-3 md:p-4'

  const listClassName = compact
    ? 'grid grid-cols-2 gap-2'
    : 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8'

  // 主选集网格 + 拆分条目分组，fillHeight 时放在 ScrollArea 内统一滚动
  const grids = (
    <>
      <div className={listClassName}>
        {episodes.map(episode => {
          const active = mainActive && selectedEpisode === episode.actualIndex
          const progress = episodeProgressMap?.get(episode.actualIndex)
          const hasProgress = progress !== undefined && progress > 0

          return (
            <Button
              key={`${episode.actualIndex}-${episode.name}`}
              variant={active ? 'default' : 'secondary'}
              className="relative justify-start overflow-hidden rounded-md"
              aria-current={active ? 'true' : undefined}
              aria-label={`切换到${episode.name || `第 ${episode.actualIndex + 1} 集`}`}
              onClick={() => onEpisodeSelect(episode.displayIndex)}
            >
              <span className="line-clamp-1 text-left text-xs sm:text-sm">
                {episode.name || `第 ${episode.actualIndex + 1} 集`}
              </span>
              {hasProgress && !active && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/60"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              )}
            </Button>
          )
        })}
      </div>

      {splitGroups?.length ? (
        <div className="space-y-3">
          {splitGroups.map(group => (
            <div key={group.vodId} className="space-y-2 border-t border-border/45 pt-3">
              <p className="truncate text-xs font-medium text-muted-foreground">{group.title}</p>
              {group.loading ? (
                <p className="text-xs text-muted-foreground">分集加载中…</p>
              ) : (
                <div className={listClassName}>
                  {group.episodes.map((name, index) => {
                    const active = group.activeEpisode === index
                    return (
                      <Button
                        key={`${group.vodId}-${index}`}
                        variant={active ? 'default' : 'secondary'}
                        className="justify-start rounded-md"
                        aria-current={active ? 'true' : undefined}
                        aria-label={`切换到${name}`}
                        onClick={() => onSplitSelect?.(group.vodId, index)}
                      >
                        <span className="line-clamp-1 text-left text-xs sm:text-sm">{name}</span>
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </>
  )

  return (
    <section className={cn(sectionClassName, className)}>
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">选集</h2>
            <Badge variant="secondary" className="rounded-full text-xs">
              第 {selectedEpisode + 1} 集 / 共 {totalEpisodes} 集
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" className="rounded-full" onClick={onToggleOrder}>
              {isReversed ? <ArrowUpDown className="size-4" /> : <ArrowDownUp className="size-4" />}
              {isReversed ? '正序' : '倒序'}
            </Button>

            {pageRanges.length > 1 && (
              <Select value={currentPageRange} onValueChange={onPageRangeChange}>
                <SelectTrigger className="h-8 w-28 rounded-full bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageRanges.map(range => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      {hideHeader && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="rounded-full" onClick={onToggleOrder}>
            {isReversed ? <ArrowUpDown className="size-4" /> : <ArrowDownUp className="size-4" />}
            {isReversed ? '正序' : '倒序'}
          </Button>

          {pageRanges.length > 1 && (
            <Select value={currentPageRange} onValueChange={onPageRangeChange}>
              <SelectTrigger className="h-8 w-28 rounded-full bg-background/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageRanges.map(range => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {mainLabel && (
        <p className="truncate text-xs font-medium text-muted-foreground">{mainLabel}</p>
      )}

      {fillHeight ? (
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="space-y-3 pr-2">{grids}</div>
          </ScrollArea>
        </div>
      ) : (
        <div className="space-y-3">{grids}</div>
      )}
    </section>
  )
})
