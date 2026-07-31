import { Video } from '@videojs/react/video'
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video'
import type { HlsConfig } from 'hls.js'

/**
 * 根据 URL 自动选 Video（mp4）或 HlsJsVideo（m3u8），透传 hls.js config
 */
export function MediaElement({
  src,
  hlsConfig,
  autoPlay,
  playsInline,
  ...rest
}: {
  src: string
  playsInline?: boolean
  autoPlay?: boolean
  hlsConfig?: Partial<HlsConfig>
}) {
  if (src.endsWith('.m3u8') || src.includes('m3u8')) {
    return (
      <HlsJsVideo
        src={src}
        playsInline={playsInline}
        autoPlay={autoPlay}
        config={{ hlsJs: hlsConfig }}
        {...rest}
      />
    )
  }
  return <Video src={src} playsInline={playsInline} autoPlay={autoPlay} {...rest} />
}

