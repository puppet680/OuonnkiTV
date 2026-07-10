import { StatePanel, type StatePanelProps } from '@/shared/components/StatePanel'

type PlayerErrorStateProps = Omit<StatePanelProps, 'mode'>

/**
 * 播放页错误状态 — StatePanel 的 mode='error' 别名。
 * ponytail: backward-compat wrapper
 */
export function PlayerErrorState(props: PlayerErrorStateProps) {
  return <StatePanel mode="error" {...props} />
}
