import { useCallback, useEffect, useState } from 'react'
import type { AppendToResponseMovieKey, AppendToResponseTvKey } from 'tmdb-ts'
import { getTmdbClient, normalizeToMediaItem } from '../lib/tmdb'
import { useSettingStore } from '../store/settingStore'
import type { TmdbMediaType, TmdbMovieDetail, TmdbTvDetail } from '../types/tmdb'
import type { PersonCombinedCredits, PersonDetails, PersonImages } from '../types/person'

const detailCache = new Map<string, unknown>()

/**
 * 详情 Hook - 引入核心数据与次要数据分阶段加载及缓存机制
 */
export function useTmdbDetail<T extends TmdbMovieDetail | TmdbTvDetail>(
  id: number | undefined,
  mediaType: TmdbMediaType,
  language = useSettingStore.getState().system.tmdbLanguage,
) {
  const cacheKey = `${mediaType}-${id}-${language}`;

  const [detail, setDetail] = useState<T | null>((detailCache.get(cacheKey) as T) || null);
  const [loading, setLoading] = useState(!detailCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (isInitial = true) => {
    if (!id) return;

    if (isInitial && !detailCache.has(cacheKey)) {
      setLoading(true);
    }
    setError(null);
    const client = getTmdbClient();

    try {
      // 1. 核心数据类型定义
      const coreAppendMovie: AppendToResponseMovieKey[] = ['credits', 'images', 'external_ids', 'release_dates'];
      const coreAppendTv: AppendToResponseTvKey[] = ['aggregate_credits', 'images', 'external_ids', 'content_ratings'];

      // 2. 次要数据类型定义
      const secondaryAppendMovie: AppendToResponseMovieKey[] = [
        'videos', 'reviews', 'recommendations', 'keywords', 'alternative_titles', 'watch/providers', 'similar',
      ];
      const secondaryAppendTv: AppendToResponseTvKey[] = [
        'videos', 'reviews', 'recommendations', 'keywords', 'alternative_titles', 'watch/providers', 'similar',
      ];

      // 执行核心请求
      const data = mediaType === 'movie'
        ? await client.movies.details(id, coreAppendMovie, language)
        : await client.tvShows.details(id, coreAppendTv, language);

      const rawData = data as Record<string, unknown>;
      const base = normalizeToMediaItem(rawData, mediaType);
      const fullDetail = { ...rawData, ...base } as T;

      setDetail(fullDetail);
      detailCache.set(cacheKey, fullDetail);
      setLoading(false);

      // 3. 异步静默加载剩余数据
      void (async () => {
        try {
          const secondaryData = mediaType === 'movie'
            ? await client.movies.details(id, secondaryAppendMovie, language)
            : await client.tvShows.details(id, secondaryAppendTv, language);

          const merged = { ...fullDetail, ...(secondaryData as Record<string, unknown>) } as T;
          setDetail(merged);
          detailCache.set(cacheKey, merged);
        } catch (e) {
          console.warn('[TMDB] Secondary data fetch failed', e);
        }
      })();

    } catch (err: unknown) {
      setError((err as Error).message || 'Fetch detail failed');
      setLoading(false);
    }
  }, [id, mediaType, language, cacheKey]);

  useEffect(() => {
    if (id) fetchDetail(true);
  }, [id, fetchDetail]);

  return { detail, loading, error, refetch: () => fetchDetail(false) };
}

const personCache = new Map<string, unknown>()

/**
 * 人物详情 Hook
 */
export function useTmdbPerson(personId: number | undefined) {
  const language = useSettingStore.getState().system.tmdbLanguage
  const cacheKey = `person-${personId}-${language}`

  const [person, setPerson] = useState<PersonDetails | null>(
    (personCache.get(cacheKey) as PersonDetails) || null,
  )
  const [credits, setCredits] = useState<PersonCombinedCredits>({ cast: [], crew: [] })
  const [images, setImages] = useState<PersonImages | null>(null)
  const [loading, setLoading] = useState(!personCache.has(cacheKey))
  const [error, setError] = useState<string | null>(null)

  const fetchPerson = useCallback(async () => {
    if (!personId) return
    setLoading(true)
    setError(null)

    try {
      const client = getTmdbClient()
      const data = await client.people.details(
        personId,
        ['combined_credits', 'images'],
        language,
      ) as Record<string, unknown>

      // 提取 person details
      const details: PersonDetails = {
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

      // 提取 combined_credits
      const rawCredits = data.combined_credits as Record<string, unknown> | undefined
      const rawCast = (rawCredits?.cast as Array<Record<string, unknown>>) || []
      const rawCrew = (rawCredits?.crew as Array<Record<string, unknown>>) || []

      const normalizeCast = (items: Array<Record<string, unknown>>) =>
        items.map(item => {
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

      const cast = normalizeCast(rawCast)
      const crew = normalizeCast(rawCrew)

      // 提取 images
      const rawImages = data.images as { profiles?: Array<Record<string, unknown>> } | undefined
      const profileImages: PersonImages = {
        id: personId,
        profiles: (rawImages?.profiles || []).map(p => ({
          file_path: (p.file_path as string) || '',
          width: (p.width as number) || 0,
          height: (p.height as number) || 0,
          vote_average: (p.vote_average as number) || 0,
          vote_count: (p.vote_count as number) || 0,
        })),
      }

      setPerson(details)
      setCredits({ cast, crew })
      setImages(profileImages)
      personCache.set(cacheKey, details)
      setLoading(false)
    } catch (err: unknown) {
      setError((err as Error).message || '获取人物详情失败')
      setLoading(false)
    }
  }, [personId, language, cacheKey])

  useEffect(() => {
    if (personId) fetchPerson()
  }, [personId, fetchPerson])

  return { person, credits, images, loading, error, refetch: fetchPerson }
}
