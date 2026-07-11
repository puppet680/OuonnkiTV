import { SettingsPageShell, SettingsSection, SettingsItem } from '../components/common'
import { Textarea } from '@/shared/components/ui/textarea'
import { Button } from '@/shared/components/ui/button'
import { Code2, RotateCcw } from 'lucide-react'
import { useCustomAdFilter } from '@/features/player/lib/custom-ad-filter'
import { toast } from 'sonner'

const EXAMPLE_CODE = `function filterAdsFromM3U8(type, m3u8Content) {
  if (!m3u8Content) return '';

  const adKeywords = [
    'sponsor', '/ad/', '/ads/',
    'advert', 'advertisement', '/adjump', 'redtraffic'
  ];

  const lines = m3u8Content.split('\\n');
  const filtered = [];
  let inAdBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // SCTE-35 广告标记
    if (line.includes('#EXT-X-CUE-OUT') ||
        line.includes('#EXT-X-SCTE35') ||
        line.includes('#EXT-OATCLS-SCTE35') ||
        (line.includes('#EXT-X-DATERANGE') && line.includes('SCTE35'))) {
      inAdBlock = true; continue;
    }
    if (line.includes('#EXT-X-CUE-IN')) { inAdBlock = false; continue; }
    if (inAdBlock) continue;

    // 跳过不连续标记
    if (line.includes('#EXT-X-DISCONTINUITY')) continue;

    // 关键字过滤
    if (line.includes('#EXTINF:') && i + 1 < lines.length) {
      const url = lines[i + 1];
      if (adKeywords.some(k => url.toLowerCase().includes(k))) { i++; continue; }
    }

    filtered.push(line);
  }

  return filtered.join('\\n');
}`

export default function AdFilterSettings() {
  const { code, compileError, updateCode } = useCustomAdFilter()

  return (
    <SettingsPageShell
      title="自定义去广告"
      description="编写 JavaScript 过滤器精准拦截广告片段。函数名必须为 filterAdsFromM3U8(type, content)，错误时自动降级为默认规则。"
      showHeader={false}
    >
      <SettingsSection
        title="过滤脚本"
        description="脚本在浏览器沙箱中执行，type 为当前播放源标识符，可针对不同源写不同逻辑。"
        icon={<Code2 className="size-4" />}
        tone="emerald"
      >
        <SettingsItem
          title=""
          description=""
          className="!flex-col items-start"
          controlClassName="w-full"
          control={
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { updateCode(EXAMPLE_CODE); toast.success('已载入示例，可在此基础上修改') }}
                >
                  <Code2 className="size-3.5" />
                  载入示例
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { updateCode(''); toast.success('已清空，将仅使用默认规则') }}
                >
                  <RotateCcw className="size-3.5" />
                  清空
                </Button>
              </div>
              <Textarea
                className="min-h-[400px] font-mono text-xs"
                placeholder={`function filterAdsFromM3U8(type, m3u8Content) {\n  // type: 当前播放源标识\n  // 返回过滤后的 m3u8 内容\n  return m3u8Content;\n}`}
                value={code}
                onChange={e => updateCode(e.target.value)}
                spellCheck={false}
              />
              {compileError && (
                <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{compileError}</p>
              )}
              {code.trim() && !compileError && (
                <p className="text-muted-foreground text-xs">✓ 脚本已启用，将在播放时自动注入 m3u8 处理管线。</p>
              )}
              {!code.trim() && (
                <p className="text-muted-foreground text-xs">未启用自定义脚本，仅使用内置默认去广告规则。</p>
              )}
            </div>
          }
        />
      </SettingsSection>
    </SettingsPageShell>
  )
}
