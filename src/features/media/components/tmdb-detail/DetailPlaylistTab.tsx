import { useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '@/shared/components/ui/button'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import type { PlaylistMatchItem, SeasonSourceMatches, SourceBestMatch } from './playlistMatcher'
import type { PlaylistMatchesProgress } from './usePlaylistMatches'
import { DetailStatePanel } from './DetailStatePanel'
import { ProgressPill } from './playlistStatusParts'
import { SourceMatchBlock, TvSeasonBlock } from './playlistMatchParts'

interface DetailPlaylistTabProps {
  tmdbType: TmdbMediaType
  tmdbId: number
  loading: boolean
  error: string | null
  searched: boolean
  searchedKeyword: string
  progress: PlaylistMatchesProgress
  startedAt: number | null
  completedAt: number | null
  candidates: PlaylistMatchItem[]
  movieSourceMatches: SourceBestMatch[]
  seasonSourceMatches: SeasonSourceMatches[]
  /** TMDB 主标题，匹配详情弹窗的"对应名" */
  searchTitle: string
  onRetry: () => void
}

export function DetailPlaylistTab({
  tmdbType,
  tmdbId,
  loading,
  error,
  searched,
  searchedKeyword,
  progress,
  startedAt,
  completedAt,
  candidates,
  movieSourceMatches,
  seasonSourceMatches,
  searchTitle,
  onRetry,
}: DetailPlaylistTabProps) {
  const reducedMotion = useReducedMotion()
  const movieMatchedSources = movieSourceMatches.filter(match => Boolean(match.bestMatch))
  const hasTvMatchedSources = seasonSourceMatches.some(seasonMatch =>
    seasonMatch.sourceMatches.some(sourceMatch => Boolean(sourceMatch.bestMatch)),
  )

  const firstSeasonId = seasonSourceMatches.find(seasonMatch => seasonMatch.season.season_number === 1)?.season.id ?? null
  const [expandedSeasonId, setExpandedSeasonId] = useState<number | null>(firstSeasonId)
  const [showComplete, setShowComplete] = useState(false)
  const [showNoMatchSources, setShowNoMatchSources] = useState(false)

  useEffect(() => {
    if (!completedAt) return
    setShowComplete(true)
    const timer = window.setTimeout(() => setShowComplete(false), 1600)
    return () => window.clearTimeout(timer)
  }, [completedAt])

  const showPillInActionSlot = loading || showComplete
  const shouldShowNoMatchState =
    !error &&
    searched &&
    !loading &&
    (tmdbType === 'movie' ? movieMatchedSources.length === 0 : !hasTvMatchedSources)

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">匹配结果</h2>
          <p className="text-muted-foreground text-xs">
            基于剧名在已启用的视频源中检索，并按标题相似度/年份/季信息计算最佳匹配。结果会增量显示。
            {searchedKeyword ? ` 当前关键词：“${searchedKeyword}”。` : ''}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <AnimatePresence mode="wait" initial={false}>
            {showPillInActionSlot ? (
              <motion.div
                key="playlist-progress"
                initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
              >
                <ProgressPill
                  tmdbType={tmdbType}
                  loading={loading}
                  progress={progress}
                  showComplete={showComplete}
                  candidatesCount={candidates.length}
                  startedAt={startedAt}
                  completedAt={completedAt}
                />
              </motion.div>
            ) : (
              <motion.div
                key="playlist-retry-button"
                initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 rounded-full px-4"
                  onClick={onRetry}
                >
                  <RefreshCcw className="size-4" />
                  重新匹配
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 占位，保证右侧区域在切换时稳定 */}
          <motion.div
            className="h-0"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.01 }}
          />
        </div>
      </div>

      {!loading && error && (
        <DetailStatePanel
          mode="error"
          tag="匹配失败"
          title="找不到匹配结果"
          description={error}
          primaryAction={{
            label: '重新匹配',
            onClick: onRetry,
          }}
          secondaryAction={{
            label: '视频源设置',
            to: '/settings/source',
          }}
        />
      )}

      {!error && searched && tmdbType === 'movie' && (
        <div className="space-y-3">
          {movieMatchedSources.length > 0 && (
            <motion.div layout={!reducedMotion || undefined} className="grid gap-3 md:grid-cols-2">
              <AnimatePresence initial={false}>
                {movieMatchedSources.map(sourceMatch => (
                  <motion.div
                    key={`movie-${sourceMatch.sourceCode}`}
                    layout={!reducedMotion || undefined}
                    initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
                    transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
                  >
                    <SourceMatchBlock
                      tmdbType={tmdbType}
                      tmdbId={tmdbId}
                      sourceMatch={sourceMatch}
                      searchTitle={searchTitle}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      )}

      {!error && searched && tmdbType === 'tv' && (
        <div className="space-y-4">
          {seasonSourceMatches.length > 0 && !shouldShowNoMatchState ? (
            <div className="space-y-4">
              {seasonSourceMatches.map(seasonMatch => (
                <TvSeasonBlock
                  key={seasonMatch.season.id}
                  tmdbType={tmdbType}
                  tmdbId={tmdbId}
                  seasonMatch={seasonMatch}
                  expanded={expandedSeasonId === seasonMatch.season.id}
                  onToggle={() =>
                    setExpandedSeasonId(prev => (prev === seasonMatch.season.id ? null : seasonMatch.season.id))
                  }
                  searchTitle={searchTitle}
                />
              ))}
            </div>
          ) : (
            !loading &&
            !shouldShowNoMatchState && <p className="text-muted-foreground text-sm">当前剧集没有可匹配的季信息</p>
          )}
        </div>
      )}

      {shouldShowNoMatchState && (
        <>
          <DetailStatePanel
            mode="empty"
            tag="暂无可用播放项"
            title="找不到匹配结果"
            description="当前已启用视频源中没有可播放条目。你可以重新匹配，或调整视频源后再试。"
            primaryAction={{
              label: '重新匹配',
              onClick: onRetry,
            }}
            secondaryAction={{
              label: '视频源设置',
              to: '/settings/source',
            }}
            extraAction={{
              label: showNoMatchSources ? '收起匹配详情' : '查看各源匹配详情',
              onClick: () => setShowNoMatchSources(v => !v),
            }}
          />

          {showNoMatchSources && tmdbType === 'movie' && movieSourceMatches.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {movieSourceMatches.map(sourceMatch => (
                <SourceMatchBlock
                  key={`nomatch-movie-${sourceMatch.sourceCode}`}
                  tmdbType={tmdbType}
                  tmdbId={tmdbId}
                  sourceMatch={sourceMatch}
                  searchTitle={searchTitle}
                />
              ))}
            </div>
          )}

          {showNoMatchSources && tmdbType === 'tv' && seasonSourceMatches.length > 0 && (
            <div className="space-y-4">
              {seasonSourceMatches.map(seasonMatch => (
                <TvSeasonBlock
                  key={`nomatch-tv-${seasonMatch.season.id}`}
                  tmdbType={tmdbType}
                  tmdbId={tmdbId}
                  seasonMatch={seasonMatch}
                  expanded={expandedSeasonId === seasonMatch.season.id}
                  onToggle={() =>
                    setExpandedSeasonId(prev => (prev === seasonMatch.season.id ? null : seasonMatch.season.id))
                  }
                  searchTitle={searchTitle}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
