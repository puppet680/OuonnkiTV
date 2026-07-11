import { defineEventHandler, getQuery, createError, sendError } from 'h3'
import { DOUBAN_UA, resolveDoubanUrl, parseComments } from '../../shared/lib/douban'
import { fetchDoubanWithVerification } from './anti-crawler'

// ── helpers ──

async function fetchHtml(url: string, timeout = 12000): Promise<string> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': DOUBAN_UA, 'Accept': 'text/html' },
      redirect: 'follow',
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return await resp.text()
  } finally {
    clearTimeout(id)
  }
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
      const resp = await fetch(url, { headers: { 'User-Agent': DOUBAN_UA, ...(cookie ? { Cookie: cookie } : {}) }, redirect: 'follow' })
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

    const comments = parseComments(html)
    return { code: 0, message: 'success', data: { comments, start, limit, count: comments.length } }
  } catch (err) {
    return {
      code: -1,
      message: `请求失败: ${err instanceof Error ? err.message : 'unknown'}`,
      data: { comments: [], start, limit, count: 0 },
    }
  }
})
