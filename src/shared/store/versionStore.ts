import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface VersionUpdate {
  version: string
  title: string
  date: string
  features: string[]
  fixes?: string[]
  breaking?: string[]
}

interface VersionState {
  // 当前版本
  currentVersion: string
  // 最后查看的版本
  lastViewedVersion: string
  // 是否显示更新弹窗
  showUpdateModal: boolean
  // 更新历史
  updateHistory: VersionUpdate[]
}

interface VersionActions {
  // 设置当前版本
  setCurrentVersion: (version: string) => void
  // 标记版本已查看
  markVersionAsViewed: (version: string) => void
  // 显示/隐藏更新弹窗
  setShowUpdateModal: (show: boolean) => void
  // 检查是否有新版本
  hasNewVersion: () => boolean
  // 获取最新的更新信息
  getLatestUpdate: () => VersionUpdate | null
}

type VersionStore = VersionState & VersionActions

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
  return date.toLocaleDateString('zh-CN', options)
}

// 版本更新历史
const VERSION_UPDATES: VersionUpdate[] = [
  {
    version: '1.2.0',
    title: '搜索聚合与 CMS 换源',
    date: formatDate('2026-06-02'),
    features: [
      '直连搜索结果按片名聚合去重，同名片合并展示并标注来源数量',
      'CMS 直连播放器支持换源，从聚合结果中切换不同视频源',
      'CMS 直连播放器支持自动切换源，播放出错时自动尝试下一个源',
      'CMS 直连播放器后台持续匹配，自动搜索所有源找到更多可用资源',
      '首页新增影视偏好快捷切换按钮（大陆/欧美）',
      '影视偏好数据按区域缓存，切换不回源请求',
    ],
    fixes: [
      '修复搜索页返回时重复搜索的问题',
      '修复视频源列表 key 重复导致的 React 警告',
      '修复 CMS 换源面板展开收起卡顿问题',
    ],
  },
  {
    version: '1.1.0',
    title: '首页影视偏好与平台筛选',
    date: formatDate('2026-06-02'),
    features: [
      '新增 TMDB 影视偏好设置，可按欧美/大陆切换首页内容',
      '欧美偏好展示 Netflix 平台热门影视，大陆偏好展示爱奇艺、腾讯视频等平台内容',
      '首页新增动画电影轮播，欧美/大陆各自筛选对应平台动画',
      '首页新增多维度分类：热门电影、最受欢迎、口碑最佳、即将上映、最受欢迎剧集、口碑最佳剧集',
      '大陆模式下各榜单自动切换为中文电影/中文剧集',
      '巨幕轮播根据影视偏好自动切换内容来源',
      'TMDB 详情页译名改用 alternative_titles API，只获取中国大陆别名',
    ],
    fixes: [
      '修复搜索页地区筛选只有"全部"的 bug',
      '修复搜索页地区筛选选择后无结果的 bug',
      '修复 TMDB 详情页媒体类型图标过大的问题',
    ],
  },
  {
    version: '1.0.0',
    title: '初始版本',
    date: formatDate('2026-06-01'),
    features: ['初始版本'],
  },
]

// 获取最新版本号
const LATEST_VERSION = VERSION_UPDATES[0]?.version || '1.0.0'

export const useVersionStore = create<VersionStore>()(
  devtools(
    persist(
      immer<VersionStore>((set, get) => ({
        // 初始状态
        currentVersion: LATEST_VERSION,
        lastViewedVersion: '1.0.0',
        showUpdateModal: false,
        updateHistory: VERSION_UPDATES,

        // Actions
        setCurrentVersion: (version: string) => {
          set(state => {
            state.currentVersion = version
          })
        },

        markVersionAsViewed: (version: string) => {
          set(state => {
            state.lastViewedVersion = version
            state.showUpdateModal = false
          })
        },

        setShowUpdateModal: (show: boolean) => {
          set(state => {
            state.showUpdateModal = show
          })
        },

        hasNewVersion: () => {
          const state = get()
          return state.currentVersion !== state.lastViewedVersion
        },

        getLatestUpdate: () => {
          const state = get()
          // 找到当前版本对应的更新信息
          return state.updateHistory.find(update => update.version === state.currentVersion) || null
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
    {
      name: 'VersionStore',
    },
  ),
)
