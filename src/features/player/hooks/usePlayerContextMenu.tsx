import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Camera, PictureInPicture2, Globe, HeartOff } from 'lucide-react'
import { useGlobalContextMenuStore } from '@/shared/store/contextMenuStore'
import { useSettingStore } from '@/shared/store/settingStore'
import { ExternalLink } from '@/components/animate-ui/icons/external-link'
import { Heart } from '@/components/animate-ui/icons/heart'

interface UsePlayerContextMenuParams {
  isCmsRoute: boolean
  isTmdbRoute: boolean
  cmsFavoriteActive: boolean
  tmdbFavoriteActive: boolean
  onToggleCmsFavorite: () => void
  onToggleTmdbFavorite: () => void
  /** 视频标题，作为全局菜单抽屉标题 */
  title?: string
  detailLink?: string
  homepage?: string
}

/**
 * 注册播放页全局右键菜单（截图/画中画/收藏/详情/官网），替代播放器内置菜单
 * 通过 ref 保持最新回调，避免重复注册
 */
export function usePlayerContextMenu({
  isCmsRoute,
  isTmdbRoute,
  cmsFavoriteActive,
  tmdbFavoriteActive,
  onToggleCmsFavorite,
  onToggleTmdbFavorite,
  title,
  detailLink,
  homepage,
}: UsePlayerContextMenuParams) {
  const navigate = useNavigate()

  const favToggleRef = useRef<() => void>(() => {})
  favToggleRef.current = isCmsRoute ? onToggleCmsFavorite : onToggleTmdbFavorite
  const favActiveRef = useRef(false)
  favActiveRef.current = isCmsRoute ? cmsFavoriteActive : tmdbFavoriteActive
  const detailLinkRef = useRef(detailLink)
  detailLinkRef.current = detailLink
  const homepageRef = useRef(homepage)
  homepageRef.current = homepage
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const contextMenuIdsRef = useRef<string[]>([])
  useEffect(() => {
    const { registerItems, unregisterItems, setMenuTitle } = useGlobalContextMenuStore.getState()
    if (contextMenuIdsRef.current.length > 0) {
      unregisterItems(...contextMenuIdsRef.current)
    }
    setMenuTitle(title || '')

    const { playback } = useSettingStore.getState()
    const items = []
    if (playback.isScreenshotEnabled)
      items.push({
        id: 'player-screenshot',
        label: '截取画面',
        icon: <Camera className="size-4" />,
        onClick: () => {
          const video = document.querySelector<HTMLVideoElement>('video')
          if (!video || video.videoWidth === 0) return
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          ctx.drawImage(video, 0, 0)
          canvas.toBlob(blob => {
            if (!blob) return
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `screenshot-${Date.now()}.png`
            a.click()
            URL.revokeObjectURL(url)
          }, 'image/png')
        },
      })
    if (playback.isPipEnabled)
      items.push({
        id: 'player-pip',
        label: '画中画',
        icon: <PictureInPicture2 className="size-4" />,
        onClick: () => {
          const video = document.querySelector<HTMLVideoElement>('video')
          if (!video) return
          try {
            if (document.pictureInPictureElement) {
              void document.exitPictureInPicture()
            } else {
              void video.requestPictureInPicture()
            }
          } catch {
            /* noop */
          }
        },
      })
    items.push({
      id: 'player-favorite',
      label: favActiveRef.current ? '取消收藏' : '加入收藏',
      icon: favActiveRef.current ? <HeartOff className="size-4" /> : <Heart className="size-4" animation="fill"/>,
      onClick: () => favToggleRef.current(),
    })
    if (detailLinkRef.current) {
      items.push({
        id: 'player-detail',
        label: '查看详情',
        icon: <ExternalLink className="size-4" />,
        onClick: () => navigateRef.current(detailLinkRef.current!),
      })
    }
    if (homepageRef.current) {
      items.push({
        id: 'player-official',
        label: '官方页面',
        icon: <Globe className="size-4" />,
        onClick: () => window.open(homepageRef.current!, '_blank', 'noopener'),
      })
    }

    const ids = registerItems(items)
    contextMenuIdsRef.current = ids
    return () => {
      unregisterItems(...ids)
      setMenuTitle('')
      contextMenuIdsRef.current = []
    }
  }, [
    isCmsRoute,
    isTmdbRoute,
    cmsFavoriteActive,
    tmdbFavoriteActive,
    title,
    detailLink,
    homepage,
  ])
}
