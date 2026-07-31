import { PlayerErrorState } from '@/features/player/components'
import { useSettingStore } from '@/shared/store/settingStore'

interface PlayerErrorRenderProps {
  message: string
  detailLink: string | undefined
  onBack: () => void
}

/**
 * 播放页错误状态：识别「无匹配 / 路由无效 / 源配置缺失」，渲染对应文案与操作
 */
export function PlayerErrorRender({ message, detailLink, onBack }: PlayerErrorRenderProps) {
  const { network, setNetworkSettings } = useSettingStore()

  const isNoMatch = message.includes('没有匹配到可播放资源')
  const isRouteInvalid = message.includes('无效的播放地址')
  const isSourceConfigIssue = message.includes('未找到对应视频源配置')
  const errorTitle = isRouteInvalid
    ? '这个播放地址不可用'
    : isNoMatch
      ? '找不到匹配播放源'
      : '视频暂时无法播放'
  const tag = isRouteInvalid ? '路由校验失败' : isNoMatch ? '匹配结果为空' : '播放链路异常'
  const isCustomProxy = network.proxyUrl && network.proxyUrl !== '/proxy?url='

  return (
    <PlayerErrorState
      title={errorTitle}
      description={message}
      tag={tag}
      primaryAction={{ label: '返回上一页', onClick: onBack }}
      secondaryAction={
        isNoMatch && detailLink
          ? { label: '返回详情页重试', to: detailLink, variant: 'outline' as const }
          : isSourceConfigIssue
            ? { label: '视频源设置', to: '/settings/source', variant: 'outline' as const }
            : detailLink
              ? { label: '查看影视详情', to: detailLink, variant: 'outline' as const }
              : undefined
      }
      extraAction={
        isCustomProxy
          ? {
              label: network.isProxyEnabled ? '切换为直连' : '切换为代理',
              variant: 'outline' as const,
              onClick: () => {
                setNetworkSettings({ isProxyEnabled: !network.isProxyEnabled })
                Object.keys(localStorage)
                  .filter(k => k.startsWith('ouonnki-speed::'))
                  .forEach(k => localStorage.removeItem(k))
                window.location.reload()
              },
            }
          : undefined
      }
    />
  )
}
