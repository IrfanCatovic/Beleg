const BACKEND_URL = process.env.BACKEND_URL

function buildTargetUrl(req) {
  if (!BACKEND_URL) {
    throw new Error('BACKEND_URL nije podešen')
  }

  const backend = new URL(BACKEND_URL)
  backend.pathname = req.url.split('?')[0]
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  backend.search = query
  return backend.toString()
}

function copyRequestHeaders(req) {
  const headers = { ...req.headers }
  delete headers.host
  delete headers['x-forwarded-host']
  delete headers['x-forwarded-proto']
  delete headers['content-length']
  return headers
}

function copyResponseHeaders(proxyResponse, res) {
  proxyResponse.headers.forEach((value, key) => {
    if (['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie'].includes(key.toLowerCase())) {
      return
    }
    res.setHeader(key, value)
  })

  const setCookies =
    typeof proxyResponse.headers.getSetCookie === 'function'
      ? proxyResponse.headers.getSetCookie()
      : proxyResponse.headers.get('set-cookie')
        ? [proxyResponse.headers.get('set-cookie')]
        : []

  if (setCookies.length > 0) {
    res.setHeader('Set-Cookie', setCookies)
  }
}

export default async function handler(req, res) {
  let targetUrl
  try {
    targetUrl = buildTargetUrl(req)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Proxy konfiguracija nije ispravna' })
    return
  }

  const proxyResponse = await fetch(targetUrl, {
    method: req.method,
    headers: copyRequestHeaders(req),
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
    redirect: 'manual',
    duplex: 'half',
  })

  copyResponseHeaders(proxyResponse, res)

  const body = Buffer.from(await proxyResponse.arrayBuffer())
  res.status(proxyResponse.status).send(body)
}
