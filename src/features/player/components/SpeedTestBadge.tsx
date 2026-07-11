/**
 * 源测速分辨率 badge —— 显示在源列表按钮上
 * 彩色：4K/2K 紫色, 1080p/720p 绿色, 480p/SD 黄色
 */
import type { VideoSourceTestResult } from '../lib/source-speed-test'

interface SpeedTestBadgeProps {
  result: VideoSourceTestResult | null
  testing: boolean
}

const QUALITY_COLORS: Record<string, string> = {
  '8K': 'bg-purple-600 text-white',
  '4K': 'bg-purple-500 text-white',
  '2K': 'bg-purple-400 text-white',
  '1080P': 'bg-green-500 text-white',
  '720P': 'bg-green-400 text-white',
  '540P': 'bg-yellow-500 text-white',
  '480P': 'bg-yellow-500 text-white',
  '360P': 'bg-yellow-400 text-white',
  'SD': 'bg-yellow-400 text-white',
}

export function SpeedTestBadge({ result, testing }: SpeedTestBadgeProps) {
  if (testing) {
    return (
      <span className="shrink-0 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] leading-none text-zinc-600 dark:text-zinc-400 animate-pulse">
        检测中
      </span>
    )
  }

  if (!result) return null

  if (result.status === 'failed' || result.hasError) {
    return (
      <span className="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] leading-none text-red-600 dark:text-red-400">
        检测失败
      </span>
    )
  }

  const label = result.quality?.label || (result.playable ? '已连通' : '')
  if (!label) return null

  const colorClass = QUALITY_COLORS[label] || 'bg-gray-400 text-white'

  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none ${colorClass}`}>
      {label}
    </span>
  )
}
