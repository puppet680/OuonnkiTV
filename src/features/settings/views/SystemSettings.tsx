import NetworkSettings from '../components/NetworkSettings'
import SearchSettings from '../components/SearchSettings'
import ThemeSettings from '../components/ThemeSettings'
import { useSettingStore } from '@/shared/store/settingStore'
import { usePanhubStore } from '@/shared/store/panhubStore'
import { Switch } from '@/shared/components/ui/switch'
import { Input } from '@/shared/components/ui/input'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Button } from '@/shared/components/ui/button'
import { Cog, KeyRound, Search } from 'lucide-react'
import { SettingsItem, SettingsPageShell, SettingsSection } from '../components/common'
import { ALL_PLUGIN_NAMES } from '@/shared/types/panhub'

export default function SystemSettings() {
  const { system, setSystemSettings } = useSettingStore()
  const panhub = usePanhubStore()

  const hasEnvToken = Boolean(import.meta.env.OKI_TMDB_API_TOKEN)
  const hasUserToken = Boolean(system.tmdbApiToken)
  const hasTmdbToken = hasEnvToken || hasUserToken

  return (
    <SettingsPageShell
      title="系统设置"
      description="组合网络、搜索、主题与系统行为，统一管理应用偏好。"
      showHeader={false}
    >
      <NetworkSettings />
      <SearchSettings />
      <ThemeSettings />
      <SettingsSection
        title="系统行为"
        description="控制系统级交互与提示策略。"
        icon={<Cog className="size-4" />}
        tone="cyan"
      >
        {/* <SettingsItem
          title="自动显示更新日志"
          description="检测到新版本时自动弹出更新说明窗口。"
          controlClassName="self-end mt-1"
          control={
            <Switch
              checked={system.isUpdateLogEnabled}
              onCheckedChange={checked => setSystemSettings({ isUpdateLogEnabled: checked })}
            />
          }
        /> */}
        <SettingsItem
          title="滚动收起导航动画"
          description={
            <span>
              启用后会在下滑时收起顶部导航和侧边栏，并在上滑时恢复。
              <span className="text-destructive font-semibold">
                {' '}
                该动画可能带来较高性能消耗，建议仅在性能充足的设备开启。
              </span>
            </span>
          }
          controlClassName="self-end mt-1"
          control={
            <Switch
              checked={system.isScrollChromeAnimationEnabled}
              onCheckedChange={checked => setSystemSettings({ isScrollChromeAnimationEnabled: checked })}
            />
          }
        />
        <SettingsItem
          title="成人内容过滤"
          description={
            <span>
              关闭后，TMDB 搜索结果不过滤成人分级，CMS 直连模式不过滤标题/简介中的敏感关键词。
              <br />
              <span className="text-muted-foreground/70 text-xs">
                CMS 关键词通过 <code className="bg-muted px-1 py-0.5 rounded text-[11px]">OKI_CMS_FILTER_KEYWORDS</code> 环境变量配置，逗号分隔。
              </span>
            </span>
          }
          controlClassName="self-end mt-1"
          control={
            <Switch
              checked={system.isAdultFilterEnabled}
              onCheckedChange={checked => setSystemSettings({ isAdultFilterEnabled: checked })}
            />
          }
        />
        {!hasEnvToken && (
          <SettingsItem
            title="TMDB API Token"
            description="未检测到环境变量 Token，可手动输入以启用 TMDB 功能。从 themoviedb.org 获取。"
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
          description={
            hasTmdbToken
              ? '启用后通过 TMDB 获取影片元数据、海报和推荐内容，关闭后仅使用视频源数据。'
              : '请先在上方输入 TMDB API Token 后启用。'
          }
          controlClassName="self-end mt-1"
          control={
            <Switch
              checked={system.tmdbEnabled}
              disabled={!hasTmdbToken}
              onCheckedChange={checked => setSystemSettings({ tmdbEnabled: checked })}
            />
          }
        />
        {system.tmdbEnabled && (
          <>
            <SettingsItem
              title="TMDB 内容语言"
              description="影响影片标题、简介等 TMDB 数据的显示语言。"
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
              title="影视平台偏好"
              description="选择首页内容的来源平台，影响剧集、综艺等分类的数据。"
              control={
                <div className="w-full sm:w-[200px]">
                  <Select
                    value={system.varietyNetworks}
                    onValueChange={value => setSystemSettings({ varietyNetworks: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="213|1330|2007|2552">全部平台</SelectItem>
                      <SelectItem value="213">奈飞 (Netflix)</SelectItem>
                      <SelectItem value="1330">爱奇艺 (iQiyi)</SelectItem>
                      <SelectItem value="2007">腾讯视频 (Tencent)</SelectItem>
                      <SelectItem value="2552">Apple TV+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
            />
            <SettingsItem
              title="TMDB 图片质量"
              description="海报和背景图的加载质量，高质量消耗更多流量。"
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

      {/* ── 网盘搜索 ── */}
      <SettingsSection
        title="网盘搜索"
        description="配置 Panhub 网盘搜索服务地址、插件与并发策略。"
        icon={<Search className="size-4" />}
        tone="cyan"
      >
        <SettingsItem
          title="API 地址"
          description="默认 /api/panhub 走本地内置服务"
          control={
            <Input className="w-full sm:w-[360px]" value={panhub.apiBase}
              placeholder="/api/panhub"
              onChange={e => panhub.setConfig({ apiBase: e.target.value.trim() })} />
          }
        />
        <SettingsItem
          title="并发数"
          description="同时发起的搜索请求数，范围 1-16"
          control={
            <Input type="number" min={1} max={16} className="w-24" value={panhub.concurrency}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) panhub.setConfig({ concurrency: v }) }} />
          }
        />
        <SettingsItem
          title="插件超时 (ms)"
          description="单个搜索插件的最大等待时间，范围 1000-60000ms"
          control={
            <Input type="number" min={1000} max={60000} step={500} className="w-28" value={panhub.pluginTimeoutMs}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) panhub.setConfig({ pluginTimeoutMs: v }) }} />
          }
        />
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">已选 {panhub.enabledPlugins.length}/{ALL_PLUGIN_NAMES.length}</span>
            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs"
              onClick={() => panhub.setConfig({
                enabledPlugins: panhub.enabledPlugins.length === ALL_PLUGIN_NAMES.length ? [] : [...ALL_PLUGIN_NAMES],
              })}>
              {panhub.enabledPlugins.length === ALL_PLUGIN_NAMES.length ? '全不选' : '全选'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_PLUGIN_NAMES.map(name => (
              <label key={name} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-muted/35 px-3 py-2 text-sm transition-colors hover:border-border">
                <Checkbox checked={panhub.enabledPlugins.includes(name)}
                  onCheckedChange={c => panhub.setConfig({
                    enabledPlugins: c ? [...panhub.enabledPlugins, name] : panhub.enabledPlugins.filter(p => p !== name),
                  })} />
                <span className="truncate">{name}</span>
              </label>
            ))}
          </div>
        </div>
      </SettingsSection>
    </SettingsPageShell>
  )
}
