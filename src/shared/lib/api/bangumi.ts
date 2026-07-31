import { getTmdbClient, normalizeToMediaItem, fillItemLogos } from '@/shared/lib/tmdb'
import type { TmdbMediaItem } from '@/shared/types/tmdb'

/** 番剧周更分组所用网络 ID（排除 Tokyo MX 等） */
const BANGUMI_WEEKDAY_NETWORKS = '213|193|145|167|86|74|85|94|118|1542|9938'

/**
 * 番剧首页数据（新番/番剧/剧场版三路 discover 并行 + 巨幕 Top10 填充 logo）
 * @param language - 显示语言
 * @param signal - 取消/超时信号
 * @returns 番剧首页各分类条目
 */
export async function fetchBangumiData(
  language: string,
  signal?: AbortSignal,
): Promise<{
  newAnime: TmdbMediaItem[]
  series: TmdbMediaItem[]
  movies: TmdbMediaItem[]
  featured: TmdbMediaItem[]
}> {
  const client = getTmdbClient()
  const discoverTv = client.discover.tvShow as unknown as (p: Record<string, unknown>) => Promise<{ results: Array<Record<string, unknown>> }>
  const discoverMovie = client.discover.movie as unknown as (p: Record<string, unknown>) => Promise<{ results: Array<Record<string, unknown>> }>

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const dateStr = threeMonthsAgo.toISOString().slice(0, 10)

  // 新番/番剧各取 3 页共 60 条（保证周更表数据量）
  const fetchPages = (build: (page: number) => Promise<{ results: Array<Record<string, unknown>> }>) =>
    Promise.all([1, 2, 3].map(p => build(p))).then(rs => rs.flatMap(r => r.results))
  const normTv = (i: Record<string, unknown>) => normalizeToMediaItem(i, 'tv')
  const normMovie = (i: Record<string, unknown>) => normalizeToMediaItem(i, 'movie')

  const [newAnimeRaw, seriesRaw, movieRes] = await Promise.all([
    fetchPages(p =>
      discoverTv({ language, sort_by: 'popularity.desc', with_genres: '16', with_original_language: 'ja', 'first_air_date.gte': dateStr, page: p, signal }),
    ),
    fetchPages(p =>
      discoverTv({ language, sort_by: 'popularity.desc', with_genres: '16', with_original_language: 'ja', with_networks: BANGUMI_WEEKDAY_NETWORKS, 'first_air_date.gte': '2010-01-01', 'vote_count.gte': 10, page: p, signal }),
    ),
    discoverMovie({ language, sort_by: 'popularity.desc', with_genres: '16', with_original_language: 'ja', 'primary_release_date.gte': '2010-01-01', 'vote_count.gte': 10, signal }),
  ])

  const newAnime = newAnimeRaw.map(normTv)
  const series = seriesRaw.map(normTv)
  const movies = movieRes.results.map(normMovie)

  // 巨幕：番剧去重，热度降序 Top 10，拉 logo
  const top10 = [...new Map(
    series.map(i => [i.id + i.mediaType, i]),
  ).values()]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 10)

  await fillItemLogos(client, top10)

  return { newAnime, series, movies, featured: top10 }
}
