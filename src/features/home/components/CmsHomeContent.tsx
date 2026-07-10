import { useApiStore } from '@/shared/store/apiStore'
import { useCmsVideoList } from '@/shared/hooks/useCmsCore'
import type { VideoSource, VideoItem } from '@ouonnki/cms-core'
import { ContinueWatching } from './ContinueWatching'
import { MediaCarousel } from '@/shared/components/media'
import { MediaPosterCard } from '@/shared/components/common'
import { buildCmsPlayPath } from '@/shared/lib/routes'
import { NavLink } from 'react-router'
import { Settings, Plus } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

/**
 * 单个视频源推荐列表
 * 独立组件以隔离每个源的 hook 调用
 */
function SourceCarousel({ source }: { source: VideoSource }) {
  const { items, loading } = useCmsVideoList(source)

  return (
    <MediaCarousel
      title={source.name}
      items={items}
      loading={loading}
      itemKey={(item: VideoItem, i: number) => `${item.source_code}-${item.vod_id}-${i}`}
      renderItem={(item: VideoItem) => (
        <MediaPosterCard
          to={buildCmsPlayPath(item.source_code || '', String(item.vod_id))}
          posterUrl={item.vod_pic}
          title={item.vod_name}
          year={item.vod_year}
          topRightLabel={item.vod_remarks || undefined}
        />
      )}
    />
  )
}

/**
 * 无视频源时的空状态
 */
function EmptySourceState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="bg-muted flex size-16 items-center justify-center rounded-full">
        <Settings className="text-muted-foreground size-8" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold">暂无视频源</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          添加视频源后即可浏览推荐内容
        </p>
      </div>
      <Button asChild variant="outline">
        <NavLink to="/settings/source">
          <Plus className="size-4" />
          添加视频源
        </NavLink>
      </Button>
    </div>
  )
}

/**
 * CmsHomeContent - CMS 模式首页内容
 * 当 TMDB 未启用时作为首页内容展示
 */
export function CmsHomeContent() {
  const videoAPIs = useApiStore(state => state.videoAPIs)

  return (
    <div className="flex flex-col gap-6">
      {/* 继续观看 */}
      <ContinueWatching />
      {/* 各视频源推荐列表 */}
      {videoAPIs.length > 0 ? (
        videoAPIs.map(source => (
          <SourceCarousel key={source.id} source={source} />
        ))
      ) : (
        <EmptySourceState />
      )}
    </div>
  )
}
