// Cloudflare Pages Function: /api/douban/*
// Douban search + comments with anti-crawler (Web Crypto API)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const BASE_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Referer': 'https://movie.douban.com/',
}

// ponytail: no Referer for proxies, they 403 on mismatched referer
const PROXY_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'zh-CN,zh;q=0.9',
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
}

// ── proxy (CDN mirrors — JSON API only, not HTML pages) ──
const PROXY_MAP: Record<string, string> = {
  'cmliussss-cdn-tencent': 'https://movie.douban.cmliussss.net',
  'cmliussss-cdn-ali': 'https://movie.douban.cmliussss.com',
  'cmliussss-unified': 'https://img.doubanio.cmliussss.net',
}

function resolveDoubanUrl(original: string, proxyType: string, proxyUrl: string): string {
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

// ── SHA-512 via Web Crypto ──
async function sha512(data: string): Promise<string> {
  const buf = new TextEncoder().encode(data)
  const hash = await crypto.subtle.digest('SHA-512', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function proofOfWork(data: string, difficulty = 4): Promise<number> {
  const target = '0'.repeat(difficulty)
  let nonce = 0
  while (true) {
    nonce++
    if ((await sha512(data + nonce)).startsWith(target)) return nonce
  }
}

// ── fetch with timeout ──
async function fetchWithTimeout(url: string, init: RequestInit, timeout = 12000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

// ── anti-crawler cookie cache (per-request; CF Workers are stateless between requests) ──
interface CookieCache { cookie: string; expiresAt: number }
let cookieCache: CookieCache | null = null

function parseChallengePage(html: string) {
  // ponytail: broader patterns — Douban may change id/name format
  const tok = (html.match(/id="tok"[^>]*value="([^"]*)"/) || html.match(/name="tok"[^>]*value="([^"]*)"/) || html.match(/<input[^>]*\bid="tok"[^>]*value="([^"]*)"[^>]*\/?>/) || html.match(/<input[^>]*\bname="tok"[^>]*value="([^"]*)"[^>]*\/?>/) || [])[1] || ''
  const cha = (html.match(/id="cha"[^>]*value="([^"]*)"/) || html.match(/name="cha"[^>]*value="([^"]*)"/) || html.match(/<input[^>]*\bid="cha"[^>]*value="([^"]*)"[^>]*\/?>/) || html.match(/<input[^>]*\bname="cha"[^>]*value="([^"]*)"[^>]*\/?>/) || [])[1] || ''
  const red = (html.match(/id="red"[^>]*value="([^"]*)"/) || html.match(/name="red"[^>]*value="([^"]*)"/) || html.match(/<input[^>]*\bid="red"[^>]*value="([^"]*)"[^>]*\/?>/) || html.match(/<input[^>]*\bname="red"[^>]*value="([^"]*)"[^>]*\/?>/) || [])[1] || ''
  if (!tok || !cha || !red) return null
  return { tok, cha, red }
}

async function fetchDoubanWithVerification(url: string): Promise<string> {
  // try cached cookie
  if (cookieCache && Date.now() < cookieCache.expiresAt - 20000) {
    const resp = await fetchWithTimeout(url, { headers: { ...BASE_HEADERS, Cookie: cookieCache.cookie } })
    if (resp.ok) return await resp.text()
    cookieCache = null
  }

  let resp = await fetchWithTimeout(url, { headers: BASE_HEADERS, redirect: 'manual' })

  if (resp.status === 302) {
    const location = resp.headers.get('location')
    if (location?.includes('sec.douban.com')) {
      const verifyResp = await fetchWithTimeout(location, { headers: BASE_HEADERS })
      const verifyHtml = await verifyResp.text()
      const form = parseChallengePage(verifyHtml)
      if (form) {
        const sol = await proofOfWork(form.cha)
        const body = new URLSearchParams({ tok: form.tok, cha: form.cha, sol: String(sol), red: form.red })
        const submitResp = await fetchWithTimeout('https://sec.douban.com/c', {
          method: 'POST',
          headers: { ...BASE_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          redirect: 'manual',
        })
        const setCookie = submitResp.headers.get('set-cookie')
        if (setCookie) {
          const match = setCookie.match(/dbsawcv1=([^;]+)/)
          cookieCache = {
            cookie: match ? `dbsawcv1=${match[1]}` : setCookie.split(';')[0],
            expiresAt: Date.now() + 300000,
          }
        }
        resp = await fetchWithTimeout(url, { headers: { ...BASE_HEADERS, Cookie: cookieCache?.cookie || '' }, redirect: 'manual' })
      } else {
        if (verifyHtml.includes('01004') || verifyHtml.includes('passport/login')) {
          throw new Error('豆瓣要求登录，当前IP被限制。请在设置中配置豆瓣Cookie后重试')
        }
        const snippet = verifyHtml.slice(0, 600).replace(/\s+/g, ' ').trim()
        throw new Error(`Anti-crawler parse failed. HTML preview: ${snippet}`)
      }
    }
  }

  if (resp.status === 302) {
    const loc = resp.headers.get('location') || 'unknown'
    throw new Error(`302 redirect to ${loc}`)
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return await resp.text()
}

// ── parsers ──
function parseComments(html: string) {
  const comments: Array<Record<string, unknown>> = []
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

// ── handler ──
export const onRequest = async (context: { request: Request; env: unknown }) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS })
  }

  const url = new URL(context.request.url)
  const path = url.pathname.replace('/api/douban', '')

  try {
    if (path === '/search') {
      const q = url.searchParams.get('q') || ''
      if (!q) return new Response(JSON.stringify({ code: -1, message: 'q required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })

      const proxyType = url.searchParams.get('proxy_type') || 'direct'
      const proxyUrl = url.searchParams.get('proxy_url') || ''
      const isCdnProxy = proxyType.startsWith('cmliussss-')

      // CDN proxy → JSON API (only JSON endpoints are cached by CDN)
      if (isCdnProxy) {
        const base = PROXY_MAP[proxyType]
        const apiUrl = `${base}/j/search_subjects?type=movie&tag=${encodeURIComponent(q)}&page_limit=5`
        const resp = await fetchWithTimeout(apiUrl, { headers: PROXY_HEADERS })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json() as { subjects?: Array<{ id: string; title: string; rate: string; cover: string }> }
        const subjects = (data.subjects || []).map(s => ({ id: s.id, title: s.title, year: '', rating: s.rate || '', type: 'movie' }))
        return new Response(JSON.stringify({ code: 0, message: 'success', data: { subjects: subjects.slice(0, 5) } }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      // cors-proxy / custom / direct → HTML scraping
      const doubanUrl = `https://www.douban.com/search?cat=1002&q=${encodeURIComponent(q)}`
      const resolvedUrl = resolveDoubanUrl(doubanUrl, proxyType, proxyUrl)

      let html: string
      if (proxyType !== 'direct') {
        const resp = await fetchWithTimeout(resolvedUrl, { headers: PROXY_HEADERS })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        html = await resp.text()
      } else {
        html = await fetchDoubanWithVerification(resolvedUrl)
      }

      const subjects: Array<Record<string, string>> = []
      const seen = new Set<string>()
      const sidRegex = /sid:\s*(\d+)/g
      let m
      while ((m = sidRegex.exec(html)) !== null) {
        const sid = m[1]
        if (seen.has(sid)) continue
        seen.add(sid)
        const s = Math.max(0, m.index - 30)
        const e = Math.min(html.length, m.index + 120)
        const ctx = html.slice(s, e)
        const titleMatch = ctx.match(/title="([^"]+)"/)
        const title = titleMatch ? titleMatch[1] : ''
        const is = Math.max(0, m.index - 200)
        const ie = Math.min(html.length, m.index + 500)
        const itemCtx = html.slice(is, ie)
        const yearMatch = itemCtx.match(/<span[^>]*>[\s]*\(?(\d{4})\)?[\s]*<\/span>/)
        const year = yearMatch ? yearMatch[1] : ''
        subjects.push({ id: sid, title, year, rating: '', type: 'movie' })
      }
      return new Response(JSON.stringify({ code: 0, message: 'success', data: { subjects: subjects.slice(0, 5) } }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (path === '/comments') {
      const id = url.searchParams.get('id') || ''
      const start = parseInt(url.searchParams.get('start') || '0') || 0
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10') || 10))
      const sort = url.searchParams.get('sort') || 'new_score'
      const cookie = url.searchParams.get('cookie') || ''
      const proxyType = url.searchParams.get('proxy_type') || 'direct'
      const proxyUrl = url.searchParams.get('proxy_url') || ''
      if (!id) return new Response(JSON.stringify({ code: -1, message: 'id required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })

      // ponytail: CDN mirrors don't cache HTML pages, comments have no JSON API
      if (proxyType.startsWith('cmliussss-')) {
        return new Response(JSON.stringify({ code: -1, message: '豆瓣短评无JSON接口，CDN代理不支持。请使用 direct/cors-proxy-zwei/custom' }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      const doubanUrl = `https://movie.douban.com/subject/${id}/comments?start=${start}&limit=${limit}&status=P&sort=${sort}`
      const resolvedUrl = resolveDoubanUrl(doubanUrl, proxyType, proxyUrl)

      let html: string
      if (proxyType !== 'direct' || cookie) {
        const resp = await fetchWithTimeout(resolvedUrl, {
          headers: { ...PROXY_HEADERS, ...(cookie ? { Cookie: cookie } : {}) },
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        html = await resp.text()
      } else {
        html = await fetchDoubanWithVerification(resolvedUrl)
      }

      if (html.includes('process(cha)') || html.includes('载入中') || html.length < 500) {
        return new Response(JSON.stringify({ code: -1, message: '豆瓣反爬虫验证触发，请在设置中配置豆瓣 Cookie 后重试' }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      const comments = parseComments(html)
      return new Response(JSON.stringify({ code: 0, message: 'success', data: { comments, start, limit, count: comments.length } }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ code: -1, message: 'not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'internal error'
    console.error('[douban]', detail)
    const uiMsg = detail.includes('302 redirect') ? '豆瓣访问受限，请尝试配置Cookie'
      : detail.includes('Anti-crawler') ? '豆瓣验证失败'
      : detail.includes('HTTP 5') ? '豆瓣服务异常'
      : detail
    return new Response(JSON.stringify({ code: -1, message: uiMsg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
}
