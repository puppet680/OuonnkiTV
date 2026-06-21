export interface VersionUpdate {
  version: string
  title: string
  date: string
  features: string[]
  fixes?: string[]
  breaking?: string[]
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
  return date.toLocaleDateString('zh-CN', options)
}

export const VERSION_UPDATES: VersionUpdate[] = [
  {
    version: '1.2.3',
    title: '功能新增加',
    date: formatDate('2026-06-21'),
    features: [
      '新增番剧入口',
      '新增底部导航栏功能',
      '新增成人影视过滤功能',
      '新增引导页，首次访问展示功能',
      '首页影视推荐改为根据用户偏好展示对应平台内容',
      '新增 TMDB 影视设置（奈飞、爱艺奇、腾讯视频、apptv+）等影视偏好',
    ],
    breaking: [
      '移除原有影视轮播，改为电影、连续剧、综艺、动漫四个分类轮播',
    ],
  },
  {
    version: '1.2.2',
    title: 'TV演员数据修复与匹配优化',
    date: formatDate('2026-06-20'),
    features: [
      '详情页匹配规则优化：主标题为全英文时，并发搜索译名别名，不等回退',
      '移除 originalTitle 匹配逻辑，统一使用 alternativeTitles 处理译名',
      '增加tmdb id搜索功能'
    ],
    fixes: [
      '修复 TV 剧集演员数据不完整的问题：改用 aggregate_credits API',
      'TV 演员多角色展示：跨季不同角色以 " / " 分隔',
      'TV 演员排序改用 total_episode_count 替代 order，更准确反映出场权重',
      '修复了历史记录点击视频不匹配的问题'
    ],
  },
  {
    version: '1.2.1',
    title: '搜索匹配与季补全优化',
    date: formatDate('2026-06-03'),
    features: [
      '搜索回退策略优化：原名和译名均作为回退关键词，提升搜索结果覆盖率',
      '多季标题掺杂检测优化，消除"第X季"后缀导致的错误扣分',
      '播放页默认季选择优化，修复补全季跳转后回退到S1的问题',
    ],
    fixes: [
      '修复部分影视主搜索无结果时不回退译名搜索的问题',
      '修复播放页补全季 matchedSourceCount 全为0的问题',
      '修复详情页"各地译名"中 key 重复的 React 警告',
      '修复从补全季进入播放页时默认显示S1的问题',
    ],
  },
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
    features: ['基于原版v2.0.4的分支'],
  },
]

export const LATEST_VERSION = VERSION_UPDATES[0]?.version || '1.0.0'
