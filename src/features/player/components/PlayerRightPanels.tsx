import { ChevronDown, Activity, RefreshCw } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/shared/components/ui/context-menu'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { CmsEpisodePanel, PlayerEpisodePanel } from '@/features/player/components'
import type { PlayerSourceOption, PlayerSeasonOption } from '@/features/player/hooks'
import type { EpisodePageItem, SplitEpisodeGroup } from '@/features/player/hooks'
import type { VideoSourceTestResult } from '../lib/source-speed-test'
import { SourceOptionButton } from './PlayerSourceOptionButton'

/** 右侧面板类型：换源 / 选季 / 选集 */
export type RightPanelId = 'episode' | 'source' | 'season'

interface EpisodePanelOptions {
  totalEpisodes: number
  selectedEpisode: number
  isReversed: boolean
  onToggleOrder: () => void
  pageRanges: Array<{ label: string; value: string }>
  currentPageRange: string
  onPageRangeChange: (value: string) => void
  episodes: EpisodePageItem[]
  onEpisodeSelect: (displayIndex: number) => void
  episodeProgressMap: Map<number, number> | null
  mainLabel?: string
  mainActive?: boolean
  splitGroups?: SplitEpisodeGroup[]
  onSplitSelect?: (vodId: string, episodeIndex: number) => void
}

interface SourcePanelOptions {
  options: PlayerSourceOption[]
  selectedCode: string
  enabledSourceIds: string[]
  speedResults: Map<string, VideoSourceTestResult>
  speedTesting: Set<string>
  onSelect: (sourceCode: string) => void
  onTestSingle: (sourceCode: string) => void
  onTestAll: () => void
  onDisable: (sourceCode: string) => void
  onRetryMatch: () => void
}

interface PlayerRightPanelsProps {
  isCmsRoute: boolean
  isTmdbRoute: boolean
  hasSourcePanel: boolean
  hasSeasonPanel: boolean
  activeRightPanel: RightPanelId | null
  onPanelChange: (panel: RightPanelId | null) => void
  source: SourcePanelOptions
  season: {
    options: PlayerSeasonOption[]
    selectedNumber: number | null
    onSelect: (seasonNumber: number) => void
  }
  episode: EpisodePanelOptions
}

const collapsibleContentClassName = 'overflow-hidden border-t border-border/45 p-3 md:p-4'

/** 根据当前激活面板构建 Collapsible 容器的 xl 布局类 */
const getPanelClassName = (
  panel: RightPanelId,
  activeRightPanel: RightPanelId | null,
) =>
  cn(
    'overflow-hidden rounded-lg border border-border/60 bg-card/55 transition-all',
    activeRightPanel === panel && 'xl:flex xl:min-h-0 xl:flex-1 xl:flex-col',
  )

/**
 * 播放器右侧面板区：无换源面板的 CMS 直连用整页选集；否则按激活态折叠展示换源/选季/选集
 */
export function PlayerRightPanels({
  isCmsRoute,
  isTmdbRoute,
  hasSourcePanel,
  hasSeasonPanel,
  activeRightPanel,
  onPanelChange,
  source,
  season,
  episode,
}: PlayerRightPanelsProps) {
  if (!hasSourcePanel && isCmsRoute) {
    return (
      <CmsEpisodePanel
        totalEpisodes={episode.totalEpisodes}
        selectedEpisode={episode.selectedEpisode}
        isReversed={episode.isReversed}
        onToggleOrder={episode.onToggleOrder}
        pageRanges={episode.pageRanges}
        currentPageRange={episode.currentPageRange}
        onPageRangeChange={episode.onPageRangeChange}
        episodes={episode.episodes}
        onEpisodeSelect={episode.onEpisodeSelect}
        episodeProgressMap={episode.episodeProgressMap}
      />
    )
  }

  return (
    <div className="space-y-3 xl:flex xl:h-full xl:flex-col xl:gap-3 xl:space-y-0">
      {/* Source panel */}
      {hasSourcePanel && (
        <Collapsible
          open={activeRightPanel === 'source'}
          onOpenChange={open => onPanelChange(open ? 'source' : null)}
          className={getPanelClassName('source', activeRightPanel)}
        >
          {/* 外层菜单绑到换源标题行，避免与源按钮的内层菜单嵌套（长按源按钮开两层） */}
          <ContextMenu key="source-panel">
            <ContextMenuTrigger asChild>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  aria-label="展开或收起换源面板"
                  className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-3 text-sm font-semibold md:px-4"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">换源</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {source.options.length} 源
                    </span>
                  </span>
                  <ChevronDown
                    className={`size-4 transition-transform ${activeRightPanel === 'source' ? 'rotate-180' : ''}`}
                  />
                </button>
              </CollapsibleTrigger>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {isTmdbRoute && (
                <ContextMenuItem onClick={() => source.onRetryMatch()}>
                  <RefreshCw className="mr-2 size-3.5" />
                  重新匹配源
                </ContextMenuItem>
              )}
              <ContextMenuItem onClick={() => source.onTestAll()}>
                <Activity className="mr-2 size-3.5" />
                源质量重测
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          <CollapsibleContent
            className={cn(
              collapsibleContentClassName,
              activeRightPanel === 'source' && 'xl:flex xl:min-h-0 xl:flex-1 xl:flex-col',
            )}
          >
            <ScrollArea className="max-h-44 sm:max-h-56 xl:h-full xl:max-h-none">
              <div className="grid grid-cols-2 gap-2 pr-2">
                {source.options
                  .filter(o => source.enabledSourceIds.includes(o.sourceCode))
                  .map(option => (
                    <SourceOptionButton
                      key={option.sourceCode}
                      option={option}
                      active={option.sourceCode === source.selectedCode}
                      isTmdbRoute={isTmdbRoute}
                      speedResults={source.speedResults}
                      speedTesting={source.speedTesting}
                      onSelect={source.onSelect}
                      onTestSingle={source.onTestSingle}
                      onDisable={source.onDisable}
                    />
                  ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Season panel */}
      {hasSeasonPanel && (
        <Collapsible
          open={activeRightPanel === 'season'}
          onOpenChange={open => onPanelChange(open ? 'season' : null)}
          className={getPanelClassName('season', activeRightPanel)}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              aria-label="展开或收起选季面板"
              className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-3 text-sm font-semibold md:px-4"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">选季</span>
                <span className="text-muted-foreground truncate text-xs">
                  {season.options.length} 季
                </span>
              </span>
              <ChevronDown
                className={`size-4 transition-transform ${activeRightPanel === 'season' ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent
            className={cn(
              collapsibleContentClassName,
              activeRightPanel === 'season' && 'xl:min-h-0 xl:flex-1',
            )}
          >
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {season.options.map(option => {
                const active = option.seasonNumber === season.selectedNumber
                return (
                  <Button
                    key={option.seasonNumber}
                    size="sm"
                    variant={active ? 'default' : 'secondary'}
                    className="max-w-full min-w-0 justify-between rounded-full sm:w-auto sm:max-w-[240px]"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => season.onSelect(option.seasonNumber)}
                  >
                    <span className="truncate">S{option.seasonNumber}</span>
                    <span className="shrink-0 text-[11px] opacity-70">
                      {option.matchedSourceCount}
                    </span>
                  </Button>
                )
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Episode panel */}
      {episode.totalEpisodes > 0 && (
        <Collapsible
          open={activeRightPanel === 'episode'}
          onOpenChange={open => onPanelChange(open ? 'episode' : null)}
          className={getPanelClassName('episode', activeRightPanel)}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              aria-label="展开或收起选集面板"
              className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-3 text-sm font-semibold md:px-4"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0">选集</span>
                <span className="text-muted-foreground truncate text-xs">
                  第 {episode.selectedEpisode + 1} 集 / 共 {episode.totalEpisodes} 集
                </span>
              </span>
              <ChevronDown
                className={`size-4 transition-transform ${activeRightPanel === 'episode' ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent
            className={cn(
              collapsibleContentClassName,
              activeRightPanel === 'episode' && 'xl:min-h-0 xl:flex-1',
            )}
          >
            <div className={activeRightPanel === 'episode' ? 'xl:h-full' : undefined}>
              <PlayerEpisodePanel
                totalEpisodes={episode.totalEpisodes}
                selectedEpisode={episode.selectedEpisode}
                isReversed={episode.isReversed}
                onToggleOrder={episode.onToggleOrder}
                pageRanges={episode.pageRanges}
                currentPageRange={episode.currentPageRange}
                onPageRangeChange={episode.onPageRangeChange}
                episodes={episode.episodes}
                onEpisodeSelect={episode.onEpisodeSelect}
                episodeProgressMap={episode.episodeProgressMap}
                mainLabel={episode.mainLabel}
                mainActive={episode.mainActive}
                splitGroups={episode.splitGroups}
                onSplitSelect={episode.onSplitSelect}
                compact
                fillHeight={activeRightPanel === 'episode'}
                hideHeader
                className="border-0 bg-transparent p-0 md:p-0"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

