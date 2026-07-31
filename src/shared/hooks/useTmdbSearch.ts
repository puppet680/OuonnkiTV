import { useCallback } from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { fetchTmdbSearch, fetchTmdbDiscover, fetchTmdbGenresAndCountries } from '@/shared/lib/api/tmdb'
import { fetchTmdbById } from '@/shared/lib/api/tmdb-detail'
import { useSettingStore } from '@/shared/store/settingStore'
import { filterAdultKeywords } from '@/shared/lib/tmdbFilters'
import type { TmdbFilterOptions } from '@/shared/types/tmdb'

/**
 * TMDB 搜索 Hook（分页追加；year 传给 API 做服务端年份过滤）
 * @param query - 搜索关键词
 * @param year - 可选年份（服务端过滤）
 * @param enabled - 是否发起请求（数字 ID 模式时关闭）
 * @returns useInfiniteQuery 结果，data.pages 为累积页（已做关键词过滤）
 */
export function useTmdbSearch(query: string, year?: number, enabled = true) {
  const language = useSettingStore(s => s.system.tmdbLanguage)
  const isAdultFilterEnabled = useSettingStore(s => s.system.isAdultFilterEnabled)
  const cmsFilterKeywords = useSettingStore(s => s.system.cmsFilterKeywords)
  const includeAdult = !isAdultFilterEnabled

  return useInfiniteQuery({
    queryKey: ['tmdb', 'search', query, year, language, includeAdult],
    queryFn: ({ pageParam, signal }) => fetchTmdbSearch(query, pageParam, year, language, includeAdult, signal),
    initialPageParam: 1,
    getNextPageParam: last =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    enabled: enabled && query.trim().length > 0,
    staleTime: 5 * 60_000,
    select: data => ({
      ...data,
      pages: data.pages.map(page => ({
        ...page,
        items: filterAdultKeywords(page.items, isAdultFilterEnabled, cmsFilterKeywords),
      })),
    }),
  })
}

/**
 * TMDB 发现 Hook（无搜索词时使用；filterOptions 变化自动重置并从第一页 refetch）
 * @param options - 筛选条件（进 queryKey）
 * @param enabled - 是否发起请求（有搜索词时关闭）
 * @returns useInfiniteQuery 结果，data.pages 为累积页
 */
export function useTmdbDiscover(options: TmdbFilterOptions, enabled = true) {
  const language = useSettingStore(s => s.system.tmdbLanguage)
  const networks = useSettingStore(s => s.system.varietyNetworks)

  return useInfiniteQuery({
    queryKey: ['tmdb', 'discover', options, language, networks],
    queryFn: ({ pageParam, signal }) => fetchTmdbDiscover(options, pageParam, language, networks, signal),
    initialPageParam: 1,
    getNextPageParam: last =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    enabled,
    staleTime: 5 * 60_000,
  })
}

/**
 * 按数字 ID 直接搜索媒体（电影/剧集并行尝试）
 * @param id - TMDB ID
 * @param enabled - 是否发起请求
 * @returns useQuery 结果，data 为命中条目
 */
export function useTmdbSearchById(id: number, enabled = true) {
  const language = useSettingStore(s => s.system.tmdbLanguage)
  return useQuery({
    queryKey: ['tmdb', 'by-id', id, language],
    queryFn: () => fetchTmdbById(id, language),
    enabled,
    staleTime: 5 * 60_000,
  })
}

/**
 * 分类/配置 Hook（genres 与国家地区，staleTime Infinity）
 */
export function useTmdbGenres() {
  const language = useSettingStore(s => s.system.tmdbLanguage)
  const query = useQuery({
    queryKey: ['tmdb', 'genres', language],
    queryFn: ({ signal }) => fetchTmdbGenresAndCountries(language, signal),
    staleTime: Infinity,
  })

  const data = query.data
  const getGenreName = useCallback(
    (id: number) => {
      const g = data?.movieGenres.find(g => g.id === id) || data?.tvGenres.find(g => g.id === id)
      return g ? g.name : 'Unknown'
    },
    [data],
  )

  return {
    movieGenres: data?.movieGenres ?? [],
    tvGenres: data?.tvGenres ?? [],
    countries: data?.countries ?? [],
    loading: query.isLoading,
    getGenreName,
  }
}
