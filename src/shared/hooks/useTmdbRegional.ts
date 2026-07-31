import { useQuery } from '@tanstack/react-query'
import { fetchTmdbRegional } from '@/shared/lib/api/tmdb'
import { useSettingStore } from '@/shared/store/settingStore'

/**
 * 区域发现 Hook — 按用户偏好（欧美/大陆）获取首页数据
 * @returns 各类别媒体数据及加载状态
 */
export function useTmdbRegionalDiscover() {
  const language = useSettingStore(s => s.system.tmdbLanguage)
  const networks = useSettingStore(s => s.system.varietyNetworks)
  const query = useQuery({
    queryKey: ['tmdb', 'regional', networks, language],
    queryFn: ({ signal }) => fetchTmdbRegional(networks, language, signal),
    staleTime: 30 * 60_000,
    retry: 2,
  })

  const data = query.data
  return {
    tvShows: data?.regionalTvShows ?? [],
    movies: data?.regionalMovies ?? [],
    animated: data?.regionalAnimated ?? [],
    variety: data?.regionalVariety ?? [],
    featured: data?.regionalFeatured ?? [],
    nowPlaying: data?.regionalNowPlaying ?? [],
    popularMovies: data?.regionalPopularMovies ?? [],
    topRatedMovies: data?.regionalTopRatedMovies ?? [],
    upcoming: data?.regionalUpcoming ?? [],
    popularTv: data?.regionalPopularTv ?? [],
    topRatedTv: data?.regionalTopRatedTv ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message || '区域发现失败' : null,
  }
}
