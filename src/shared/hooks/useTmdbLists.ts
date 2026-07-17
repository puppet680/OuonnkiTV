import { useEffect } from 'react'
import { useTmdbStore } from '../store/tmdbStore'

/**
 * 热映/热门 Hook
 */
export function useTmdbNowPlaying() {
  const movies = useTmdbStore(s => s.nowPlayingMovies)
  const tv = useTmdbStore(s => s.popularTv)
  const trending = useTmdbStore(s => s.trending)
  const loading = useTmdbStore(s => s.loading)
  const error = useTmdbStore(s => s.error)

  const fetchNowPlaying = useTmdbStore(s => s.fetchNowPlaying)
  const fetchTrending = useTmdbStore(s => s.fetchTrending)

  useEffect(() => {
    // 惰性加载，如果有数据暂不刷新，或者可以添加 forceRefresh 参数
    if (movies.length === 0) fetchNowPlaying()
    if (trending.length === 0) fetchTrending()
  }, [fetchNowPlaying, fetchTrending, movies.length, trending.length])

  return {
    movies,
    tv,
    trending,
    loading,
    error,
    refreshNowPlaying: fetchNowPlaying,
    refreshTrending: fetchTrending,
  }
}

/**
 * 电影榜单 Hook (正在热映/最受欢迎/口碑最佳/即将上映)
 */
export function useTmdbMovieLists() {
  const nowPlaying = useTmdbStore(s => s.nowPlayingMovies)
  const popular = useTmdbStore(s => s.popularMovies)
  const topRated = useTmdbStore(s => s.topRatedMovies)
  const upcoming = useTmdbStore(s => s.upcomingMovies)
  const loading = useTmdbStore(s => s.loading)

  const fetchNowPlaying = useTmdbStore(s => s.fetchNowPlaying)
  const fetchPopular = useTmdbStore(s => s.fetchPopularMovies)
  const fetchTopRated = useTmdbStore(s => s.fetchTopRatedMovies)
  const fetchUpcoming = useTmdbStore(s => s.fetchUpcomingMovies)

  useEffect(() => {
    if (nowPlaying.length === 0) fetchNowPlaying()
    if (popular.length === 0) fetchPopular()
    if (topRated.length === 0) fetchTopRated()
    if (upcoming.length === 0) fetchUpcoming()
  }, [
    nowPlaying.length,
    popular.length,
    topRated.length,
    upcoming.length,
    fetchNowPlaying,
    fetchPopular,
    fetchTopRated,
    fetchUpcoming,
  ])

  return {
    nowPlaying,
    popular,
    topRated,
    upcoming,
    loading,
    refreshNowPlaying: fetchNowPlaying,
    refreshPopular: fetchPopular,
    refreshTopRated: fetchTopRated,
    refreshUpcoming: fetchUpcoming,
  }
}

/**
 * 剧集榜单 Hook (今日播出/最受欢迎/口碑最佳)
 */
export function useTmdbTvLists() {
  const airingToday = useTmdbStore(s => s.airingTodayTv)
  const popular = useTmdbStore(s => s.popularTv)
  const topRated = useTmdbStore(s => s.topRatedTv)
  const loading = useTmdbStore(s => s.loading)

  const fetchAiringToday = useTmdbStore(s => s.fetchAiringTodayTv)
  const fetchPopular = useTmdbStore(s => s.fetchPopularTv)
  const fetchTopRated = useTmdbStore(s => s.fetchTopRatedTv)

  useEffect(() => {
    if (airingToday.length === 0) fetchAiringToday()
    if (popular.length === 0) fetchPopular()
    if (topRated.length === 0) fetchTopRated()
  }, [
    airingToday.length,
    popular.length,
    topRated.length,
    fetchAiringToday,
    fetchPopular,
    fetchTopRated,
  ])

  return {
    airingToday,
    popular,
    topRated,
    loading,
    refreshAiringToday: fetchAiringToday,
    refreshPopular: fetchPopular,
    refreshTopRated: fetchTopRated,
  }
}
