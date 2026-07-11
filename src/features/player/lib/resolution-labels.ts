/**
 * 清晰度标签解析工具
 * 移植自 KVideo，支持从文本、维度、m3u8 manifest 中提取分辨率标签
 */

export interface ResolutionLabel {
  label: string
  color: string
  width?: number
  height?: number
}

const DIMENSION_PATTERN = /(\d{3,4})\s*[xX]\s*(\d{3,4})/g

/**
 * 文本标签优先级表：从高到低
 * 每个 pattern 使用单词边界断言 (?:^|[^\d]) 避免文件名误匹配
 */
const TEXT_QUALITY_PATTERNS: { pattern: RegExp; width?: number; height?: number; label: string; color: string }[] = [
  { pattern: /(?:^|[^\d])(4320p?|8k)(?:[^\d]|$)/i, width: 7680, height: 4320, label: '8K',  color: 'bg-rose-500' },
  { pattern: /(?:^|[^\d])(2160p?|4k|uhd)(?:[^\d]|$)/i, width: 3840, height: 2160, label: '4K',  color: 'bg-amber-500' },
  { pattern: /(?:^|[^\d])(1440p?|2k|qhd)(?:[^\d]|$)/i, width: 2560, height: 1440, label: '2K',  color: 'bg-emerald-500' },
  { pattern: /(?:^|[^\d])(1080p?|1080i|fhd|full\s*hd)(?:[^\d]|$)/i, width: 1920, height: 1080, label: '1080P', color: 'bg-green-500' },
  { pattern: /(?:^|[^\d])(720p?|hd720)(?:[^\d]|$)/i, width: 1280, height: 720, label: '720P', color: 'bg-teal-500' },
  { pattern: /(?:^|[^\d])540p?(?:[^\d]|$)/i, width: 960, height: 540, label: '540P', color: 'bg-cyan-500' },
  { pattern: /(?:^|[^\d])480p?(?:[^\d]|$)/i, width: 854, height: 480, label: '480P', color: 'bg-sky-500' },
  { pattern: /(?:^|[^\d])360p?(?:[^\d]|$)/i, width: 640, height: 360, label: '360P', color: 'bg-gray-500' },
  { pattern: /(?:^|[^\d])240p?(?:[^\d]|$)/i, width: 426, height: 240, label: '240P', color: 'bg-gray-500' },
  { pattern: /(?:^|[^\d])144p?(?:[^\d]|$)/i, width: 256, height: 144, label: '144P', color: 'bg-gray-500' },
]

const QUALITY_RANK: Record<string, number> = {
  '8K': 780, '4K': 700, '2K': 620,
  '1080P': 540, '720P': 420, '540P': 300,
  '480P': 260, '360P': 220, '240P': 180, '144P': 160,
}

/**
 * 根据实际宽高推断分辨率标签
 */
export function getResolutionLabel(width: number, height: number): ResolutionLabel {
  const normalizedWidth = Math.max(width, height)
  const normalizedHeight = Math.min(width, height)

  if (normalizedHeight >= 4320) return { width: normalizedWidth, height: normalizedHeight, label: '8K', color: 'bg-rose-500' }
  if (normalizedHeight >= 2160) return { width: normalizedWidth, height: normalizedHeight, label: '4K', color: 'bg-amber-500' }
  if (normalizedHeight >= 1440) return { width: normalizedWidth, height: normalizedHeight, label: '2K', color: 'bg-emerald-500' }
  if (normalizedHeight >= 1080) return { width: normalizedWidth, height: normalizedHeight, label: '1080P', color: 'bg-green-500' }
  if (normalizedHeight >= 720)  return { width: normalizedWidth, height: normalizedHeight, label: '720P', color: 'bg-teal-500' }
  if (normalizedHeight >= 540)  return { width: normalizedWidth, height: normalizedHeight, label: '540P', color: 'bg-cyan-500' }
  if (normalizedHeight >= 480)  return { width: normalizedWidth, height: normalizedHeight, label: '480P', color: 'bg-sky-500' }
  if (normalizedHeight >= 360)  return { width: normalizedWidth, height: normalizedHeight, label: '360P', color: 'bg-gray-500' }
  if (normalizedHeight >= 240)  return { width: normalizedWidth, height: normalizedHeight, label: '240P', color: 'bg-gray-500' }
  if (normalizedHeight >= 144)  return { width: normalizedWidth, height: normalizedHeight, label: '144P', color: 'bg-gray-500' }
  return { width: normalizedWidth, height: normalizedHeight, label: `${normalizedHeight}P`, color: 'bg-gray-500' }
}

function getCandidateRank(candidate: ResolutionLabel): number {
  if (candidate.width && candidate.height) return candidate.width * candidate.height
  return QUALITY_RANK[candidate.label] || 0
}

export function chooseHigherQuality(
  current: ResolutionLabel | null,
  candidate: ResolutionLabel | null,
): ResolutionLabel | null {
  if (!candidate) return current
  if (!current) return candidate
  return getCandidateRank(candidate) > getCandidateRank(current) ? candidate : current
}

/**
 * 从多个文本值中提取最高分辨率标签
 * 遍历维度模式 + 文本标签模式，取最高
 */
export function extractResolutionHint(...values: Array<string | undefined>): ResolutionLabel | null {
  let best: ResolutionLabel | null = null

  for (const value of values) {
    if (!value) continue

    let match: RegExpExecArray | null
    DIMENSION_PATTERN.lastIndex = 0
    while ((match = DIMENSION_PATTERN.exec(value)) !== null) {
      const width = Number.parseInt(match[1], 10)
      const height = Number.parseInt(match[2], 10)
      if (width > 0 && height > 0) {
        best = chooseHigherQuality(best, getResolutionLabel(width, height))
      }
    }

    for (const pattern of TEXT_QUALITY_PATTERNS) {
      if (!pattern.pattern.test(value)) continue
      best = chooseHigherQuality(best, {
        label: pattern.label,
        color: pattern.color,
        width: pattern.width,
        height: pattern.height,
      })
    }
  }

  return best
}

/**
 * 从视频源名称/备注中提取清晰度标签（用于源列表 badge）
 * 返回最高质量的一个标签
 */
export function extractBestQualityLabel(...values: Array<string | undefined>): string {
  const best = extractResolutionHint(...values)
  return best?.label ?? ''
}

/**
 * 从文本提取所有匹配的清晰度标签（去重，最多 2 个）
 * 兼容原有 extractQualityLabel 接口
 */
export function extractQualityTags(...values: Array<string | undefined>): string {
  const text = values.filter(Boolean).join(' ')
  if (!text.trim()) return ''

  const matches: string[] = []
  for (const pattern of TEXT_QUALITY_PATTERNS) {
    if (pattern.pattern.test(text)) {
      matches.push(pattern.label)
    }
  }

  // 也检查维度
  let dimMatch: RegExpExecArray | null
  DIMENSION_PATTERN.lastIndex = 0
  while ((dimMatch = DIMENSION_PATTERN.exec(text)) !== null) {
    const w = Number.parseInt(dimMatch[1], 10)
    const h = Number.parseInt(dimMatch[2], 10)
    if (w > 0 && h > 0) {
      const label = getResolutionLabel(w, h)
      matches.push(label.label)
    }
  }

  const unique = [...new Set(matches)]
  return unique.slice(0, 2).join(' ')
}

// === m3u8 清单分辨率解析 ===

const HLS_RESOLUTION_PATTERN = /RESOLUTION=(\d+)x(\d+)/gi

/**
 * 从 m3u8 manifest 文本中提取最高分辨率
 * 仅解析 #EXT-X-STREAM-INF 标签中的 RESOLUTION=WxH（权威来源）
 */
export function parseResolutionFromManifest(content: string): ResolutionLabel | null {
  let best: ResolutionLabel | null = null

  // 只匹配 RESOLUTION=WxH（区分大小写，通常是大写）
  let match: RegExpExecArray | null
  HLS_RESOLUTION_PATTERN.lastIndex = 0
  while ((match = HLS_RESOLUTION_PATTERN.exec(content)) !== null) {
    const width = Number.parseInt(match[1], 10)
    const height = Number.parseInt(match[2], 10)
    if (width > 0 && height > 0) {
      best = chooseHigherQuality(best, getResolutionLabel(width, height))
    }
  }

  return best
}

/**
 * 从 master m3u8 中提取所有变体 playlist URL
 */
export function extractVariantPlaylistUrls(content: string, baseUrl: string): string[] {
  const urls = new Set<string>()
  const lines = content.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line) continue

    // I-FRAME-STREAM-INF 包含 URI="..."
    if (line.startsWith('#EXT-X-I-FRAME-STREAM-INF') && line.includes('URI="')) {
      const uriMatch = line.match(/URI="([^"]+)"/i)
      if (uriMatch?.[1]) {
        try { urls.add(new URL(uriMatch[1], baseUrl).toString()) } catch { /* skip */ }
      }
      continue
    }

    if (!line.startsWith('#EXT-X-STREAM-INF')) continue

    // 下一行是变体 playlist URL
    const candidate = lines[index + 1]?.trim()
    if (!candidate || candidate.startsWith('#')) continue

    try { urls.add(new URL(candidate, baseUrl).toString()) } catch { /* skip */ }
  }

  return Array.from(urls)
}
