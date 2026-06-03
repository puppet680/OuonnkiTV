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
 * - 移除 #EXT-X-DISCONTINUITY 标记（广告段边界）
 * - 移除 URL 路径包含广告关键词的 EXTINF 段
 */
export function createDefaultAdFilter(): M3u8Filter {
  return (content: string): string => {
    if (!content) return ''

    const lines = content.split('\n')
    const result: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // 跳过 #EXT-X-DISCONTINUITY
      if (line.includes('#EXT-X-DISCONTINUITY')) {
        continue
      }

      // EXTINF 行：检查下一行 URL 是否包含广告关键词
      if (line.includes('#EXTINF:') && i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        const isAd = AD_SEGMENT_KEYWORDS.some((kw) =>
          nextLine.toLowerCase().includes(kw.toLowerCase()),
        )
        if (isAd) {
          // console.warn(`❌ 广告段已过滤: ${nextLine.trim()}`)
          i += 1 // 跳过 EXTINF 和 URL 两行（循环自增再跳一行）
          continue
        }
      }

      result.push(line)
    }

    return result.join('\n')
  }
}

/**
 * 功能加：创建基于密钥路径一致性的过滤器（过滤掉与解密密钥目录不一致的广告段）
 * - 自动扫描 #EXT-X-KEY 的 URI 属性作为绝对正片白名单
 * - 如果文件未加密或找不到密钥，则不启用过滤逻辑直接返回
 */
export function createKeyPathFilter(): M3u8Filter {
  return (content: string): string => {
    if (!content) return ''

    const lines = content.split('\n')
    const result: string[] = []
    let keyBasePrefix: string | null = null

    // 预扫描：精准定位正片的密钥目录路径
    for (const line of lines) {
      if (line.includes('#EXT-X-KEY') && line.includes('URI=')) {
        const match = line.match(/URI=["']([^"']+)["']/)
        if (match && match[1]) {
          const keyPath = match[1].trim()
          const lastSlashIndex = keyPath.lastIndexOf('/')
          if (lastSlashIndex !== -1) {
            keyBasePrefix = keyPath.substring(0, lastSlashIndex + 1)
            // console.log(`🔑 成功锁定正片密钥白名单路径: ${keyBasePrefix}`)
            break
          }
        }
      }
    }

    // 如果 M3U8 文件本身完全没有加密（没有解密密钥标签），则跳过路径对齐直接返回原内容
    if (!keyBasePrefix) {
      return content
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // 如果是分片信息行
      if (line.includes('#EXTINF:') && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()

        // 排除空行或其它干扰标签
        if (nextLine && !nextLine.startsWith('#')) {
          // 检查当前分片 URL 是否属于密钥所在的合法目录
          if (!nextLine.startsWith(keyBasePrefix)) {
            // console.warn(`❌ [密钥路径不符] 成功拦截无解密需求的广告段: ${nextLine}`)
            i += 1 // 跳过当前的 EXTINF 和下一行的 URL
            continue
          }
        }
      }

      result.push(line)
    }

    return result.join('\n')
  }
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
