const fs = require('fs')
const http = require('http')
const path = require('path')
const zlib = require('zlib')

const PORT = Number(process.env.PORT || 8081)
const API_TARGET = process.env.API_TARGET || 'http://127.0.0.1:8080'
const DIST_DIR = path.join(__dirname, 'dist')

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
}

const compressible = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt'])
const compressedCache = new Map()

function send(res, status, headers, body) {
  res.writeHead(status, headers)
  res.end(body)
}

function safePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0])
  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  return path.join(DIST_DIR, normalized)
}

function serveStatic(req, res) {
  let filePath = safePath(req.url)

  if (!filePath.startsWith(DIST_DIR)) {
    send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden')
    return
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  const ext = path.extname(filePath)
  const headers = {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*'
  }

  if (filePath.endsWith('index.html')) {
    headers['Cache-Control'] = 'no-cache'
  } else {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable'
  }

  const accepts = req.headers['accept-encoding'] || ''
  const shouldCompress = compressible.has(ext)

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Internal Server Error')
      return
    }

    if (req.method === 'HEAD') {
      send(res, 200, headers, '')
      return
    }

    if (shouldCompress && accepts.includes('br')) {
      const cacheKey = `${filePath}:br`
      const cached = compressedCache.get(cacheKey)
      if (cached) {
        send(res, 200, { ...headers, 'Content-Encoding': 'br', 'Content-Length': cached.length, Vary: 'Accept-Encoding' }, cached)
        return
      }

      zlib.brotliCompress(data, (zipErr, compressed) => {
        if (zipErr) {
          send(res, 200, headers, data)
          return
        }
        compressedCache.set(cacheKey, compressed)
        send(res, 200, { ...headers, 'Content-Encoding': 'br', 'Content-Length': compressed.length, Vary: 'Accept-Encoding' }, compressed)
      })
      return
    }

    if (shouldCompress && accepts.includes('gzip')) {
      const cacheKey = `${filePath}:gzip`
      const cached = compressedCache.get(cacheKey)
      if (cached) {
        send(res, 200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': cached.length, Vary: 'Accept-Encoding' }, cached)
        return
      }

      zlib.gzip(data, (zipErr, compressed) => {
        if (zipErr) {
          send(res, 200, headers, data)
          return
        }
        compressedCache.set(cacheKey, compressed)
        send(res, 200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': compressed.length, Vary: 'Accept-Encoding' }, compressed)
      })
      return
    }

    send(res, 200, { ...headers, 'Content-Length': data.length }, data)
  })
}

function proxyApi(req, res) {
  const target = new URL(req.url, API_TARGET)
  const proxyReq = http.request(target, {
    method: req.method,
    headers: {
      ...req.headers,
      host: target.host
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', () => {
    send(res, 502, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({
      success: false,
      message: 'API proxy failed'
    }))
  })

  req.pipe(proxyReq)
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    proxyApi(req, res)
    return
  }

  serveStatic(req, res)
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Mistake Notebook frontend listening on 0.0.0.0:${PORT}`)
  console.log(`Proxying /api/* to ${API_TARGET}`)
})
