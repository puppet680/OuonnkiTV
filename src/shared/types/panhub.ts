export interface PanhubMergedLink {
  url: string
  password: string
  note: string
  datetime: string
  source?: string
}

export type PanhubMergedLinks = Record<string, PanhubMergedLink[]>

export interface PanhubSearchResponse {
  total: number
  merged_by_type?: PanhubMergedLinks
}

export interface PanhubGenericResponse<T> {
  code: number
  message: string
  data?: T
}

export const PLATFORM_INFO: Record<string, { name: string; color: string; icon: string }> = {
  aliyun: { name: '阿里云盘', color: '#7c3aed', icon: '/icons/panhub/aliyun.png' },
  quark: { name: '夸克网盘', color: '#6366f1', icon: '/icons/panhub/quark.png' },
  baidu: { name: '百度网盘', color: '#2563eb', icon: '/icons/panhub/baidu.png' },
  '115': { name: '115网盘', color: '#f59e0b', icon: '/icons/panhub/115.png' },
  xunlei: { name: '迅雷云盘', color: '#fbbf24', icon: '/icons/panhub/xunlei.png' },
  uc: { name: 'UC网盘', color: '#ef4444', icon: '/icons/panhub/uc.png' },
  tianyi: { name: '天翼云盘', color: '#ec4899', icon: '/icons/panhub/tianyi.png' },
  '123': { name: '123网盘', color: '#10b981', icon: '/icons/panhub/123.png' },
  mobile: { name: '移动云盘', color: '#0ea5e9', icon: '/icons/panhub/mobile.png' },
  magnet: { name: '磁力链接', color: '#a855f7', icon: '/icons/panhub/magnet.png'},
  others: { name: '其他网盘', color: '#6b7280', icon: '/icons/panhub/others.png' },
}

export const ALL_PLUGIN_NAMES = [
  'pansearch',
  'qupansou',
  'panta',
  'hunhepan',
  'jikepan',
  'labi',
  'thepiratebay',
  'duoduo',
  'xuexizhinan',
  'nyaa',
] as const

export const DEFAULT_PANHUB_CONFIG = {
  apiBase: '/api/panhub',
  enabledPlugins: [...ALL_PLUGIN_NAMES],
  concurrency: 4,
  pluginTimeoutMs: 5000,
}
