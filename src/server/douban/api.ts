import { defineEventHandler, getQuery, createError, sendError } from 'h3'
import type { DoubanComment } from '@/shared/types/douban'
import { fetchDoubanWithVerification } from './anti-crawler'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ── proxy ──

const PROXY_MAP: Record<string, string> = {
  'cmliussss-cdn-tencent': 'https://m.douban.cmliussss.net',
  'cmliussss-cdn-ali': 'https://m.douban.cmliussss.com',
  'cmliussss-unified': 'https://img.doubanio.cmliussss.net',
}

function resolveDoubanUrl(original: string, proxyType: string, proxyUrl: string): string {
  // cors-proxy-zwei and custom use proxy URL prefix
  if (proxyType === 'cors-proxy-zwei') {
    return `https://ciao-cors.is-an.org/${encodeURIComponent(original)}`
  }
  if (proxyType === 'custom' && proxyUrl) {
    return `${proxyUrl}${encodeURIComponent(original)}`
  }
  const base = PROXY_MAP[proxyType]
  if (base) {
    return original.replace('https://movie.douban.com', base).replace('https://www.douban.com', base)
  }
  return original // direct
}

// ── helpers ──

async function fetchHtml(url: string, timeout = 12000): Promise<string> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      redirect: 'follow',
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return await resp.text()
  } finally {
    clearTimeout(id)
  }
}

function parseDoubanComments(html: string): DoubanComment[] {
  const comments: DoubanComment[] = []
  const itemRegex = /<div class="comment-item"[^>]*>([\s\S]*?)(?=<div class="comment-item"|<div id="paginator"|$)/g
  let match
  while ((match = itemRegex.exec(html)) !== null) {
    try {
      const item = match[0]
      const userMatch = item.match(/<span class="comment-info">[\s\S]*?<a href="https:\/\/www\.douban\.com\/people\/([^/]+)\/">([^<]+)<\/a>/)
      const username = userMatch ? userMatch[2].trim() : ''
      const userId = userMatch ? userMatch[1] : ''
      const avatarMatch = item.match(/<div class="avatar">[\s\S]*?<img src="([^"]+)"/)
      const avatar = avatarMatch ? avatarMatch[1].replace(/^http:/, 'https:') : ''
      const ratingMatch = item.match(/<span class="allstar(\d)0 rating"/)
      const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 0
      const timeMatch = item.match(/<span class="comment-time"[^>]*title="([^"]+)"/)
      const time = timeMatch ? timeMatch[1] : ''
      const locationMatch = item.match(/<span class="comment-location">([^<]+)<\/span>/)
      const location = locationMatch ? locationMatch[1].trim() : ''
      const contentMatch = item.match(/<span class="short">([\s\S]*?)<\/span>/)
      let content = ''
      if (contentMatch) {
        content = contentMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
      }
      const usefulMatch = item.match(/<span class="votes vote-count">(\d+)<\/span>/)
      const usefulCount = usefulMatch ? parseInt(usefulMatch[1], 10) : 0
      if (username && content) {
        comments.push({ username, user_id: userId, avatar, rating, time, location, content, useful_count: usefulCount })
      }
    } catch { /* skip */ }
  }
  return comments
}

// ── search handler ──

export const doubanSearchHandler = defineEventHandler(async (event) => {
  const q = getQuery(event)
  const keyword = ((q.q as string) || '').trim()
  if (!keyword) return sendError(event, createError({ statusCode: 400, statusMessage: 'q is required' }))

  const proxyType = (q.proxy_type as string) || 'direct'
  const proxyUrl = (q.proxy_url as string) || ''
  const doubanUrl = `https://www.douban.com/search?cat=1002&q=${encodeURIComponent(keyword)}`
  const url = resolveDoubanUrl(doubanUrl, proxyType, proxyUrl)
  const html = await fetchHtml(url)
  const subjects: Array<{ id: string; title: string; year: string; rating: string; type: 'movie' | 'tv' }> = []
  const seen = new Set<string>()

  // match: sid: 35465232 + title="狂飙" from onclick handler
  const sidRegex = /sid:\s*(\d+)/g
  let m
  while ((m = sidRegex.exec(html)) !== null) {
    const sid = m[1]
    if (seen.has(sid)) continue
    seen.add(sid)

    // find the corresponding title attr nearby
    const start = Math.max(0, m.index - 30)
    const end = Math.min(html.length, m.index + 120)
    const context = html.slice(start, end)
    const titleMatch = context.match(/title="([^"]+)"/)
    const title = titleMatch ? titleMatch[1] : ''
    // year: look for (2023) pattern in the broader result item
    const itemStart = Math.max(0, m.index - 200)
    const itemEnd = Math.min(html.length, m.index + 500)
    const itemCtx = html.slice(itemStart, itemEnd)
    const yearMatch = itemCtx.match(/<span[^>]*>[\s]*\(?(\d{4})\)?[\s]*<\/span>/)
    const year = yearMatch ? yearMatch[1] : ''

    subjects.push({ id: sid, title, year, rating: '', type: 'movie' })
  }

  return { code: 0, message: 'success', data: { subjects: subjects.slice(0, 5) } }
})

// ── comments handler ──

export const doubanCommentsHandler = defineEventHandler(async (event) => {
  const q = getQuery(event)
  const id = (q.id as string) || ''
  const start = parseInt((q.start as string) || '0', 10) || 0
  const limit = Math.min(50, Math.max(1, parseInt((q.limit as string) || '10', 10) || 10))
  const sort = (q.sort as string) || 'new_score'

  if (!id) return sendError(event, createError({ statusCode: 400, statusMessage: 'id is required' }))

  const cookie = (q.cookie as string) || ''
  const proxyType = (q.proxy_type as string) || 'direct'
  const proxyUrl = (q.proxy_url as string) || ''
  const doubanUrl = `https://movie.douban.com/subject/${id}/comments?start=${start}&limit=${limit}&status=P&sort=${sort}`
  const url = resolveDoubanUrl(doubanUrl, proxyType, proxyUrl)

  try {
    // proxy/cookie mode: simple fetch. direct mode: use anti-crawler.
    let html: string
    if (proxyType !== 'direct' || cookie) {
      const resp = await fetch(url, { headers: { 'User-Agent': UA, ...(cookie ? { Cookie: cookie } : {}) }, redirect: 'follow' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      html = await resp.text()
    } else {
      html = await fetchDoubanWithVerification(doubanUrl)
    }

    // detect anti-crawler challenge
    if (html.includes('process(cha)') || html.includes('载入中') || html.length < 500) {
      return {
        code: -1,
        message: '豆瓣反爬虫验证触发，请在设置中配置豆瓣 Cookie 后重试',
        data: { comments: [], start, limit, count: 0 },
      }
    }

    const comments = parseDoubanComments(html)
    return { code: 0, message: 'success', data: { comments, start, limit, count: comments.length } }
  } catch (err) {
    return {
      code: -1,
      message: `请求失败: ${err instanceof Error ? err.message : 'unknown'}`,
      data: { comments: [], start, limit, count: 0 },
    }
  }
})
