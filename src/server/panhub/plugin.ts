import type { Plugin, ViteDevServer } from 'vite'
import { createPanhubListener } from './api'
import { createDoubanListener } from '../douban'

const API_PREFIXES: Record<string, () => ReturnType<typeof createPanhubListener>> = {
  '/api/panhub': createPanhubListener,
  '/api/douban': createDoubanListener,
}

function serverApiPlugin(): Plugin {
  return {
    name: 'server-api',
    configureServer(server: ViteDevServer) {
      const listeners: Record<string, ReturnType<typeof createPanhubListener>> = {}

      for (const [prefix, factory] of Object.entries(API_PREFIXES)) {
        listeners[prefix] = factory()
      }

      // CORS proxy: must be registered BEFORE the generic /api/panhub handler
      server.middlewares.use('/api/panhub/proxy', async (req, res) => {
        const url = new URL(req.url!, 'http://localhost')
        const target = url.searchParams.get('target')
        if (!target) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ code: -1, message: 'missing target param' }))
          return
        }

        const proxyParams = new URLSearchParams()
        for (const [k, v] of url.searchParams.entries()) {
          if (k !== 'target') proxyParams.set(k, v)
        }
        const proxyQs = proxyParams.toString()
        const proxyUrl = target + (proxyQs ? '?' + proxyQs : '')

        try {
          const resp = await fetch(proxyUrl, {
            method: req.method || 'GET',
            headers: { 'User-Agent': 'Panhub-Proxy/1.0' },
          })
          res.statusCode = resp.status
          resp.headers.forEach((v, k) => {
            if (!['content-encoding', 'transfer-encoding'].includes(k.toLowerCase())) {
              res.setHeader(k, v)
            }
          })
          res.setHeader('Access-Control-Allow-Origin', '*')
          const body = await resp.arrayBuffer()
          res.end(Buffer.from(body))
        } catch {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ code: -1, message: 'proxy error' }))
        }
      })

      // built-in API routes
      server.middlewares.use(async (req, res, next) => {
        const matched = Object.keys(listeners).find(p => req.url?.startsWith(p))
        if (!matched) return next()

        const listener = listeners[matched]
        const originalUrl = req.url
        req.url = req.url!.slice(matched.length) || '/'

        try {
          await new Promise<void>((resolve, reject) => {
            const onFinish = () => {
              cleanup()
              resolve()
            }
            const onError = (err: Error) => {
              cleanup()
              reject(err)
            }
            const cleanup = () => {
              res.removeListener('finish', onFinish)
              res.removeListener('error', onError)
            }
            res.on('finish', onFinish)
            res.on('error', onError)
            listener(req, res)
          })
        } catch {
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ code: -1, message: 'internal server error' }))
          }
        } finally {
          req.url = originalUrl
        }
      })
    },
  }
}

export default serverApiPlugin
