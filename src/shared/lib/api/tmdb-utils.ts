import { z } from 'zod'
import { getTmdbClient, normalizeToMediaItem } from '@/shared/lib/tmdb'
import type { TmdbMediaItem, TmdbMediaType, TmdbPagination } from '@/shared/types/tmdb'

// ---------- zod schema（外部 TMDB 响应结构校验，unknown 进校验后出） ----------

export const tmdbPageSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())),
  page: z.number().optional(),
  total_pages: z.number().optional(),
  total_results: z.number().optional(),
})

export const tmdbGenresSchema = z.object({
  genres: z.array(z.object({ id: z.number(), name: z.string() })),
})

export const tmdbCountriesSchema = z.array(
  z.object({
    iso_3166_1: z.string(),
    english_name: z.string(),
    native_name: z.string(),
  }),
)

// ---------- 工具 ----------

export type TmdbClient = ReturnType<typeof getTmdbClient>
type TmdbLang = NonNullable<Parameters<TmdbClient['search']['multi']>[0]>['language']

/** tmdb-ts 的 language 参数是严格字面量类型，动态配置值需安全收窄（不用 any） */
export function langOpts(language: string): { language: TmdbLang } {
  return { language: language as TmdbLang }
}

/** tmdb-ts 的 options 类型不含 signal，包装后作为变量传入可避开多余属性检查 */
export function withSignal<T extends object>(opts: T, signal?: AbortSignal): T & { signal?: AbortSignal } {
  return signal ? { ...opts, signal } : opts
}

export function isTmdbMediaType(value: unknown): value is TmdbMediaType {
  return value === 'movie' || value === 'tv'
}

/** 按条目自带 media_type 规范化；非 movie/tv 条目丢弃 */
export function normalizeListResults(results: Array<Record<string, unknown>>): TmdbMediaItem[] {
  return results.flatMap(item => {
    if (!isTmdbMediaType(item.media_type)) return []
    return [normalizeToMediaItem(item, item.media_type)]
  })
}

/** 固定 mediaType 规范化（列表/发现等接口） */
export function normalizeFixedType(results: Array<Record<string, unknown>>, type: TmdbMediaType): TmdbMediaItem[] {
  return results.map(item => normalizeToMediaItem(item, type))
}

/**
 * 提取 TMDB 列表响应并规范化
 * @param result - TMDB 列表接口返回（含 results / page / total_pages / total_results）
 * @param type - 固定媒体类型（null 表示按条目 media_type 判断）
 * @returns 规范化后的条目与分页信息
 */
export function parseTmdbPage(
  result: unknown,
  type: TmdbMediaType | null,
): { items: TmdbMediaItem[]; pagination: TmdbPagination } {
  const parsed = tmdbPageSchema.safeParse(result)
  if (!parsed.success) {
    throw new Error('Invalid TMDB list response')
  }
  const data = parsed.data
  const items = type ? normalizeFixedType(data.results, type) : normalizeListResults(data.results)
  return {
    items,
    pagination: {
      page: data.page ?? 1,
      totalPages: data.total_pages ?? 0,
      totalResults: data.total_results ?? 0,
    },
  }
}
