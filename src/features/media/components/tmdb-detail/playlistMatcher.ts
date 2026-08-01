import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import type { VideoItem } from '@ouonnki/cms-core'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import type { DetailSeason } from './types'

export interface PlaylistMatchItem {
  item: VideoItem
  score: number
  titleSimilarity: number
  seasonHints: number[]
  /** 命中的搜索关键词（主标题或具体别名），用于展示匹配流程 */
  matchedBy?: string
  /** 扣分原因明细（如"标题相似度不足（-12分）"），用于匹配详情展示 */
  deductions?: string[]
  /** 被过滤原因（标题相似度过低 / 扣分过多）；有值时该条目不算匹配候选，仅用于展示"为什么没匹配上" */
  filtered?: string
}

export interface SourceBestMatch {
  sourceCode: string
  sourceName: string
  bestMatch: PlaylistMatchItem | null
  alternatives: PlaylistMatchItem[]
}

export interface SeasonSourceMatches {
  season: DetailSeason
  sourceMatches: SourceBestMatch[]
}

interface SourceMeta {
  id: string
  name: string
}

interface BuildPlaylistMatchesParams {
  mediaType: TmdbMediaType
  items: VideoItem[]
  title: string
  alternativeTitles?: string[]
  releaseYear?: string
  seasons: DetailSeason[]
  sources: SourceMeta[]
  /** 回退搜索已完成，低分源直接过滤（85 替 80） */
  strictScore?: boolean
}

const FUSE_OPTIONS: IFuseOptions<VideoItem> = {
  keys: ['vod_name', 'vod_remarks', 'vod_sub'],
  threshold: 0.3,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
  ignoreFieldNorm: true,
  isCaseSensitive: false,
}

export const isEnglishText = (s: string): boolean => {
  const t = s.trim()
  if (!t) return false
  return [...t].every(c => c.charCodeAt(0) <= 127) && /[A-Za-z]/.test(t)
}

const parseChineseNumber = (value: string): number | null => {
  const normalized = value.replace(/\s+/g, '')
  if (!normalized) return null

  const map: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  }

  if (normalized === '十') return 10

  if (normalized.includes('十')) {
    const [left, right] = normalized.split('十')
    const tens = left ? map[left] : 1
    const units = right ? map[right] || 0 : 0
    if (Number.isFinite(tens)) {
      return tens * 10 + units
    }
  }

  if (normalized.length === 1 && normalized in map) {
    return map[normalized]
  }

  return null
}

/** 罗马数字转整数（I-XX / Ⅰ-Ⅻ 范围内的季号），非法返回 null */
const romanToNumber = (value: string): number | null => {
  // Unicode 罗马数字（Ⅱ 等单个字符）直接映射
  const unicodeMap: Record<string, number> = {
    Ⅰ: 1, Ⅱ: 2, Ⅲ: 3, Ⅳ: 4, Ⅴ: 5, Ⅵ: 6, Ⅶ: 7, Ⅷ: 8, Ⅸ: 9, Ⅹ: 10, Ⅺ: 11, Ⅻ: 12,
  }
  if (value.length === 1 && value in unicodeMap) return unicodeMap[value]
  // ASCII 罗马数字减法定则
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let total = 0
  let prev = 0
  for (let i = value.length - 1; i >= 0; i--) {
    const v = map[value[i]]
    if (!v) return null
    if (v < prev) total -= v
    else {
      total += v
      prev = v
    }
  }
  return total || null
}

const extractSeasonHints = (item: VideoItem): number[] => {
  const text = `${item.vod_name || ''} ${item.vod_remarks || ''} ${item.type_name || ''}`
  const hints = new Set<number>()

  const seasonRegex = /(?:第\s*([0-9一二两三四五六七八九十〇零]{1,3})\s*[季部篇])|(?:\bS(?:EASON)?\s*0*([0-9]{1,2})\b)|(?:\b([0-9]{1,2})\s*季\b)/gi

  let match: RegExpExecArray | null = seasonRegex.exec(text)
  while (match) {
    const [, cnValue, enValue, numValue] = match
    const numeric = enValue || numValue
    const seasonNumber = numeric
      ? Number.parseInt(numeric, 10)
      : cnValue
        ? /^\d+$/.test(cnValue) ? Number.parseInt(cnValue, 10) : parseChineseNumber(cnValue)
        : null

    if (seasonNumber && Number.isFinite(seasonNumber) && seasonNumber > 0 && seasonNumber < 100) {
      hints.add(seasonNumber)
    }

    match = seasonRegex.exec(text)
  }

  // 末尾裸数字：画江湖之不良人2 → 2（仅无其他季标记时使用）
  if (hints.size === 0) {
    const bareNumberRegex = /[一-鿿]\s*0*([0-9]{1,2})(?=\s*$|\s+[^季部篇])/g
    let bareMatch: RegExpExecArray | null = bareNumberRegex.exec(text)
    while (bareMatch) {
      const n = Number.parseInt(bareMatch[1], 10)
      if (n > 0 && n < 100) hints.add(n)
      bareMatch = bareNumberRegex.exec(text)
    }
  }

  // 范围季节：第1-3季 / 1-3季合集 / S1-S3
  const rangeRegex = /(?:第\s*)?([0-9]{1,3})\s*[-~至到]\s*([0-9]{1,3})\s*[季部篇]|S(?:EASON)?\s*([0-9]{1,2})\s*[-~]\s*S?(?:EASON)?\s*([0-9]{1,2})/gi

  match = rangeRegex.exec(text)
  while (match) {
    const rangeStart = match[1] || match[3]
    const rangeEnd = match[2] || match[4]
    if (rangeStart && rangeEnd) {
      const start = Number.parseInt(rangeStart, 10)
      const end = Number.parseInt(rangeEnd, 10)
      if (start > 0 && end > start && end - start <= 20) {
        for (let i = start; i <= end && i < 100; i++) {
          hints.add(i)
        }
      }
    }
    match = rangeRegex.exec(text)
  }

  // 罗马数字季号：无职转生II/无职转生Ⅱ → 2（紧跟中文标题后，后接非罗马字符或结尾；
  // 允许直接跟中文标题正文，如「无职转生II到了异世界…」，否则季号会被正文吞掉）
  const romanRegex = /([一-鿿])([IVXLCDMⅠ-Ⅻ]{1,4})(?=$|[^IVXLCDMⅠ-Ⅻ])/g
  let romanMatch: RegExpExecArray | null = romanRegex.exec(text)
  while (romanMatch) {
    const n = romanToNumber(romanMatch[2])
    if (n && Number.isFinite(n) && n > 0 && n < 100) {
      hints.add(n)
    }
    romanMatch = romanRegex.exec(text)
  }

  return Array.from(hints)
}

/**
 * 减分制评分，满分 100。
 * 完美匹配 = 100，各种不匹配逐项扣分。
 */
const scoreItem = (
  titleSimilarity: number,
  item: VideoItem,
  mediaType: TmdbMediaType,
  releaseYear: string | undefined,
  alternativeTitles?: string[],
  searchTitle?: string,
): { score: number; deductions: string[] } => {
  let s = 100
  const deductions: string[] = []

  const deduct = (points: number, reason: string) => {
    if (points <= 0) return
    s -= points
    deductions.push(`${reason}（-${points}分）`)
  }

  // 1. 标题不相似扣分 (0 ~ -50)
  deduct(Math.round((1 - titleSimilarity) * 50), `标题相似度不足（${Math.round(titleSimilarity * 100)}%）`)

  // 2. 译名未命中扣 -25，部分命中扣 -10，精确命中不扣
  // 注意：searchTitle 本身也算一个有效译名（vod_name 包含主标题即命中）
  const allAlts = searchTitle ? [searchTitle, ...(alternativeTitles || [])] : (alternativeTitles || [])
  const searchText = `${item.vod_name || ''} ${item.vod_sub || ''}`.toLowerCase()
  const nameOnly = (item.vod_name || '').toLowerCase()
  let altMiss = true
  let altPartial = false

  // 主标题去符号后完整匹配 → 视为精确命中（兼容 ":" vs "~"、"·" 等符号差异，
  // 避免正确完整标题被"别名占比 < 40%"误判为部分命中而扣分）
  const normalizedSearch = (searchTitle || '').toLowerCase().replace(/[^a-z0-9一-鿿]/g, '')
  const normalizedName = nameOnly.replace(/[^a-z0-9一-鿿]/g, '')
  const isExactTitle =
    Boolean(normalizedSearch) &&
    normalizedName.length > 0 &&
    (normalizedName === normalizedSearch ||
      normalizedName.includes(normalizedSearch) ||
      normalizedSearch.includes(normalizedName))

  if (isExactTitle) {
    // 主标题去符号精确命中 → 视为精确匹配，不扣译名分
    altMiss = false
    altPartial = false
  } else {
    for (const alt of allAlts) {
      const keyword = alt.toLowerCase().trim()
      if (!keyword) continue
      if (searchText.includes(keyword)) {
        // 统计 keyword 在 nameOnly 中的出现次数，用累计命中长度判断
        let hitCount = 0
        let hitIdx = 0
        while ((hitIdx = nameOnly.indexOf(keyword, hitIdx)) !== -1) {
          hitCount++
          hitIdx += keyword.length
        }
        const totalHitLen = hitCount * keyword.length
        const ratio = totalHitLen / Math.max(nameOnly.length, 1)
        if (ratio >= 0.4) { altMiss = false; altPartial = false; break }
        altMiss = false
        altPartial = true
      } else if (keyword.length >= 3) {
        for (let i = 0; i <= keyword.length - 3; i++) {
          if (searchText.includes(keyword.slice(i, i + 3))) {
            altMiss = false
            altPartial = true
            break
          }
        }
      }
    }
  }
  if (allAlts.length > 0) {
    if (altMiss) deduct(25, '译名未命中')
    else if (altPartial) deduct(10, '译名部分命中')
  }

  // 3. 年份不匹配扣分（从 vod_year 提取前 4 位数字，兼容 "2021–" 等非标准格式）
  const parsedVodYear = item.vod_year?.match(/\b(19|20)\d{2}\b/)?.[0]
  if (releaseYear && parsedVodYear) {
    const targetYear = Number(releaseYear)
    const itemYear = Number(parsedVodYear)
    if (Number.isFinite(targetYear) && Number.isFinite(itemYear)) {
      const diff = Math.abs(targetYear - itemYear)
      if (diff >= 5) deduct(10, `年份差异较大（${itemYear} vs ${targetYear}）`)
      else if (diff >= 3) deduct(5, `年份有差异（${itemYear} vs ${targetYear}）`)
      else if (diff >= 1) deduct(2, `年份略有差异（${itemYear} vs ${targetYear}）`)
    }
  }

  // 4. 媒体类型不匹配扣分
  const typeText = `${item.type_name || ''} ${item.vod_remarks || ''}`.toLowerCase()
  if (mediaType === 'movie') {
    if (/季|集|连载|更新/.test(typeText)) deduct(5, '疑似剧集')
  } else {
    if (/电影|movie|院线/.test(typeText)) deduct(5, '疑似电影')
  }

  // 5. 预告/花絮/解说/剪辑扣 -5（至少同部电影，只是形式问题）
  if (/预告|花絮|解说|剪辑|速看/.test(typeText)) {
    deduct(5, '预告/花絮/解说类')
  }

  // 5.5 配音/语言版本扣分：vod_name / vod_remarks / type_name 中含国语/台配/粤语/配音等
  const dubPattern = /国语|台配|粤语|配音|中配|日配|英配|国配|普通话/
  if (dubPattern.test(typeText) || dubPattern.test(nameOnly)) {
    deduct(8, '配音/语言版本')
  }

  // 6. 标题掺杂：vod_name 包含 title 但多了额外字符（如"重生，消失的她"）
  const searchLower = (searchTitle || '').toLowerCase().trim()
  if (searchLower && nameOnly.includes(searchLower)) {
    // 统计 title 在 nameOnly 中出现的次数，避免 title 本身重复（如"间谍过家家间谍过家家"）被误当掺杂
    let count = 0
    let idx = 0
    while ((idx = nameOnly.indexOf(searchLower, idx)) !== -1) {
      count++
      idx += searchLower.length
    }
    const totalSearchLen = count * searchLower.length
    let extra = nameOnly.length - totalSearchLen

    // TV 类型：去除常见的季号后缀，这些不应算作"标题掺杂"
    if (mediaType === 'tv') {
      const seasonSuffixPattern = /(?:第\s*(?:[0-9一二两三四五六七八九十]{1,3})\s*季|Season\s*[0-9]{1,2}|S[0-9]{1,2})/gi
      const cleanedName = nameOnly.replace(seasonSuffixPattern, '')
      const cleanedLen = cleanedName.trim().length
      extra = Math.max(0, cleanedLen - totalSearchLen)
    }

    // 去除年份后缀（如"剑来 2024"、"剑来 (2024)"），避免被当作标题掺杂扣分
    const yearTokens = nameOnly.match(/\s*\(?(?:19|20)\d{2}\)?\s*/g)
    if (yearTokens) {
      for (const token of yearTokens) {
        extra -= token.length
      }
    }
    extra = Math.max(0, extra)

    // 额外字符占比：extra 占 nameOnly 的比例越大，说明掺杂越严重
    const extraRatio = extra / Math.max(nameOnly.length, 1)

    if (extra > 2 && extraRatio > 0.15) {
      // 额外字符超过15%，按比例扣分，最多扣30
      deduct(Math.round(extraRatio * 30), '标题含额外字符')
    }
  }

  return { score: Math.max(0, Math.min(100, s)), deductions }
}

const searchWithFuse = (
  fuse: Fuse<VideoItem>,
  query: string,
): Map<string, { item: VideoItem; fuseScore: number; matchedBy: string }> => {
  const map = new Map<string, { item: VideoItem; fuseScore: number; matchedBy: string }>()
  if (!query) return map

  const results = fuse.search(query)
  for (const r of results) {
    const key = `${r.item.source_code || 'unknown'}::${r.item.vod_id}`
    const score = r.score ?? 1
    const existing = map.get(key)
    // 保留命中分数最优的关键词（主标题或别名），作为匹配流程依据
    if (!existing || score < existing.fuseScore) {
      map.set(key, { item: r.item, fuseScore: score, matchedBy: query })
    }
  }
  return map
}

const dedupeByVod = (items: PlaylistMatchItem[]) => {
  const map = new Map<string, PlaylistMatchItem>()
  items.forEach(entry => {
    const key = `${entry.item.source_code || 'unknown'}::${entry.item.vod_id}`
    const existing = map.get(key)
    if (!existing || existing.score < entry.score) {
      map.set(key, entry)
    }
  })

  return Array.from(map.values()).sort((a, b) => b.score - a.score)
}

/**
 * 提取标题中的拆分序号（如 Part 1 -> 1, Part 2 -> 2, 上部 -> 1, 下部 -> 2 等）
 * 未匹配到拆分后缀返回 null
 */
export const getSplitPartIndex = (name: string): number | null => {
  const trimmed = (name || '').trim()

  // 1. 匹配 Part.1 / Part 2 / Part01 等
  const partMatch = trimmed.match(/[Pp]art\s*\.?\s*(\d+)$/i)
  if (partMatch) {
    return Number.parseInt(partMatch[1], 10)
  }

  // 2. 匹配 上部/下部、前篇/后篇/后半部
  if (/[上|前][部集篇]?$/i.test(trimmed)) return 1
  if (/[下|后][部集篇]?|后半部?$/i.test(trimmed)) return 2

  return null
}

/** 兼容保留的原函数 */
export const hasSplitSuffix = (name: string): boolean =>
  getSplitPartIndex(name) !== null

/** 匹配条目排序规则：
 * 1. 分数降序
 * 2. 同分时无拆分后缀的完整标题优先
 * 3. 同为拆分标题时，Part 序号小的优先 (Part 1 > Part 2, 上部 > 下部)
 */
const compareEntries = (a: PlaylistMatchItem, b: PlaylistMatchItem): number => {
  if (b.score !== a.score) return b.score - a.score

  const aPartIndex = getSplitPartIndex(a.item.vod_name)
  const bPartIndex = getSplitPartIndex(b.item.vod_name)

  const aHasPart = aPartIndex !== null
  const bHasPart = bPartIndex !== null
  // 完整标题排在拆分标题前面
  if (aHasPart !== bHasPart) return aHasPart ? 1 : -1
  // 如果两者都是拆分标题，按 Part 序号升序排列 (Part 1 排在 Part 2 前面)
  if (aPartIndex !== null && bPartIndex !== null && aPartIndex !== bPartIndex) {
    return aPartIndex - bPartIndex
  }

  return 0
}

const groupBySource = (items: PlaylistMatchItem[]) => {
  const grouped = new Map<string, PlaylistMatchItem[]>()
  items.forEach(entry => {
    const sourceCode = entry.item.source_code || 'unknown'
    const list = grouped.get(sourceCode) || []
    list.push(entry)
    grouped.set(sourceCode, list)
  })
  grouped.forEach(list => list.sort(compareEntries))
  return grouped
}

const buildSourceOrder = (sources: SourceMeta[], grouped: Map<string, PlaylistMatchItem[]>) => {
  const ordered: SourceMeta[] = [...sources]
  const sourceSet = new Set(sources.map(source => source.id))

  grouped.forEach((entries, sourceCode) => {
    if (!sourceSet.has(sourceCode)) {
      ordered.push({
        id: sourceCode,
        name: entries[0]?.item.source_name || sourceCode || '未知源',
      })
    }
  })

  return ordered
}

const MIN_MATCH_SCORE = 80
const MIN_MATCH_SCORE_STRICT = 85

const toSourceMatches = (
  grouped: Map<string, PlaylistMatchItem[]>,
  orderedSources: SourceMeta[],
  threshold: number,
): SourceBestMatch[] => {
  const matches = orderedSources.map(source => {
    const entries = grouped.get(source.id) || []
    const best = entries[0]
    // 被过滤条目（filtered）不算最佳匹配，但仍留在 alternatives 供查看"为什么没匹配上"
    const bestMatch = best && !best.filtered && best.score > threshold ? best : null
    return {
      sourceCode: source.id,
      sourceName: source.name,
      bestMatch,
      alternatives: bestMatch ? entries.slice(1) : entries,
    }
  })

  // 源排序：按最佳匹配的综合分从高到低，无匹配项排最后
  return matches.sort((a, b) => {
    const aScore = a.bestMatch?.score ?? -1
    const bScore = b.bestMatch?.score ?? -1
    if (bScore !== aScore) return bScore - aScore
    return (a.sourceName || a.sourceCode).localeCompare(b.sourceName || b.sourceCode, 'zh-Hans-CN')
  })
}

const applySeasonScore = (entry: PlaylistMatchItem, seasonNumber: number): PlaylistMatchItem => {
  let s = entry.score
  const deductions = entry.deductions ? [...entry.deductions] : []
  const deduct = (points: number, reason: string) => {
    s -= points
    deductions.push(`${reason}（-${points}分）`)
  }
  const bonus = (points: number, reason: string) => {
    s += points
    deductions.push(`${reason}（+${points}分）`)
  }

  if (entry.seasonHints.length > 0) {
    if (entry.seasonHints.includes(seasonNumber)) {
      bonus(5, `季匹配奖励：标注 S${seasonNumber}`) // 明确标注目标季，奖励
    } else {
      // 明确标注了其他季，按距离分层惩罚（记录最近标注的季号便于说明）
      const nearestHint = entry.seasonHints.reduce((best, h) =>
        Math.abs(h - seasonNumber) < Math.abs(best - seasonNumber) ? h : best,
        entry.seasonHints[0],
      )
      const nearestDist = Math.abs(nearestHint - seasonNumber)
      if (nearestDist === 1) {
        deduct(35, `标注了 S${nearestHint}（相邻季）`)
      } else {
        deduct(50, `标注了 S${nearestHint}（远距）`)
      }
    }
  } else if (seasonNumber === 1) {
    // 无季信息且是第一季，不扣不奖（常见默认假设）
  } else {
    deduct(30, '缺少季信息（非 S1 无季标注）')
  }

  return { ...entry, score: Math.max(0, Math.min(100, s)), deductions }
}

export function buildPlaylistMatches({
  mediaType,
  items,
  title,
  alternativeTitles,
  releaseYear,
  seasons,
  sources,
  strictScore,
}: BuildPlaylistMatchesParams) {
  const threshold = strictScore ? MIN_MATCH_SCORE_STRICT : MIN_MATCH_SCORE
  if (!title || items.length === 0) {
    const emptyMatches = sources.map(source => ({
      sourceCode: source.id,
      sourceName: source.name,
      bestMatch: null,
      alternatives: [],
    }))
    return {
      candidates: [] as PlaylistMatchItem[],
      movieSourceMatches: (mediaType === 'movie' ? emptyMatches : []) as SourceBestMatch[],
      seasonSourceMatches: (mediaType === 'tv'
        ? seasons
            .filter(season => season.season_number > 0)
            .map(season => ({
              season,
              sourceMatches: emptyMatches,
            }))
        : []) as SeasonSourceMatches[],
    }
  }

  const fuse = new Fuse(items, FUSE_OPTIONS)

  const titleResults = searchWithFuse(fuse, title)

  // 译名搜索合并
  for (const altTitle of alternativeTitles || []) {
    const altResults = searchWithFuse(fuse, altTitle)
    for (const [key, entry] of altResults) {
      const existing = titleResults.get(key)
      if (!existing || entry.fuseScore < existing.fuseScore) {
        titleResults.set(key, entry)
      }
    }
  }

  const scored: PlaylistMatchItem[] = []
  const filteredOut: PlaylistMatchItem[] = []
  const matchedKeys = new Set(titleResults.keys())
  for (const { item, fuseScore, matchedBy } of titleResults.values()) {
    const titleSimilarity = 1 - Math.min(fuseScore, 1)
    const seasonHints = extractSeasonHints(item)
    const { score, deductions } = scoreItem(titleSimilarity, item, mediaType, releaseYear, alternativeTitles, title)

    if (score < 0) {
      // 保留扣分过多的条目，供"为什么没匹配上"展示
      filteredOut.push({ item, score: 0, titleSimilarity, seasonHints, matchedBy, deductions, filtered: '扣分过多' })
      continue
    }

    scored.push({ item, score, titleSimilarity, seasonHints, matchedBy, deductions })
  }

  // Fuse 未命中（标题相似度过低）的条目按源保留，让"无匹配"时能看到该源返回了什么、为何被过滤
  for (const item of items) {
    const key = `${item.source_code || 'unknown'}::${item.vod_id}`
    if (matchedKeys.has(key)) continue
    filteredOut.push({
      item,
      score: 0,
      titleSimilarity: 0,
      seasonHints: extractSeasonHints(item),
      filtered: '标题相似度过低',
    })
  }

  const deduped = dedupeByVod(scored)
  // 分组合并被过滤项（去重后），alternatives 里能看到"为什么没匹配"
  const grouped = groupBySource(dedupeByVod([...deduped, ...filteredOut]))
  const orderedSources = buildSourceOrder(sources, grouped)

  if (mediaType === 'movie') {
    return {
      candidates: deduped,
      movieSourceMatches: toSourceMatches(grouped, orderedSources, threshold),
      seasonSourceMatches: [] as SeasonSourceMatches[],
    }
  }

  const tvSeasons = seasons.filter(season => season.season_number > 0)
  const seasonSourceMatches: SeasonSourceMatches[] = tvSeasons.map(season => {
    const seasonGrouped = new Map<string, PlaylistMatchItem[]>()
    // 季级年份：优先当前季首播年，否则回退剧级 releaseYear（避免整剧年份误扣后续季）
    const seasonYear = season.air_date ? season.air_date.slice(0, 4) : releaseYear

    grouped.forEach((entries, sourceCode) => {
      const scoredEntries = entries
        .map(entry => {
          // 用季级年份重算标题评分（年份差异按当前季判定），再叠加季分
          const { score, deductions } = scoreItem(entry.titleSimilarity, entry.item, mediaType, seasonYear, alternativeTitles, title)
          return applySeasonScore({ ...entry, score, deductions }, season.season_number)
        })
        .sort(compareEntries)
      seasonGrouped.set(sourceCode, scoredEntries)
    })

    return {
      season,
      sourceMatches: toSourceMatches(seasonGrouped, orderedSources, threshold),
    }
  })

  return {
    candidates: deduped,
    movieSourceMatches: [] as SourceBestMatch[],
    seasonSourceMatches,
  }
}
