import { createApp, createRouter, defineEventHandler, getQuery, sendError, createError, toNodeListener } from 'h3'
import { getOrCreateSearchService } from './core/services'
import channelsConfig from './config/channels.json'
import type { GenericResponse, SearchRequest } from './core/types/models'

function parseList(val: string | undefined): string[] | undefined {
  if (!val) return undefined
  const parts = val.split(',').map(s => s.trim()).filter(Boolean)
  return parts.length ? parts : undefined
}

function getClientAbortSignal(event: any): AbortSignal | undefined {
  const nodeEvent = event as { node?: { req?: any } }
  const req = nodeEvent.node?.req
  if (req && typeof req.on === 'function') {
    const controller = new AbortController()
    req.on('close', () => {
      if (req.destroyed || (req.writableEnded === false && req.readableEnded)) {
        controller.abort()
      }
    })
    return controller.signal
  }
  return undefined
}

const runtimeConfig = {
  priorityChannels: channelsConfig.priorityChannels,
  defaultChannels: channelsConfig.defaultChannels,
  defaultConcurrency: channelsConfig.defaultConcurrency,
  pluginTimeoutMs: channelsConfig.pluginTimeoutMs,
  cacheEnabled: true,
  cacheTtlMinutes: channelsConfig.cacheTtlMinutes,
}

const searchHandler = defineEventHandler(async (event) => {
  const service = getOrCreateSearchService(runtimeConfig)
  const q = getQuery(event)

  const kw = ((q.kw as string) || '').trim()
  if (!kw) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'kw is required' }))
  }
  if (kw.length > 200) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'kw too long (max 200)' }))
  }

  let ext: Record<string, any> | undefined
  const extStr = (q.ext as string | undefined)?.trim()
  if (extStr) {
    if (extStr === '{}') ext = {}
    else {
      try { ext = JSON.parse(extStr) }
      catch {
        return sendError(event, createError({ statusCode: 400, statusMessage: 'invalid ext json' }))
      }
    }
  }

  const req: SearchRequest = {
    kw,
    channels: parseList(q.channels as string | undefined),
    conc: (() => {
      const n = q.conc ? parseInt(String(q.conc), 10) : NaN
      return Number.isFinite(n) && n >= 1 && n <= 16 ? n : undefined
    })(),
    refresh: String(q.refresh).trim() === 'true',
    res: (q.res as any) || 'merged_by_type',
    src: (q.src as any) || 'all',
    plugins: parseList(q.plugins as string | undefined),
    cloud_types: parseList(q.cloud_types as string | undefined),
    ext,
  }

  if (req.src === 'tg') req.plugins = undefined
  else if (req.src === 'plugin') req.channels = undefined
  if (!req.res || req.res === 'merge') req.res = 'merged_by_type'

  const signal = getClientAbortSignal(event)

  const { response: result, warnings } = await service.searchWithWarnings(
    req.kw, req.channels, req.conc, !!req.refresh,
    req.res, req.src, req.plugins, req.cloud_types, req.ext || {}, signal,
  )

  const resp: GenericResponse<typeof result> = {
    code: 0,
    message: warnings.length > 0 ? 'partial_success' : 'success',
    data: result,
  }
  if (warnings.length > 0) {
    (resp as any).warnings = warnings
  }
  return resp
})

const healthHandler = defineEventHandler(() => ({
  status: 'ok',
  timestamp: Date.now(),
}))

const router = createRouter()
router.get('/search', searchHandler)
router.get('/health', healthHandler)

export const panhubApp = createApp()
panhubApp.use(router)

export function createPanhubListener() {
  return toNodeListener(panhubApp)
}
