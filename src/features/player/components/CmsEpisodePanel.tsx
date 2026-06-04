import { memo } from 'react'
import { PlayerEpisodePanel } from '@/features/player/components'
import type { EpisodePageItem } from '@/features/player/hooks'

interface CmsEpisodePanelProps {
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
}

export const CmsEpisodePanel = memo(function CmsEpisodePanel({
  totalEpisodes,
  selectedEpisode,
  isReversed,
  onToggleOrder,
  pageRanges,
  currentPageRange,
  onPageRangeChange,
  episodes,
  onEpisodeSelect,
  episodeProgressMap,
}: CmsEpisodePanelProps) {
  return (
    <section className="space-y-3 rounded-lg border border-border/60 bg-card/55 p-3 md:p-4 xl:h-full xl:min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">选集</h2>
        <span className="text-muted-foreground text-xs">共 {totalEpisodes} 集</span>
      </div>
      <PlayerEpisodePanel
        totalEpisodes={totalEpisodes}
        selectedEpisode={selectedEpisode}
        isReversed={isReversed}
        onToggleOrder={onToggleOrder}
        pageRanges={pageRanges}
        currentPageRange={currentPageRange}
        onPageRangeChange={onPageRangeChange}
        episodes={episodes}
        onEpisodeSelect={onEpisodeSelect}
        episodeProgressMap={episodeProgressMap}
        compact
        fillHeight
        hideHeader
        className="border-0 bg-transparent p-0 md:p-0"
      />
    </section>
  )
})
