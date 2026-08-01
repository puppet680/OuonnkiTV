import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  CalendarDays,
  Copy,
  ExternalLink,
  Film,
  Heart,
  HeartOff,
  Lock,
  MapPin,
  Play,
  Star,
  Tv,
  ArrowUpDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDocumentTitle } from '@/shared/hooks'
import { useTmdbPerson } from '@/shared/hooks/useTmdbDetail'
import { useSettingStore } from '@/shared/store/settingStore'
import { getPosterUrl, getBackdropUrl } from '@/shared/lib/tmdb'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ScrollableText, MediaPosterCard } from '@/shared/components/common'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import type { TmdbMediaItem } from '@/shared/types/tmdb'
import type { PersonCastCredit, CreditSortBy } from '@/shared/types/person'
import { MediaCarousel, HorizontalMediaCard } from '@/shared/components/media'
import { DetailStatePanel } from '@/features/media/components/tmdb-detail'
import { PersonDetailSkeleton } from '../components/PersonDetailSkeleton'
import { buildTmdbDetailPath, buildTmdbPlayPath } from '@/shared/lib/routes'
import { useFavoritesStore } from '@/features/favorites/store/favoritesStore'
import { AnimateIcon } from '@/components/animate-ui/icons/icon'
import { ArrowLeft } from '@/components/animate-ui/icons/arrow-left'

const SORT_OPTIONS: { value: CreditSortBy; label: string }[] = [
  { value: 'release_date', label: '上映日期' },
  { value: 'vote_average', label: '评分' },
  { value: 'popularity', label: '热度' },
  { value: 'title', label: '标题' },
]

const MEDIA_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'movie', label: '电影' },
  { key: 'tv', label: '剧集' },
] as const

type MediaFilter = (typeof MEDIA_FILTERS)[number]['key']

interface CreditCardProps {
  credit: PersonCastCredit
  censored?: boolean
  heroBg?: string | null
}

function CreditCard({ credit, censored, heroBg }: CreditCardProps) {
  const navigate = useNavigate()
  const favoritesStore = useFavoritesStore()
  const isFavorited = favoritesStore.isTmdbFavorited(credit.id, credit.mediaType)

  if (censored) {
    return (
      <article className="border-border/40 pointer-events-none relative flex gap-3 overflow-hidden rounded-lg border p-3 select-none">
        {heroBg && (
          <img
            src={heroBg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        )}
        <div className="border-border/35 relative z-10 aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg border bg-zinc-200/40 dark:bg-zinc-800/40" />
        <div className="relative z-10 min-w-0 flex-1 space-y-1 text-sm">
          <div className="h-4 w-2/3 rounded bg-zinc-200/40 dark:bg-zinc-800/40" />
          <div className="h-3 w-1/2 rounded bg-zinc-200/40 dark:bg-zinc-800/40" />
          <div className="h-3 w-1/3 rounded bg-zinc-200/40 dark:bg-zinc-800/40" />
        </div>
        <div className="bg-background/60 absolute inset-0 z-20 flex items-center justify-center rounded-lg backdrop-blur-xl">
          <Lock className="text-foreground/30 size-6" />
        </div>
      </article>
    )
  }

  const media: TmdbMediaItem = {
    id: credit.id,
    mediaType: credit.mediaType,
    title: credit.title,
    originalTitle: credit.originalTitle,
    overview: credit.overview,
    posterPath: credit.posterPath,
    backdropPath: credit.backdropPath,
    logoPath: null,
    releaseDate: credit.releaseDate,
    voteAverage: credit.voteAverage,
    voteCount: credit.voteCount,
    popularity: credit.popularity,
    genreIds: credit.genreIds,
    originalLanguage: credit.originalLanguage,
    originCountry: credit.originCountry,
  }

  return (
    <HorizontalMediaCard
      posterPath={credit.posterPath}
      posterAlt={credit.title}
      to={buildTmdbDetailPath(credit.mediaType, credit.id)}
      contextMenuDescription={{
        posterUrl: credit.posterPath ? getPosterUrl(credit.posterPath, 'w185') : null,
        year: credit.releaseDate?.slice(0, 4),
        rating: credit.voteAverage,
        overview: credit.overview || undefined,
      }}
      contextMenuItems={[
        {
          id: 'play-now',
          label: '立即播放',
          icon: <Play className="size-4" />,
          onClick: () => navigate(buildTmdbPlayPath(credit.mediaType, credit.id)),
        },
        {
          id: 'view-detail',
          label: '查看详情',
          icon: <ExternalLink className="size-4" />,
          onClick: () => navigate(buildTmdbDetailPath(credit.mediaType, credit.id)),
        },
        {
          id: 'toggle-favorite',
          label: isFavorited ? '取消收藏' : '加入收藏',
          icon: isFavorited ? <HeartOff className="size-4" /> : <Heart className="size-4" />,
          variant: isFavorited ? 'destructive' : 'default',
          onClick: () => favoritesStore.toggleTmdbFavorite(media),
        },
        {
          id: 'copy-title',
          label: '复制标题',
          icon: <Copy className="size-4" />,
          onClick: () => {
            navigator.clipboard.writeText(credit.title).then(
              () => toast.success(`已复制：${credit.title}`),
              () => toast.error('复制失败，请重试'),
            )
          },
        },
      ]}
    >
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-1.5">
          {credit.mediaType === 'tv' ? (
            <Tv className="text-muted-foreground size-3.5 shrink-0" />
          ) : (
            <Film className="text-muted-foreground size-3.5 shrink-0" />
          )}
          <p className="line-clamp-1 font-semibold">{credit.title}</p>
          {credit.voteAverage > 0 && (
            <Badge
              variant="outline"
              className="ml-auto h-5 shrink-0 rounded-full px-1.5 text-[10px]"
            >
              <Star className="mr-0.5 size-3 fill-amber-400 text-amber-400" />
              {credit.voteAverage.toFixed(1)}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          饰演：{credit.character || '未知'}
        </p>
        <p className="text-muted-foreground text-xs">
          {credit.releaseDate ? credit.releaseDate.slice(0, 4) : '未知年份'}
          {credit.mediaType === 'tv' && credit.episodeCount ? ` · ${credit.episodeCount} 集` : ''}
        </p>
        {credit.overview && (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-5">{credit.overview}</p>
        )}
      </div>
    </HorizontalMediaCard>
  )
}

export default function PersonDetailView() {
  const navigate = useNavigate()
  const { personId: personIdParam = '' } = useParams<{ personId: string }>()
  const personId = Number(personIdParam)
  const isValidId = Number.isInteger(personId) && personId > 0

  const { person, credits, images, loading, error } = useTmdbPerson(
    isValidId ? personId : undefined,
  )
  const favoritesStore = useFavoritesStore()

  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [sortBy, setSortBy] = useState<CreditSortBy>('release_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useDocumentTitle(person?.name || '人物详情')

  const isAdultFilterEnabled = useSettingStore(s => s.system.isAdultFilterEnabled)

  const { knownWorks, adultIds } = useMemo(() => {
    if (!credits) return { knownWorks: [] as TmdbMediaItem[], adultIds: new Set<number>() }
    const seen = new Set<number>()
    const ids = new Set<number>()
    const items = [...credits.cast, ...credits.crew]
      .filter(c => {
        if (seen.has(c.id)) return false
        seen.add(c.id)
        if (isAdultFilterEnabled && c.adult) ids.add(c.id)
        return c.voteAverage > 0 || c.popularity > 1
      })
      .sort((a, b) => b.voteAverage - a.voteAverage || b.popularity - a.popularity)
      .slice(0, 18)
      .map(c => ({
        id: c.id,
        mediaType: c.mediaType,
        title: c.title,
        originalTitle: c.originalTitle,
        overview: c.overview,
        posterPath: c.posterPath,
        backdropPath: c.backdropPath,
        logoPath: null,
        releaseDate: c.releaseDate,
        voteAverage: c.voteAverage,
        voteCount: c.voteCount,
        popularity: c.popularity,
        genreIds: c.genreIds,
        originalLanguage: c.originalLanguage,
        originCountry: c.originCountry,
      }))
    return { knownWorks: items, adultIds: ids }
  }, [credits, isAdultFilterEnabled])

  const filteredCredits = useMemo<PersonCastCredit[]>(() => {
    if (!credits) return []
    let list = [...credits.cast]
    if (mediaFilter !== 'all') {
      list = list.filter(c => c.mediaType === mediaFilter)
    }
    list.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'release_date':
          cmp = (a.releaseDate || '').localeCompare(b.releaseDate || '')
          break
        case 'vote_average':
          cmp = a.voteAverage - b.voteAverage
          break
        case 'popularity':
          cmp = a.popularity - b.popularity
          break
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
      }
      return sortOrder === 'desc' ? -cmp : cmp
    })
    return list
  }, [credits, mediaFilter, sortBy, sortOrder])

  // --- invalid id ---
  if (!isValidId) {
    return (
      <DetailStatePanel
        mode="error"
        tag="路由校验失败"
        title="这个人物页面地址不可用"
        description="当前链接缺少有效的人物 ID，无法加载人物详情。"
        primaryAction={{
          label: '返回上一页',
          onClick: () => navigate(-1),
        }}
      />
    )
  }

  // --- loading ---
  if (loading && !person) {
    return <PersonDetailSkeleton />
  }

  // --- error ---
  if (error || !person) {
    return (
      <DetailStatePanel
        mode="error"
        tag="详情加载失败"
        title="找不到人物信息"
        description={error || '该条目可能已下线，或当前服务暂不可用。'}
        primaryAction={{
          label: '返回上一页',
          onClick: () => navigate(-1),
        }}
      />
    )
  }

  const profileUrl = getPosterUrl(person.profile_path, 'w342')
  const heroBackdrop = images?.profiles?.[0]?.file_path
    ? getBackdropUrl(images.profiles[0].file_path, 'w1280')
    : null
  const age = person.birthday
    ? `（${new Date().getFullYear() - new Date(person.birthday).getFullYear()} 岁）`
    : ''

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-lg">
        {heroBackdrop ? (
          <img
            src={heroBackdrop}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />

        <AnimateIcon animateOnHover>
          <Button
            variant="ghost"
            className="absolute top-3 left-3 z-20 h-8 rounded-full !bg-transparent px-2.5 text-white/90 hover:text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="size-4" />
            返回
          </Button>
        </AnimateIcon>

        <div className="relative z-10 flex flex-col gap-4 p-4 sm:flex-row sm:gap-6 sm:p-6 md:p-8">
          <div className="border-border/30 mx-auto size-28 shrink-0 overflow-hidden rounded-full border-2 bg-black/30 sm:mx-0 sm:size-36 md:size-44">
            {profileUrl ? (
              <img src={profileUrl} alt={person.name} className="size-full object-cover" />
            ) : (
              <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
                暂无照片
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-white md:text-3xl">
              {person.name}
              {age}
            </h1>
            {person.original_name && person.original_name !== person.name && (
              <p className="text-sm text-white/60">{person.original_name}</p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/70 sm:justify-start">
              {person.known_for_department && (
                <Badge className="h-5 rounded-full bg-white/16 px-2 text-[10px] text-white">
                  {person.known_for_department}
                </Badge>
              )}
              {person.adult && (
                <Badge className="h-5 rounded-full bg-red-600/80 px-2 text-[10px] text-white">
                  成人演员
                </Badge>
              )}
              {person.birthday && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {person.birthday}
                  {person.deathday ? ` — ${person.deathday}` : ''}
                </span>
              )}
              {person.place_of_birth && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {person.place_of_birth}
                </span>
              )}
            </div>
            {person.biography && (
              <ScrollableText className="text-sm leading-6 whitespace-pre-line text-white/80">
                {person.biography}
              </ScrollableText>
            )}
          </div>
        </div>
      </section>

      {/* Known works */}
      {knownWorks.length > 0 && (
        <MediaCarousel
          title="知名作品"
          items={knownWorks}
          itemKey={item => `${item.mediaType}-${item.id}`}
          renderItem={
            adultIds.size > 0
              ? item => {
                  const isAdult = adultIds.has(item.id)
                  const inner = (
                    <MediaPosterCard
                      to={isAdult ? '#' : buildTmdbDetailPath(item.mediaType, item.id)}
                      posterUrl={getPosterUrl(item.posterPath, 'w342')}
                      title={item.title}
                      year={item.releaseDate?.split('-')[0]}
                      rating={item.voteAverage}
                      overview={item.overview}
                      onToggleFavorite={() => favoritesStore.toggleTmdbFavorite(item)}
                      isFavorited={favoritesStore.isTmdbFavorited(item.id, item.mediaType)}
                      onPlayNow={() => navigate(buildTmdbPlayPath(item.mediaType, item.id))}
                      onViewDetail={() => navigate(buildTmdbDetailPath(item.mediaType, item.id))}
                    />
                  )
                  if (isAdult)
                    return (
                      <div className="border-border/40 pointer-events-none relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-lg border select-none">
                        {heroBackdrop && (
                          <img
                            src={heroBackdrop}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-60"
                          />
                        )}
                        <div className="bg-background/60 absolute inset-0 rounded-lg backdrop-blur-xl" />
                        <Lock className="text-foreground/30 relative size-5" />
                      </div>
                    )
                  return inner
                }
              : undefined
          }
        />
      )}

      {/* Acting credits */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            表演
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              共 {filteredCredits.length} 部
            </span>
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Media type filter chips */}
            <div className="flex gap-1">
              {MEDIA_FILTERS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setMediaFilter(f.key)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    mediaFilter === f.key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-primary',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort select */}
            <Select value={sortBy} onValueChange={v => setSortBy(v as CreditSortBy)}>
              <SelectTrigger className="h-8 w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
            >
              <ArrowUpDown
                className={cn('size-4 transition-transform', sortOrder === 'asc' && 'rotate-180')}
              />
            </Button>
          </div>
        </div>

        {filteredCredits.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredCredits.map((credit, i) => (
              <CreditCard
                key={`${credit.id}-${credit.character}-${i}`}
                credit={credit}
                censored={isAdultFilterEnabled && credit.adult}
                heroBg={heroBackdrop}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">暂无符合条件的作品</p>
        )}
      </section>
    </div>
  )
}
