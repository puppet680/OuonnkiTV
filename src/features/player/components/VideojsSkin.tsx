import { Camera, Lock, LockOpen } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { useSettingStore } from '@/shared/store/settingStore'
import {
  Container,
  usePlayer,
  Poster,
  AirPlayButton,
  BufferingIndicator,
  CastButton,
  Controls,
  ErrorDialog,
  FullscreenButton,
  Gesture,
  Hotkey,
  PiPButton,
  PlayButton,
  SeekIndicator,
  Slider,
  StatusAnnouncer,
  StatusIndicator,
  Time,
  TimeSlider,
  Tooltip,
  VolumeIndicator,
} from '@videojs/react'
import {
  AirPlayEnterIcon, AirPlayExitIcon,
  CaptionsOffIcon, CaptionsOnIcon,
  CastEnterIcon, CastExitIcon,
  ChevronIcon,
  FullscreenEnterIcon, FullscreenExitIcon,
  PauseIcon,
  PipEnterIcon, PipExitIcon,
  PlayIcon,
  RestartIcon,
  SpinnerIcon,
  VolumeHighIcon, VolumeLowIcon, VolumeOffIcon,
} from '@videojs/react/icons'
import { Btn, VolumePopover, SettingsMenu, LanguageMenu } from './videojsSkinMenus'

// ── helpers from original skin ──

const TOP_STATUS_ACTIONS = ['toggleSubtitles', 'toggleFullscreen', 'togglePictureInPicture'] as const
const CENTER_STATUS_ACTIONS = ['togglePaused'] as const

// ── Custom skin: seek buttons → episode prev/next ──

interface VideojsSkinProps {
  children: ReactNode
  poster?: string | (() => ReactNode)
  placeholder?: string
  className?: string
  style?: Record<string, unknown>
  onPrevEpisode?: () => void
  onNextEpisode?: () => void
  title?: string
  currentEpisode?: string
  resolutionBadge?: ReactNode
  languageOptions?: { vodId: string; label: string }[]
  languageValue?: string
  onLanguageChange?: (vodId: string, label: string) => void
  episodes?: string[]
  selectedEpisode?: number
  onEpisodeSelect?: (index: number) => void
}

export function VideojsSkin({
  children, className, poster, placeholder,
  onPrevEpisode, onNextEpisode, title, currentEpisode, resolutionBadge,
  languageOptions, languageValue, onLanguageChange,
  episodes, selectedEpisode, onEpisodeSelect,
  style, ...rest
}: VideojsSkinProps) {
  const pipEnabled = useSettingStore(s => s.playback.isPipEnabled)
  const screenshotEnabled = useSettingStore(s => s.playback.isScreenshotEnabled)
  const paused = usePlayer((s: Record<string, unknown>) => s.paused as boolean | undefined)
  const isFullscreen = usePlayer((s: Record<string, unknown>) => s.fullscreen as boolean | undefined)
  const controlsVisible = usePlayer((s: Record<string, unknown>) => s.controlsVisible as boolean | undefined)
  const [isLocked, setIsLocked] = useState(false)

  // 退出全屏时自动解锁
  useEffect(() => { if (!isFullscreen) setIsLocked(false) }, [isFullscreen])
  const containerStyle = placeholder
    ? { '--media-poster-placeholder': `url(${placeholder})`, ...style }
    : style

  const posterSrc = typeof poster === 'string' ? poster : undefined
  const posterRender = typeof poster === 'function' ? poster : undefined

  return (
    <Container className={cn('media-default-skin media-default-skin--video', className)} style={containerStyle} {...rest}>
      {children}
      {/* ── 仿底栏悬浮定制：顶部控制栏 ── */}
      {isFullscreen && controlsVisible && !isLocked && (
        <div
          className={cn(
            // 1. 悬浮定位与边距：不贴边，与底栏的悬浮边距保持一致
            "absolute top-3 left-3 right-3 z-20",
            // 2. 视觉样式：复用底栏的磨砂质感 + 圆角 + 微光边框 + 投影
            "media-surface rounded-[1.5rem] border border-white/5 shadow-lg media-topbar-active",
            // 3. 高度与对齐
            "flex h-11 items-center justify-between px-4 transition-all duration-300"
          )}
          style={{ color: 'var(--media-color-primary)' }}
        >
          <Tooltip.Provider>

            {/* 左侧区域：返回按钮 + 同行标题 */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
            <SettingsMenu episodes={episodes} selectedEpisode={selectedEpisode} onEpisodeSelect={onEpisodeSelect} />

              {/* 返回按钮 (复用底栏圆形微光悬浮态) */}
              <Tooltip.Root side="bottom">
                <Tooltip.Trigger render={
                  <button
                    type="button"
                    aria-label="返回"
                    onClick={() => window.history.back()}
                    className="media-button media-button--subtle media-button--icon hover:bg-[var(--media-color-primary)]/10 active:scale-95 transition-all duration-150 rounded-full flex items-center justify-center w-8 h-8 shrink-0"
                  >
                    <ChevronIcon className="media-icon media-icon--flipped w-4 h-4" />
                  </button>
                } />
                <Tooltip.Popup className="media-surface media-tooltip">
                  <Tooltip.Label>返回</Tooltip.Label>
                </Tooltip.Popup>
              </Tooltip.Root>

              {/* 标题与集数同行显示 */}
              <div className="flex items-baseline gap-2 min-w-0 text-left">
                {title && (
                  <h1 className="truncate text-sm font-medium tracking-wide drop-shadow">
                    {title}
                  </h1>
                )}
                {title && currentEpisode && (
                  <span className="text-xs select-none shrink-0 opacity-30">|</span>
                )}
                {currentEpisode && (
                  <p className="truncate text-xs drop-shadow shrink-0 opacity-60">
                    {currentEpisode}
                  </p>
                )}
              </div>
            </div>

            {/* 右侧区域：语言图标按钮 + 分辨率 */}
            <div className="flex items-center gap-2.5 shrink-0 pointer-events-auto">
              {languageOptions && languageOptions.length > 1 && (
                <LanguageMenu options={languageOptions} value={languageValue ?? ''} onChange={onLanguageChange ?? (() => {})} />
              )}
              {resolutionBadge && (
                <div className="text-xs font-medium opacity-80">
                  {resolutionBadge}
                </div>
              )}
            </div>

          </Tooltip.Provider>
        </div>
      )}
      {poster && <Poster src={posterSrc} render={posterRender as React.ComponentProps<typeof Poster>['render']} />}
      <BufferingIndicator render={(props) => (
        <div {...props} className="media-buffering-indicator">
          <SpinnerIcon className="media-icon" />
        </div>
      )} />
      <ErrorDialog.Root>
        <ErrorDialog.Popup className="media-error">
          <div className="media-error__dialog media-surface">
            <div className="media-error__content">
              <ErrorDialog.Title className="media-error__title">Something went wrong.</ErrorDialog.Title>
              <ErrorDialog.Description className="media-error__description" />
            </div>
            <div className="media-error__actions">
              <ErrorDialog.Close className="media-button media-button--primary">OK</ErrorDialog.Close>
            </div>
          </div>
        </ErrorDialog.Popup>
      </ErrorDialog.Root>

      {/* ── Controls ── */}
      <Controls.Root className={cn('media-surface media-controls', isLocked && 'pointer-events-none opacity-0')}>
        <Tooltip.Provider>
          <div className="media-button-group">
            {/* Ep prev — 替换快退 */}
            <Tooltip.Root side="top">
              <Tooltip.Trigger render={
                <button type="button" aria-label="上一集" onClick={onPrevEpisode}
                  disabled={!onPrevEpisode}
                  className="media-button media-button--subtle media-button--icon disabled:opacity-25">
                  <ChevronIcon className="media-icon media-icon--flipped" />
                </button>
              } />
              <Tooltip.Popup className="media-surface media-tooltip">
                <Tooltip.Label>{onPrevEpisode ? '上一集' : '没有上一集了'}</Tooltip.Label>
              </Tooltip.Popup>
            </Tooltip.Root>

            {/* Play */}
            <Tooltip.Root side="top">
              <Tooltip.Trigger render={
                <PlayButton className="media-button--play" render={<Btn />}>
                  <RestartIcon className="media-icon media-icon--restart" />
                  <PlayIcon className="media-icon media-icon--play" />
                  <PauseIcon className="media-icon media-icon--pause" />
                </PlayButton>
              } />
              <Tooltip.Popup className="media-surface media-tooltip">
                <Tooltip.Label>{paused ? '播放' : '暂停'}</Tooltip.Label>
                <Tooltip.Shortcut className="media-tooltip__kbd" />
              </Tooltip.Popup>
            </Tooltip.Root>
            <Tooltip.Root side="top">
              <Tooltip.Trigger render={
                <button type="button" aria-label="下一集" onClick={onNextEpisode}
                  disabled={!onNextEpisode}
                  className="media-button media-button--subtle media-button--icon disabled:opacity-25">
                  <ChevronIcon className="media-icon" />
                </button>
              } />
              <Tooltip.Popup className="media-surface media-tooltip">
                <Tooltip.Label>{onNextEpisode ? '下一集' : '没有下一集了'}</Tooltip.Label>
              </Tooltip.Popup>
            </Tooltip.Root>
          </div>

          {/* Time controls */}
          <div className="media-time-controls">
            <Time.Value type="current" className="media-time" />
            <TimeSlider.Root className="media-slider">
              <Slider.Track className="media-slider__track">
                <Slider.Fill className="media-slider__fill" />
                <Slider.Buffer className="media-slider__buffer" />
              </Slider.Track>
              <Slider.Thumb className="media-slider__thumb" />
              <div className="media-surface media-thumbnail media-slider__thumbnail">
                <Slider.Thumbnail className="media-thumbnail__image" />
                <Slider.Value type="pointer" className="media-time media-thumbnail__time" />
                <SpinnerIcon className="media-thumbnail__spinner media-icon" />
              </div>
              <Slider.Preview className="media-slider__preview">
                <Slider.Value type="pointer" className="media-time media-slider__value" />
              </Slider.Preview>
            </TimeSlider.Root>
            <Time.Value toggle type="duration" className="media-time" />
          </div>

          {/* Right buttons */}
          <div className="media-button-group">
            <VolumePopover />
            <SettingsMenu episodes={episodes} selectedEpisode={selectedEpisode} onEpisodeSelect={onEpisodeSelect} />
            <Tooltip.Root side="top">
              <Tooltip.Trigger render={
                <CastButton className="media-button--cast" render={<Btn />}>
                  <CastEnterIcon className="media-icon media-icon--cast-enter" />
                  <CastExitIcon className="media-icon media-icon--cast-exit" />
                </CastButton>
              } />
              <Tooltip.Popup className="media-surface media-tooltip">
                <Tooltip.Label /><Tooltip.Shortcut className="media-tooltip__kbd" />
              </Tooltip.Popup>
            </Tooltip.Root>
            <Tooltip.Root side="top">
              <Tooltip.Trigger render={
                <AirPlayButton className="media-button--airplay" render={<Btn />}>
                  <AirPlayEnterIcon className="media-icon media-icon--airplay-enter" />
                  <AirPlayExitIcon className="media-icon media-icon--airplay-exit" />
                </AirPlayButton>
              } />
              <Tooltip.Popup className="media-surface media-tooltip">
                <Tooltip.Label /><Tooltip.Shortcut className="media-tooltip__kbd" />
              </Tooltip.Popup>
            </Tooltip.Root>
            {pipEnabled && (
              <Tooltip.Root side="top">
                <Tooltip.Trigger render={
                  <PiPButton className="media-button--pip" render={<Btn />}>
                    <PipEnterIcon className="media-icon media-icon--pip-enter" />
                    <PipExitIcon className="media-icon media-icon--pip-exit" />
                  </PiPButton>
                } />
                <Tooltip.Popup className="media-surface media-tooltip">
                  <Tooltip.Label>画中画</Tooltip.Label>
                  <Tooltip.Shortcut className="media-tooltip__kbd" />
                </Tooltip.Popup>
              </Tooltip.Root>
            )}
            <Tooltip.Root side="top">
              <Tooltip.Trigger render={
                <FullscreenButton className="media-button--fullscreen" render={<Btn />}>
                  <FullscreenEnterIcon className="media-icon media-icon--fullscreen-enter" />
                  <FullscreenExitIcon className="media-icon media-icon--fullscreen-exit" />
                </FullscreenButton>
              } />
              <Tooltip.Popup className="media-surface media-tooltip">
                <Tooltip.Label>{isFullscreen ? '退出全屏' : '全屏'}</Tooltip.Label>
                <Tooltip.Shortcut className="media-tooltip__kbd" />
              </Tooltip.Popup>
            </Tooltip.Root>
          </div>
        </Tooltip.Provider>
      </Controls.Root>

      {/* 右侧截图按钮 — 全屏时显示 */}
      {screenshotEnabled && isFullscreen && controlsVisible && !isLocked && (
        <div className="absolute top-1/2 z-30 flex -translate-y-1/2" style={{ right: 'calc(0.75rem + env(safe-area-inset-right, 0px))' }}>
          <Tooltip.Root side="left">
            <Tooltip.Trigger render={
              <button type="button" aria-label="截取画面" className="media-button media-button--subtle media-button--icon"
                onClick={() => {
                  const video = document.querySelector<HTMLVideoElement>('video')
                  if (!video || video.videoWidth === 0) return
                  const canvas = document.createElement('canvas')
                  canvas.width = video.videoWidth
                  canvas.height = video.videoHeight
                  canvas.getContext('2d')?.drawImage(video, 0, 0)
                  canvas.toBlob(blob => {
                    if (!blob) return
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = `screenshot-${Date.now()}.png`
                    a.click()
                    URL.revokeObjectURL(a.href)
                  }, 'image/png')
                }}>
                <Camera size={18} className="text-[var(--media-color-primary)]" />
              </button>
            } />
            <Tooltip.Popup className="media-surface media-tooltip">
              <Tooltip.Label>截图</Tooltip.Label>
            </Tooltip.Popup>
          </Tooltip.Root>
        </div>
      )}

      {/* 左侧居中锁定按钮 — 全屏时显示 */}
      {isFullscreen && controlsVisible && !isLocked && (
        <div className="absolute top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2" style={{ left: 'calc(0.75rem + env(safe-area-inset-left, 0px))' }}>
          <Tooltip.Root side="right">
            <Tooltip.Trigger render={
              <button type="button" aria-label={isLocked ? '解锁' : '锁定'} className="media-button media-button--subtle media-button--icon"
                onClick={() => setIsLocked(v => !v)}>
                {isLocked ? <LockOpen size={18} className="text-[var(--media-color-primary)]" /> : <Lock size={18} className="text-[var(--media-color-primary)]" />}
              </button>
            } />
            <Tooltip.Popup className="media-surface media-tooltip">
              <Tooltip.Label>{isLocked ? '解锁' : '锁定'}</Tooltip.Label>
            </Tooltip.Popup>
          </Tooltip.Root>
        </div>
      )}

      {/* 锁定后独立解锁按钮 */}
      {isLocked && (
        <button type="button" aria-label="解锁"
          className="media-button media-button--subtle media-button--icon absolute top-1/2 z-30 -translate-y-1/2"
          style={{ left: 'calc(0.75rem + env(safe-area-inset-left, 0px))' }}
          onClick={() => setIsLocked(false)}>
          <LockOpen size={18} className="text-[var(--media-color-primary)]" />
        </button>
      )}

      <div className="media-overlay" />

      {/* Hotkeys */}
      <Hotkey keys="Space" action="togglePaused" />
      <Hotkey keys="k" action="togglePaused" />
      <Hotkey keys="m" action="toggleMuted" />
      <Hotkey keys="f" action="toggleFullscreen" />
      <Hotkey keys="c" action="toggleSubtitles" />
      <Hotkey keys="i" action="togglePictureInPicture" />
      <Hotkey keys="l" action="seekStep" value={10} />
      <Hotkey keys="j" action="seekStep" value={-10} />
      <Hotkey keys="ArrowUp" action="volumeStep" value={0.05} />
      <Hotkey keys="ArrowDown" action="volumeStep" value={-0.05} />
      <Hotkey keys="0-9" action="seekToPercent" />
      <Hotkey keys="Home" action="seekToPercent" value={0} />
      <Hotkey keys="End" action="seekToPercent" value={100} />

      {/* Gestures */}
      <Gesture type="tap" action="toggleControls" pointer="touch" />
      <Gesture type="tap" action="togglePaused" pointer="mouse" />
      <Gesture type="doubletap" action="seekStep" value={-10} region="left" />
      <Gesture type="doubletap" action="toggleFullscreen" region="center" pointer="mouse" />
      <Gesture type="doubletap" action="togglePaused" region="center" pointer="touch" />
      <Gesture type="doubletap" action="seekStep" value={10} region="right" />

      <StatusAnnouncer />
      <div className="media-input-feedback">
        <VolumeIndicator.Root className="media-surface media-input-feedback-island media-input-feedback-island--volume">
          <VolumeIndicator.Fill className="media-input-feedback-island__content">
            <VolumeHighIcon className="media-icon media-icon--volume-high" />
            <VolumeLowIcon className="media-icon media-icon--volume-low" />
            <VolumeOffIcon className="media-icon media-icon--volume-off" />
            <VolumeIndicator.Value className="media-input-feedback-island__value" />
          </VolumeIndicator.Fill>
        </VolumeIndicator.Root>
        <StatusIndicator.Root actions={TOP_STATUS_ACTIONS} className="media-surface media-input-feedback-island media-input-feedback-island--status">
          <div className="media-input-feedback-island__content">
            <CaptionsOnIcon className="media-icon media-icon--captions-on" />
            <CaptionsOffIcon className="media-icon media-icon--captions-off" />
            <FullscreenEnterIcon className="media-icon media-icon--fullscreen-enter" />
            <FullscreenExitIcon className="media-icon media-icon--fullscreen-exit" />
            <PipEnterIcon className="media-icon media-icon--pip-enter" />
            <PipExitIcon className="media-icon media-icon--pip-exit" />
            <StatusIndicator.Value className="media-input-feedback-island__value" />
          </div>
        </StatusIndicator.Root>
        <SeekIndicator.Root className="media-input-feedback-bubble">
          <ChevronIcon className="media-icon media-icon--seek" />
          <SeekIndicator.Value className="media-time" />
        </SeekIndicator.Root>
        <StatusIndicator.Root actions={CENTER_STATUS_ACTIONS} className="media-input-feedback-bubble">
          <PlayIcon className="media-icon media-icon--play" />
          <PauseIcon className="media-icon media-icon--pause" />
        </StatusIndicator.Root>
      </div>
    </Container>
  )
}

// ── mobile: auto-lock landscape on fullscreen ──

const isMobileDevice = () =>
  window.matchMedia('(hover: none) and (pointer: coarse)').matches || navigator.maxTouchPoints > 0

/**
 * 移动端全屏时自动锁定横屏，退出全屏时解锁
 * ponytail: DOM fullscreenchange 事件 — Video.js Fullscreen feature 也可用但事件更直接
 */
export function OrientationLocker() {
  useEffect(() => {
    if (!isMobileDevice()) return

    const lock = () => {
      const video = document.querySelector<HTMLVideoElement>('video')
      if (!video || video.videoWidth === 0) return
      if (video.videoWidth > video.videoHeight) {
        try { void (screen.orientation as unknown as { lock?: (m: string) => Promise<void> })?.lock?.('landscape') } catch { /* noop */ }
      }
    }
    const unlock = () => {
      try { void (screen.orientation as unknown as { unlock?: () => void })?.unlock?.() } catch { /* noop */ }
    }

    const onFullscreenChange = () => {
      if (document.fullscreenElement) lock()
      else unlock()
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      unlock()
    }
  }, [])

  return null
}
