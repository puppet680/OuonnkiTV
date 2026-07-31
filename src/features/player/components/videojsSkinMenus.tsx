import { forwardRef, useCallback, useRef } from 'react'
import { Globe } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  Menu,
  MuteButton,
  Popover,
  Slider,
  Tooltip,
  useAudioTrackOptions,
  useCaptionsOptions,
  usePlaybackRateOptions,
  usePlayer,
  useQualityOptions,
  VolumeSlider,
} from '@videojs/react'
import {
  CaptionsOffIcon,
  CheckIcon,
  ChevronIcon,
  GearIcon,
  QualityIcon,
  SpeechIcon,
  SpeedIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeOffIcon,
} from '@videojs/react/icons'

/** 基础图标按钮 */
export const Btn = forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'>>(
  function Btn({ className, ...props }, ref) {
    return <button ref={ref} type="button" className={cn('media-button media-button--subtle media-button--icon', className)} {...props} />
  },
)

/** 音量弹层（不支持时降级为静音按钮） */
export function VolumePopover() {
  const volumeUnsupported = usePlayer((s: Record<string, unknown>) => s.volumeAvailability === 'unsupported')
  const mute = (
    <MuteButton className="media-button--mute" render={<Btn />}>
      <VolumeOffIcon className="media-icon media-icon--volume-off" />
      <VolumeLowIcon className="media-icon media-icon--volume-low" />
      <VolumeHighIcon className="media-icon media-icon--volume-high" />
    </MuteButton>
  )
  if (volumeUnsupported) return mute
  return (
    <Popover.Root openOnHover delay={200} closeDelay={100} side="top">
      <Popover.Trigger render={mute} />
      <Popover.Popup className="media-surface media-popover media-popover--volume">
        <VolumeSlider.Root className="media-slider" orientation="vertical" thumbAlignment="edge">
          <Slider.Track className="media-slider__track">
            <Slider.Fill className="media-slider__fill" />
          </Slider.Track>
          <Slider.Thumb className="media-slider__thumb media-slider__thumb--persistent" />
        </VolumeSlider.Root>
      </Popover.Popup>
    </Popover.Root>
  )
}

function MenuChevron({ flipped = false }: { flipped?: boolean }) {
  return <ChevronIcon className={cn('media-icon media-menu__chevron', flipped ? 'media-icon--flipped' : undefined)} />
}

/** 设置菜单（画质/音轨/倍速/字幕/选集） */
export function SettingsMenu({ episodes, selectedEpisode, onEpisodeSelect }: {
  episodes?: string[]
  selectedEpisode?: number
  onEpisodeSelect?: (index: number) => void
}) {
  const playbackRate = usePlaybackRateOptions()
  const quality = useQualityOptions()
  const audioTrack = useAudioTrackOptions()
  const captions = useCaptionsOptions()
  const show = (
    playbackRate?.state.availability === 'available' ||
    quality?.state.availability === 'available' ||
    audioTrack?.state.availability === 'available' ||
    captions?.state.availability === 'available' ||
    (episodes && episodes.length > 1)
  )
  if (!show) return null

  return (
    <Menu.Root side="top" align="center">
      <Menu.Trigger aria-label="设置" className="media-button--settings" render={<Btn />}>
        <GearIcon className="media-icon media-icon--settings" />
      </Menu.Trigger>
      <Menu.Content className="media-surface media-popover media-menu media-menu--settings">
        <Menu.View className="media-menu__panel">
          <div className="media-menu__group">
            {quality?.state.availability === 'available' && (
              <Menu.Root>
                <Menu.Trigger type="quality" className="media-menu__item media-menu__item--submenu"
                  render={(props) => (
                    <div {...props}>
                      <QualityIcon className="media-icon" />
                      <span>画质</span>
                      <span className="media-menu__hint">
                        <Menu.ItemValue className="media-menu__hint-label" />
                        <MenuChevron />
                      </span>
                    </div>
                  )} />
                <Menu.Content className="media-menu__panel">
                  <Menu.Back className="media-menu__back"><MenuChevron flipped />画质</Menu.Back>
                  <Menu.Separator className="media-menu__separator" />
                  <Menu.RadioGroup className="media-menu__group" value={quality.value} onValueChange={quality.setValue} aria-label="画质">
                    {quality.options.map((option) => (
                      <Menu.RadioItem key={option.value} className="media-menu__item" value={option.value} disabled={option.disabled}>
                        <span>{option.label}{option.tier ? <sup className="media-menu__tier">{option.tier}</sup> : null}</span>
                        {option.badge ? <span className="media-badge">{option.badge}</span> : null}
                        <Menu.ItemIndicator checked={option.value === quality.value} forceMount className="media-menu__indicator">
                          <CheckIcon className="media-icon" />
                        </Menu.ItemIndicator>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Content>
              </Menu.Root>
            )}
            {audioTrack?.state.availability === 'available' && (
              <Menu.Root>
                <Menu.Trigger type="audio-track" className="media-menu__item media-menu__item--submenu"
                  render={(props) => (
                    <div {...props}>
                      <SpeechIcon className="media-icon" />
                      <span>音轨</span>
                      <span className="media-menu__hint"><Menu.ItemValue className="media-menu__hint-label" /><MenuChevron /></span>
                    </div>
                  )} />
                <Menu.Content className="media-menu__panel">
                  <Menu.Back className="media-menu__back"><MenuChevron flipped />音轨</Menu.Back>
                  <Menu.Separator className="media-menu__separator" />
                  <Menu.RadioGroup className="media-menu__group" value={audioTrack.value} onValueChange={audioTrack.setValue} aria-label="音轨">
                    {audioTrack.options.map((option) => (
                      <Menu.RadioItem key={option.value} className="media-menu__item" value={option.value} disabled={option.disabled}>
                        <span>{option.label}</span>
                        <Menu.ItemIndicator checked={option.value === audioTrack.value} forceMount className="media-menu__indicator">
                          <CheckIcon className="media-icon" />
                        </Menu.ItemIndicator>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Content>
              </Menu.Root>
            )}
            {playbackRate?.state.availability === 'available' && (
              <Menu.Root>
                <Menu.Trigger type="playback-rate" className="media-menu__item media-menu__item--submenu"
                  render={(props) => (
                    <div {...props}>
                      <SpeedIcon className="media-icon" />
                      <span>倍速</span>
                      <span className="media-menu__hint"><Menu.ItemValue className="media-menu__hint-label" /><MenuChevron /></span>
                    </div>
                  )} />
                <Menu.Content className="media-menu__panel">
                  <Menu.Back className="media-menu__back"><MenuChevron flipped />倍速</Menu.Back>
                  <Menu.Separator className="media-menu__separator" />
                  <Menu.RadioGroup className="media-menu__group" value={playbackRate.value} onValueChange={playbackRate.setValue} aria-label="倍速">
                    {playbackRate.options.map((option) => (
                      <Menu.RadioItem key={option.value} className="media-menu__item" value={option.value} disabled={option.disabled}>
                        <span>{option.label}</span>
                        <Menu.ItemIndicator checked={option.value === playbackRate.value} forceMount className="media-menu__indicator">
                          <CheckIcon className="media-icon" />
                        </Menu.ItemIndicator>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Content>
              </Menu.Root>
            )}
            {captions?.state.availability === 'available' && (
              <Menu.Root>
                <Menu.Trigger type="captions" className="media-menu__item media-menu__item--submenu"
                  render={(props) => (
                    <div {...props}>
                      <CaptionsOffIcon className="media-icon" />
                      <span>字幕</span>
                      <span className="media-menu__hint"><Menu.ItemValue className="media-menu__hint-label" /><MenuChevron /></span>
                    </div>
                  )} />
                <Menu.Content className="media-menu__panel">
                  <Menu.Back className="media-menu__back"><MenuChevron flipped />字幕</Menu.Back>
                  <Menu.Separator className="media-menu__separator" />
                  <Menu.RadioGroup className="media-menu__group" value={captions.value} onValueChange={captions.setValue} aria-label="字幕">
                    {captions.options.map((option) => (
                      <Menu.RadioItem key={option.value} className="media-menu__item" value={option.value} disabled={option.disabled}>
                        <span>{option.label}</span>
                        <Menu.ItemIndicator checked={option.value === captions.value} forceMount className="media-menu__indicator">
                          <CheckIcon className="media-icon" />
                        </Menu.ItemIndicator>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Content>
              </Menu.Root>
            )}
            {episodes && episodes.length > 1 && (
              <EpisodeList episodes={episodes} selectedEpisode={selectedEpisode ?? 0} onEpisodeSelect={onEpisodeSelect} />
            )}
          </div>
        </Menu.View>
      </Menu.Content>
    </Menu.Root>
  )
}

/** 选集列表（自动滚动到当前项） */
function EpisodeList({ episodes, selectedEpisode, onEpisodeSelect }: {
  episodes: string[]
  selectedEpisode: number
  onEpisodeSelect?: (index: number) => void
}) {
  const itemRef = useRef<HTMLSpanElement | null>(null)

  // 子菜单打开后滚动到当前集
  const scrollToActive = useCallback(() => {
    requestAnimationFrame(() => itemRef.current?.scrollIntoView({ block: 'nearest' }))
  }, [])

  return (
    <Menu.Root onOpenChangeComplete={(open) => open && scrollToActive()}>
      <Menu.Trigger className="media-menu__item media-menu__item--submenu"
        render={(props) => (
          <div {...props}>
            <ChevronIcon className="media-icon media-icon--flipped" />
            <span>选集</span>
            <span className="media-menu__hint">
              <span className="media-menu__hint-label">{selectedEpisode != null ? `第 ${selectedEpisode + 1} 集` : ''}</span>
              <MenuChevron />
            </span>
          </div>
        )} />
      <Menu.Content className="media-menu__panel">
        <Menu.Back className="media-menu__back"><MenuChevron flipped />选集</Menu.Back>
        <Menu.Separator className="media-menu__separator" />
        <Menu.RadioGroup className="media-menu__group" value={String(selectedEpisode)} onValueChange={(v) => onEpisodeSelect?.(Number(v))} aria-label="选集">
          {episodes.map((_ep, i) => (
            <Menu.RadioItem key={i} className="media-menu__item" value={String(i)}>
              <span ref={i === selectedEpisode ? itemRef : undefined}>第 {i + 1} 集</span>
              <Menu.ItemIndicator checked={i === selectedEpisode} className="media-menu__indicator !opacity-100">
                <CheckIcon className="media-icon" />
              </Menu.ItemIndicator>
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Root>
  )
}

/** 语言切换菜单 */
export function LanguageMenu({ options, value, onChange }: {
  options: { vodId: string; label: string }[]
  value: string
  onChange: (vodId: string, label: string) => void
}) {
  if (options.length < 2) return null
  return (
    <Menu.Root side="bottom" align="end">
      <Tooltip.Root side="bottom">
        <Tooltip.Trigger render={
          <Menu.Trigger aria-label="切换语言" render={<Btn />}>
            <Globe className="media-icon" />
          </Menu.Trigger>
        } />
        <Tooltip.Popup className="media-surface media-tooltip">
          <Tooltip.Label>切换语言</Tooltip.Label>
        </Tooltip.Popup>
      </Tooltip.Root>
      <Menu.Content className="media-surface media-popover media-menu">
        <Menu.RadioGroup className="media-menu__group" value={value} onValueChange={(label) => {
          const opt = options.find(o => o.label === label)
          if (opt) onChange(opt.vodId, opt.label)
        }} aria-label="语言">
          {options.map((option) => (
            <Menu.RadioItem key={option.vodId} className="media-menu__item" value={option.label}>
              <span>{option.label}</span>
              <Menu.ItemIndicator checked={option.label === value} className="media-menu__indicator !opacity-100">
                <CheckIcon className="media-icon" />
              </Menu.ItemIndicator>
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Root>
  )
}
