import type { DoubanComment } from '@/shared/types/douban'

export const DOUBAN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
}

export const PROXY_MAP: Record<string, string> = {
  'cmliussss-cdn-ali': 'https://m.douban.cmliussss.com',
}

export function resolveDoubanUrl(original: string, proxyType: string, proxyUrl: string): string {
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
  return original
}

export interface ChallengeForm {
  tok: string
  cha: string
  red: string
}

export function parseChallengePage(html: string): ChallengeForm | null {
  const tok = (html.match(/id="tok"[^>]*value="([^"]*)"/) || [])[1] || ''
  const cha = (html.match(/id="cha"[^>]*value="([^"]*)"/) || [])[1] || ''
  const red = (html.match(/id="red"[^>]*value="([^"]*)"/) || [])[1] || ''
  if (!tok || !cha || !red) return null
  return { tok, cha, red }
}

export function parseComments(html: string): DoubanComment[] {
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
