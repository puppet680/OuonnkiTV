import express from 'express'
import cors from 'cors'
import https from 'https'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { getProxyTimeoutMs, parseProxyError, handleProxyRequest } from './shared/proxy-core.js'

const app = express()
const PORT = process.env.PROXY_PORT || 3001
const SYSTEM_PROXY =
  process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy || null

app.use(cors({ origin: '*' }))

function proxyFetchWithAgent(targetUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl)
    const agent = new HttpsProxyAgent(SYSTEM_PROXY)
    const timeoutMs = getProxyTimeoutMs()
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
      agent,
      rejectUnauthorized: false,
      timeout: timeoutMs,
    }, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 502,
          headers: {
            get: (k) => res.headers[k.toLowerCase()],
          },
          text: () => Promise.resolve(data),
        })
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Proxy timeout')) })
  })
}

app.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' })
    }

    const targetUrl = decodeURIComponent(url)
    const response = SYSTEM_PROXY
      ? await proxyFetchWithAgent(targetUrl)
      : await handleProxyRequest(targetUrl)

    const text = await response.text()
    const contentType = response.headers.get('content-type') || 'application/json'

    res.setHeader('Content-Type', contentType)
    res.status(response.status).send(text)
  } catch (error) {
    const { message, cause } = parseProxyError(error)
    res.status(500).json({
      error: 'Proxy request failed',
      message,
      cause,
      timeoutMs: getProxyTimeoutMs(),
    })
  }
})

app.listen(PORT, () => console.log(`Proxy server on :${PORT}`))
