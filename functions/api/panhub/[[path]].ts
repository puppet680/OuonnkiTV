// Cloudflare Pages Function: /api/panhub/*
// Proxies requests to the production panhub server

const PANHUB_BASE = 'https://panhub.shenzjd.com/api'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
}

export const onRequest = async (context: { request: Request; env: unknown }) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS })
  }

  const url = new URL(context.request.url)
  const path = url.pathname.replace('/api/panhub', '')
  const target = `${PANHUB_BASE}${path}${url.search}`

  try {
    const resp = await fetch(target, {
      headers: { 'User-Agent': 'Panhub-Proxy/1.0' },
      signal: AbortSignal.timeout(30000),
    })
    return new Response(resp.body, {
      status: resp.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ code: -1, message: 'proxy error' }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
}
