// API 配置
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export const API_CONFIG = {
  search: {
    path: '/api.php/provide/vod/?ac=videolist&wd=',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json',
    },
  },
  detail: {
    path: '/api.php/provide/vod/?ac=videolist&ids=',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json',
    },
  },
}

// 代理地址前缀（可在设置页被覆盖）
export const DEFAULT_PROXY_URL = '/proxy?url='
export const PROXY_URL = DEFAULT_PROXY_URL
export const M3U8_PATTERN = /\$https?:\/\/[^"'\s]+?\.m3u8/g

export const normalizeProxyPrefix = (proxyUrl?: string | null): string => {
  const value = typeof proxyUrl === 'string' ? proxyUrl.trim() : ''
  const base = value || DEFAULT_PROXY_URL

  if (base.includes('{url}')) return base
  if (/[?&]url=$/i.test(base)) return base
  if (/[?&]url=[^&]*$/i.test(base)) {
    return base.replace(/([?&]url=)[^&]*$/i, '$1')
  }
  return base.includes('?') ? `${base}&url=` : `${base}?url=`
}

export const buildProxyRequestUrl = (targetUrl: string, proxyUrl?: string | null): string => {
  const normalized = normalizeProxyPrefix(proxyUrl)
  if (normalized.includes('{url}')) {
    return normalized.split('{url}').join(encodeURIComponent(targetUrl))
  }
  return normalized + encodeURIComponent(targetUrl)
}

import type { VideoApi } from '@/shared/types/video'
import { INITIAL_CONFIG } from './initialConfig'
import { DEFAULT_SETTINGS } from './settings.config'

/** 初始订阅源配置 */
export interface InitialSubscription {
  name: string
  url: string
  refreshInterval?: number
  isEnabled?: boolean
}

/**
 * 从环境变量 / config 获取初始订阅源
 */
export const getInitialSubscriptions = (): InitialSubscription[] => {
  // 1. 优先从 INITIAL_CONFIG 取
  if (INITIAL_CONFIG?.subscriptions?.length) {
    return INITIAL_CONFIG.subscriptions.map(s => ({
      name: s.name,
      url: s.url,
      refreshInterval: s.refreshInterval ?? 60,
      isEnabled: s.isEnabled ?? true,
    }))
  }

  // 2. 从 OKI_INITIAL_SUBSCRIPTIONS 环境变量取
  const envSubs = import.meta.env.OKI_INITIAL_SUBSCRIPTIONS
  if (!envSubs || typeof envSubs !== 'string') return []

  try {
    const cleaned = envSubs.trim().replace(/^['"](.*)['"]$/, '$1')
    const parsed = JSON.parse(cleaned)
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return list
      .filter((s: Record<string, unknown>) => s.name && s.url)
      .map((s: Record<string, unknown>) => ({
        name: s.name as string,
        url: s.url as string,
        refreshInterval: (s.refreshInterval as number) ?? 60,
        isEnabled: (s.isEnabled as boolean) ?? true,
      }))
  } catch (e) {
    console.error('解析 OKI_INITIAL_SUBSCRIPTIONS 失败:', e)
    return []
  }
}

// 从环境变量获取初始视频源
export const getInitialVideoSources = async (): Promise<VideoApi[]> => {
  // 1. First priority: Full JSON config from OKI_INITIAL_CONFIG
  // 1. First priority: Full JSON config from OKI_INITIAL_CONFIG
  if (INITIAL_CONFIG?.videoSources && Array.isArray(INITIAL_CONFIG.videoSources)) {
    return parseVideoSources(INITIAL_CONFIG.videoSources)
  }

  // 2. Second priority: Specific OKI_INITIAL_VIDEO_SOURCES
  let envSources = import.meta.env.OKI_INITIAL_VIDEO_SOURCES

  // 验证url
  try {
    new URL(envSources.trim())
    const response = await fetch(buildProxyRequestUrl(envSources.trim()))
    if (!response.ok) {
      console.error(`无法获取视频源，HTTP状态: ${response.status}`)
      return []
    }
    envSources = await response.text()
  } catch {
    // 不是URL，继续处理
  }

  if (!envSources || typeof envSources !== 'string') {
    return []
  }

  try {
    // 清理多行JSON：移除不必要的换行符和空白字符，但保留JSON结构内的空格
    const cleanedSources = envSources
      .replace(/^\s*['"`]/, '') // 移除开头的引号
      .replace(/['"`]\s*$/, '') // 移除结尾的引号
      .trim()

    // 解析 JSON 格式
    const jsonSources = JSON.parse(cleanedSources)
    const sources = Array.isArray(jsonSources) ? jsonSources : [jsonSources]

    return parseVideoSources(sources)
  } catch (error) {
    console.error('解析环境变量中的视频源失败:', error)
    console.error('环境变量内容:', envSources)
    return []
  }
}

/** 环境变量视频源的原始结构（解析期宽松字段，运行时值经下方校验） */
interface EnvVideoSource {
  name?: unknown
  url?: unknown
  id?: unknown
  detailUrl?: unknown
  isEnabled?: unknown
  updatedAt?: unknown
  timeout?: unknown
  retry?: unknown
}

// Helper to parse and validate video sources
const parseVideoSources = (sources: unknown[]): VideoApi[] => {
  return sources
    .map((raw, index) => {
      const source = raw as EnvVideoSource
      if (typeof source.name !== 'string' || typeof source.url !== 'string') {
        console.warn(`跳过无效的视频源配置: ${JSON.stringify(source)}`)
        return null
      }

      return {
        id: typeof source.id === 'string' ? source.id : `env_source_${index}`,
        name: source.name,
        url: source.url,
        detailUrl: typeof source.detailUrl === 'string' ? source.detailUrl : source.url,
        isEnabled: typeof source.isEnabled === 'boolean' ? source.isEnabled : true,
        updatedAt: source.updatedAt ? new Date(source.updatedAt as string) : new Date(),
        timeout:
          typeof source.timeout === 'number'
            ? source.timeout
            : DEFAULT_SETTINGS.network.defaultTimeout,
        retry:
          typeof source.retry === 'number' ? source.retry : DEFAULT_SETTINGS.network.defaultRetry,
      } as VideoApi
    })
    .filter((source): source is VideoApi => source !== null)
}
