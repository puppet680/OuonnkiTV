// Cloudflare Pages Function: /api/douban/*
// Douban search + comments with anti-crawler (Web Crypto API)

import { DOUBAN_UA, CORS, resolveDoubanUrl, parseComments, parseChallengePage } from '@/shared/lib/douban'

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

// ── anti-crawler cookie cache (per-request; CF Workers are stateless between requests) ──
interface CookieCache { cookie: string; expiresAt: number }
let cookieCache: CookieCache | null = null

async function fetchDoubanWithVerification(url: string): Promise<string> {
  // try cached cookie
  if (cookieCache && Date.now() < cookieCache.expiresAt - 20000) {
    const resp = await fetch(url, { headers: { 'User-Agent': DOUBAN_UA, Cookie: cookieCache.cookie } })
    if (resp.ok) return await resp.text()
    cookieCache = null
  }

  let resp = await fetch(url, { headers: { 'User-Agent': DOUBAN_UA }, redirect: 'manual' })

  if (resp.status === 302) {
    const location = resp.headers.get('location')
    if (location?.includes('sec.douban.com')) {
      const verifyResp = await fetch(location, { headers: { 'User-Agent': DOUBAN_UA } })
      const verifyHtml = await verifyResp.text()
      const form = parseChallengePage(verifyHtml)
      if (form) {
        const sol = await proofOfWork(form.cha)
        const body = new URLSearchParams({ tok: form.tok, cha: form.cha, sol: String(sol), red: form.red })
        const submitResp = await fetch('https://sec.douban.com/c', {
          method: 'POST',
          headers: { 'User-Agent': DOUBAN_UA, 'Content-Type': 'application/x-www-form-urlencoded' },
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
        resp = await fetch(url, { headers: { 'User-Agent': DOUBAN_UA, Cookie: cookieCache?.cookie || '' } })
      }
    }
  }

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return await resp.text()
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
      const doubanUrl = `https://www.douban.com/search?cat=1002&q=${encodeURIComponent(q)}`
      const targetUrl = resolveDoubanUrl(doubanUrl, proxyType, proxyUrl)
      const html = proxyType !== 'direct'
        ? await (await fetch(targetUrl, { headers: { 'User-Agent': DOUBAN_UA } })).text()
        : await fetchDoubanWithVerification(doubanUrl)
      const subjects: Array<Record<string, string>> = []
      const seen = new Set<string>()
      const sidRegex = /sid:\s*(\d+)/g
      let m
      while ((m = sidRegex.exec(html)) !== null) {
        if (seen.has(m[1])) continue
        seen.add(m[1])
        const ctx = html.slice(Math.max(0, m.index - 30), Math.min(html.length, m.index + 120))
        const titleMatch = ctx.match(/title="([^"]+)"/)
        subjects.push({ id: m[1], title: titleMatch ? titleMatch[1] : '', year: '', rating: '', type: 'movie' })
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
      if (!id) return new Response(JSON.stringify({ code: -1, message: 'id required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })

      const cookie = url.searchParams.get('cookie') || ''
      const proxyType = url.searchParams.get('proxy_type') || 'direct'
      const proxyUrl = url.searchParams.get('proxy_url') || ''
      const doubanUrl = `https://movie.douban.com/subject/${id}/comments?start=${start}&limit=${limit}&status=P&sort=${sort}`
      const targetUrl = resolveDoubanUrl(doubanUrl, proxyType, proxyUrl)

      let html: string
      if (proxyType !== 'direct' || cookie) {
        const resp = await fetch(targetUrl, {
          headers: { 'User-Agent': DOUBAN_UA, ...(cookie ? { Cookie: cookie } : {}) },
          redirect: 'follow',
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        html = await resp.text()
      } else {
        html = await fetchDoubanWithVerification(doubanUrl)
      }

      if (html.includes('process(cha)') || html.includes('载入中') || html.length < 500) {
        return new Response(JSON.stringify({ code: -1, message: '豆瓣反爬虫验证触发' }), {
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
    return new Response(JSON.stringify({ code: -1, message: err instanceof Error ? err.message : 'internal error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
}
