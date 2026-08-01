import { useEffect, useMemo, useRef, useState } from 'react'
import type { CmsClient, DetailResult, VideoSource } from '@ouonnki/cms-core'
import { hasSplitSuffix, type PlaylistMatchItem } from '@/features/media/components'

/** 同一源内一个条目的集数分组（主选集或拆分条目） */
export interface SourceEpisodeGroup {
  vodId: string
  /** 条目名，作分组标题 */
  title: string
  /** 集数显示名：优先 episodes_names，否则生成「第 N 集」 */
  episodes: string[]
  loading: boolean
}

/** 拆分条目分组，含当前选中集高亮（activeEpisode 为 null 表示不高亮） */
export interface SplitEpisodeGroup extends SourceEpisodeGroup {
  activeEpisode: number | null
}

interface UsePlayerSourceEpisodesParams {
  /** 是否启用（TMDB 播放模式） */
  enabled: boolean
  /** 匹配候选（tmdbPlayback.playlist.candidates） */
  candidates: PlaylistMatchItem[]
  /** 当前播放源 */
  currentSourceCode: string
  /** 当前播放条目；是非拆分候选时成为主选集锚点，此后保持不变 */
  currentVodId: string
  sourceConfig: VideoSource | undefined
  cmsClient: CmsClient
}

const toEpisodeNames = (res: DetailResult): string[] =>
  res.videoInfo?.episodes_names?.length
    ? res.videoInfo.episodes_names
    : res.episodes.map((_, index) => `第 ${index + 1} 集`)

// vod_id 统一按字符串比较：API 返回数字，URL 参数为字符串
const toGroup = (entry: PlaylistMatchItem, loading: boolean): SourceEpisodeGroup => ({
  vodId: String(entry.item.vod_id),
  title: entry.item.vod_name,
  episodes: [],
  loading,
})

// 集数缓存上限，超限淘汰最早一条（Map 保持插入序）
const CACHE_LIMIT = 30
const cacheSet = (cache: Map<string, string[]>, vodId: string, names: string[]) => {
  if (cache.size >= CACHE_LIMIT && !cache.has(vodId)) cache.delete(cache.keys().next().value!)
  cache.set(vodId, names)
}

/**
 * 拉取当前源的主选集（默认完整条目）与拆分条目（Part.2/下部/后篇 等）的集数
 * 主选集锚定在当前播放的非拆分条目上（首次确定后不变），拆分条目常驻下方
 * @param enabled - TMDB 播放模式开关，关闭时返回空
 * @param candidates - 同源全部匹配候选，按分数排序
 * @param currentSourceCode - 当前播放源
 * @param currentVodId - 当前播放条目，是非拆分候选时成为主选集锚点
 * @param sourceConfig - 当前源配置，用于 getDetail
 * @param cmsClient - CMS 客户端
 * @returns defaultGroup 主选集分组，splitGroups 拆分条目分组
 */
export function usePlayerSourceEpisodes({
  enabled,
  candidates,
  currentSourceCode,
  currentVodId,
  sourceConfig,
  cmsClient,
}: UsePlayerSourceEpisodesParams) {
  const [defaultGroup, setDefaultGroup] = useState<SourceEpisodeGroup | null>(null)
  const [splitGroups, setSplitGroups] = useState<SourceEpisodeGroup[]>([])
  const reqSeqRef = useRef(0)
  // 主选集锚点：首次命中的非拆分候选 vodId，源不变则保持（点击拆分条目不跟随）
  const anchorRef = useRef<string | null>(null)
  const anchorSourceRef = useRef<string>('')
  // 已拉取的集数缓存：vodId → 显示名，换源/重新匹配时复用，避免加载闪动与重复请求
  const episodesCacheRef = useRef<Map<string, string[]>>(new Map())

  // 同源候选：当前条目是非拆分候选即为主选集锚点；拆分条目=其余带拆分后缀的条目
  const { defaultEntry, splitEntries } = useMemo(() => {
    if (!enabled) return { defaultEntry: null, splitEntries: [] as PlaylistMatchItem[] }
    const sourceEntries = candidates.filter(
      entry => entry.item.source_code === currentSourceCode && Boolean(entry.item.vod_id),
    )

    // 换源时重置锚点（render 期幂等写 ref）
    if (anchorSourceRef.current !== currentSourceCode) {
      anchorSourceRef.current = currentSourceCode
      anchorRef.current = null
    }
    const currentEntry = sourceEntries.find(
      entry => String(entry.item.vod_id) === String(currentVodId),
    )
    if (currentEntry && !hasSplitSuffix(currentEntry.item.vod_name)) {
      anchorRef.current = String(currentEntry.item.vod_id)
    }

    const defaultEntry = anchorRef.current
      ? sourceEntries.find(entry => String(entry.item.vod_id) === anchorRef.current) ?? null
      : // 无锚点（直接落在拆分条目/非候选条目）时回退到首个非拆分候选，保证主选集仍是完整条目
        sourceEntries.find(entry => !hasSplitSuffix(entry.item.vod_name)) ?? sourceEntries[0] ?? null
    const splitEntries = sourceEntries
      .filter(
        entry =>
          (!defaultEntry || String(entry.item.vod_id) !== String(defaultEntry.item.vod_id)) &&
          hasSplitSuffix(entry.item.vod_name) &&
          // 低分过滤与多语言备选一致（score >= 80）
          entry.score >= 80 &&
          // 无锚点时主选集兜底为当前条目，拆分区排除当前条目避免重复
          (defaultEntry ? true : String(entry.item.vod_id) !== String(currentVodId)),
      )
      // 同名重复标签（Part.2/下部/后篇 等）只保留评分最高的一个
      .slice(0, 1)
    return { defaultEntry, splitEntries }
  }, [candidates, currentSourceCode, currentVodId, enabled])

  useEffect(() => {
    if (!enabled || !sourceConfig) {
      setDefaultGroup(null)
      setSplitGroups([])
      return
    }

    const reqSeq = ++reqSeqRef.current
    const canCommit = () => reqSeqRef.current === reqSeq

    // 拆分条目：命中缓存直接复用集数，未命中才置 loading 并拉取
    setSplitGroups(
      splitEntries.map(entry => {
        const cached = episodesCacheRef.current.get(String(entry.item.vod_id))
        return cached ? { ...toGroup(entry, false), episodes: cached } : toGroup(entry, true)
      }),
    )
    splitEntries.forEach(entry => {
      const vodId = String(entry.item.vod_id)
      if (episodesCacheRef.current.has(vodId)) return
      cmsClient
        .getDetail(entry.item.vod_id!, sourceConfig)
        .then(response => {
          if (!canCommit() || !response.success || !response.episodes?.length) return
          const names = toEpisodeNames(response)
          cacheSet(episodesCacheRef.current, vodId, names)
          setSplitGroups(prev =>
            prev.map(g => (g.vodId === vodId ? { ...g, episodes: names, loading: false } : g)),
          )
        })
        .catch(() => {
          if (!canCommit()) return
          setSplitGroups(prev =>
            prev.map(g => (g.vodId === vodId ? { ...g, loading: false } : g)),
          )
        })
    })

    // 默认条目未知时主选集留空，由面板兜底为当前条目集数
    if (!defaultEntry) {
      setDefaultGroup(null)
      return
    }

    const defaultVodId = String(defaultEntry.item.vod_id)
    const cachedDefault = episodesCacheRef.current.get(defaultVodId)
    setDefaultGroup(
      cachedDefault
        ? { ...toGroup(defaultEntry, false), episodes: cachedDefault }
        : toGroup(defaultEntry, true),
    )
    if (cachedDefault) return

    cmsClient
      .getDetail(defaultEntry.item.vod_id!, sourceConfig)
      .then(response => {
        if (!canCommit() || !response.success || !response.episodes?.length) return
        const names = toEpisodeNames(response)
        cacheSet(episodesCacheRef.current, defaultVodId, names)
        setDefaultGroup({ ...toGroup(defaultEntry, false), episodes: names })
      })
      .catch(() => {
        if (canCommit()) setDefaultGroup(prev => (prev ? { ...prev, loading: false } : prev))
      })
  }, [cmsClient, defaultEntry, enabled, sourceConfig, splitEntries])

  return { defaultGroup, splitGroups }
}
