import { useEffect } from 'react'
import { useTmdbStore } from '../store/tmdbStore'

/**
 * 区域发现 Hook — 按用户偏好（欧美/大陆）获取首页数据
 * @returns 各类别媒体数据及加载状态
 */
export function useTmdbRegionalDiscover() {
  const cache = useTmdbStore(s => s.regionCache['default'])
  const loading = useTmdbStore(s => s.regionalLoading)
  const error = useTmdbStore(s => s.error)
  const fetchRegionalDiscover = useTmdbStore(s => s.fetchRegionalDiscover)

  useEffect(() => {
    fetchRegionalDiscover()
  }, [fetchRegionalDiscover])

  return {
    tvShows: cache?.regionalTvShows ?? [],
    movies: cache?.regionalMovies ?? [],
    animated: cache?.regionalAnimated ?? [],
    variety: cache?.regionalVariety ?? [],
    featured: cache?.regionalFeatured ?? [],
    nowPlaying: cache?.regionalNowPlaying ?? [],
    popularMovies: cache?.regionalPopularMovies ?? [],
    topRatedMovies: cache?.regionalTopRatedMovies ?? [],
    upcoming: cache?.regionalUpcoming ?? [],
    popularTv: cache?.regionalPopularTv ?? [],
    topRatedTv: cache?.regionalTopRatedTv ?? [],
    loading,
    error,
  }
}
