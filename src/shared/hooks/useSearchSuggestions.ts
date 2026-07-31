import { useQuery } from '@tanstack/react-query'
import { fetchTmdbPersonSearch, fetchTmdbSearch } from '@/shared/lib/api/tmdb'
import { useSettingStore } from '@/shared/store/settingStore'
import { isTmdbEnabled } from '@/shared/hooks/useTmdbMode'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import type { TmdbMediaItem } from '@/shared/types/tmdb'
import type { TmdbPersonResult } from '@/shared/types/tmdb'

// 搜索建议最大数量
const MAX_SUGGESTIONS = 9

/** 人物结果转为统一建议项（mediaType 运行时为 'person'，类型上仍归 TmdbMediaItem） */
function personToMediaItem(person: TmdbPersonResult): TmdbMediaItem {
  return {
    id: person.id,
    mediaType: 'person',
    title: person.name,
    originalTitle: person.name,
    overview: '',
    posterPath: person.profilePath,
    backdropPath: null,
    logoPath: null,
    releaseDate: '',
    voteAverage: 0,
    voteCount: 0,
    popularity: person.popularity,
    genreIds: [],
    originalLanguage: '',
    originCountry: [],
  } as unknown as TmdbMediaItem
}

/**
 * 搜索建议 hook（影视类型走 multi，人物类型走 people）
 * 防抖 100ms 与存量行为一致，空串/未启用 TMDB 时不发起请求
 * @param query - 当前输入内容
 * @param type - 搜索类型（media | person）
 * @returns 建议列表与加载态
 */
export function useSearchSuggestions(query: string, type?: string) {
  const debouncedQuery = useDebouncedValue(query, 100)
  const isPerson = type === 'person'
  const language = useSettingStore.getState().system.tmdbLanguage
  const includeAdult = !useSettingStore.getState().system.isAdultFilterEnabled

  const q = useQuery({
    queryKey: ['tmdb', 'suggestions', debouncedQuery, isPerson, language],
    queryFn: () =>
      isPerson
        ? fetchTmdbPersonSearch(debouncedQuery, 1, language, includeAdult)
            .then(r => r.items.map(personToMediaItem))
        : fetchTmdbSearch(debouncedQuery, 1, undefined, language, includeAdult)
            .then(r => r.items),
    enabled: isTmdbEnabled() && debouncedQuery.trim().length > 0,
    staleTime: 5 * 60_000,
  })

  return {
    suggestions: (q.data ?? []).slice(0, MAX_SUGGESTIONS),
    isLoading: q.isLoading,
  }
}
