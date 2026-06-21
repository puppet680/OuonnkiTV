import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { LATEST_VERSION } from '@/shared/data/changelog'

interface VersionUpdate {
  version: string
  title: string
  date: string
  features: string[]
  fixes?: string[]
  breaking?: string[]
}

interface VersionState {
  currentVersion: string
  lastViewedVersion: string
  showUpdateModal: boolean
  updateHistory: VersionUpdate[]
}

interface VersionActions {
  setCurrentVersion: (version: string) => void
  markVersionAsViewed: (version: string) => void
  setShowUpdateModal: (show: boolean) => void
  hasNewVersion: () => boolean
  getLatestUpdate: () => VersionUpdate | null
  loadUpdateHistory: () => Promise<void>
}

type VersionStore = VersionState & VersionActions

export const useVersionStore = create<VersionStore>()(
  devtools(
    persist(
      immer<VersionStore>((set, get) => ({
        // 初始状态（updateHistory 通过 loadUpdateHistory 懒加载填充）
        currentVersion: LATEST_VERSION,
        lastViewedVersion: '1.0.0',
        showUpdateModal: false,
        updateHistory: [],

        setCurrentVersion: (version: string) => {
          set(state => { state.currentVersion = version })
        },

        markVersionAsViewed: (version: string) => {
          set(state => {
            state.lastViewedVersion = version
            state.showUpdateModal = false
          })
        },

        setShowUpdateModal: (show: boolean) => {
          set(state => { state.showUpdateModal = show })
        },

        hasNewVersion: () => {
          return get().currentVersion !== get().lastViewedVersion
        },

        getLatestUpdate: () => {
          return get().updateHistory.find(u => u.version === get().currentVersion) || null
        },

        // 懒加载 changelog 数据，避免 ~3KB 数据进入入口 chunk
        loadUpdateHistory: async () => {
          const { VERSION_UPDATES } = await import('@/shared/data/changelog')
          set(state => { state.updateHistory = VERSION_UPDATES })
        },
      })),
      {
        name: 'ouonnki-tv-version-store',
        version: 1,
        partialize: state => ({
          lastViewedVersion: state.lastViewedVersion,
        }),
      },
    ),
    { name: 'VersionStore' },
  ),
)
