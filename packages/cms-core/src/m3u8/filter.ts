/**
 * M3U8过滤器类型
 */
export type M3u8Filter = (content: string) => string

/**
 * TS分片URL广告关键词
 * 匹配的EXTINF+URL段会被整体移除
 */
const AD_SEGMENT_KEYWORDS = [
  'sponsor',
  '/ad/',
  '/ads/',
  'advert',
  'advertisement',
  '/adjump',
  'redtraffic',
]

/**
 * 创建默认广告过滤器
 * - SCTE-35 标准广告标记检测（#EXT-X-CUE-OUT / #EXT-X-CUE-IN）
 * - 移除 #EXT-X-DISCONTINUITY 标记（广告段边界）
 * - 移除 URL 路径包含广告关键词的 EXTINF 段
 */
export function createDefaultAdFilter(): M3u8Filter {
  return (content: string): string => {
    if (!content) return ''

    const lines = content.split('\n')
    const result: string[] = []
    let inAdBlock = false

    console.log("过滤前：",result.join('\n'))
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // SCTE-35 广告开始标记
      if (
        line.includes('#EXT-X-CUE-OUT') ||
        line.includes('#EXT-X-SCTE35') ||
        line.includes('#EXT-OATCLS-SCTE35') ||
        (line.includes('#EXT-X-DATERANGE') && line.includes('SCTE35'))
      ) {
        inAdBlock = true
        continue
      }

      // SCTE-35 广告结束标记
      if (line.includes('#EXT-X-CUE-IN')) {
        inAdBlock = false
        continue
      }

      // 跳过广告区块内容
      if (inAdBlock) continue

      // 跳过 #EXT-X-DISCONTINUITY
      if (line.includes('#EXT-X-DISCONTINUITY')) continue

      // EXTINF 行：检查下一行 URL 是否包含广告关键词
      if (line.includes('#EXTINF:') && i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        if (AD_SEGMENT_KEYWORDS.some(kw => nextLine.toLowerCase().includes(kw.toLowerCase()))) {
          i += 1
          continue
        }
      }

      result.push(line)
    }
    console.log("过滤后：",result.join('\n'))

    return result.join('\n')
  }
}

/**
 * 空操作过滤器 — 管线占位，透传不做任何处理
 */
export function createNoopFilter(): M3u8Filter {
  return (content: string): string => content
}

/**
 * 组合多个过滤器
 * @param filters 过滤器列表
 */
export function composeFilters(...filters: M3u8Filter[]): M3u8Filter {
  return (content: string): string => {
    return filters.reduce((acc, filter) => filter(acc), content)
  }
}

/**
 * 创建用户自定义脚本过滤器
 * 脚本格式：function filterAdsFromM3U8(type, m3u8Content) { ... return filteredContent; }
 *
 * @param code - 用户编写的 JS 代码字符串
 * @param sourceKey - 当前播放源标识（可选，传给脚本的 type 参数）
 */
export function createCustomScriptFilter(code: string, sourceKey?: string): M3u8Filter | null {
  if (!code || !code.trim()) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(`"use strict"; ${code}; return typeof filterAdsFromM3U8 === 'function' ? filterAdsFromM3U8 : null;`)()
    if (typeof fn !== 'function') return null

    const key = sourceKey || ''
    return (content: string): string => {
      try {
        const result = fn(key, content)
        return typeof result === 'string' ? result : content
      } catch {
        return content // 脚本执行失败，降级为原内容
      }
    }
  } catch {
    return null // 脚本编译失败
  }
}
