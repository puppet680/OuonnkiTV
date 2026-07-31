import { useEffect, useRef } from 'react'

interface AutoPiPProps {
  playerSectionRef: React.RefObject<HTMLElement | null>
  enabled: boolean
  pipEnabled: boolean
  currentUrl: string
}

type PiPState = 'idle' | 'transitioning' | 'pip'

/**
 * 页面滚动时自动进入画中画模式（浏览器原生 PiP API）
 */
export function AutoPiP({
  playerSectionRef,
  enabled,
  pipEnabled,
  currentUrl,
}: AutoPiPProps) {
  const stateRef = useRef<{
    status: PiPState
    lockTimer: NodeJS.Timeout | null
  }>({
    status: 'idle',
    lockTimer: null,
  })

  useEffect(() => {
    const playerSection = playerSectionRef.current
    if (!enabled || !pipEnabled || !playerSection || !document.pictureInPictureEnabled) return

    const scrollViewport = document.querySelector(
      '[data-main-scroll-area] [data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null
    if (!scrollViewport) return

    const VISIBILITY_GAP = 60
    let currentVideo: HTMLVideoElement | null = null
    let initTimer: NodeJS.Timeout | null = null

    const clearLockTimer = () => {
      if (stateRef.current.lockTimer) {
        clearTimeout(stateRef.current.lockTimer)
        stateRef.current.lockTimer = null
      }
    }

    const forceResetStatus = (targetStatus: 'idle' | 'pip') => {
      clearLockTimer()
      stateRef.current.status = targetStatus
    }

    const onLeavePiP = () => {
      forceResetStatus('idle')
    }

    const onEnterPiP = () => {
      forceResetStatus('pip')
    }

    const getVideoElement = () => {
      if (currentVideo?.isConnected) return currentVideo

      currentVideo = playerSection.querySelector('video')
      if (currentVideo) {
        currentVideo.removeEventListener('leavepictureinpicture', onLeavePiP)
        currentVideo.removeEventListener('enterpictureinpicture', onEnterPiP)
        currentVideo.addEventListener('leavepictureinpicture', onLeavePiP)
        currentVideo.addEventListener('enterpictureinpicture', onEnterPiP)

        if (initTimer) {
          clearInterval(initTimer)
          initTimer = null
        }
      }
      return currentVideo
    }

    let rafId: number | null = null
    const checkVisibility = () => {
      if (rafId) return

      rafId = requestAnimationFrame(() => {
        rafId = null
        const state = stateRef.current

        if (state.status === 'transitioning') return

        const video = getVideoElement()
        if (!video || video.readyState < 2) return

        const rect = playerSection.getBoundingClientRect()
        const isVisible =
          rect.bottom > VISIBILITY_GAP && rect.top < window.innerHeight - VISIBILITY_GAP

        if (!isVisible && state.status === 'idle') {
          if (!document.pictureInPictureElement) {
            state.status = 'transitioning'

            state.lockTimer = setTimeout(() => {
              console.warn('AutoPiP: enter event timeout safety net triggered.')
              forceResetStatus('idle')
            }, 3000)

            video.requestPictureInPicture().catch((err) => {
              console.warn('AutoPiP enter failed:', err)
              forceResetStatus('idle')
            })
          } else {
            state.status = 'pip'
          }
        }
        else if (isVisible && state.status === 'pip') {
          if (document.pictureInPictureElement === video) {
            state.status = 'transitioning'

            state.lockTimer = setTimeout(() => {
              console.warn('AutoPiP: leave event timeout safety net triggered.')
              forceResetStatus('pip')
            }, 3000)

            document.exitPictureInPicture().catch((err) => {
              console.warn('AutoPiP exit failed:', err)
              forceResetStatus('pip')
            })
          } else {
            state.status = 'idle'
          }
        }
      })
    }

    scrollViewport.addEventListener('scroll', checkVisibility, { passive: true })
    initTimer = setInterval(checkVisibility, 1000)
    checkVisibility()

    return () => {
      clearLockTimer()
      if (initTimer) clearInterval(initTimer)
      if (rafId) cancelAnimationFrame(rafId)

      scrollViewport.removeEventListener('scroll', checkVisibility)

      if (currentVideo) {
        currentVideo.removeEventListener('leavepictureinpicture', onLeavePiP)
        currentVideo.removeEventListener('enterpictureinpicture', onEnterPiP)
      }

      if (document.pictureInPictureElement && stateRef.current.status === 'pip') {
        document.exitPictureInPicture().catch(() => {})
      }
    }
  }, [playerSectionRef, enabled, pipEnabled, currentUrl])

  return null
}
