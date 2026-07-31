/**
 * 源测速 hook —— 后台批量测速，返回累积结果 Map
 * 接近 LunaTV fullSpeedTest：前 5 + 随机 10 个源，并发 2
 * 结果持久化到 localStorage，key: sourceCode::vodId，TTL 24h
 */
import { useState, useEffect, useRef } from 'react'
import type { VideoSource } from '@ouonnki/cms-core'
import type { PlayerSourceOption } from './useTmdbPlayback'
import type { VideoSourceTestResult } from '../lib/source-speed-test'
import { testM3u8Source } from '../lib/source-speed-test'

// ponytail: minimal interface — real CmsClient has richer types
interface CmsClientLike {
  getDetail: (id: string, source: VideoSource) => Promise<{ success: boolean; episodes: string[]; error?: string }>
}

const MAX_SOURCES = 30
const TOP_COUNT = 5
const CONCURRENCY = 4
const CACHE_PREFIX = 'ouonnki-speed::'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

function cacheKey(sourceCode: string, vodId: string) {
  return `${CACHE_PREFIX}${sourceCode}::${vodId}`
}

function loadFromCache(sourceCode: string, vodId: string): VideoSourceTestResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(sourceCode, vodId))
    if (!raw) return null
    const entry = JSON.parse(raw) as VideoSourceTestResult & { _ts?: number }
    if (entry._ts && Date.now() - entry._ts > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(sourceCode, vodId))
      return null
    }
    return entry
  } catch {
    return null
  }
}

function saveToCache(sourceCode: string, vodId: string, result: VideoSourceTestResult) {
  try {
    const entry = { ...result, _ts: Date.now() }
    localStorage.setItem(cacheKey(sourceCode, vodId), JSON.stringify(entry))
  } catch { /* localStorage full */ }
}

export function useSourceSpeedTest(
  sourceOptions: PlayerSourceOption[],
  videoAPIs: VideoSource[],
  cmsClient: CmsClientLike | null,
) {
  const [results, setResults] = useState<Map<string, VideoSourceTestResult>>(() => {
    const map = new Map<string, VideoSourceTestResult>()
    // pre-populate from cache
    for (const opt of sourceOptions) {
      const cached = loadFromCache(opt.sourceCode, opt.bestVodId)
      if (cached) map.set(opt.sourceCode, cached)
    }
    return map
  })
  const [testing, setTesting] = useState(false)
  const [testingSet, setTestingSet] = useState<Set<string>>(new Set())
  const testedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (sourceOptions.length <= 1) return
    if (!cmsClient) return
    // ponytail: load cache in effect too — useState initializer runs with empty sourceOptions on first render
    let cacheLoaded = false
    setResults(prev => {
      const next = new Map(prev)
      for (const opt of sourceOptions) {
        if (!next.has(opt.sourceCode)) {
          const cached = loadFromCache(opt.sourceCode, opt.bestVodId)
          if (cached) { next.set(opt.sourceCode, cached); cacheLoaded = true }
        }
      }
      return cacheLoaded ? next : prev
    })

    // collect all untested + uncached sources
    const uncached: PlayerSourceOption[] = []
    for (const opt of sourceOptions) {
      if (!testedRef.current.has(opt.sourceCode) && !loadFromCache(opt.sourceCode, opt.bestVodId)) {
        uncached.push(opt)
      }
    }
    if (uncached.length === 0) return

    // sort by bestScore, test high-score first; cap at MAX_SOURCES via random sampling if excess
    uncached.sort((a, b) => b.bestScore - a.bestScore)
    const fresh = uncached.length <= MAX_SOURCES
      ? uncached
      : (() => {
          const top = uncached.slice(0, TOP_COUNT)
          const rest = uncached.slice(TOP_COUNT)
          const random = rest.sort(() => Math.random() - 0.5).slice(0, MAX_SOURCES - TOP_COUNT)
          return [...top, ...random]
        })()

    // mark as tested IMMEDIATELY so concurrent effects don't re-queue
    for (const f of fresh) testedRef.current.add(f.sourceCode)
    setTesting(true)

    const queue = [...fresh]

    const updateResult = (sourceCode: string, vodId: string, result: VideoSourceTestResult) => {
      saveToCache(sourceCode, vodId, result)
      setResults(prev => {
        const next = new Map(prev)
        next.set(sourceCode, result)
        return next
      })
    }

    const worker = async () => {
      while (queue.length > 0) {
        const option = queue.shift()!
        const api = videoAPIs.find(a => a.id === option.sourceCode)
        if (!api) {
          updateResult(option.sourceCode, option.bestVodId, {
            quality: null, loadSpeed: '未知', pingTime: 9999,
            status: 'failed', message: '未找到源配置', hasError: true,
            playable: false, testedAt: Date.now(),
          })
          setTestingSet(prev => { const s = new Set(prev); s.delete(option.sourceCode); return s })
          continue
        }

        setTestingSet(prev => new Set(prev).add(option.sourceCode))

        try {
          const detail = await cmsClient.getDetail(option.bestVodId, api)
          if (!detail.success || !detail.episodes?.length) {
            updateResult(option.sourceCode, option.bestVodId, {
              quality: null, loadSpeed: '未知', pingTime: 9999,
              status: 'failed', message: '无法获取播放地址', hasError: true,
              playable: false, testedAt: Date.now(),
            })
            setTestingSet(prev => { const s = new Set(prev); s.delete(option.sourceCode); return s })
            continue
          }

          const m3u8Url = detail.episodes[0]
          const result = await testM3u8Source(m3u8Url, 8000)
          updateResult(option.sourceCode, option.bestVodId, result)
        } catch {
          updateResult(option.sourceCode, option.bestVodId, {
            quality: null, loadSpeed: '未知', pingTime: 9999,
            status: 'failed', message: '测速异常', hasError: true,
            playable: false, testedAt: Date.now(),
          })
        } finally {
          setTestingSet(prev => { const s = new Set(prev); s.delete(option.sourceCode); return s })
        }
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker())
    Promise.all(workers).finally(() => setTesting(false))

    return () => { /* no cleanup needed */ }
  }, [sourceOptions, videoAPIs, cmsClient])  

  // ── single source test — callable from UI ──
  const testSingle = (sourceCode: string) => {
    const option = sourceOptions.find(o => o.sourceCode === sourceCode)
    if (!option) return
    const api = videoAPIs.find(a => a.id === option.sourceCode)
    if (!api || !cmsClient) return

    setTestingSet(prev => new Set(prev).add(sourceCode))
    testedRef.current.add(sourceCode)

    cmsClient.getDetail(option.bestVodId, api)
      .then(detail => {
        if (!detail.success || !detail.episodes?.length) throw new Error('无法获取播放地址')
        return testM3u8Source(detail.episodes[0], 8000)
      })
      .then(result => {
        saveToCache(sourceCode, option.bestVodId, result)
        setResults(prev => { const next = new Map(prev); next.set(sourceCode, result); return next })
      })
      .catch(() => {
        const failed = { quality: null, loadSpeed: '未知', pingTime: 9999, status: 'failed' as const, message: '测速异常', hasError: true, playable: false, testedAt: Date.now() }
        saveToCache(sourceCode, option.bestVodId, failed)
        setResults(prev => { const next = new Map(prev); next.set(sourceCode, failed); return next })
      })
      .finally(() => setTestingSet(prev => { const s = new Set(prev); s.delete(sourceCode); return s }))
  }

  // ── test all sources ──
  const testAll = () => {
    for (const opt of sourceOptions) testSingle(opt.sourceCode)
  }

  return { results, testing, testingSet, testSingle, testAll }
}
