import type { Plugin } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import type http from 'node:http'
import { parseManifest } from '../lib/maps'
import type { MapManifest } from '../lib/types'

const API_PATH = '/__api/maps'

export interface PreviewInfo {
  category: string
  name: string
  path: string
}

export interface MapBundleInfo {
  name: string
  manifest: MapManifest
  previewUrl: string
  availablePreviews: PreviewInfo[]
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

async function loadManifest(bundlePath: string): Promise<MapManifest | null> {
  const manifestPath = path.join(bundlePath, 'export', 'manifest.json')
  try {
    const content = await fs.readFile(manifestPath, 'utf-8')
    const json = JSON.parse(content)
    return parseManifest(json)
  } catch {
    return null
  }
}

async function discoverPreviews(bundlePath: string): Promise<PreviewInfo[]> {
  const previewsPath = path.join(bundlePath, 'export', 'previews')
  const previews: PreviewInfo[] = []

  try {
    const categories = await fs.readdir(previewsPath)

    for (const category of categories) {
      const categoryPath = path.join(previewsPath, category)
      const stats = await fs.stat(categoryPath)

      if (!stats.isDirectory()) continue

      const files = await fs.readdir(categoryPath)

      for (const file of files) {
        if (file.endsWith('.png') && !file.includes('contact_sheet')) {
          const name = file.replace('.png', '')
          previews.push({
            category,
            name,
            path: `${category}/${name}`
          })
        }
      }
    }

    return previews
  } catch {
    // If previews directory doesn't exist or has issues, return empty array
    return []
  }
}

export async function handleMapsRequest(
  root: string,
  res: http.ServerResponse,
): Promise<void> {
  const mapsDir = path.join(root, 'public', 'maps')
  const bundles: MapBundleInfo[] = []

  try {
    const entries = await fs.readdir(mapsDir)

    for (const name of entries) {
      const bundlePath = path.join(mapsDir, name)
      const stats = await fs.stat(bundlePath)

      if (!stats.isDirectory()) continue

      const manifest = await loadManifest(bundlePath)
      if (manifest) {
        const availablePreviews = await discoverPreviews(bundlePath)
        bundles.push({
          name,
          manifest,
          previewUrl: `/maps/${name}/export/previews/density/density_target.png`,
          availablePreviews
        })
      }
    }

    sendJSON(res, 200, bundles)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      sendJSON(res, 200, [])
    } else {
      throw err
    }
  }
}

export function mapsPlugin(): Plugin {
  return {
    name: 'maps-api',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root

      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (url !== API_PATH) return next()

        if (req.method !== 'GET') {
          sendError(res, 405, 'Method not allowed')
          return
        }

        handleMapsRequest(root, res).catch((err) => {
          console.error('[maps-api]', err)
          if (!res.headersSent) {
            sendError(res, 500, 'Internal server error')
          }
        })
      })
    },
  }
}