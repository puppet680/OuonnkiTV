import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router'
import { FeaturedCarousel } from '@/features/home/components/FeaturedCarousel'
import { MediaCarousel } from '@/shared/components/media'
import { StatePanel } from '@/shared/components/StatePanel'
import { useSettingStore } from '@/shared/store/settingStore'
import { useTmdbEnabled } from '@/shared/hooks/useTmdbMode'
import { useBangumi } from '../hooks/useBangumi'

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/**
 * BangumiView - 番剧首页
 * 展示新番周更表、番剧、剧场版及巨幕推荐
 */
export default function BangumiView() {
  const navigate = useNavigate()
  const tmdbEnabled = useTmdbEnabled()
  const { newAnime, series, movies, featured, loading, error } = useBangumi()
  const reducedMotion = useReducedMotion()
  const [scheduleDay, setScheduleDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)

  // 临时关闭 TMDB 时返回到首页
  useEffect(() => {
    if (!tmdbEnabled) navigate('/', { replace: true })
  }, [tmdbEnabled, navigate])

  const dayItems = newAnime.filter(item => {
    if (!item.releaseDate) return false
    const d = new Date(item.releaseDate)
    const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1
    return dayIndex === scheduleDay
  })

  if (error && !loading && !featured.length && !newAnime.length) {
    return (
      <StatePanel
        mode="error"
        title="番剧数据暂时不可用"
        description="TMDB 服务暂时不可用，可前往设置页检查代理地址是否正确。"
        tag="数据加载失败"
        primaryAction={{ label: '前往设置', to: '/settings/source', variant: 'outline' }}
        secondaryAction={{ label: '临时关闭 TMDB 智能模式', onClick: () => useSettingStore.getState().setTmdbDisableOnce(true) }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <FeaturedCarousel items={featured} loading={loading} />
      {/* 周更表 */}
      <section>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h2 className="text-lg font-semibold shrink-0">周更表</h2>
          <div className="relative flex gap-1 bg-muted/40 rounded-lg p-1 overflow-x-auto scrollbar-hide">
            {WEEKDAYS.map((day, i) => {
              const active = scheduleDay === i
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setScheduleDay(i)}
                  className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {active && (
                    reducedMotion ? (
                      <div className="bg-background shadow-sm absolute inset-0 rounded-md" />
                    ) : (
                      <motion.div
                        layoutId="bangumi-tab-indicator"
                        className="bg-background shadow-sm absolute inset-0 rounded-md"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )
                  )}
                  <span className="relative z-10">{day}</span>
                </button>
              )
            })}
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={scheduleDay}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
          >
            <MediaCarousel title="" items={dayItems} loading={loading} />
          </motion.div>
        </AnimatePresence>
      </section>
      <MediaCarousel title="新番" items={newAnime} loading={loading} />
      <MediaCarousel title="番剧" items={series} loading={loading} />
      <MediaCarousel title="剧场" items={movies} loading={loading} />
    </div>
  )
}
