import { useCallback, useEffect, useRef, useState, useDeferredValue } from 'react'
import type {
  SearchProgressEvent,
  SearchResultEvent,
  SearchStartEvent,
  VideoItem,
  VideoSource,
} from '@ouonnki/cms-core'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import { useCmsClient } from '@/shared/hooks'
import { useApiStore } from '@/shared/store/apiStore'
import { extractSubscriptionId, useSubscriptionStore } from '@/shared/store/subscriptionStore'
import { useSettingStore } from '@/shared/store/settingStore'
import { useTmdbMatchCacheStore } from '@/shared/store/tmdbMatchCacheStore'
import {
  buildPlaylistMatches,
  isEnglishText,
  type PlaylistMatchItem,
  type SeasonSourceMatches,
  type SourceBestMatch,
} from './playlistMatcher'
import type { DetailSeason } from './types'
import { COUNTRY_CHINESE_NAMES } from '@/shared/constants/countries'

interface UsePlaylistMatchesParams {
  active: boolean
  tmdbType: TmdbMediaType
  tmdbId: number
  title: string
  alternativeTitles?: string[]
  releaseDate?: string
  seasons: DetailSeason[]
  originCountry?: string[]
  genres?: Array<{ id: number; name: string }>
}

export interface PlaylistMatchesProgress {
  phase: 'idle' | 'search' | 'match' | 'complete'
  completed: number
  total: number
  currentSourceName: string
  currentSourceId: string
  lastEvent: 'idle' | 'start' | 'progress' | 'result' | 'complete'
  lastEventAt: number | null
  lastResultSourceName: string
  lastResultSourceId: string
  lastResultCount: number
}

interface PlaylistMatchesState {
  loading: boolean
  error: string | null
  searched: boolean
  searchedKeyword: string
  progress: PlaylistMatchesProgress
  startedAt: number | null
  completedAt: number | null
  candidates: PlaylistMatchItem[]
  movieSourceMatches: SourceBestMatch[]
  seasonSourceMatches: SeasonSourceMatches[]
}

const initialState: PlaylistMatchesState = {
  loading: false,
  error: null,
  searched: false,
  searchedKeyword: '',
  progress: {
    phase: 'idle',
    completed: 0,
    total: 0,
    currentSourceName: '',
    currentSourceId: '',
    lastEvent: 'idle',
    lastEventAt: null,
    lastResultSourceName: '',
    lastResultSourceId: '',
    lastResultCount: 0,
  },
  startedAt: null,
  completedAt: null,
  candidates: [],
  movieSourceMatches: [],
  seasonSourceMatches: [],
}

const TMDB_MATCH_CACHE_MAX_ENTRIES = 200

const normalizeCacheText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

const buildSourceSignature = (sources: VideoSource[]) =>
  sources
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(source => {
      const updatedAt =
        source.updatedAt instanceof Date
          ? source.updatedAt.getTime()
          : source.updatedAt
            ? new Date(source.updatedAt).getTime()
            : 0
      return [
        source.id,
        source.url || '',
        source.detailUrl || '',
        source.timeout ?? '',
        source.retry ?? '',
        Number.isFinite(updatedAt) ? updatedAt : 0,
      ].join('|')
    })
    .join(';;')

export function usePlaylistMatches({
  active,
  tmdbType,
  tmdbId,
  title,
  alternativeTitles,
  releaseDate,
  seasons,
  originCountry,
  genres,
}: UsePlaylistMatchesParams) {
  const cmsClient = useCmsClient()
  const tmdbMatchCacheTTLHours = useSettingStore(state => state.playback.tmdbMatchCacheTTLHours)
  const getTmdbMatchCacheEntry = useTmdbMatchCacheStore(state => state.getEntry)
  const setTmdbMatchCacheEntry = useTmdbMatchCacheStore(state => state.setEntry)
  const pruneTmdbMatchCache = useTmdbMatchCacheStore(state => state.prune)

  // ponytail: getState() to keep runSearch stable when only isEnabled toggles
  const getEnabledSources = () => {
    const all = useApiStore.getState().videoAPIs.filter(s => s.isEnabled)
    const subs = useSubscriptionStore.getState().subscriptions
    return all.filter(s => {
      const subId = extractSubscriptionId(s.id)
      if (!subId) return true
      const sub = subs.find(sub => sub.id === subId)
      return sub ? sub.isEnabled : true
    })
  }

  const [state, setState] = useState<PlaylistMatchesState>(initialState)
  const abortRef = useRef<AbortController | null>(null)
  const searchKeyRef = useRef('')
  const sessionRef = useRef<{
    token: string
    keyword: string
    sourceIdSet: Set<string>
  } | null>(null)
  const uniqueMapRef = useRef<Map<string, VideoItem>>(new Map())
  const recomputeTimerRef = useRef<number | null>(null)
  const unsubRef = useRef<Array<() => void>>([])
  // Track accumulated item count to trigger deferred fuse computation
  const [accumulatedVersion, setAccumulatedVersion] = useState(0)
  const deferredAccumulatedVersion = useDeferredValue(accumulatedVersion)
  const isFuseStale = accumulatedVersion !== deferredAccumulatedVersion
  const isFuseStaleRef = useRef(false)
  isFuseStaleRef.current = isFuseStale

  const clearRecomputeTimer = useCallback(() => {
    if (!recomputeTimerRef.current) return
    window.clearTimeout(recomputeTimerRef.current)
    recomputeTimerRef.current = null
  }, [])

  const clearSubscriptions = useCallback(() => {
    unsubRef.current.forEach(unsub => unsub())
    unsubRef.current = []
  }, [])

  const scheduleRecompute = useCallback(
    (params: {
      keyword: string
      releaseYear?: string
      sourceMetaList: Array<{ id: string; name: string }>
    }) => {
      clearRecomputeTimer()

      recomputeTimerRef.current = window.setTimeout(() => {
        if (isFuseStaleRef.current) {
          // Items are still being accumulated (deferred value hasn't caught up),
          // reschedule to avoid blocking the main thread with CPU-intensive Fuse matching
          scheduleRecompute(params)
          return
        }
        const items = Array.from(uniqueMapRef.current.values())
        const { candidates, movieSourceMatches, seasonSourceMatches } = buildPlaylistMatches({
          mediaType: tmdbType,
          items,
          title: params.keyword,
          alternativeTitles,
          releaseYear: params.releaseYear,
          seasons,
          sources: params.sourceMetaList,
        })

        setState(prev => ({
          ...prev,
          candidates,
          movieSourceMatches,
          seasonSourceMatches,
        }))
      }, 160)
    },
    [clearRecomputeTimer, alternativeTitles, seasons, tmdbType],
  )

  const runSearch = useCallback(
    async (force = false) => {
      const keyword = title.trim()
      const releaseYear = releaseDate ? releaseDate.slice(0, 4) : undefined
      const area = originCountry?.[0] ? COUNTRY_CHINESE_NAMES[originCountry[0]] : undefined
      const classParams = genres?.map(g => g.name).filter(Boolean)
      const normalizedKeyword = normalizeCacheText(keyword)
      const sourceSignature = buildSourceSignature(getEnabledSources())
      // 季列表也参与缓存 key：episode_groups 聚合后季数会变（如 1→3 季），否则命中旧缓存返回过期季
      const seasonSignature = seasons
        .filter(s => s.season_number > 0)
        .map(s => `${s.season_number}:${s.episode_count}`)
        .join(',')
      const currentKey = [
        tmdbType,
        tmdbId,
        normalizedKeyword,
        releaseYear || '',
        seasonSignature,
        sourceSignature,
      ].join('::')

      if (!keyword) {
        setState(prev => ({
          ...prev,
          loading: false,
          searched: true,
          error: '当前条目缺少标题，无法搜索播放资源',
        }))
        return
      }

      if (getEnabledSources().length === 0) {
        setState(prev => ({
          ...prev,
          loading: false,
          searched: true,
          searchedKeyword: keyword,
          error: '当前没有启用的 CMS 视频源，请先到设置中启用视频源',
          progress: {
            phase: 'idle',
            completed: 0,
            total: 0,
            currentSourceName: '',
            currentSourceId: '',
            lastEvent: 'idle',
            lastEventAt: null,
            lastResultSourceName: '',
            lastResultSourceId: '',
            lastResultCount: 0,
          },
          startedAt: null,
          completedAt: null,
          candidates: [],
          movieSourceMatches: [],
          seasonSourceMatches: [],
        }))
        return
      }

      if (!force && searchKeyRef.current === currentKey && state.searched) {
        return
      }

      if (!force) {
        const cachedEntry = getTmdbMatchCacheEntry(currentKey, tmdbMatchCacheTTLHours)
        if (cachedEntry) {
          abortRef.current?.abort()
          clearSubscriptions()
          clearRecomputeTimer()
          searchKeyRef.current = currentKey
          setState(prev => ({
            ...prev,
            loading: false,
            error: null,
            searched: true,
            searchedKeyword: cachedEntry.payload.searchedKeyword,
            progress: {
              phase: 'complete',
              completed: 0,
              total: 0,
              currentSourceName: '',
              currentSourceId: '',
              lastEvent: 'complete',
              lastEventAt: Date.now(),
              lastResultSourceName: '',
              lastResultSourceId: '',
              lastResultCount: 0,
            },
            startedAt: null,
            completedAt: null,
            candidates: cachedEntry.payload.candidates,
            movieSourceMatches: cachedEntry.payload.movieSourceMatches,
            seasonSourceMatches: cachedEntry.payload.seasonSourceMatches,
          }))
          return
        }
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      searchKeyRef.current = currentKey

      clearSubscriptions()
      uniqueMapRef.current = new Map()
      setAccumulatedVersion(0)

      const sourceMetaList = getEnabledSources().map(source => ({
        id: source.id,
        name: source.name || source.id || '未知源',
      }))
      const sessionToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      sessionRef.current = {
        token: sessionToken,
        keyword,
        sourceIdSet: new Set(sourceMetaList.map(source => source.id)),
      }

      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
        searched: true,
        searchedKeyword: keyword,
        startedAt: Date.now(),
        completedAt: null,
        progress: {
          phase: 'search',
          completed: 0,
          total: getEnabledSources().length,
          currentSourceName: '',
          currentSourceId: '',
          lastEvent: 'start',
          lastEventAt: Date.now(),
          lastResultSourceName: '',
          lastResultSourceId: '',
          lastResultCount: 0,
        },
        candidates: [],
        movieSourceMatches: [],
        seasonSourceMatches: [],
      }))

      try {
        const isSameSources = (sources: VideoSource[]) => {
          const session = sessionRef.current
          if (!session) return false
          if (sources.length !== session.sourceIdSet.size) return false
          return sources.every(source => session.sourceIdSet.has(source.id))
        }

        const onStart = (event: SearchStartEvent) => {
          const session = sessionRef.current
          if (!session || session.token !== sessionToken) return
          if (event.query !== session.keyword) return
          if (!isSameSources(event.sources)) return

          setState(prev => ({
            ...prev,
            progress: {
              ...prev.progress,
              phase: 'search',
              lastEvent: 'start',
              lastEventAt: Date.now(),
            },
          }))
        }

        const onProgress = (event: SearchProgressEvent) => {
          const session = sessionRef.current
          if (!session || session.token !== sessionToken) return
          if (!session.sourceIdSet.has(event.source.id)) return

          setState(prev => ({
            ...prev,
            progress: {
              phase: 'search',
              completed: event.completed,
              total: event.total,
              currentSourceName: event.source.name || event.source.id || '未知源',
              currentSourceId: event.source.id,
              lastEvent: 'progress',
              lastEventAt: Date.now(),
              lastResultSourceName: prev.progress.lastResultSourceName,
              lastResultSourceId: prev.progress.lastResultSourceId,
              lastResultCount: prev.progress.lastResultCount,
            },
          }))
        }

        const onResult = (event: SearchResultEvent) => {
          const session = sessionRef.current
          if (!session || session.token !== sessionToken) return
          if (!session.sourceIdSet.has(event.source.id)) return

          setState(prev => ({
            ...prev,
            progress: {
              ...prev.progress,
              phase: 'match',
              lastEvent: 'result',
              lastEventAt: Date.now(),
              lastResultSourceName: event.source.name || event.source.id || '未知源',
              lastResultSourceId: event.source.id,
              lastResultCount: event.items.length,
            },
          }))

          let hasNewItems = false
          event.items.forEach(item => {
            const key = `${item.source_code || 'unknown'}::${item.vod_id}`
            if (!uniqueMapRef.current.has(key)) {
              uniqueMapRef.current.set(key, item)
              hasNewItems = true
            }
          })

          if (hasNewItems) {
            setAccumulatedVersion(v => v + 1)
          }

          scheduleRecompute({ keyword, releaseYear, sourceMetaList })
        }

        const onComplete = () => {
          const session = sessionRef.current
          if (!session || session.token !== sessionToken) return

          setState(prev => ({
            ...prev,
            progress: {
              ...prev.progress,
              phase: 'match',
              lastEvent: 'complete',
              lastEventAt: Date.now(),
            },
          }))
          scheduleRecompute({ keyword, releaseYear, sourceMetaList })
        }

        unsubRef.current = [
          cmsClient.on('search:start', onStart),
          cmsClient.on('search:progress', onProgress),
          cmsClient.on('search:result', onResult),
          cmsClient.on('search:complete', onComplete),
        ]

        // 搜索策略
        const needsFallbackSearch = async () => {
          const items = Array.from(uniqueMapRef.current.values())
          if (items.length === 0) return true

          const { movieSourceMatches, seasonSourceMatches } = buildPlaylistMatches({
            mediaType: tmdbType,
            items,
            title: keyword,
            alternativeTitles,
            releaseYear,
            seasons,
            sources: sourceMetaList,
          })

          const allMatches = movieSourceMatches.length > 0
            ? movieSourceMatches
            : seasonSourceMatches.length > 0
              ? seasonSourceMatches.flatMap(s => s.sourceMatches)
              : []

          const bestScore = allMatches.length > 0
            ? Math.max(...allMatches.map(m => m.bestMatch?.score ?? 0))
            : 0

          const lowScoreCount = allMatches.filter(m => (m.bestMatch?.score ?? 0) < 80).length
          return bestScore < 85 || lowScoreCount > allMatches.length / 2
        }

        // 回退关键词：译名（去重）
        const fallbackKeywords = [
          ...new Set((alternativeTitles || []).filter((v): v is string => !!v?.trim())),
        ]

        const isTitleEnglish = isEnglishText(keyword)
        let fallbackAttempted = false

        if (keyword.length < 2 && fallbackKeywords.length > 0) {
          // 短标题：直接用回退关键词搜索
          fallbackAttempted = true
          await Promise.all(
            fallbackKeywords.map(altKwd =>
              cmsClient.aggregatedSearch(altKwd, getEnabledSources(), 1, controller.signal, area, classParams).catch(() => {}),
            ),
          )
        } else if (isTitleEnglish && fallbackKeywords.length > 0) {
          // 主标题为全英文：并发搜索 title + 所有别名，不等回退
          fallbackAttempted = true
          await Promise.all([
            cmsClient.aggregatedSearch(keyword, getEnabledSources(), 1, controller.signal, area, classParams).catch(() => {}),
            ...fallbackKeywords.map(altKwd =>
              cmsClient.aggregatedSearch(altKwd, getEnabledSources(), 1, controller.signal, area, classParams).catch(() => {}),
            ),
          ])
        } else {
          // 先用 title 搜索
          await cmsClient.aggregatedSearch(keyword, getEnabledSources(), 1, controller.signal, area, classParams)

          // 评分低则用回退关键词搜索
          if (await needsFallbackSearch()) {
            fallbackAttempted = true
            await Promise.all(
              fallbackKeywords.map(altKwd =>
                cmsClient.aggregatedSearch(altKwd, getEnabledSources(), 1, controller.signal, area, classParams).catch(() => {}),
              ),
            )
          }
        }

        const items = Array.from(uniqueMapRef.current.values())
        const { candidates, movieSourceMatches, seasonSourceMatches } = buildPlaylistMatches({
          mediaType: tmdbType,
          items,
          title: keyword,
          alternativeTitles,
          releaseYear,
          seasons,
          sources: sourceMetaList,
          strictScore: fallbackAttempted,
        })

        setState(prev => ({
          ...prev,
          loading: false,
          error: null,
          progress: { ...prev.progress, phase: 'complete', lastEvent: 'complete', lastEventAt: Date.now() },
          completedAt: Date.now(),
          candidates,
          movieSourceMatches,
          seasonSourceMatches,
        }))

        setTmdbMatchCacheEntry(currentKey, {
          searchedKeyword: keyword,
          candidates,
          movieSourceMatches,
          seasonSourceMatches,
        })
        pruneTmdbMatchCache(TMDB_MATCH_CACHE_MAX_ENTRIES)
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return
        }

        setState(prev => ({
          ...prev,
          loading: false,
          error: (error as Error).message || '搜索 CMS 资源失败',
          progress: {
            phase: 'idle',
            completed: 0,
            total: 0,
            currentSourceName: '',
            currentSourceId: '',
            lastEvent: 'idle',
            lastEventAt: null,
            lastResultSourceName: '',
            lastResultSourceId: '',
            lastResultCount: 0,
          },
          startedAt: null,
          completedAt: null,
          candidates: [],
          movieSourceMatches: [],
          seasonSourceMatches: [],
        }))
      } finally {
        clearSubscriptions()
      }
    },
    [
      clearSubscriptions,
      cmsClient,
      getTmdbMatchCacheEntry,
      alternativeTitles,
      pruneTmdbMatchCache,
      releaseDate,
      seasons,
      scheduleRecompute,
      setTmdbMatchCacheEntry,
      state.searched,
      title,
      tmdbMatchCacheTTLHours,
      tmdbId,
      tmdbType,
      clearRecomputeTimer,
    ],
  )

  useEffect(() => {
    if (!active) return
    runSearch(false)
  }, [active, runSearch])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      clearSubscriptions()
      clearRecomputeTimer()
    }
  }, [clearRecomputeTimer, clearSubscriptions])

  return {
    ...state,
    retry: () => runSearch(true),
  }
}
