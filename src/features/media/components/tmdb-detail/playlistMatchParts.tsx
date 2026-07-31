import { Link } from 'react-router'
import { ChevronDown, ImageOff, List, Play } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { buildTmdbPlayPath } from '@/shared/lib/routes'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import type { PlaylistMatchItem, SeasonSourceMatches, SourceBestMatch } from './playlistMatcher'
import { MotionCollapse } from './playlistStatusParts'

const buildPlayLink = (
  tmdbType: TmdbMediaType,
  tmdbId: number,
  entry: PlaylistMatchItem,
  seasonNumber?: number,
) => {
  if (!entry.item.source_code || !entry.item.vod_id) return null
  return buildTmdbPlayPath(tmdbType, tmdbId, {
    sourceCode: entry.item.source_code,
    vodId: entry.item.vod_id,
    seasonNumber: tmdbType === 'tv' ? seasonNumber : undefined,
  })
}

/** 单个匹配条目行 */
function MatchRow({
  tmdbType,
  tmdbId,
  entry,
  density = 'default',
  seasonNumber,
}: {
  tmdbType: TmdbMediaType
  tmdbId: number
  entry: PlaylistMatchItem
  density?: 'default' | 'compact'
  seasonNumber?: number
}) {
  const playLink = buildPlayLink(tmdbType, tmdbId, entry, seasonNumber)
  const title = entry.item.vod_name || '未命名条目'
  const year = entry.item.vod_year || ''
  const remarks = entry.item.vod_remarks || ''
  const cover = entry.item.vod_pic || ''
  const rowClass =
    density === 'compact'
      ? 'flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3'
      : 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4'

  return (
    <div className={rowClass}>
      <div className="flex min-w-0 w-full gap-3 sm:w-auto sm:flex-1">
        <div className={density === 'compact' ? 'border-border/40 bg-muted/30 size-12 shrink-0 overflow-hidden rounded-md border' : 'border-border/40 bg-muted/30 size-14 shrink-0 overflow-hidden rounded-md border'}>
          {cover ? (
            <img src={cover} alt={title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="text-muted-foreground flex h-full w-full items-center justify-center">
              <ImageOff className="size-4" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className={density === 'compact' ? 'line-clamp-1 text-sm font-medium' : 'line-clamp-1 text-sm font-semibold'}>
            {title}
          </p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            {year && <span>{year}</span>}
            {remarks && (
              <Badge variant="outline" className="max-w-full rounded-full text-[11px] whitespace-nowrap">
                {remarks}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-end sm:self-center">
        <p className="text-muted-foreground text-xs sm:hidden">分数 {entry.score}</p>
        <Badge variant="outline" className="hidden h-7 rounded-full px-2.5 py-0 text-[11px] sm:inline-flex">
          分数 {entry.score}
        </Badge>
        {playLink ? (
          <Button asChild size="xs" className="h-7 shrink-0 rounded-full px-3">
            <Link to={playLink}>
              <Play className="size-3.5" />
              立即播放
            </Link>
          </Button>
        ) : (
          <Button size="xs" variant="outline" className="h-7 shrink-0 rounded-full px-3" disabled>
            不可播
          </Button>
        )}
      </div>
    </div>
  )
}

/** 单个视频源的匹配结果块（含全部结果 Dialog） */
function SourceMatchBlock({
  tmdbType,
  tmdbId,
  sourceMatch,
  seasonNumber,
}: {
  tmdbType: TmdbMediaType
  tmdbId: number
  sourceMatch: SourceBestMatch
  seasonNumber?: number
}) {
  const totalMatches = (sourceMatch.bestMatch ? 1 : 0) + sourceMatch.alternatives.length
  const best = sourceMatch.bestMatch
  const isSingle = totalMatches === 1 && Boolean(best)
  const useScrollArea = totalMatches > 3

  return (
    <article className="space-y-3 rounded-lg border border-border/45 p-3 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="line-clamp-1 text-sm font-semibold">{sourceMatch.sourceName || sourceMatch.sourceCode}</p>
            <Badge variant={best ? 'secondary' : 'outline'} className="h-7 rounded-full px-2.5 py-0 text-[11px]">
              {best ? `最高分 ${best.score}` : '无匹配'}
            </Badge>
          </div>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="xs" className="h-7 gap-1 rounded-full px-3" disabled={totalMatches === 0}>
              <List className="size-3.5" />
              全部（{totalMatches}）
            </Button>
          </DialogTrigger>
          <DialogContent
            className={
              isSingle
                ? 'h-fit gap-3 p-4 sm:max-w-xl sm:rounded-xl'
                : 'max-h-[85vh] flex flex-col sm:max-w-3xl'
            }
          >
            <DialogHeader>
              <DialogTitle>{sourceMatch.sourceName || sourceMatch.sourceCode}</DialogTitle>
              {!isSingle && <DialogDescription>共 {totalMatches} 条，按综合分从高到低排序。</DialogDescription>}
            </DialogHeader>

            {isSingle && best ? (
              <div className="rounded-lg border border-border/45 p-3">
                <MatchRow
                  tmdbType={tmdbType}
                  tmdbId={tmdbId}
                  entry={best}
                  seasonNumber={seasonNumber}
                />
              </div>
            ) : useScrollArea ? (
              <ScrollArea className="max-h-[65vh]">
                <div className="space-y-4">
                  {best && (
                    <section className="space-y-2">
                      <p className="text-muted-foreground text-xs">最佳匹配</p>
                      <div className="rounded-lg border border-border/45 p-3">
                        <MatchRow
                          tmdbType={tmdbType}
                          tmdbId={tmdbId}
                          entry={best}
                          seasonNumber={seasonNumber}
                        />
                      </div>
                    </section>
                  )}

                  {sourceMatch.alternatives.length > 0 && (
                    <section className="space-y-2">
                      <p className="text-muted-foreground text-xs">其他匹配项</p>
                      <ul className="divide-border/35 border-border/35 divide-y rounded-lg border">
                        {sourceMatch.alternatives.map(entry => (
                          <li key={`${sourceMatch.sourceCode}-${entry.item.vod_id}-alt-all`} className="p-3">
                            <MatchRow
                              tmdbType={tmdbType}
                              tmdbId={tmdbId}
                              entry={entry}
                              density="compact"
                              seasonNumber={seasonNumber}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="max-h-[65vh] space-y-4 overflow-y-auto">
                {best && (
                  <section className="space-y-2">
                    <p className="text-muted-foreground text-xs">最佳匹配</p>
                    <div className="rounded-lg border border-border/45 p-3">
                      <MatchRow
                        tmdbType={tmdbType}
                        tmdbId={tmdbId}
                        entry={best}
                        seasonNumber={seasonNumber}
                      />
                    </div>
                  </section>
                )}

                {sourceMatch.alternatives.length > 0 && (
                  <section className="space-y-2">
                    <p className="text-muted-foreground text-xs">其他匹配项</p>
                    <ul className="divide-border/35 border-border/35 divide-y rounded-lg border">
                      {sourceMatch.alternatives.map(entry => (
                        <li key={`${sourceMatch.sourceCode}-${entry.item.vod_id}-alt-all`} className="p-3">
                          <MatchRow
                            tmdbType={tmdbType}
                            tmdbId={tmdbId}
                            entry={entry}
                            density="compact"
                            seasonNumber={seasonNumber}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {best ? (
        <div className="rounded-lg border border-border/45 p-3">
          <MatchRow
            tmdbType={tmdbType}
            tmdbId={tmdbId}
            entry={best}
            seasonNumber={seasonNumber}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/55 p-3">
          <p className="text-muted-foreground text-sm">该源暂未筛选到可播放条目</p>
        </div>
      )}
    </article>
  )
}

/** 剧集季的匹配块（可折叠） */
function TvSeasonBlock({
  tmdbType,
  tmdbId,
  seasonMatch,
  expanded,
  onToggle,
}: {
  tmdbType: TmdbMediaType
  tmdbId: number
  seasonMatch: SeasonSourceMatches
  expanded: boolean
  onToggle: () => void
}) {
  const matchedCount = seasonMatch.sourceMatches.filter(match => Boolean(match.bestMatch)).length
  const matchedSources = seasonMatch.sourceMatches.filter(match => Boolean(match.bestMatch))

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/45 px-3 py-2 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronDown
            className={
              expanded
                ? 'text-muted-foreground size-4 rotate-180 transition-transform'
                : 'text-muted-foreground size-4 transition-transform'
            }
          />
          <p className="line-clamp-1 text-sm font-semibold">
            S{seasonMatch.season.season_number} · {seasonMatch.season.name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={matchedCount > 0 ? 'secondary' : 'outline'} className="h-7 rounded-full px-2.5 py-0 text-[11px]">
            {matchedCount > 0 ? `已匹配 ${matchedCount}` : '暂无匹配'}
          </Badge>
        </div>
      </button>

      <MotionCollapse open={expanded}>
        {matchedSources.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {matchedSources.map(sourceMatch => (
              <SourceMatchBlock
                key={`season-${seasonMatch.season.id}-${sourceMatch.sourceCode}`}
                tmdbType={tmdbType}
                tmdbId={tmdbId}
                sourceMatch={sourceMatch}
                seasonNumber={seasonMatch.season.season_number}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">这一季没有匹配到可播放条目</p>
        )}
      </MotionCollapse>
    </section>
  )
}

export { SourceMatchBlock, TvSeasonBlock }
