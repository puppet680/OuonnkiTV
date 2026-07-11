import { Search, RotateCcw, ExternalLink } from 'lucide-react'
import { usePanhubStore } from '@/shared/store/panhubStore'
import type { DoubanProxyType } from '@/shared/store/panhubStore'
import { ALL_PLUGIN_NAMES } from '@/shared/types/panhub'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { SettingsPageShell, SettingsSection, SettingsItem } from '../components/common'
import { toast } from 'sonner'

const DOUBAN_PROXY_OPTIONS: Array<{ value: DoubanProxyType; label: string; thanks?: { text: string; url: string } }> = [
  { value: 'direct', label: '直连（服务器直接请求豆瓣）' },
  { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei', thanks: { text: 'Thanks to @Zwei', url: 'https://github.com/bestzwei' } },
  { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）', thanks: { text: 'Thanks to @CMLiussss', url: 'https://github.com/cmliu' } },
  { value: 'custom', label: '自定义代理' },
]

export default function PanhubSettings() {
  const { apiBase, enabledPlugins, concurrency, pluginTimeoutMs, doubanCookie, doubanProxyType, doubanProxyUrl, setConfig, resetConfig } =
    usePanhubStore()

  const allSelected = enabledPlugins.length === ALL_PLUGIN_NAMES.length

  const handleReset = () => {
    resetConfig()
    toast.success('已恢复默认设置')
  }

  return (
    <SettingsPageShell
      title="网盘搜索"
      description="配置 Panhub 网盘资源搜索源，选择启用的插件与并发策略。"
      showHeader={false}
    >
      <SettingsSection
        title="服务地址"
        description="Panhub 搜索服务的 API 地址，支持自部署实例。"
        icon={<Search className="size-4" />}
        tone="cyan"
      >
        <SettingsItem
          title="API 地址"
          description="默认 /api/panhub 走本地内置服务"
          control={
            <Input
              className="w-full sm:w-[360px]"
              value={apiBase}
              placeholder="/api/panhub"
              onChange={e => setConfig({ apiBase: e.target.value.trim() })}
            />
          }
        />
      </SettingsSection>

      <SettingsSection
        title="搜索插件"
        description="勾选要启用的搜索来源，插件越多结果越全但耗时越长。"
        tone="cyan"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs text-muted-foreground">
            已选 {enabledPlugins.length}/{ALL_PLUGIN_NAMES.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() =>
              setConfig({
                enabledPlugins: allSelected ? [] : [...ALL_PLUGIN_NAMES],
              })
            }
          >
            {allSelected ? '全不选' : '全选'}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ALL_PLUGIN_NAMES.map(name => {
            const checked = enabledPlugins.includes(name)
            return (
              <label
                key={name}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-muted/35 px-3 py-2 text-sm transition-colors hover:border-border"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={c => {
                    if (c) {
                      setConfig({ enabledPlugins: [...enabledPlugins, name] })
                    } else {
                      setConfig({ enabledPlugins: enabledPlugins.filter(p => p !== name) })
                    }
                  }}
                />
                <span className="truncate">{name}</span>
              </label>
            )
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title="并发与超时"
        description="控制搜索请求的并发数和单个插件超时时间。"
        tone="cyan"
      >
        <SettingsItem
          title="并发数"
          description="同时发起的搜索请求数，范围 1-16"
          control={
            <Input
              type="number"
              min={1}
              max={16}
              className="w-24"
              value={concurrency}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v)) setConfig({ concurrency: v })
              }}
            />
          }
        />
        <SettingsItem
          title="插件超时 (ms)"
          description="单个搜索插件的最大等待时间，范围 1000-60000ms"
          control={
            <Input
              type="number"
              min={1000}
              max={60000}
              step={500}
              className="w-28"
              value={pluginTimeoutMs}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v)) setConfig({ pluginTimeoutMs: v })
              }}
            />
          }
        />
      </SettingsSection>

      <SettingsSection
        title="豆瓣数据代理"
        description="选择获取豆瓣数据的方式"
        tone="cyan"
      >
        <SettingsItem
          title="数据源"
          description="选择获取豆瓣数据的方式"
          control={
            <Select
              value={doubanProxyType}
              onValueChange={v => setConfig({ doubanProxyType: v as DoubanProxyType })}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOUBAN_PROXY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        {(() => {
          const opt = DOUBAN_PROXY_OPTIONS.find(o => o.value === doubanProxyType)
          if (opt?.thanks) {
            return (
              <div className="mt-2 text-center">
                <a
                  href={opt.thanks.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {opt.thanks.text} <ExternalLink className="size-3" />
                </a>
              </div>
            )
          }
          return null
        })()}
        {doubanProxyType === 'custom' && (
          <SettingsItem
            title="代理地址"
            description="自定义 CORS 代理 URL，{url} 会被替换为编码后的豆瓣 URL"
            control={
              <Input
                className="w-full font-mono text-xs"
                value={doubanProxyUrl}
                placeholder="https://your-proxy.com/"
                onChange={e => setConfig({ doubanProxyUrl: e.target.value.trim() })}
              />
            }
          />
        )}
        <SettingsItem
          title="Cookie（可选）"
          description="豆瓣登录态 Cookie，优先级高于反爬虫。从浏览器复制 dbcl2 等值。"
          control={
            <Input
              className="w-full font-mono text-xs"
              value={doubanCookie}
              placeholder="dbcl2=...; ck=...; ..."
              onChange={e => setConfig({ doubanCookie: e.target.value.trim() })}
            />
          }
        />
      </SettingsSection>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="mr-1.5 size-3.5" />
          恢复默认
        </Button>
      </div>
    </SettingsPageShell>
  )
}
