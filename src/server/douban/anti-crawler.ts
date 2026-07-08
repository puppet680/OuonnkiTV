import * as cheerio from 'cheerio'
import { createHash } from 'crypto'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

interface CookieCache { cookie: string; expiresAt: number }
let cookieCache: CookieCache | null = null

function sha512(data: string): string {
  return createHash('sha512').update(data).digest('hex')
}

function proofOfWork(data: string, difficulty = 4): number {
  const target = '0'.repeat(difficulty)
  let nonce = 0
  while (true) {
    nonce++
    if (sha512(data + nonce).startsWith(target)) return nonce
  }
}

function parseChallengePage(html: string) {
  const $ = cheerio.load(html)
  const tok = $('#tok').val() as string
  const cha = $('#cha').val() as string
  const red = $('#red').val() as string
  if (!tok || !cha || !red) return null
  return { tok, cha, red }
}

export async function fetchDoubanWithVerification(url: string, extraHeaders?: Record<string, string>): Promise<string> {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Referer': 'https://movie.douban.com/',
    ...extraHeaders,
  }

  // try cached cookie first
  if (cookieCache && Date.now() < cookieCache.expiresAt - 20000) {
    const resp = await fetch(url, { headers: { ...headers, Cookie: cookieCache.cookie } })
    if (resp.ok) {
      return await resp.text()
    }
    cookieCache = null
  }

  // first attempt: follow redirect
  let resp = await fetch(url, { headers, redirect: 'manual' })

  // handle anti-crawler redirect
  if (resp.status === 302) {
    const location = resp.headers.get('location')
    if (location?.includes('sec.douban.com')) {
      // get challenge page
      const verifyResp = await fetch(location, { headers })
      const verifyHtml = await verifyResp.text()
      const form = parseChallengePage(verifyHtml)
      if (!form) throw new Error('Failed to parse douban challenge page')

      // solve proof-of-work
      const sol = proofOfWork(form.cha)
      console.log(`[Douban] PoW solved: nonce=${sol}`)

      // submit solution
      const body = new URLSearchParams({ tok: form.tok, cha: form.cha, sol: String(sol), red: form.red })
      const submitResp = await fetch('https://sec.douban.com/c', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        redirect: 'manual',
      })

      const setCookie = submitResp.headers.get('set-cookie')
      if (setCookie) {
        const match = setCookie.match(/dbsawcv1=([^;]+)/)
        const cookie = match ? `dbsawcv1=${match[1]}` : setCookie.split(';')[0]
        cookieCache = { cookie, expiresAt: Date.now() + 300000 } // 5 min
      }

      // retry with cookie
      resp = await fetch(url, { headers: { ...headers, Cookie: cookieCache?.cookie || '' } })
    }
  }

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return await resp.text()
}
