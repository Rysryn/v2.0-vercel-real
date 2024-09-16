import { createServer } from 'http'
import { parse } from 'url'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'

const handler = async (req, res) => {
  const parsedUrl = parse(req.url, true)
  const { pathname, query } = parsedUrl

  // Serve static files
  if (req.method === 'GET' && !pathname.startsWith('/api')) {
    const filePath = join(process.cwd(), 'public', pathname === '/' ? 'index.html' : pathname)
    try {
      const content = await readFile(filePath)
      const contentType = getContentType(filePath)
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content)
    } catch (err) {
      res.writeHead(404)
      res.end('File not found')
    }
    return
  }

  // API routes
  if (pathname === '/api/wallpapers' && req.method === 'GET') {
    try {
      const data = await readFile('wallpapers.json', 'utf8')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(data)
    } catch (error) {
      res.writeHead(500)
      res.end('Error reading wallpapers')
    }
  } else if (pathname === '/api/save-wallpapers' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })
    req.on('end', async () => {
      try {
        await writeFile('wallpapers.json', body)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'Wallpapers saved successfully' }))
      } catch (error) {
        res.writeHead(500)
        res.end('Error saving wallpapers')
      }
    })
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
}

const getContentType = (filePath) => {
  const ext = filePath.split('.').pop().toLowerCase()
  const types = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml'
  }
  return types[ext] || 'application/octet-stream'
}

export default createServer(handler)