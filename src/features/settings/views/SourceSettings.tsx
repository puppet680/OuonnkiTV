import { useSettingStore } from '@/shared/store/settingStore'
import VideoSource from '../components/VideoSource'
import SubscriptionManager from '../components/VideoSource/SubscriptionManager'
import { usePanhubStore } from '@/shared/store/panhubStore'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { SettingsPageShell, SettingsSection, SettingsItem } from '../components/common'
import { Database, ExternalLink, Link2, Image } from 'lucide-react'
import type { DoubanProxyType } from '@/shared/store/panhubStore'

const DOUBAN_PROXY_OPTIONS: Array<{ value: DoubanProxyType; label: string; thanks?: { text: string; url: string } }> = [
  { value: 'direct', label: '直连（服务器直接请求豆瓣）' },
  { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei', thanks: { text: 'Thanks to @Zwei', url: 'https://github.com/bestzwei' } },
  { value: 'cmliussss-cdn-tencent', label: '豆瓣 CDN By CMLiussss（腾讯云）', thanks: { text: 'Thanks to @CMLiussss', url: 'https://github.com/cmliu' } },
  { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）', thanks: { text: 'Thanks to @CMLiussss', url: 'https://github.com/cmliu' } },
  { value: 'cmliussss-unified', label: '豆瓣 CDN By CMLiussss（统一域名）', thanks: { text: 'Thanks to @CMLiussss', url: 'https://github.com/cmliu' } },
  { value: 'custom', label: '自定义代理' },
]

/**
 * SourceSettings - 数据源管理设置页
 */
export default function SourceSettings() {
  const { system, setSystemSettings } = useSettingStore()
  const panhub = usePanhubStore()
  const tmdbApiBaseUrlPlaceholder = import.meta.env.OKI_TMDB_API_BASE_URL || 'https://api.themoviedb.org/3'
  const tmdbImageBaseUrlPlaceholder =
    import.meta.env.OKI_TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p/'

  return (
    <SettingsPageShell
      title="数据源管理"
      description="管理视频源与订阅源，支持导入、导出、订阅远程列表与参数编辑。"
      showHeader={false}
    >
      <SubscriptionManager />
      <VideoSource />

      <SettingsSection
        title="TMDB 数据代理"
        description="配置 TMDB API 与图片服务的基础地址"
        icon={<Link2 className="size-4" />}
        tone="sky"
      >
        <SettingsItem
          title="API Base URL"
          description="支持绝对地址或相对路径，留空后自动回退到环境变量或官方默认地址。"
          control={
            <div className="relative w-full sm:w-[340px]">
              <Link2 className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input type="text" className="pl-9" value={system.tmdbApiBaseUrl}
                placeholder={tmdbApiBaseUrlPlaceholder}
                onChange={e => setSystemSettings({ tmdbApiBaseUrl: e.target.value })} />
            </div>
          }
        />
        <SettingsItem
          title="图片 Base URL"
          description="支持绝对地址或相对路径，留空后自动回退到环境变量或官方默认地址。"
          control={
            <div className="relative w-full sm:w-[340px]">
              <Image className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input type="text" className="pl-9" value={system.tmdbImageBaseUrl}
                placeholder={tmdbImageBaseUrlPlaceholder}
                onChange={e => setSystemSettings({ tmdbImageBaseUrl: e.target.value })} />
            </div>
          }
        />
      </SettingsSection>

      <SettingsSection
        title="豆瓣数据代理"
        description="配置获取豆瓣评论数据的代理方式"
        icon={<Database className="size-4" />}
        tone="cyan"
      >
        <SettingsItem
          title="数据源"
          description="选择获取豆瓣数据的方式"
          control={
            <Select value={panhub.doubanProxyType}
              onValueChange={v => panhub.setConfig({ doubanProxyType: v as DoubanProxyType })}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOUBAN_PROXY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        {(() => {
          const opt = DOUBAN_PROXY_OPTIONS.find(o => o.value === panhub.doubanProxyType)
          if (opt?.thanks) {
            return (
              <div className="mt-2 text-center">
                <a href={opt.thanks.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  {opt.thanks.text} <ExternalLink className="size-3" />
                </a>
              </div>
            )
          }
          return null
        })()}
        {panhub.doubanProxyType === 'custom' && (
          <SettingsItem title="代理地址" description="自定义 CORS 代理 URL，{url} 会被替换为编码后的豆瓣 URL"
            control={
              <Input className="w-full font-mono text-xs" value={panhub.doubanProxyUrl}
                placeholder="https://your-proxy.com/"
                onChange={e => panhub.setConfig({ doubanProxyUrl: e.target.value.trim() })} />
            }
          />
        )}
        <SettingsItem title="Cookie（可选）" description="豆瓣登录态 Cookie，优先级高于反爬虫"
          control={
            <Input className="w-full font-mono text-xs" value={panhub.doubanCookie}
              placeholder="dbcl2=...; ck=...; ..."
              onChange={e => panhub.setConfig({ doubanCookie: e.target.value.trim() })} />
          }
        />
      </SettingsSection>
    </SettingsPageShell>
  )
}
