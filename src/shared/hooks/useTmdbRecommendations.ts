import { useEffect, useMemo, useRef, useState } from 'react'
import { useTmdbStore } from '../store/tmdbStore'
import type { TmdbMediaType } from '../types/tmdb'

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
 * 为避免重渲染时随机抖动，候选集合不变时会优先复用上一次已选中的来源。
 */
export function useTmdbRecommendations(
  preferredSources: RecommendationSource[] = EMPTY_RECOMMENDATION_SOURCES,
) {
  const recommendations = useTmdbStore(s => s.recommendations)
  const loading = useTmdbStore(s => s.loading.recommendations)
  const trending = useTmdbStore(s => s.trending)

  const fetchRecommendations = useTmdbStore(s => s.fetchRecommendations)
  // 从 Zustand 读取上次缓存的推荐源（拆成三个独立 selector，避免对象引用变化导致死循环）
  const cachedSourceId = useTmdbStore(s => s.recommendationSourceId)
  const cachedSourceMediaType = useTmdbStore(s => s.recommendationSourceMediaType)
  const cachedHasRecommendations = useTmdbStore(s => s.recommendations.length > 0)
  const attemptedSourceKeysRef = useRef<Set<string>>(new Set())

  const sourceCandidates = useMemo<RecommendationSource[]>(() => {
    const sourceMap = new Map<string, RecommendationSource>()

    if (preferredSources.length > 0) {
      preferredSources.forEach(source => {
        sourceMap.set(buildRecommendationSourceKey(source), source)
      })
      return Array.from(sourceMap.values())
    }

    trending.forEach(item => {
      sourceMap.set(buildRecommendationSourceKey({ id: item.id, mediaType: item.mediaType }), {
        id: item.id,
        mediaType: item.mediaType,
      })
    })
    return Array.from(sourceMap.values())
  }, [preferredSources, trending])

  // 初始化 selectedSource：优先复用 Zustand 缓存的上次选中源，避免随机重抽
  const [selectedSource, setSelectedSource] = useState<RecommendationSource | null>(() => {
    if (cachedHasRecommendations && cachedSourceId && cachedSourceMediaType) {
      const cached = { id: cachedSourceId, mediaType: cachedSourceMediaType as 'movie' | 'tv' }
      return sourceCandidates.some(
        c => c.id === cached.id && c.mediaType === cached.mediaType,
      )
        ? cached
        : null
    }
    return null
  })

  useEffect(() => {
    attemptedSourceKeysRef.current = new Set()
    setSelectedSource(previous => selectRecommendationSource(previous, sourceCandidates))
  }, [sourceCandidates])

  useEffect(() => {
    if (!selectedSource) return

    const sourceKey = buildRecommendationSourceKey(selectedSource)
    if (attemptedSourceKeysRef.current.has(sourceKey)) {
      return
    }

    const currentState = useTmdbStore.getState()
    const sourceUnchangedAndHasData =
      currentState.recommendationSourceId === selectedSource.id &&
      currentState.recommendationSourceMediaType === selectedSource.mediaType &&
      currentState.recommendations.length > 0
    if (sourceUnchangedAndHasData) {
      attemptedSourceKeysRef.current.add(sourceKey)
      return
    }

    attemptedSourceKeysRef.current.add(sourceKey)
    let cancelled = false

    const fetchBySource = async () => {
      try {
        await fetchRecommendations(selectedSource.id, selectedSource.mediaType)
      } catch {
        // fetchRecommendations 已在 store 内处理错误状态，这里仅做降级切源。
      }

      if (cancelled) return

      const latestState = useTmdbStore.getState()
      const hasDataFromSelectedSource =
        latestState.recommendationSourceId === selectedSource.id &&
        latestState.recommendationSourceMediaType === selectedSource.mediaType &&
        latestState.recommendations.length > 0
      if (hasDataFromSelectedSource) {
        return
      }

      const nextSource = findNextRecommendationSource(sourceCandidates, attemptedSourceKeysRef.current)
      if (nextSource) {
        setSelectedSource(nextSource)
      }
    }

    void fetchBySource()

    return () => {
      cancelled = true
    }
  }, [
    selectedSource,
    fetchRecommendations,
    sourceCandidates,
  ])

  return {
    recommendations,
    loading,
    refreshRecommendations: fetchRecommendations,
  }
}
