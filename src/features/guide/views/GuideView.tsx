import { useState } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SatelliteDish,
  Database,
  Play,
  Settings,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib'
import { SettingsPageShell, SettingsSection } from '@/features/settings/components/common'
import { useSettingStore } from '@/shared/store/settingStore'
import { Switch } from '@/shared/components/ui/switch'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { KeyRound, Link2, Image as ImageIcon } from 'lucide-react'
import { SettingsItem } from '@/features/settings/components/common'
import NetworkSettings from '@/features/settings/components/NetworkSettings'
import SearchSettings from '@/features/settings/components/SearchSettings'
import PlaybackSettingsComponent from '@/features/settings/components/PlaybackSettings'
import VideoSource from '@/features/settings/components/VideoSource'
import SubscriptionManager from '@/features/settings/components/VideoSource/SubscriptionManager'

const GUIDE_COMPLETED_KEY = 'ouonnki-tv-guide-completed'

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
}

interface StepDef {
  title: string
  description: string
  icon: React.ReactNode
  tone: 'slate' | 'sky' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan'
}

const STEPS: StepDef[] = [
  {
    title: '视频源配置',
    description: 'CMS 视频源是内容的来源，至少启用一个才能正常使用。后续可在设置中继续添加。',
    icon: <SatelliteDish className="size-4" />,
    tone: 'sky',
  },
  {
    title: 'TMDB API 配置',
    description: 'TMDB 提供影视元数据、海报和推荐内容。如已配置环境变量可跳过此步。',
    icon: <Database className="size-4" />,
    tone: 'violet',
  },
  {
    title: '播放偏好',
    description: '控制播放体验、观看历史和自动播放等行为。',
    icon: <Play className="size-4" />,
    tone: 'amber',
  },
  {
    title: '系统设置',
    description: '网络代理、搜索历史和通用系统行为配置。',
    icon: <Settings className="size-4" />,
    tone: 'emerald',
  },
]

function TmdbApiStep() {
  const { system, setSystemSettings } = useSettingStore()
  const hasEnvToken = Boolean(import.meta.env.OKI_TMDB_API_TOKEN)
  const hasUserToken = Boolean(system.tmdbApiToken)
  const hasTmdbToken = hasEnvToken || hasUserToken
  const tmdbApiBaseUrlPlaceholder = import.meta.env.OKI_TMDB_API_BASE_URL || 'https://api.themoviedb.org/3'
  const tmdbImageBaseUrlPlaceholder = import.meta.env.OKI_TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p/'

  return (
    <SettingsSection
      title="TMDB API"
      description="配置 TMDB 连接参数以启用影视元数据功能。"
      icon={<Database className="size-4" />}
      tone="violet"
    >
      {!hasEnvToken && (
        <SettingsItem
          title="TMDB API Token"
          description="从 themoviedb.org 获取免费 API Token。"
          control={
            <div className="relative w-full sm:w-[340px]">
              <KeyRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                type="password"
                className="pl-9"
                value={system.tmdbApiToken}
                placeholder="输入 TMDB API Token"
                onChange={e => setSystemSettings({ tmdbApiToken: e.target.value.trim() })}
              />
            </div>
          }
        />
      )}
      <SettingsItem
        title="TMDB 智能模式"
        description={hasTmdbToken ? '启用后通过 TMDB 获取影片元数据、海报和推荐内容。' : '请先在上方输入 TMDB API Token 后启用。'}
        controlClassName="self-end mt-1"
        control={
          <Switch
            checked={system.tmdbEnabled}
            disabled={!hasTmdbToken}
            onCheckedChange={checked => setSystemSettings({ tmdbEnabled: checked })}
          />
        }
      />
      <SettingsItem
        title="TMDB API Base URL"
        description="支持绝对地址或相对路径，留空使用默认值。"
        control={
          <div className="relative w-full sm:w-[340px]">
            <Link2 className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="text"
              className="pl-9"
              value={system.tmdbApiBaseUrl}
              placeholder={tmdbApiBaseUrlPlaceholder}
              onChange={e => setSystemSettings({ tmdbApiBaseUrl: e.target.value })}
            />
          </div>
        }
      />
      <SettingsItem
        title="TMDB 图片 Base URL"
        description="海报和背景图的加载地址，留空使用默认值。"
        control={
          <div className="relative w-full sm:w-[340px]">
            <ImageIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="text"
              className="pl-9"
              value={system.tmdbImageBaseUrl}
              placeholder={tmdbImageBaseUrlPlaceholder}
              onChange={e => setSystemSettings({ tmdbImageBaseUrl: e.target.value })}
            />
          </div>
        }
      />
      {system.tmdbEnabled && (
        <>
          <SettingsItem
            title="TMDB 内容语言"
            description="影响影片标题、简介等数据的显示语言。"
            control={
              <div className="w-full sm:w-[200px]">
                <Select
                  value={system.tmdbLanguage}
                  onValueChange={value => setSystemSettings({ tmdbLanguage: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">简体中文</SelectItem>
                    <SelectItem value="zh-TW">繁體中文</SelectItem>
                    <SelectItem value="en-US">English</SelectItem>
                    <SelectItem value="ja-JP">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          />
          <SettingsItem
            title="TMDB 影视偏好"
            description="欧美对应 Netflix 等平台，大陆对应爱奇艺、腾讯视频等。"
            control={
              <div className="w-full sm:w-[200px]">
                <Select
                  value={system.tmdbRegion}
                  onValueChange={value => setSystemSettings({ tmdbRegion: value as 'international' | 'mainland' })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="international">欧美</SelectItem>
                    <SelectItem value="mainland">大陆</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          />
          <SettingsItem
            title="TMDB 图片质量"
            description="高质量消耗更多流量。"
            control={
              <div className="w-full sm:w-[200px]">
                <Select
                  value={system.tmdbImageQuality}
                  onValueChange={(value: 'low' | 'medium' | 'high') =>
                    setSystemSettings({ tmdbImageQuality: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低（w342）</SelectItem>
                    <SelectItem value="medium">中（w500/w780）</SelectItem>
                    <SelectItem value="high">高（original）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          />
        </>
      )}
    </SettingsSection>
  )
}

function CompletionStep() {
  const navigate = useNavigate()

  const handleEnter = () => {
    localStorage.setItem(GUIDE_COMPLETED_KEY, 'true')
    navigate('/', { replace: true })
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="bg-emerald-500/10 ring-emerald-500/20 flex size-20 items-center justify-center rounded-full ring-1">
        <CheckCircle className="text-emerald-500 size-10" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">配置完成！</h2>
        <p className="text-muted-foreground max-w-md text-sm">
          您已完成基础配置，可以开始探索影视内容了。
          随时可以在设置页面中调整更多选项。
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        <span className="bg-muted/50 rounded-md px-3 py-1">✓ 视频源已就绪</span>
        <span className="bg-muted/50 rounded-md px-3 py-1">✓ TMDB 已配置</span>
        <span className="bg-muted/50 rounded-md px-3 py-1">✓ 播放偏好已保存</span>
        <span className="bg-muted/50 rounded-md px-3 py-1">✓ 系统设置已完成</span>
      </div>
      <Button size="lg" onClick={handleEnter} className="mt-4 gap-2">
        进入应用
        <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}

export default function GuideView() {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const navigate = useNavigate()

  const isLastContentStep = currentStep === STEPS.length - 1
  const isCompletion = currentStep === STEPS.length

  const goNext = () => {
    setDirection(1)
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length))
  }

  const goPrev = () => {
    setDirection(-1)
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const handleSkip = () => {
    localStorage.setItem(GUIDE_COMPLETED_KEY, 'true')
    navigate('/', { replace: true })
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <header className="border-border/50 shrink-0 border-b px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-primary text-lg font-bold tracking-wider">I TV</span>
            <span className="text-muted-foreground text-sm">初始化引导</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            跳过引导
          </Button>
        </div>
      </header>

      {/* Step indicators */}
      {!isCompletion && (
        <div className="shrink-0 px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
            {STEPS.map((step, i) => (
              <button
                key={i}
                type="button"
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors',
                  i === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : i < currentStep
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground',
                )}
                onClick={() => {
                  setDirection(i > currentStep ? 1 : -1)
                  setCurrentStep(i)
                }}
              >
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full text-xs font-bold',
                    i === currentStep
                      ? 'bg-primary-foreground text-primary'
                      : i < currentStep
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground/30 text-muted-foreground',
                  )}
                >
                  {i < currentStep ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{step.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-6">
        <div className="mx-auto max-w-2xl">
          <AnimatePresence mode="wait" custom={direction}>
            {isCompletion ? (
              <motion.div
                key="completion"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <CompletionStep />
              </motion.div>
            ) : (
              <motion.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <SettingsPageShell
                  title={STEPS[currentStep].title}
                  description={STEPS[currentStep].description}
                >
                  {currentStep === 0 && (
                    <>
                      <SubscriptionManager />
                      <VideoSource />
                    </>
                  )}
                  {currentStep === 1 && <TmdbApiStep />}
                  {currentStep === 2 && <PlaybackSettingsComponent />}
                  {currentStep === 3 && (
                    <>
                      <NetworkSettings />
                      <SearchSettings />
                    </>
                  )}
                </SettingsPageShell>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer navigation */}
      {!isCompletion && (
        <footer className="border-border/50 shrink-0 border-t px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              上一步
            </Button>

            <span className="text-muted-foreground text-sm">
              {currentStep + 1} / {STEPS.length}
            </span>

            <Button onClick={goNext} className="gap-2">
              {isLastContentStep ? '完成' : '下一步'}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </footer>
      )}
    </div>
  )
}
