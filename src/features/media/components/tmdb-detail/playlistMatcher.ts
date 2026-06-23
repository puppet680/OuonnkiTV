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

/** 标题相似度阈值，低于此值的候选项被过滤 */
const MIN_TITLE_SIMILARITY = 0.28

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
): number => {
  let s = 100

  // 1. 标题不相似扣分 (0 ~ -50)
  s -= Math.round((1 - titleSimilarity) * 50)

  // 2. 译名未命中扣 -25，部分命中扣 -10，精确命中不扣
  // 注意：searchTitle 本身也算一个有效译名（vod_name 包含主标题即命中）
  const allAlts = searchTitle ? [searchTitle, ...(alternativeTitles || [])] : (alternativeTitles || [])
  const searchText = `${item.vod_name || ''} ${item.vod_sub || ''}`.toLowerCase()
  const nameOnly = (item.vod_name || '').toLowerCase()
  let altMiss = true
  let altPartial = false
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
  if (allAlts.length > 0) {
    if (altMiss) s -= 25
    else if (altPartial) s -= 10
  }

  // 3. 年份不匹配扣分
  if (releaseYear && item.vod_year) {
    const targetYear = Number(releaseYear)
    const itemYear = Number(item.vod_year)
    if (Number.isFinite(targetYear) && Number.isFinite(itemYear)) {
      const diff = Math.abs(targetYear - itemYear)
      if (diff >= 5) s -= 10
      else if (diff >= 3) s -= 5
      else if (diff >= 1) s -= 2
    }
  }

  // 4. 媒体类型不匹配扣分
  const typeText = `${item.type_name || ''} ${item.vod_remarks || ''}`.toLowerCase()
  if (mediaType === 'movie') {
    if (/季|集|连载|更新/.test(typeText)) s -= 5
  } else {
    if (/电影|movie|院线/.test(typeText)) s -= 5
  }

  // 5. 预告/花絮/解说/剪辑扣 -5（至少同部电影，只是形式问题）
  if (/预告|花絮|解说|剪辑|速看/.test(typeText)) {
    s -= 5
  }

  // 5.5 配音/语言版本扣分：vod_name / vod_remarks / type_name 中含国语/台配/粤语/配音等
  const dubPattern = /国语|台配|粤语|配音|中配|日配|英配|国配|普通话/
  if (dubPattern.test(typeText) || dubPattern.test(nameOnly)) {
    s -= 8
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
      s -= Math.round(extraRatio * 30)
    }
  }

  return Math.max(0, Math.min(100, s))
}

const searchWithFuse = (
  fuse: Fuse<VideoItem>,
  query: string,
): Map<string, { item: VideoItem; fuseScore: number }> => {
  const map = new Map<string, { item: VideoItem; fuseScore: number }>()
  if (!query) return map

  const results = fuse.search(query)
  for (const r of results) {
    const key = `${r.item.source_code || 'unknown'}::${r.item.vod_id}`
    const score = r.score ?? 1
    const existing = map.get(key)
    if (!existing || score < existing.fuseScore) {
      map.set(key, { item: r.item, fuseScore: score })
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

const groupBySource = (items: PlaylistMatchItem[]) => {
  const grouped = new Map<string, PlaylistMatchItem[]>()
  items.forEach(entry => {
    const sourceCode = entry.item.source_code || 'unknown'
    const list = grouped.get(sourceCode) || []
    list.push(entry)
    grouped.set(sourceCode, list)
  })
  grouped.forEach(list => list.sort((a, b) => b.score - a.score))
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
    return {
      sourceCode: source.id,
      sourceName: source.name,
      bestMatch: best && best.score > threshold ? best : null,
      alternatives: best && best.score > threshold ? entries.slice(1) : entries,
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

  if (entry.seasonHints.length > 0) {
    if (entry.seasonHints.includes(seasonNumber)) {
      s += 5 // 明确标注目标季，奖励
    } else {
      // 明确标注了其他季，按距离分层惩罚
      const nearestDist = entry.seasonHints.reduce((best, h) => {
        const dist = Math.abs(h - seasonNumber)
        return dist < best ? dist : best
      }, Infinity)
      if (nearestDist === 1) {
        s -= 35 // 相邻季但标注了其他季号，大概率不匹配
      } else {
        s -= 50 // 远距离，几乎确定不是这个季
      }
    }
  } else if (seasonNumber === 1) {
    // 无季信息且是第一季，不扣不奖（常见默认假设）
  } else {
    s -= 30 // 无季标注作为非 S1 匹配，极不可靠
  }

  return { ...entry, score: Math.max(0, Math.min(100, s)) }
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
  for (const { item, fuseScore } of titleResults.values()) {
    const titleSimilarity = 1 - Math.min(fuseScore, 1)
    if (titleSimilarity < MIN_TITLE_SIMILARITY) continue

    const score = scoreItem(titleSimilarity, item, mediaType, releaseYear, alternativeTitles, title)

    if (score < 0) continue

    scored.push({
      item,
      score,
      titleSimilarity,
      seasonHints: extractSeasonHints(item),
    })
  }

  const deduped = dedupeByVod(scored)
  const grouped = groupBySource(deduped)
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

    grouped.forEach((entries, sourceCode) => {
      const scoredEntries = entries
        .map(entry => applySeasonScore(entry, season.season_number))
        .sort((a, b) => b.score - a.score)
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
