import { useEffect, useState, useCallback } from 'react'
import { getTmdbClient, normalizeToMediaItem, fillItemLogos } from '@/shared/lib/tmdb'
import type { TmdbMediaItem } from '@/shared/types/tmdb'

const WEEKDAY_NETWORKS = '213|193|145|167|86|74|85|94|118|1542|9938'

interface BangumiData {
  newAnime: TmdbMediaItem[]
  series: TmdbMediaItem[]
  movies: TmdbMediaItem[]
  featured: TmdbMediaItem[]
  loading: boolean
  error: string | null
}

/**
 * 番剧首页数据 Hook
 * 从 TMDB 获取新番、番剧、剧场版及巨幕推荐数据
 * @returns 番剧首页所需的所有数据及状态
 */
export function useBangumi(): BangumiData {
  const [newAnime, setNewAnime] = useState<TmdbMediaItem[]>([])
  const [series, setSeries] = useState<TmdbMediaItem[]>([])
  const [movies, setMovies] = useState<TmdbMediaItem[]>([])
  const [featured, setFeatured] = useState<TmdbMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
              with_networks: WEEKDAY_NETWORKS,
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
        seriesItems.map(i => [i.id + i.mediaType, i]),
      ).values()]
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 10)

      await fillItemLogos(client, top10)

      setFeatured(top10)
    } catch (err) {
      console.error('Bangumi fetch failed:', err)
      setError(err instanceof Error ? err.message : '获取番剧数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { newAnime, series, movies, featured, loading, error }
}
