// Vercel Analytics 配置
export const analyticsConfig = {
  // Analytics 会自动在生产环境启用
  // 在开发环境中默认是禁用的
  debug: false, // 设置为 true 可以在控制台看到分析事件

  // Speed Insights 配置
  speedInsights: {
    // 采样率：0-1 之间的值，1 表示 100% 采样
    sampleRate: 1,
    // 是否在开发环境启用
    debug: false,
  },
}

// ponytail: track() 动态 import，避免 @vercel/analytics 阻塞首屏渲染
export const trackEvent = (
  eventName: string,
  properties?: Record<string, string | number | boolean | null>,
) => {
  if (import.meta.env.OKI_DISABLE_ANALYTICS !== 'true') {
    import('@vercel/analytics')
      .then(({ track }) => track(eventName, properties))
      .catch(() => {}) // 静默失败，分析不影响用户体验
  }
}
