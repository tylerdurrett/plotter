import type { Plugin, Connect } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import type http from 'node:http'

const API_PREFIX = '/__api/presets/'
const MAX_BODY_BYTES = 1_048_576 // 1 MB
const MAX_NAME_LENGTH = 100

/**
 * Alphanumeric start, then alphanumeric / hyphens / underscores.
 * Prevents path traversal by forbidding dots, slashes, and backslashes.
 */
const SAFE_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/

/** Validate a sketch or preset name for safe filesystem use. */
export function isValidName(name: string): boolean {
  return (
    name.length > 0 && name.length <= MAX_NAME_LENGTH && SAFE_NAME_RE.test(name)
  )
}

function sendJSON(
  res: http.ServerResponse,
  status: number,
  data: unknown,
): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function sendError(
  res: http.ServerResponse,
  status: number,
  message: string,
): void {
  sendJSON(res, status, { error: message })
}

function sendNoContent(res: http.ServerResponse): void {
  res.writeHead(204)
  res.end()
}

/** Read the request body as a string, with a size limit to prevent abuse. */
function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

function presetsDir(root: string, sketch: string): string {
  return path.join(root, 'sketches', sketch, 'presets')
}

function presetFile(root: string, sketch: string, name: string): string {
  return path.join(root, 'sketches', sketch, 'presets', `${name}.json`)
}

/** List preset names for a sketch. Returns [] if directory doesn't exist. */
async function handleList(
  root: string,
  sketch: string,
  res: http.ServerResponse,
): Promise<void> {
  const dir = presetsDir(root, sketch)
  try {
    const entries = await fs.readdir(dir)
    const names = entries
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .sort()
    sendJSON(res, 200, names)
  } catch (err: unknown) {
    // Directory doesn't exist yet — return empty list
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      sendJSON(res, 200, [])
    } else {
      throw err
    }
  }
}

/** Read a single preset file. */
async function handleRead(
  root: string,
  sketch: string,
  name: string,
  res: http.ServerResponse,
): Promise<void> {
  const filePath = presetFile(root, sketch, name)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    // Return raw file content (already JSON)
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(content),
    })
    res.end(content)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      sendError(res, 404, `Preset "${name}" not found`)
    } else {
      throw err
    }
  }
}

/** Write a preset file, creating the presets/ directory if needed. */
async function handleWrite(
  root: string,
  sketch: string,
  name: string,
  req: Connect.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  let body: string
  try {
    body = await readBody(req)
  } catch {
    sendError(res, 413, 'Request body too large')
    return
  }

  // Validate JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    sendError(res, 400, 'Invalid JSON body')
    return
  }

  const dir = presetsDir(root, sketch)
  await fs.mkdir(dir, { recursive: true })
  // Re-serialize for consistent formatting
  await fs.writeFile(
    presetFile(root, sketch, name),
    JSON.stringify(parsed, null, 2) + '\n',
    'utf-8',
  )
  sendNoContent(res)
}

/** Delete a preset file. */
async function handleDelete(
  root: string,
  sketch: string,
  name: string,
  res: http.ServerResponse,
): Promise<void> {
  try {
    await fs.unlink(presetFile(root, sketch, name))
    sendNoContent(res)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      sendError(res, 404, `Preset "${name}" not found`)
    } else {
      throw err
    }
  }
}

/**
 * Main request handler for the preset API. Exported for testing.
 * Routes: GET/POST/DELETE on /__api/presets/:sketch(/:name)
 */
export async function handlePresetRequest(
  root: string,
  req: Connect.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const url = (req.url ?? '').split('?')[0] // strip query string
  const segments = url.slice(API_PREFIX.length).split('/').filter(Boolean)
  const method = req.method ?? 'GET'

  // Must have 1 segment (sketch) or 2 segments (sketch + preset name)
  if (segments.length < 1 || segments.length > 2) {
    sendError(res, 404, 'Not found')
    return
  }

  const sketch = segments[0]
  if (!isValidName(sketch)) {
    sendError(res, 400, 'Invalid sketch name')
    return
  }

  // Single segment: list presets
  if (segments.length === 1) {
    if (method !== 'GET') {
      sendError(res, 405, 'Method not allowed')
      return
    }
    return handleList(root, sketch, res)
  }

  // Two segments: operate on a specific preset
  const presetName = segments[1]
  if (!isValidName(presetName)) {
    sendError(res, 400, 'Invalid preset name')
    return
  }

  switch (method) {
    case 'GET':
      return handleRead(root, sketch, presetName, res)
    case 'POST':
      return handleWrite(root, sketch, presetName, req, res)
    case 'DELETE':
      return handleDelete(root, sketch, presetName, res)
    default:
      sendError(res, 405, 'Method not allowed')
  }
}

/**
 * Vite plugin that exposes a dev-server REST API for preset CRUD.
 * Dev-only — presets are stored as JSON files alongside sketch code
 * at sketches/{name}/presets/{presetName}.json.
 */
export function presetsPlugin(): Plugin {
  return {
    name: 'preset-api',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root

      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith(API_PREFIX)) return next()

        handlePresetRequest(root, req, res).catch((err) => {
          console.error('[preset-api]', err)
          if (!res.headersSent) {
            sendError(res, 500, 'Internal server error')
          }
        })
      })
    },
  }
}
