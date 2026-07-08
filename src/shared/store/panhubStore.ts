import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { DEFAULT_PANHUB_CONFIG, ALL_PLUGIN_NAMES } from '@/shared/types/panhub'

export type DoubanProxyType = 'direct' | 'cors-proxy-zwei' | 'cmliussss-cdn-tencent' | 'cmliussss-cdn-ali' | 'cmliussss-unified' | 'custom'

export interface PanhubConfig {
  apiBase: string
  enabledPlugins: string[]
  concurrency: number
  pluginTimeoutMs: number
  doubanCookie: string
  doubanProxyType: DoubanProxyType
  doubanProxyUrl: string
}

interface PanhubStore extends PanhubConfig {
  setConfig: (partial: Partial<PanhubConfig>) => void
  resetConfig: () => void
}

export const usePanhubStore = create<PanhubStore>()(
  persist(
    immer(set => ({
      apiBase: DEFAULT_PANHUB_CONFIG.apiBase,
      enabledPlugins: [...DEFAULT_PANHUB_CONFIG.enabledPlugins],
      concurrency: DEFAULT_PANHUB_CONFIG.concurrency,
      pluginTimeoutMs: DEFAULT_PANHUB_CONFIG.pluginTimeoutMs,
      doubanCookie: '',
      doubanProxyType: 'direct' as DoubanProxyType,
      doubanProxyUrl: '',

      setConfig: (partial: Partial<PanhubConfig>) =>
        set(state => {
          if (partial.apiBase !== undefined) state.apiBase = partial.apiBase
          if (partial.enabledPlugins !== undefined) {
            state.enabledPlugins = partial.enabledPlugins.filter(p =>
              (ALL_PLUGIN_NAMES as readonly string[]).includes(p),
            )
          }
          if (partial.concurrency !== undefined) {
            state.concurrency = Math.min(16, Math.max(1, partial.concurrency))
          }
          if (partial.pluginTimeoutMs !== undefined) {
            state.pluginTimeoutMs = Math.min(60000, Math.max(1000, partial.pluginTimeoutMs))
          }
          if (partial.doubanCookie !== undefined) state.doubanCookie = partial.doubanCookie
          if (partial.doubanProxyType !== undefined) state.doubanProxyType = partial.doubanProxyType
          if (partial.doubanProxyUrl !== undefined) state.doubanProxyUrl = partial.doubanProxyUrl
        }),

      resetConfig: () =>
        set(state => {
          state.apiBase = DEFAULT_PANHUB_CONFIG.apiBase
          state.enabledPlugins = [...DEFAULT_PANHUB_CONFIG.enabledPlugins]
          state.concurrency = DEFAULT_PANHUB_CONFIG.concurrency
          state.pluginTimeoutMs = DEFAULT_PANHUB_CONFIG.pluginTimeoutMs
          state.doubanCookie = ''
          state.doubanProxyType = 'direct'
          state.doubanProxyUrl = ''
        }),
    })),
    { name: 'ouonnki-panhub-config' },
  ),
)
