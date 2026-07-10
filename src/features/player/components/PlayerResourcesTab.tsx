import { useEffect, useState, useRef, useCallback } from 'react'
import { ExternalLink, Copy, Check, Search, AlertCircle, Loader2, ChevronDown, RotateCcw } from 'lucide-react'
import { usePanhubStore } from '@/shared/store/panhubStore'
import { PLATFORM_INFO, type PanhubMergedLinks, type PanhubGenericResponse, type PanhubSearchResponse } from '@/shared/types/panhub'
import { Badge } from '@/shared/components/ui/badge'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { cn } from '@/shared/lib/utils'

// ponytail: sessionStorage cache survives page refresh
const CACHE_PREFIX = 'panhub_cache:'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

interface CacheEntry {
  data: PanhubMergedLinks
  ts: number
}

function cacheGet(key: string): PanhubMergedLinks | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return entry.data
  } catch { return null }
}

function cacheSet(key: string, value: PanhubMergedLinks) {
  try {
    const entry: CacheEntry = { data: value, ts: Date.now() }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch { /* quota exceeded */ }
}

function cacheKey(keyword: string, plugins: string[]): string {
  return `${keyword.trim()}::${[...plugins].sort().join(',')}`
}

interface PlayerResourcesTabProps {
  keyword: string
  noScroll?: boolean
}

type SearchStatus = 'idle' | 'loading' | 'done' | 'error'

function mergeByType(a: PanhubMergedLinks, b: PanhubMergedLinks): PanhubMergedLinks {
  const out = { ...a }
  for (const type of Object.keys(b)) {
    const existing = out[type] || []
    const seen = new Set(existing.map(x => x.url))
    out[type] = [...existing, ...b[type].filter(item => !seen.has(item.url))]
  }
  return out
}

const formatDate = (d?: string) => {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  const diff = Date.now() - dt.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return dt.toLocaleDateString('zh-CN')
}

export default function PlayerResourcesTab({ keyword, noScroll }: PlayerResourcesTabProps) {
  const { apiBase, enabledPlugins, concurrency, pluginTimeoutMs } = usePanhubStore()
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [results, setResults] = useState<PanhubMergedLinks>({})
  const [error, setError] = useState('')
  const [copiedUrl, setCopiedUrl] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [retryCount, setRetryCount] = useState(0)
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set())
  const abortRef = useRef<AbortController | null>(null)

  // Keep-Alive: when search config changes (e.g. settings reset), clear stale results and re-search
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    abortRef.current?.abort()
    setStatus('idle')
    setResults({})
    setError('')
  }, [apiBase, enabledPlugins, concurrency, pluginTimeoutMs])

  const doSearch = useCallback(async () => {
    if (!keyword.trim() || enabledPlugins.length === 0) {
      setStatus('idle')
      return
    }

    const key = cacheKey(keyword, enabledPlugins)
    const cached = cacheGet(key)
    if (cached) {
      setResults(cached)
      // ponytail: still re-search to pick up incomplete plugins, but show cache first
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
    setError('')
    setResults({})
    setProgress({ done: 0, total: enabledPlugins.length })

    const { default: pLimit } = await import('p-limit')
    const limit = pLimit(concurrency)

    let merged: PanhubMergedLinks = {}
    let hasError = false
    let completed = 0

    const tasks = enabledPlugins.map(plugin =>
      limit(async () => {
        if (controller.signal.aborted) return
        try {
          const ext = JSON.stringify({ __plugin_timeout_ms: pluginTimeoutMs })
          const params = new URLSearchParams({
            kw: keyword.trim(),
            res: 'merged_by_type',
            src: 'plugin',
            conc: '1',
            plugins: plugin,
            ext,
          })
          // pony: external API → proxy through Vite to avoid CORS
          const isExternal = apiBase.startsWith('http')
          const searchUrl = isExternal
            ? `/api/panhub/proxy?target=${encodeURIComponent(apiBase + '/search')}&${params}`
            : `${apiBase}/search?${params}`
          const resp = await fetch(searchUrl, { signal: controller.signal })
          if (!resp.ok) return
          const json: PanhubGenericResponse<PanhubSearchResponse> = await resp.json()
          if (json.code !== 0) return
          const fresh = json.data?.merged_by_type || {}
          merged = mergeByType(merged, fresh)
          setResults({ ...merged })
          // pony: save partial results so cross-page navigation doesn't lose progress
          cacheSet(key, merged)
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === 'AbortError') return
          hasError = true
        } finally {
          completed++
          setProgress({ done: completed, total: enabledPlugins.length })
        }
      }),
    )

    try {
      await Promise.all(tasks)
      if (controller.signal.aborted) return
      cacheSet(key, merged)
      setResults({ ...merged })
      setStatus(Object.keys(merged).length > 0 || !hasError ? 'done' : 'done')
    } catch {
      if (!controller.signal.aborted) {
        setError('搜索请求失败')
        setStatus('error')
      }
    }
  }, [keyword, apiBase, enabledPlugins, concurrency, pluginTimeoutMs, retryCount])

  useEffect(() => {
    doSearch()
    return () => abortRef.current?.abort()
  }, [doSearch])

  const handleCopy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(''), 1500)
    } catch {
      // clipboard API not available
    }
  }, [])

  const handleRetry = useCallback(() => {
    const key = cacheKey(keyword, enabledPlugins)
    localStorage.removeItem(CACHE_PREFIX + key)
    abortRef.current?.abort()
    setResults({})
    setError('')
    setRetryCount(c => c + 1)
  }, [keyword, enabledPlugins])

  const toggleExpand = useCallback((type: string) => {
    setCollapsedSet(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const platformTypes = Object.keys(results).filter(t => results[t].length > 0)
  const totalCount = platformTypes.reduce((sum, t) => sum + results[t].length, 0)

  const platformList = (
    <div className={noScroll ? 'space-y-3' : 'space-y-3 pr-1'}>
      {platformTypes.map(type => {
        const info = PLATFORM_INFO[type] || PLATFORM_INFO.others
        const items = results[type]
        const collapsed = collapsedSet.has(type)
        return (
          <div
            key={type}
            className="overflow-hidden rounded-lg border border-border/50 bg-card/35"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2.5 border-b border-border/40 px-3 py-2.5 text-left hover:bg-muted/20 transition-colors"
              onClick={() => toggleExpand(type)}
            >
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${info.color}22` }}
              >
                <img
                  src={info.icon}
                  alt={info.name}
                  className="size-4.5 object-contain"
                />
              </div>
              <span className="text-sm font-semibold">{info.name}</span>
              <Badge variant="outline" className="ml-auto h-5 rounded-full px-2 text-[11px]">
                {items.length}
              </Badge>
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  !collapsed && 'rotate-180',
                )}
              />
            </button>

            {!collapsed && (
            <ul className="divide-y divide-border/30">
              {items.map((link, i) => (
                <li key={`${link.url}-${i}`} className="px-3 py-2.5">
                  <div className="flex flex-col gap-1.5">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="group flex items-start gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <span className="line-clamp-2 flex-1">{link.note || link.url}</span>
                      <ExternalLink className="size-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {link.datetime && <span>{formatDate(link.datetime)}</span>}
                        {link.password && (
                          <Badge
                            variant="outline"
                            className="h-5 rounded-full px-1.5 text-[10px] border-emerald-400/30 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400"
                          >
                            提取码: {link.password}
                          </Badge>
                        )}
                      </div>

                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                          copiedUrl === link.url
                            ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() => handleCopy(link.url)}
                      >
                        {copiedUrl === link.url ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        {copiedUrl === link.url ? '已复制' : '复制'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-3">
      {status === 'loading' && (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>
            正在搜索 {progress.done}/{progress.total} 个源
            {totalCount > 0 && ` · 已找到 ${totalCount} 个资源`}
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-red-400/30 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
            onClick={handleRetry}
          >
            <RotateCcw className="size-3" />
            重新匹配
          </button>
        </div>
      )}

      {status === 'idle' && !keyword.trim() && (
        <p className="py-4 text-sm text-muted-foreground">输入关键词后可搜索网盘资源</p>
      )}

      {status === 'idle' && keyword.trim() && enabledPlugins.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">请先在设置中启用至少一个搜索插件</p>
      )}

      {status === 'done' && totalCount === 0 && (
        <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
          <Search className="size-8 opacity-40" />
          <p className="text-sm">未找到相关网盘资源</p>
          <p className="text-xs opacity-60">试试缩短关键词或切换搜索插件</p>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            onClick={handleRetry}
          >
            <RotateCcw className="size-3" />
            重新匹配
          </button>
        </div>
      )}

      {(status === 'done' || status === 'loading') && totalCount > 0 && (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px]">
              共 {totalCount} 个资源
            </Badge>
          </div>

          {noScroll ? (
            platformList
          ) : (
            <ScrollArea className="max-h-[50vh]">
              {platformList}
            </ScrollArea>
          )}
        </>
      )}
    </div>
  )
}
