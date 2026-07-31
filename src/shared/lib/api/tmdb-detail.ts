import { z } from 'zod'
import type { AppendToResponseMovieKey, AppendToResponseTvKey } from 'tmdb-ts'
import { getTmdbClient, normalizeToMediaItem } from '@/shared/lib/tmdb'
import type { TmdbMediaItem, TmdbMediaType } from '@/shared/types/tmdb'
import type {
  PersonDetails,
  PersonCombinedCredits,
  PersonImages,
  PersonCastCredit,
} from '@/shared/types/person'

const tmdbDetailSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  name: z.string().optional(),
})

/**
 * 获取媒体详情（两阶段：core 先渲染，secondary 静默后台合并）
 * 注：tmdb-ts 的 details 方法无 options 槽位，不支持 signal 取消/超时（与存量行为一致）
 * @param id - TMDB ID
 * @param mediaType - movie | tv
 * @param language - 显示语言
 * @param phase - core（credits/images/external_ids 等）| secondary（videos/reviews/recommendations 等）
 * @returns 原始 TMDB 详情与规范化字段合并后的对象（调用方按需收窄类型）
 */
export async function fetchTmdbDetail(
  id: number,
  mediaType: TmdbMediaType,
  language: string,
  phase: 'core' | 'secondary',
): Promise<Record<string, unknown>> {
  const coreAppendMovie: AppendToResponseMovieKey[] = ['credits', 'images', 'external_ids', 'release_dates']
  const coreAppendTv: AppendToResponseTvKey[] = ['aggregate_credits', 'images', 'external_ids', 'content_ratings']
  const secondaryAppendMovie: AppendToResponseMovieKey[] = [
    'videos', 'reviews', 'recommendations', 'keywords', 'alternative_titles', 'watch/providers', 'similar',
  ]
  const secondaryAppendTv: AppendToResponseTvKey[] = [
    'videos', 'reviews', 'recommendations', 'keywords', 'alternative_titles', 'watch/providers', 'similar',
  ]

  const client = getTmdbClient()
  const data = mediaType === 'movie'
    ? await client.movies.details(id, phase === 'core' ? coreAppendMovie : secondaryAppendMovie, language)
    : await client.tvShows.details(id, phase === 'core' ? coreAppendTv : secondaryAppendTv, language)

  const raw = data as unknown as Record<string, unknown>
  const parsed = tmdbDetailSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('Invalid TMDB detail response')
  }
  return { ...raw, ...normalizeToMediaItem(raw, mediaType) }
}

/**
 * 按 TMDB ID 直接查找媒体（电影/剧集并行尝试）
 * 注：tmdb-ts 的 details 方法无 options 槽位，不支持 signal 取消/超时（与存量行为一致）
 * @param id - TMDB ID
 * @param language - 显示语言
 * @returns 命中的媒体条目（movie 与 tv 均可命中时都返回）
 */
export async function fetchTmdbById(
  id: number,
  language: string,
): Promise<TmdbMediaItem[]> {
  const client = getTmdbClient()
  const results = await Promise.allSettled([
    client.movies.details(id, [], language),
    client.tvShows.details(id, [], language),
  ])

  const items: TmdbMediaItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      const raw = r.value as unknown as Record<string, unknown>
      items.push(normalizeToMediaItem(raw, 'title' in raw ? 'movie' : 'tv'))
    }
  }
  return items
}

const tmdbPersonSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
})

/** 表演履历条目规范化（cast/crew 统一格式，含 TV 专属 episodeCount） */
function normalizeCast(items: Array<Record<string, unknown>>): PersonCastCredit[] {
  return items.map(item => {
    const mediaType: TmdbMediaType = item.media_type === 'tv' ? 'tv' : 'movie'
    return {
      id: item.id as number,
      mediaType,
      title: ((mediaType === 'movie' ? item.title : item.name) as string) || '',
      originalTitle: ((mediaType === 'movie' ? item.original_title : item.original_name) as string) || '',
      character: (item.character as string) || '',
      overview: (item.overview as string) || '',
      posterPath: (item.poster_path as string) || null,
      backdropPath: (item.backdrop_path as string) || null,
      releaseDate: ((mediaType === 'movie' ? item.release_date : item.first_air_date) as string) || '',
      voteAverage: (item.vote_average as number) || 0,
      voteCount: (item.vote_count as number) || 0,
      popularity: (item.popularity as number) || 0,
      genreIds: Array.isArray(item.genre_ids) ? item.genre_ids as number[] : [],
      originalLanguage: (item.original_language as string) || '',
      originCountry: Array.isArray(item.origin_country) ? item.origin_country as string[] : [],
      adult: Boolean(item.adult),
      episodeCount: (item.episode_count as number) || undefined,
    }
  })
}

/** 人物详情结构（person 基本信息 + 综合演职员 + 形象照） */
export interface TmdbPersonData {
  person: PersonDetails
  credits: PersonCombinedCredits
  images: PersonImages
}

/**
 * 获取人物详情（含综合演职员与形象照）
 * 注：tmdb-ts 的 people.details 方法无 options 槽位，不支持 signal 取消/超时（与存量行为一致）
 * @param personId - TMDB 人物 ID
 * @param language - 显示语言
 * @returns 结构化的基本信息/演职员/形象照
 */
export async function fetchTmdbPerson(
  personId: number,
  language: string,
): Promise<TmdbPersonData> {
  const client = getTmdbClient()
  const data = await client.people.details(personId, ['combined_credits', 'images'], language) as unknown as Record<string, unknown>

  const parsed = tmdbPersonSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error('Invalid TMDB person response')
  }

  const person: PersonDetails = {
    id: data.id as number,
    name: (data.name as string) || '',
    original_name: (data.original_name as string) || '',
    profile_path: (data.profile_path as string) || null,
    adult: Boolean(data.adult),
    known_for_department: (data.known_for_department as string) || '',
    gender: (data.gender as number) || 0,
    popularity: (data.popularity as number) || 0,
    birthday: (data.birthday as string) || null,
    deathday: (data.deathday as string) || null,
    also_known_as: Array.isArray(data.also_known_as) ? data.also_known_as as string[] : [],
    biography: (data.biography as string) || '',
    place_of_birth: (data.place_of_birth as string) || null,
    imdb_id: (data.imdb_id as string) || null,
    homepage: (data.homepage as string) || null,
  }

  const rawCredits = data.combined_credits as Record<string, unknown> | undefined
  const credits: PersonCombinedCredits = {
    cast: normalizeCast(Array.isArray(rawCredits?.cast) ? (rawCredits.cast as Array<Record<string, unknown>>) : []),
    crew: normalizeCast(Array.isArray(rawCredits?.crew) ? (rawCredits.crew as Array<Record<string, unknown>>) : []),
  }

  const rawImages = data.images as { profiles?: Array<Record<string, unknown>> } | undefined
  const images: PersonImages = {
    id: personId,
    profiles: (rawImages?.profiles || []).map(p => ({
      file_path: (p.file_path as string) || '',
      width: (p.width as number) || 0,
      height: (p.height as number) || 0,
      vote_average: (p.vote_average as number) || 0,
      vote_count: (p.vote_count as number) || 0,
    })),
  }

  return { person, credits, images }
}
