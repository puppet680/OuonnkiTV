import { useCallback } from 'react'
import type { DetailResult } from '@ouonnki/cms-core'
import type { TmdbMediaItem, TmdbMediaType } from '@/shared/types/tmdb'
import type { VideoItem } from '@/shared/types/video'
import { useFavoritesStore } from '@/features/favorites/store/favoritesStore'
import { toast } from 'sonner'

interface UsePlayerFavoritesParams {
  isCmsRoute: boolean
  isTmdbRoute: boolean
  tmdbMediaType: TmdbMediaType | null
  parsedTmdbId: number
  resolvedSourceCode: string
  resolvedVodId: string
  detail: DetailResult | null
  cmsFavoriteActive: boolean
  tmdbFavoriteActive: boolean
  tmdbDetail: {
    title?: string
    originalTitle?: string
    overview?: string
    posterPath?: string | null
    backdropPath?: string | null
    logoPath?: string | null
    releaseDate?: string
    voteAverage?: number
    voteCount?: number
    popularity?: number
    genreIds?: number[]
    originalLanguage?: string
    originCountry?: string[]
  } | null
}

/**
 * 收藏切换（CMS 源收藏 / TMDB 媒体收藏），成功后 toast 提示
 * @returns 两个切换回调，按当前路由模式分发
 */
export function usePlayerFavorites({
  isCmsRoute,
  isTmdbRoute,
  tmdbMediaType,
  parsedTmdbId,
  resolvedSourceCode,
  resolvedVodId,
  detail,
  cmsFavoriteActive,
  tmdbFavoriteActive,
  tmdbDetail,
}: UsePlayerFavoritesParams) {
  const toggleCmsFavorite = useFavoritesStore(state => state.toggleCmsFavorite)
  const toggleTmdbFavorite = useFavoritesStore(state => state.toggleTmdbFavorite)

  const handleToggleCmsFavorite = useCallback(() => {
    if (!isCmsRoute || !resolvedVodId || !resolvedSourceCode) return
    const video: VideoItem = {
      vod_id: resolvedVodId,
      vod_name: detail?.videoInfo?.title || '未知视频',
      vod_pic: detail?.videoInfo?.cover,
      vod_year: detail?.videoInfo?.year,
      vod_area: detail?.videoInfo?.area,
      vod_remarks: detail?.videoInfo?.remarks,
      vod_content: detail?.videoInfo?.desc,
      type_name: detail?.videoInfo?.type,
      source_code: resolvedSourceCode,
      source_name: detail?.videoInfo?.source_name || '',
    }
    toggleCmsFavorite(video)
    toast.success(cmsFavoriteActive ? '已取消收藏' : '已加入收藏')
  }, [
    cmsFavoriteActive,
    detail?.videoInfo,
    isCmsRoute,
    resolvedSourceCode,
    resolvedVodId,
    toggleCmsFavorite,
  ])

  const handleToggleTmdbFavorite = useCallback(() => {
    if (!isTmdbRoute || !tmdbMediaType || parsedTmdbId <= 0) return
    const tmdbMedia: TmdbMediaItem = {
      id: parsedTmdbId,
      mediaType: tmdbMediaType,
      title: tmdbDetail?.title || '未知视频',
      originalTitle: tmdbDetail?.originalTitle || tmdbDetail?.title || '未知视频',
      overview: tmdbDetail?.overview || '',
      posterPath: tmdbDetail?.posterPath || null,
      backdropPath: tmdbDetail?.backdropPath || null,
      logoPath: tmdbDetail?.logoPath || null,
      releaseDate: tmdbDetail?.releaseDate || '',
      voteAverage: tmdbDetail?.voteAverage || 0,
      voteCount: tmdbDetail?.voteCount || 0,
      popularity: tmdbDetail?.popularity || 0,
      genreIds: tmdbDetail?.genreIds || [],
      originalLanguage: tmdbDetail?.originalLanguage || '',
      originCountry: tmdbDetail?.originCountry || [],
    }
    toggleTmdbFavorite(tmdbMedia)
    toast.success(tmdbFavoriteActive ? '已取消收藏' : '已加入收藏')
  }, [
    isTmdbRoute,
    parsedTmdbId,
    tmdbFavoriteActive,
    tmdbMediaType,
    tmdbDetail,
    toggleTmdbFavorite,
  ])

  return { handleToggleCmsFavorite, handleToggleTmdbFavorite }
}
