import type { ReactNode } from 'react'
import type { DetailResult } from '@ouonnki/cms-core'
import type { HlsConfig } from 'hls.js'
import { ChevronDown } from 'lucide-react'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import type { VideoResolutionInfo } from '../lib/resolution-labels'
import type { VideoSourceTestResult } from '../lib/source-speed-test'
import { Spinner } from '@/shared/components/ui/spinner'
import { Player } from './videojsPlayerCore'
import { VideojsSkin, OrientationLocker } from './VideojsSkin'
import { VideojsMobileGestures } from './VideojsMobileGestures'
import { DesktopSpeedKeys } from './DesktopSpeedKeys'
import {
  PlaybackTracker,
  SourceAutoSwitch,
  ResolutionTracker,
  SpeedTracker,
  DefaultVolumeSetter,
  LoopSetter,
} from './videojsPlayerTrackers'
import { AutoPiP } from './PlayerAutoPiP'
import { MediaElement } from './videojsPlayerMedia'

interface PlayerStageTrackers {
  resolvedSourceCode: string
  resolvedVodId: string
  detail: DetailResult
  episodes: string[]
  selectedEpisode: number
  canUseTmdbHistory: boolean
  tmdbMediaType: TmdbMediaType | null
  parsedTmdbId: number
  tmdbSeasonNumberForHistory: number | null
  backdropUrl: string
  isTmdbRoute: boolean
  isCmsRoute: boolean
  sourceOptions: Array<{ sourceCode: string; sourceName: string; bestVodId: string }>
  speedResults: Map<string, VideoSourceTestResult>
  onEnded: () => void
  onNotice: (msg: string) => void
  onAllExhausted: () => void
  isLoopEnabled: boolean
  isAutoPlayEnabled: boolean
  isAutoMiniEnabled: boolean
  isPipEnabled: boolean
  onSpeedChange: (rate: number) => void
  onSeekPreview: (time: number, duration: number) => void
  onSeekPreviewEnd: () => void
  onResolutionChange: (info: VideoResolutionInfo | null) => void
}

interface PlayerStageOverlays {
  isTmdbRoute: boolean
  isMatching: boolean
  matchingText: string
  shouldShowBetterSource: boolean
  betterSourceName: string
  betterSourceScore: number
  onSwitchBetterSource: () => void
  playerNotice: string | null
  speedNotice: string | null
  seekPreview: string | null
  isDetailRefreshing: boolean
}

interface PlayerVideoStageProps {
  /** 播放器容器 section 的 ref（供 AutoPiP / 手势 / 右键拦截使用） */
  sectionRef: React.RefObject<HTMLElement | null>
  /** 播放器实例与源地址 */
  player: {
    key: string
    url: string | null
    hlsConfig: Partial<HlsConfig>
    title: string
    poster: string | undefined
    currentEpisode: string | undefined
    resolutionInfo: VideoResolutionInfo | null
    themeColor: string
  }
  /** 皮肤层数据（语言、选集、分辨率徽章） */
  skin: {
    languageOptions?: Array<{ vodId: string; label: string; score: number }>
    languageValue: string
    onLanguageChange: (vodId: string, label: string) => void
    episodes: string[]
    selectedEpisode: number
    onEpisodeSelect: (i: number) => void
    onPrevEpisode: (() => void) | undefined
    onNextEpisode: (() => void) | undefined
  }
  trackers: PlayerStageTrackers
  overlays: PlayerStageOverlays
}

/**
 * 播放器主体：Video.js Provider + 皮肤 + 各内置 tracker，放在 section 内
 * 所有数据/回调由外层传入，本组件只负责组装（纯 UI）
 */
export function PlayerVideoStage({
  sectionRef,
  player,
  skin,
  trackers,
  overlays,
}: PlayerVideoStageProps) {
  return (
    <section
      ref={sectionRef}
      style={{ '--media-color-primary': player.themeColor } as React.CSSProperties}
      className="relative overflow-hidden rounded-lg border border-border/60 bg-black/95 shadow-lg aspect-video min-h-[180px] w-full sm:aspect-auto sm:h-[clamp(240px,56vw,74vh)] sm:min-h-[220px]"
    >
      {/* Player overlays — 左上角 */}
      <div className="pointer-events-none absolute top-3 left-3 z-30 flex flex-col gap-1.5">
        {/* TMDB 持续匹配提示 */}
        {overlays.isTmdbRoute && overlays.isMatching && (
          <span className="pointer-events-auto w-fit rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] text-white/70 backdrop-blur-sm">
            {overlays.matchingText}
          </span>
        )}
        {/* Better source notice */}
        {overlays.shouldShowBetterSource && (
          <button
            type="button"
            onClick={overlays.onSwitchBetterSource}
            className="pointer-events-auto flex w-fit items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400 backdrop-blur-sm transition-colors hover:bg-amber-500/20"
          >
            推荐切换到 {overlays.betterSourceName} ({overlays.betterSourceScore})
            <ChevronDown className="size-3 -rotate-90" />
          </button>
        )}
      </div>
      {player.url ? (
        <Player.Provider key={player.key}>
          <VideojsSkin
            languageOptions={skin.languageOptions}
            languageValue={skin.languageValue}
            onLanguageChange={skin.onLanguageChange}
            poster={player.poster}
            title={player.title}
            currentEpisode={player.currentEpisode}
            resolutionBadge={
              player.resolutionInfo ? (
                renderResolutionBadge(player.resolutionInfo)
              ) : (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] text-white/30">
                  ···
                </span>
              )
            }
            episodes={skin.episodes}
            selectedEpisode={skin.selectedEpisode}
            onEpisodeSelect={skin.onEpisodeSelect}
            onPrevEpisode={skin.onPrevEpisode}
            onNextEpisode={skin.onNextEpisode}
          >
            <MediaElement src={player.url} playsInline autoPlay hlsConfig={player.hlsConfig} />
            {/* Overlays — inside Container, visible in fullscreen */}
            {overlays.playerNotice && <StageOverlay>{overlays.playerNotice}</StageOverlay>}
            {overlays.speedNotice && (
              <StageOverlay bold>{overlays.speedNotice}</StageOverlay>
            )}
            {overlays.seekPreview && <StageOverlay>{overlays.seekPreview}</StageOverlay>}
          </VideojsSkin>
          <PlaybackTracker
            resolvedSourceCode={trackers.resolvedSourceCode}
            resolvedVodId={trackers.resolvedVodId}
            detail={trackers.detail}
            episodes={trackers.episodes}
            selectedEpisode={trackers.selectedEpisode}
            canUseTmdbHistory={trackers.canUseTmdbHistory}
            tmdbMediaType={trackers.tmdbMediaType}
            parsedTmdbId={trackers.parsedTmdbId}
            tmdbSeasonNumberForHistory={trackers.tmdbSeasonNumberForHistory}
            backdropUrl={trackers.backdropUrl}
            onEnded={trackers.onEnded}
          />
          <SourceAutoSwitch
            resolvedSourceCode={trackers.resolvedSourceCode}
            isTmdbRoute={trackers.isTmdbRoute}
            isCmsRoute={trackers.isCmsRoute}
            sourceOptions={trackers.sourceOptions}
            selectedEpisode={trackers.selectedEpisode}
            speedResults={trackers.speedResults}
            onNotice={trackers.onNotice}
            onAllExhausted={trackers.onAllExhausted}
          />
          <ResolutionTracker onResolution={trackers.onResolutionChange} />
          <DefaultVolumeSetter />
          <LoopSetter />
          <AutoPiP
            playerSectionRef={sectionRef}
            enabled={trackers.isAutoMiniEnabled}
            pipEnabled={trackers.isPipEnabled}
            currentUrl={player.url}
          />
          <OrientationLocker />
          <VideojsMobileGestures
            playerSectionRef={sectionRef}
            onSpeedChange={trackers.onSpeedChange}
            onSeekPreview={trackers.onSeekPreview}
            onSeekPreviewEnd={trackers.onSeekPreviewEnd}
          />
          <SpeedTracker onChange={trackers.onSpeedChange} />
          <DesktopSpeedKeys onSpeedChange={trackers.onSpeedChange} />
        </Player.Provider>
      ) : (
        <div className="text-muted-foreground flex aspect-video items-center justify-center text-sm">
          暂无播放地址
        </div>
      )}
      {overlays.isDetailRefreshing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-sm text-white">
            <Spinner size="sm" />
            正在切换资源...
          </div>
        </div>
      )}
    </section>
  )
}

function StageOverlay({ children, bold }: { children: ReactNode; bold?: boolean }) {
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2">
      <span
        className={
          bold
            ? 'rounded-full bg-black/70 px-3 py-1.5 text-sm font-bold text-white shadow-lg backdrop-blur-sm'
            : 'rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-xs whitespace-nowrap text-white shadow-lg backdrop-blur-sm'
        }
      >
        {children}
      </span>
    </div>
  )
}

/** 渲染当前分辨率徽章（label + 尺寸） */
function renderResolutionBadge(info: VideoResolutionInfo | null) {
  if (!info) return undefined
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${info.color}`}
    >
      {info.label}
      <span className="font-normal opacity-80">
        {info.width}x{info.height}
      </span>
    </span>
  )
}
