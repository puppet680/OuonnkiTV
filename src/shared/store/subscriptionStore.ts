import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'sonner'
import type { VideoSource } from '@ouonnki/cms-core'
import type { VideoSourceSubscription } from '@/shared/types/subscription'
import { getInitialSubscriptions } from '@/shared/config/api.config'
import { useApiStore } from './apiStore'
import { useSettingStore } from './settingStore'

// ==================== 工具函数 ====================

/** 判断视频源 ID 是否属于订阅源 */
export function isSubscriptionSource(sourceId: string): boolean {
  return sourceId.startsWith('sub:')
}

/** 从视频源 ID 提取订阅 ID */
export function extractSubscriptionId(sourceId: string): string | null {
  if (!isSubscriptionSource(sourceId)) return null
  return sourceId.split(':')[1]
}

/** 为订阅源生成带前缀的 ID */
function buildSubscriptionSourceId(subscriptionId: string, index: number): string {
  return `sub:${subscriptionId}:${index}`
}

// ==================== 远程拉取与转换 ====================

/** 从远程 URL 拉取视频源列表 */
async function fetchSourcesFromUrl(url: string): Promise<Partial<VideoSource>[]> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  const data = await response.json()
  if (!Array.isArray(data)) {
    throw new Error('返回数据不是数组格式')
  }
  return data
}

/** 将原始数据转换为带订阅前缀 ID 的 VideoSource 数组 */
function mapToSubscriptionSources(
  subscriptionId: string,
  rawSources: Partial<VideoSource>[],
): VideoSource[] {
  const { defaultTimeout, defaultRetry } = useSettingStore.getState().network
  return rawSources
    .filter(s => s.name && s.url)
    .map((source, index) => ({
      id: buildSubscriptionSourceId(subscriptionId, index),
      name: source.name!,
      url: source.url!,
      detailUrl: source.detailUrl || source.url,
      timeout: source.timeout ?? defaultTimeout,
      retry: source.retry ?? defaultRetry,
      isEnabled: source.isEnabled ?? true,
      updatedAt: new Date(),
    }))
}

// ==================== Store 定义 ====================

interface SubscriptionState {
  /** 所有订阅列表 */
  subscriptions: VideoSourceSubscription[]
}

interface SubscriptionActions {
  /** 添加新订阅（添加后立即拉取一次） */
  addSubscription: (url: string, name?: string, refreshInterval?: number) => Promise<void>
  /** 移除订阅（同时从 apiStore 移除对应视频源） */
  removeSubscription: (subscriptionId: string) => void
  /** 刷新指定订阅 */
  refreshSubscription: (subscriptionId: string) => Promise<void>
  /** 刷新所有订阅 */
  refreshAllSubscriptions: () => Promise<void>
  /** 更新订阅的自动刷新间隔 */
  setRefreshInterval: (subscriptionId: string, intervalMinutes: number) => void
  /** 更新订阅信息（重命名等） */
  updateSubscription: (subscriptionId: string, data: Partial<Pick<VideoSourceSubscription, 'name'>>) => void
  /** 启用/禁用订阅（批量开关该订阅所有源） */
  setSubscriptionEnabled: (subscriptionId: string, enabled: boolean) => void
  /** 判断 URL 是否已被订阅 */
  isUrlSubscribed: (url: string) => boolean
  /** 从环境变量 / config 加载初始订阅 */
  initializeSubscriptions: () => Promise<void>
}

type SubscriptionStore = SubscriptionState & SubscriptionActions

export const useSubscriptionStore = create<SubscriptionStore>()(
  devtools(
    persist(
      immer<SubscriptionStore>((set, get) => ({
        subscriptions: [],

        addSubscription: async (
          url: string,
          name?: string,
          refreshInterval?: number,
        ) => {
          if (get().isUrlSubscribed(url)) {
            toast.error('该 URL 已存在订阅')
            return
          }

          // 尝试从 URL 推断名称
          let resolvedName = name || ''
          if (!resolvedName) {
            try {
              resolvedName = new URL(url).hostname
            } catch {
              resolvedName = '未命名订阅'
            }
          }

          const subscriptionId = uuidv4()
          const subscription: VideoSourceSubscription = {
            id: subscriptionId,
            name: resolvedName,
            isEnabled: true,
            url,
            sourceCount: 0,
            lastRefreshedAt: null,
            lastRefreshSuccess: false,
            lastRefreshError: null,
            refreshInterval: refreshInterval ?? 60,
            createdAt: new Date(),
          }

          set(state => {
            state.subscriptions.push(subscription)
          })

          // 立即拉取一次
          await get().refreshSubscription(subscriptionId)
        },

        removeSubscription: (subscriptionId: string) => {
          const subscription = get().subscriptions.find(s => s.id === subscriptionId)
          useApiStore.getState().removeSubscriptionSources(subscriptionId)

          set(state => {
            state.subscriptions = state.subscriptions.filter(s => s.id !== subscriptionId)
          })

          if (subscription) {
            toast.success(`已取消订阅「${subscription.name}」`)
          }
        },

        refreshSubscription: async (subscriptionId: string) => {
          const subscription = get().subscriptions.find(s => s.id === subscriptionId)
          if (!subscription) return

          try {
            const rawSources = await fetchSourcesFromUrl(subscription.url)
            const sources = mapToSubscriptionSources(subscriptionId, rawSources)

            useApiStore.getState().replaceSubscriptionSources(subscriptionId, sources)

            set(state => {
              const sub = state.subscriptions.find(s => s.id === subscriptionId)
              if (sub) {
                sub.sourceCount = sources.length
                sub.lastRefreshedAt = new Date()
                sub.lastRefreshSuccess = true
                sub.lastRefreshError = null
              }
            })

            toast.success(`订阅「${subscription.name}」已刷新，共 ${sources.length} 个源`)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误'

            set(state => {
              const sub = state.subscriptions.find(s => s.id === subscriptionId)
              if (sub) {
                sub.lastRefreshedAt = new Date()
                sub.lastRefreshSuccess = false
                sub.lastRefreshError = errorMessage
              }
            })

            toast.error(`刷新订阅「${subscription.name}」失败：${errorMessage}`)
          }
        },

        refreshAllSubscriptions: async () => {
          const { subscriptions } = get()
          if (subscriptions.length === 0) return

          await Promise.allSettled(
            subscriptions.map(sub => get().refreshSubscription(sub.id)),
          )
        },

        setRefreshInterval: (subscriptionId: string, intervalMinutes: number) => {
          set(state => {
            const sub = state.subscriptions.find(s => s.id === subscriptionId)
            if (sub) {
              sub.refreshInterval = intervalMinutes
            }
          })
        },

        updateSubscription: (subscriptionId, data) => {
          set(state => {
            const sub = state.subscriptions.find(s => s.id === subscriptionId)
            if (sub && data.name !== undefined) sub.name = data.name
          })
        },

        setSubscriptionEnabled: (subscriptionId, enabled) => {
          set(state => {
            const sub = state.subscriptions.find(s => s.id === subscriptionId)
            if (sub) sub.isEnabled = enabled
          })
        },

        isUrlSubscribed: (url: string) => {
          return get().subscriptions.some(s => s.url === url)
        },

        initializeSubscriptions: async () => {
          const existing = get().subscriptions
          const initials = getInitialSubscriptions()
          for (const sub of initials) {
            if (existing.some(s => s.url === sub.url)) continue
            try {
              await get().addSubscription(sub.url, sub.name, sub.refreshInterval ?? 60)
            } catch (e) {
              console.error(`初始化订阅失败: ${sub.name} (${sub.url})`, e)
            }
          }
        },
      })),
      {
        name: 'ouonnki-tv-subscription-store',
        version: 2,
        migrate: (state: unknown, version: number) => {
          const s = state as { subscriptions: VideoSourceSubscription[] }
          if (version < 2) {
            s.subscriptions.forEach(sub => { (sub as { isEnabled?: boolean }).isEnabled ??= true })
          }
          return s as SubscriptionStore
        },
      },
    ),
    {
      name: 'SubscriptionStore',
    },
  ),
)
