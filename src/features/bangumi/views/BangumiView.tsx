import { useEffect, useState, useCallback } from 'react'
import { FeaturedCarousel } from '@/features/home/components/FeaturedCarousel'
import { MediaCarousel } from '@/features/home/components/MediaCarousel'
import { getTmdbClient, normalizeToMediaItem } from '@/shared/lib/tmdb'
import type { TmdbMediaItem } from '@/shared/types/tmdb'

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export default function BangumiView() {
  const [newAnime, setNewAnime] = useState<TmdbMediaItem[]>([])
  const [series, setSeries] = useState<TmdbMediaItem[]>([])
  const [movies, setMovies] = useState<TmdbMediaItem[]>([])
  const [featured, setFeatured] = useState<TmdbMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduleDay, setScheduleDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const client = getTmdbClient()
    const lang = 'zh-CN'
    const normTv = (i: unknown) => normalizeToMediaItem(i as Record<string, unknown>, 'tv')
    const normMovie = (i: unknown) => normalizeToMediaItem(i as Record<string, unknown>, 'movie')

    try {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      const dateStr = threeMonthsAgo.toISOString().slice(0, 10)
      const nets = '213|193|145|167|86|74|85|94|118|1542|9938'

      const [newRes, seriesRes, movieRes] = await Promise.all([
        // 新番：取3页共60条，供周更表分组（不加网络过滤，保证数据量）
        (async () => {
          const pages = await Promise.all([1, 2, 3].map(p =>
            client.discover.tvShow({
              language: lang, sort_by: 'popularity.desc',
              with_genres: '16', with_original_language: 'ja',
              'first_air_date.gte': dateStr, page: p,
            }),
          ))
          return { results: pages.flatMap(r => r.results) }
        })(),
        // 番剧：取3页共60条，加网络过滤排除 Tokyo MX
        (async () => {
          const pages = await Promise.all([1, 2, 3].map(p =>
            client.discover.tvShow({
              language: lang, sort_by: 'popularity.desc',
              with_genres: '16', with_original_language: 'ja',
              with_networks: nets,
              'first_air_date.gte': '2010-01-01',
              'vote_count.gte': 10, page: p,
            }),
          ))
          return { results: pages.flatMap(r => r.results) }
        })(),
        client.discover.movie({
          language: lang, sort_by: 'popularity.desc',
          with_genres: '16', with_original_language: 'ja',
          'primary_release_date.gte': '2010-01-01',
          'vote_count.gte': 10,
        }),
      ])

      const newItems = newRes.results.map(normTv)
      const seriesItems = seriesRes.results.map(normTv)
      const movieItems = movieRes.results.map(normMovie)

      setNewAnime(newItems)
      setSeries(seriesItems)
      setMovies(movieItems)

      // 巨幕：番剧去重，热度降序 Top 10，拉 logo
      const top10 = [...new Map(
        seriesItems.map(i => [i.id + i.mediaType, i])
      ).values()]
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 10)

      try {
        const logoResults = await Promise.allSettled(
          top10.map(async item => {
            const res = item.mediaType === 'movie'
              ? await client.movies.images(item.id)
              : await client.tvShows.images(item.id)
            const logos: { file_path: string }[] = (res as unknown as Record<string, unknown>).logos as { file_path: string }[] ?? []
            return { id: item.id, mediaType: item.mediaType, logoPath: logos[0]?.file_path ?? null }
          }),
        )
        for (const r of logoResults) {
          if (r.status === 'fulfilled' && r.value.logoPath) {
            const item = top10.find(i => i.id === r.value.id && i.mediaType === r.value.mediaType)
            if (item) item.logoPath = r.value.logoPath
          }
        }
      } catch { /* logo 拉取失败不影响主流程 */ }

      setFeatured(top10)
    } catch (err) {
      console.error('Bangumi fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const dayItems = newAnime.filter(item => {
    if (!item.releaseDate) return false
    const d = new Date(item.releaseDate)
    const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1
    return dayIndex === scheduleDay
  })

  return (
    <div className="min-h-full">
      <FeaturedCarousel items={featured} loading={loading} />

      <div className="flex flex-col gap-6 px-4 pb-8 pt-6">
        {/* 周更表 */}
        <section>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h2 className="text-lg font-semibold shrink-0">周更表</h2>
            <div className="flex gap-1 bg-muted/40 rounded-lg p-1 flex-wrap">
              {WEEKDAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setScheduleDay(i)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    scheduleDay === i
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <MediaCarousel title="" items={dayItems} loading={loading} />
        </section>

        <MediaCarousel title="新番" items={newAnime} loading={loading} />
        <MediaCarousel title="番剧" items={series} loading={loading} />
        <MediaCarousel title="剧场" items={movies} loading={loading} />
      </div>
    </div>
  )
}
