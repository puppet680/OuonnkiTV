import { getCountryChineseName } from '@/shared/constants/countries'
import type { TmdbMediaItem, TmdbMediaType } from '@/shared/types/tmdb'
import type {
  DetailImage,
  DetailRecommendationRaw,
  DetailSeason,
  DetailSpokenLanguage,
  TmdbRichDetail,
} from './types'

export const getReleaseYear = (value: string | undefined) => (value ? value.slice(0, 4) : '')

export const formatRuntime = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return ''
  const hour = Math.floor(minutes / 60)
  const min = minutes % 60
  if (hour === 0) return `${min}分钟`
  if (min === 0) return `${hour}小时`
  return `${hour}小时${min}分钟`
}

export const formatLargeNumber = (value: number | undefined) => {
  if (!Number.isFinite(value || 0)) return ''
  return new Intl.NumberFormat('zh-CN').format(value || 0)
}

export const formatCurrencyUSD = (value: number | undefined) => {
  if (!Number.isFinite(value || 0) || (value || 0) <= 0) return ''
  return `$${new Intl.NumberFormat('en-US').format(value || 0)}`
}

export const mapBooleanLabel = (value: boolean | undefined) => {
  if (value === undefined) return ''
  return value ? '是' : '否'
}

/** 优先级：TW > HK > CN > US，取第一个非空分级 */
const CERT_PRIORITY_COUNTRIES = ['TW', 'HK', 'CN', 'US']

/** 分级说明映射 */
const CERT_DESCRIPTIONS: Record<string, string> = {
  '普遍級': '适合任何年龄人士观看',
  '保護級': '未满 6 岁不得观看，6-12 岁需家长陪同',
  '輔12級': '未满 12 岁不得观看，12-18 岁需家长辅导',
  '輔12': '未满 12 岁不得观看，12-18 岁需家长辅导',
  '輔15級': '未满 15 岁不得观看',
  '輔15': '未满 15 岁不得观看',
  '限制級': '只准 18 岁或以上人士观看',
  I: '适合任何年龄人士观看',
  IIA: '儿童不宜',
  IIB: '青少年及儿童不宜',
  III: '只准 18 岁或以上人士观看',
  R: '限制级 — 17 岁以下需家长陪同',
  'NC-17': '17 岁以下不得观看',
  'PG-13': '13 岁以下需家长陪同',
  PG: '建议家长陪同观看',
  G: '一般观众皆可观赏',
  '18+': '只准 18 岁或以上人士观看',
  '18': '只准 18 岁或以上人士观看',
  '0+': '适合所有年龄观看',
}

export const describeCertification = (cert: string): string => {
  if (!cert) return ''
  const desc = CERT_DESCRIPTIONS[cert]
  return desc ? `${cert} — ${desc}` : cert
}

/** 分级颜色 */
const CERT_COLOR_CLASS: Record<string, string> = {
  // 成人/限制
  '成人': 'bg-red-600/80 hover:bg-red-600',
  '限制級': 'bg-red-600/80 hover:bg-red-600',
  '18+': 'bg-red-600/80 hover:bg-red-600',
  '18': 'bg-red-600/80 hover:bg-red-600',
  III: 'bg-red-600/80 hover:bg-red-600',
  R: 'bg-red-600/80 hover:bg-red-600',
  'NC-17': 'bg-red-600/80 hover:bg-red-600',
  // 辅导/中度
  '輔15級': 'bg-orange-500/80 hover:bg-orange-500',
  '輔15': 'bg-orange-500/80 hover:bg-orange-500',
  IIB: 'bg-orange-500/80 hover:bg-orange-500',
  // 12+/轻度
  '輔12級': 'bg-amber-500/80 hover:bg-amber-500',
  '輔12': 'bg-amber-500/80 hover:bg-amber-500',
  IIA: 'bg-amber-500/80 hover:bg-amber-500',
  'PG-13': 'bg-amber-500/80 hover:bg-amber-500',
  // 全年龄
  '普遍級': 'bg-emerald-500/80 hover:bg-emerald-500',
  '保護級': 'bg-emerald-500/80 hover:bg-emerald-500',
  I: 'bg-emerald-500/80 hover:bg-emerald-500',
  PG: 'bg-emerald-500/80 hover:bg-emerald-500',
  G: 'bg-emerald-500/80 hover:bg-emerald-500',
  '0+': 'bg-emerald-500/80 hover:bg-emerald-500',
}

export const getCertColor = (cert: string): string => {
  return CERT_COLOR_CLASS[cert] || 'bg-amber-500/80 hover:bg-amber-500'
}

/** 获取分级简写（Hero 标签用） */
export const getCertShort = (
  adult: boolean | undefined,
  releaseDates?: TmdbRichDetail['release_dates'],
): string => {
  if (adult) return '成人'
  const cert = pickCertification(adult, releaseDates)
  return cert || ''
}

/** 获取分级完整说明（基础信息用） */
export const getCertFull = (
  adult: boolean | undefined,
  releaseDates?: TmdbRichDetail['release_dates'],
): string => {
  if (adult) return '成人 — 成人内容'
  const cert = pickCertification(adult, releaseDates)
  return cert ? describeCertification(cert) : ''
}

const pickCertification = (
  adult: boolean | undefined,
  releaseDates?: TmdbRichDetail['release_dates'],
): string | null => {
  if (adult) return '成人'

  if (releaseDates?.results) {
    const byCountry = new Map(releaseDates.results.map(c => [c.iso_3166_1, c]))
    for (const code of CERT_PRIORITY_COUNTRIES) {
      const country = byCountry.get(code)
      const cert = country?.release_dates?.find(rd => rd.certification?.trim())?.certification?.trim()
      if (cert && cert !== 'NR') return cert
    }
    for (const country of releaseDates.results) {
      const cert = country.release_dates?.find(rd => rd.certification?.trim())?.certification?.trim()
      if (cert && cert !== 'NR') return cert
    }
  }
  return null
}

const normalizeRecommendation = (
  item: DetailRecommendationRaw,
  mediaType: TmdbMediaType,
): TmdbMediaItem | null => {
  const title = (item.title || item.name || '').trim()
  if (!title) return null

  return {
    id: item.id,
    mediaType,
    title,
    originalTitle: item.original_title || item.original_name || title,
    overview: item.overview || '',
    posterPath: item.poster_path ?? null,
    backdropPath: item.backdrop_path ?? null,
    logoPath: null,
    releaseDate: item.release_date || item.first_air_date || '',
    voteAverage: item.vote_average || 0,
    voteCount: item.vote_count || 0,
    popularity: item.popularity || 0,
    genreIds: item.genre_ids || [],
    originalLanguage: item.original_language || '',
    originCountry: item.origin_country || [],
  }
}

export const extractRecommendations = (detail: TmdbRichDetail, mediaType: TmdbMediaType) => {
  const fromRecommendations = detail.recommendations?.results || []
  const fromSimilar = detail.similar?.results || []
  const uniqueMap = new Map<number, TmdbMediaItem>()

  ;[...fromRecommendations, ...fromSimilar].forEach(item => {
    const normalized = normalizeRecommendation(item, mediaType)
    if (normalized && !uniqueMap.has(normalized.id)) {
      uniqueMap.set(normalized.id, normalized)
    }
  })

  return Array.from(uniqueMap.values()).slice(0, 18)
}

export const pickHeroLogo = (logos: DetailImage[]) => {
  if (logos.length === 0) return null
  const sorted = logos
    .slice()
    .sort(
      (a, b) => (b.vote_average || 0) - (a.vote_average || 0) || (b.vote_count || 0) - (a.vote_count || 0),
    )

  return sorted.find(item => item.iso_639_1 === 'zh') || sorted.find(item => item.iso_639_1 === 'en') || sorted[0]
}

const languageDisplayNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['zh-Hans', 'zh-CN', 'en'], { type: 'language' })
    : null

export const mapCountryCodeToName = (countryCode: string) => {
  const normalized = countryCode.trim().toUpperCase()
  if (!normalized) return ''
  return getCountryChineseName(normalized, null, null)
}

export const mapLanguageCodeToName = (languageCode: string | undefined, spokenLanguages: DetailSpokenLanguage[]) => {
  if (!languageCode) return ''
  const normalized = languageCode.toLowerCase()

  const matched = spokenLanguages.find(language => language.iso_639_1.toLowerCase() === normalized)
  if (matched) {
    return matched.name || matched.english_name || normalized
  }

  return languageDisplayNames?.of(normalized) || normalized
}

export const mapTvTypeLabel = (typeValue: string | undefined) => {
  if (!typeValue) return ''
  const mapping: Record<string, string> = {
    Scripted: '剧情剧',
    Reality: '真人秀',
    Documentary: '纪录片',
    News: '新闻节目',
    'Talk Show': '脱口秀',
    Miniseries: '迷你剧',
    Video: '视频节目',
  }
  return mapping[typeValue] || typeValue
}

export interface TranslationTitleEntry {
  countryCode: string
  countryName: string
  title: string
}

/**
 * 从 TMDB alternative_titles 中提取中国大陆别名
 * CN 返回的 title 已是简体中文，无需繁简转换
 * 过滤掉与已有标题重复的条目
 */
export function extractTranslationTitles(
  alternativeTitles: TmdbRichDetail['alternative_titles'] | undefined,
  existingTitles: string[],
): TranslationTitleEntry[] {
  // TV shows 返回 results，movies 返回 titles
  const titles = alternativeTitles?.results ?? alternativeTitles?.titles
  if (!titles?.length) return []

  const normalize = (s: string) =>
    s.trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/！/g, '!')
      .replace(/？/g, '?')
      .replace(/（/g, '(')
      .replace(/）/g, ')')

  const normalizedExisting = new Set(existingTitles.map(normalize))

  const entries: TranslationTitleEntry[] = []

  for (const t of titles) {
    if (t.iso_3166_1 !== 'CN') continue

    const title = t.title?.trim()
    if (!title) continue

    if (normalizedExisting.has(normalize(title))) continue

    entries.push({
      countryCode: 'CN',
      countryName: t.type || '中国大陆',
      title,
    })
  }

  return entries
}

const CN_NUMBER_MAP: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3,
  四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
}

const parseChineseNumber = (value: string): number | null => {
  const normalized = value.replace(/\s+/g, '')
  if (!normalized) return null

  if (normalized === '十') return 10

  if (normalized.includes('十')) {
    const [left, right] = normalized.split('十')
    const tens = left ? CN_NUMBER_MAP[left] : 1
    const units = right ? CN_NUMBER_MAP[right] || 0 : 0
    if (Number.isFinite(tens)) return tens * 10 + units
  }

  if (normalized.length === 1 && normalized in CN_NUMBER_MAP) {
    return CN_NUMBER_MAP[normalized]
  }

  return null
}

/**
 * 从单个别名标题中提取季数信息
 * 支持："咒术回战 第二季"、"咒术回战 第3季"、"Season 2"、"S2" 等
 */
export function extractSeasonFromTitle(title: string): number | null {
  const text = title.trim()
  if (!text) return null

  // 匹配中文：第 X 季/部/篇
  const cnMatch = text.match(/第\s*([0-9一二两三四五六七八九十〇零]{1,3})\s*[季部篇]/)
  if (cnMatch) {
    const cnValue = cnMatch[1]
    if (/^\d+$/.test(cnValue)) {
      const num = Number.parseInt(cnValue, 10)
      if (num > 0 && num < 100) return num
    } else {
      const num = parseChineseNumber(cnValue)
      if (num && num > 0 && num < 100) return num
    }
  }

  // 匹配英文：Season X 或 SX
  const enMatch = text.match(/\bS(?:eason)?\s*(\d{1,2})\b/i)
  if (enMatch) {
    const num = Number.parseInt(enMatch[1], 10)
    if (num > 0 && num < 100) return num
  }

  // 匹配中文数字 + 季
  const suffixMatch = text.match(/[第\s]?([0-9一二两三四五六七八九十]{1,3})\s*季\b/)
  if (suffixMatch) {
    const val = suffixMatch[1]
    if (/^\d+$/.test(val)) {
      const num = Number.parseInt(val, 10)
      if (num > 0 && num < 100) return num
    } else {
      const num = parseChineseNumber(val)
      if (num && num > 0 && num < 100) return num
    }
  }

  return null
}

/**
 * 从别名标题中推断额外的季数，扩充 seasons 列表
 * 用于 TMDB 只有 1 季但译名标注了多个季数的情况
 */
export function augmentSeasonsFromTitles(
  seasons: DetailSeason[],
  titles: string[],
): DetailSeason[] {
  if (!titles.length) return seasons

  const existingSeasonNumbers = new Set(seasons.map(s => s.season_number))
  const result = [...seasons]

  for (const title of titles) {
    const seasonNumber = extractSeasonFromTitle(title)
    if (seasonNumber && !existingSeasonNumbers.has(seasonNumber)) {
      existingSeasonNumbers.add(seasonNumber)
      result.push({
        id: -seasonNumber,
        season_number: seasonNumber,
        name: `第 ${seasonNumber} 季`,
        episode_count: 0,
        overview: '',
        air_date: undefined,
        poster_path: null,
      })
    }
  }

  return result
}
