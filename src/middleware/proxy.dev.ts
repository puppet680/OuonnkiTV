import type { Plugin, Connect } from 'vite'
import type { ServerResponse } from 'node:http'
import {
  handleProxyRequest,
  getProxyTimeoutMs,
  getTargetUrl,
  parseProxyError,
} from '../shared/lib/proxy'

function getSystemProxyUrl(): string | null {
  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy || null
}

async function createProxyFetch() {
  const proxyUrl = getSystemProxyUrl()
  if (!proxyUrl) return null

  const { HttpsProxyAgent } = await import('https-proxy-agent')
  const mod = await import('https')

  return (targetUrl: string) => {
    return new Promise<{ status: number; headers: { get: (k: string) => string | undefined }; text: () => Promise<string> }>((resolve, reject) => {
      const u = new URL(targetUrl)
      const agent = new HttpsProxyAgent(proxyUrl)
      const req = mod.get({
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
        },
        agent,
        rejectUnauthorized: false,
        timeout: getProxyTimeoutMs(),
      }, res => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 502,
            headers: { get: (k: string) => (res.headers as Record<string, string | undefined>)[k.toLowerCase()] },
            text: () => Promise.resolve(data),
          })
        })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Proxy timeout')) })
    })
  }
}

export function proxyMiddleware(): Plugin {
  function createProxyHandler() {
    let proxyFetch: ((url: string) => Promise<{ status: number; headers: { get: (k: string) => string | undefined }; text: () => Promise<string> }>) | null = null
    let proxyFetchReady = false

    return async (
      req: Connect.IncomingMessage,
      res: ServerResponse,
      next: Connect.NextFunction,
    ) => {
      if (!req.url?.startsWith('/proxy')) {
        return next()
      }

      try {
        if (!proxyFetchReady) {
          proxyFetch = await createProxyFetch()
          proxyFetchReady = true
        }

        const targetUrl = getTargetUrl(req.url)
        const response = proxyFetch
          ? await proxyFetch(targetUrl)
          : await handleProxyRequest(targetUrl)

        const text = await response.text()
        const contentType = response.headers.get('content-type') || 'application/json'

        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', contentType)
        res.writeHead(response.status)
        res.end(text)
      } catch (error) {
        const { message, cause } = parseProxyError(error)
        const timeoutMs = getProxyTimeoutMs()
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Proxy request failed', message, cause, timeoutMs }))
      }
    }
  }

  return {
    name: 'proxy-middleware',
    configureServer(server) {
      server.middlewares.use(createProxyHandler())
    },
    configurePreviewServer(server) {
      server.middlewares.use(createProxyHandler())
    },
  }
}
