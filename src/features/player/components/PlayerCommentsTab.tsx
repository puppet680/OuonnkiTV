import { useEffect, useState, useCallback } from 'react'
import { Star, ExternalLink, AlertCircle, Loader2, Search, User } from 'lucide-react'
import type { DoubanComment, DoubanSearchResult, DoubanCommentsResult } from '@/shared/types/douban'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { cn } from '@/shared/lib/utils'

// ponytail: localStorage cache, 1h TTL
const CACHE_PREFIX = 'douban_cache:'
const CACHE_TTL = 60 * 60 * 1000

interface CacheEntry<T> { data: T; ts: number }

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.ts > CACHE_TTL) { localStorage.removeItem(CACHE_PREFIX + key); return null }
    return entry.data
  } catch { return null }
}
function cacheSet<T>(key: string, value: T) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data: value, ts: Date.now() })) } catch { /* quota */ }
}

interface PlayerCommentsTabProps {
  title: string
  year?: string
}

type Status = 'idle' | 'resolving' | 'loading' | 'done' | 'error'

export default function PlayerCommentsTab({ title, year }: PlayerCommentsTabProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [comments, setComments] = useState<DoubanComment[]>([])
  const [doubanId, setDoubanId] = useState('')
  const [error, setError] = useState('')

  const fetchComments = useCallback(async (id: string) => {
    const cacheKey = `comments:${id}`
    const cached = cacheGet<DoubanComment[]>(cacheKey)
    if (cached) { setComments(cached); setDoubanId(id); setStatus('done'); return }

    setStatus('loading')
    try {
      // pony: read from store.getState() to avoid re-fetch on store init
      const { doubanCookie, doubanProxyType, doubanProxyUrl } = await import('@/shared/store/panhubStore').then(m => m.usePanhubStore.getState())
      const params = new URLSearchParams({ id, limit: '10', sort: 'new_score', proxy_type: doubanProxyType })
      if (doubanCookie) params.set('cookie', doubanCookie)
      if ((doubanProxyType === 'custom' || doubanProxyType === 'cors-proxy-zwei') && doubanProxyUrl) params.set('proxy_url', doubanProxyUrl)
      const resp = await fetch(`/api/douban/comments?${params}`)
      const json: DoubanCommentsResult = await resp.json()
      if (json.code !== 0) throw new Error(json.message || '获取评论失败')
      const data = json.data?.comments || []
      cacheSet(cacheKey, data)
      setComments(data)
      setDoubanId(id)
      setStatus('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '获取评论失败')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!title.trim()) { setStatus('idle'); return }

    const cacheKey = `search:${title}:${year || ''}`
    const cached = cacheGet<{ doubanId: string }>(cacheKey)
    if (cached) { fetchComments(cached.doubanId); return }

    setStatus('resolving')
    let cancelled = false

    const doResolve = async () => {
      try {
        const q = year ? `${title} ${year}` : title
        const resp = await fetch(`/api/douban/search?q=${encodeURIComponent(q)}`)
        const json: { code: number; data: DoubanSearchResult } = await resp.json()
        if (cancelled) return
        if (json.code !== 0 || !json.data?.subjects?.length) {
          setError('未匹配到豆瓣条目')
          setStatus('error')
          return
        }
        const subject = json.data.subjects[0]
        cacheSet(cacheKey, { doubanId: subject.id })
        fetchComments(subject.id)
      } catch (err: unknown) {
        if (!cancelled) { setError(err instanceof Error ? err.message : '搜索豆瓣失败'); setStatus('error') }
      }
    }

    doResolve()
    return () => { cancelled = true }
  }, [title, year, fetchComments])

  const isLoading = status === 'resolving' || status === 'loading'

  return (
    <div className="space-y-3">
      {isLoading && (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>{status === 'resolving' ? '正在匹配豆瓣条目...' : '正在加载评论...'}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-sm text-red-500">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {status === 'idle' && !title.trim() && (
        <p className="py-4 text-sm text-muted-foreground">暂无影视信息，无法搜索评论</p>
      )}

      {status === 'done' && comments.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
          <Search className="size-8 opacity-40" />
          <p className="text-sm">暂无豆瓣短评</p>
        </div>
      )}

      {status === 'done' && comments.length > 0 && (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-1">
            {comments.map((c, i) => (
              <div key={`${c.user_id}-${i}`} className="rounded-lg border border-border/50 bg-card/35 p-3">
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    {c.avatar ? (
                      <img src={c.avatar} alt={c.username} className="size-10 rounded-full object-cover"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <User className="size-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{c.username}</span>
                      {c.rating > 0 && (
                        <span className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, j) => (
                            <Star key={j} className={cn('size-3', j < c.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                          ))}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{c.time}{c.location && ` · ${c.location}`}</span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
                    {c.useful_count > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">{c.useful_count} 人认为有用</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {doubanId && comments.length > 0 && (
        <div className="text-center">
          <a href={`https://movie.douban.com/subject/${doubanId}/comments?status=P`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            查看更多短评 <ExternalLink className="size-3" />
          </a>
        </div>
      )}
    </div>
  )
}
