import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTmdbRecommendations } from '@/shared/lib/api/tmdb'
import { useSettingStore } from '@/shared/store/settingStore'
import { useTmdbTrending } from '@/shared/hooks/useTmdbTrending'
import type { TmdbMediaType } from '@/shared/types/tmdb'

interface RecommendationSource {
  id: number
  mediaType: TmdbMediaType
}

const EMPTY_RECOMMENDATION_SOURCES: RecommendationSource[] = []

const buildRecommendationSourceKey = (source: RecommendationSource) => `${source.mediaType}:${source.id}`

export function selectRecommendationSource(
  previous: RecommendationSource | null,
  candidates: RecommendationSource[],
  randomFn: () => number = Math.random,
): RecommendationSource | null {
  if (candidates.length === 0) return null

  if (previous) {
    const previousKey = buildRecommendationSourceKey(previous)
    const exists = candidates.some(candidate => buildRecommendationSourceKey(candidate) === previousKey)
    if (exists) return previous
  }

  const randomIndex = Math.floor(randomFn() * candidates.length)
  const safeIndex = Math.max(0, Math.min(candidates.length - 1, randomIndex))
  return candidates[safeIndex]
}

export function findNextRecommendationSource(
  candidates: RecommendationSource[],
  attemptedSourceKeys: Set<string>,
): RecommendationSource | null {
  const next = candidates.find(candidate => !attemptedSourceKeys.has(buildRecommendationSourceKey(candidate)))
  return next || null
}

/**
 * 猜你喜欢 Hook
 * 优先从传入的 TMDB 候选来源中随机选择一条；若没有候选来源则回退到 trending。
 * 候选源返回空推荐时自动降级切换到下一个未尝试的候选源。
 * @param preferredSources - 收藏/历史等偏好来源（空则回退 trending）
 * @returns 推荐列表与加载态
 */
export function useTmdbRecommendations(
  preferredSources: RecommendationSource[] = EMPTY_RECOMMENDATION_SOURCES,
) {
  const language = useSettingStore(s => s.system.tmdbLanguage)
  const { data: trending } = useTmdbTrending()
  const [selectedSource, setSelectedSource] = useState<RecommendationSource | null>(null)
  const attemptedSourceKeysRef = useRef<Set<string>>(new Set())

  const sourceCandidates = useMemo<RecommendationSource[]>(() => {
    const sourceMap = new Map<string, RecommendationSource>()
    if (preferredSources.length > 0) {
      preferredSources.forEach(source => sourceMap.set(buildRecommendationSourceKey(source), source))
      return Array.from(sourceMap.values())
    }
    ;(trending ?? []).forEach(item => {
      sourceMap.set(buildRecommendationSourceKey({ id: item.id, mediaType: item.mediaType }), {
        id: item.id,
        mediaType: item.mediaType,
      })
    })
    return Array.from(sourceMap.values())
  }, [preferredSources, trending])

  // 候选源变化时重置尝试集合，尽量复用上次选中源避免随机抖动
  useEffect(() => {
    attemptedSourceKeysRef.current = new Set()
    setSelectedSource(previous => selectRecommendationSource(previous, sourceCandidates))
  }, [sourceCandidates])

  const recommendationsQuery = useQuery({
    queryKey: ['tmdb', 'recommendations', selectedSource?.id, selectedSource?.mediaType, language],
    queryFn: ({ signal }) => fetchTmdbRecommendations(selectedSource!.id, selectedSource!.mediaType, language, signal),
    enabled: !!selectedSource,
    staleTime: 30 * 60_000,
    retry: 2,
  })

  // 标记当前源已尝试，避免同一源反复请求
  useEffect(() => {
    if (!selectedSource) return
    attemptedSourceKeysRef.current.add(buildRecommendationSourceKey(selectedSource))
  }, [selectedSource])

  // 当前源无推荐时降级切到下一个未尝试候选源
  useEffect(() => {
    if (!selectedSource || recommendationsQuery.isPending) return
    if ((recommendationsQuery.data ?? []).length > 0) return
    const next = findNextRecommendationSource(sourceCandidates, attemptedSourceKeysRef.current)
    if (next) setSelectedSource(next)
  }, [selectedSource, recommendationsQuery.isPending, recommendationsQuery.data, sourceCandidates])

  return {
    recommendations: recommendationsQuery.data ?? [],
    loading: recommendationsQuery.isLoading,
  }
}
