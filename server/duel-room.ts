import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  applyMessage,
  emptyMatch,
  readMatch,
  readOverall,
  viewFor,
  type ClientMessage,
  type DuelMatch,
  type Seat,
} from '../src/study/duel.ts'

type FamilySocket = WebSocket & { seat: Seat | null }

const CONTENT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

export function startDuelServer(options: {
  port: number
  scoresPath: string
  distPath?: string
  host?: string
}) {
  mkdirSync(path.dirname(options.scoresPath), { recursive: true })
  const matchPath = path.join(path.dirname(options.scoresPath), 'match.json')
  const overall = loadOverall(options.scoresPath)
  let match: DuelMatch = existsSync(matchPath) ? readMatch(readFileSync(matchPath, 'utf8'), overall) : emptyMatch(overall)

  const httpServer = createServer((request, response) => {
    if (options.distPath) serveApp(options.distPath, request, response)
    else {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end('family room')
    }
  })
  const sockets = new WebSocketServer({ server: httpServer })

  function persist() {
    writeFileSync(options.scoresPath, JSON.stringify(match.overall))
    writeFileSync(matchPath, JSON.stringify(match))
  }

  function broadcast() {
    for (const client of sockets.clients) {
      const seat = (client as FamilySocket).seat ?? null
      client.send(JSON.stringify({ type: 'state', view: viewFor(match, seat) }))
    }
  }

  sockets.on('connection', (client) => {
    const socket = client as FamilySocket
    socket.seat = null
    socket.send(JSON.stringify({ type: 'state', view: viewFor(match, null) }))

    socket.on('message', (data) => {
      const message = parseMessage(data.toString())
      if (!message) return
      const next = applyMessage(match, socket.seat, message)
      socket.seat = next.seat
      if (next.match === match && next.seat === socket.seat) return
      match = next.match
      persist()
      broadcast()
    })

    socket.on('close', () => {
      if (socket.seat === null) return
      const next = applyMessage(match, socket.seat, { type: 'leave' })
      socket.seat = null
      match = next.match
      persist()
      broadcast()
    })
  })

  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    httpServer.listen(options.port, options.host ?? '127.0.0.1', () => {
      const address = httpServer.address()
      const port = typeof address === 'object' && address ? address.port : options.port
      resolve({
        port,
        close: () =>
          new Promise((done) => {
            for (const client of sockets.clients) client.terminate()
            sockets.close()
            httpServer.close(() => done())
          }),
      })
    })
  })
}

function loadOverall(scoresPath: string) {
  if (!existsSync(scoresPath)) return readOverall('')
  return readOverall(readFileSync(scoresPath, 'utf8'))
}

function parseMessage(raw: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(raw) as ClientMessage
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

function serveApp(distPath: string, request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', 'http://family.local')
  const requested = path.normalize(decodeURIComponent(url.pathname))
  const relative = requested === '/' ? 'index.html' : requested.replace(/^[/\\]+/, '')
  const filePath = path.join(distPath, relative)
  if (!filePath.startsWith(distPath)) {
    response.writeHead(403)
    response.end()
    return
  }
  const target = existsSync(filePath) && !filePath.endsWith(path.sep) ? filePath : path.join(distPath, 'index.html')
  if (!existsSync(target)) {
    response.writeHead(404)
    response.end()
    return
  }
  response.writeHead(200, {
    'content-type': CONTENT[path.extname(target)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  createReadStream(target).pipe(response)
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const scoresPath = process.env.DUEL_SCORES_PATH ?? path.join(process.cwd(), 'data', 'scores.json')
  const distPath = process.env.DUEL_DIST
  const port = Number(process.env.DUEL_PORT ?? 8787)
  void startDuelServer({ port, scoresPath, distPath, host: '0.0.0.0' }).then((server) => {
    console.log(`family room on ${server.port}`)
  })
}
