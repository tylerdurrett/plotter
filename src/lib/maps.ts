import type { MapManifest, MapInfo, MapKey, MapFitMode } from '@/lib/types'

const VALID_MAP_KEYS = new Set<MapKey>([
  'density_target',
  'flow_x',
  'flow_y',
  'importance',
  'coherence',
  'complexity',
  'flow_speed',
])

function isMapKey(key: unknown): key is MapKey {
  return typeof key === 'string' && VALID_MAP_KEYS.has(key as MapKey)
}

function isMapInfo(obj: unknown): obj is MapInfo {
  if (!obj || typeof obj !== 'object') return false

  const m = obj as Record<string, unknown>

  if (typeof m.filename !== 'string') return false
  if (!isMapKey(m.key)) return false
  if (typeof m.dtype !== 'string') return false
  if (typeof m.description !== 'string') return false

  if (!Array.isArray(m.shape) || m.shape.length !== 2) return false
  if (typeof m.shape[0] !== 'number' || typeof m.shape[1] !== 'number') return false

  if (!Array.isArray(m.value_range) || m.value_range.length !== 2) return false
  if (typeof m.value_range[0] !== 'number' || typeof m.value_range[1] !== 'number') return false

  return true
}

export function parseManifest(json: unknown): MapManifest {
  if (!json || typeof json !== 'object') {
    throw new Error('Manifest must be an object')
  }

  const manifest = json as Record<string, unknown>

  if (typeof manifest.version !== 'number') {
    throw new Error(`Manifest version must be a number, got ${typeof manifest.version}`)
  }

  if (manifest.version !== 1) {
    throw new Error(`Unsupported manifest version ${manifest.version}, expected 1`)
  }

  if (typeof manifest.source_image !== 'string') {
    throw new Error(`Manifest source_image must be a string, got ${typeof manifest.source_image}`)
  }

  if (typeof manifest.width !== 'number' || manifest.width <= 0) {
    throw new Error(`Manifest width must be a positive number, got ${manifest.width}`)
  }

  if (typeof manifest.height !== 'number' || manifest.height <= 0) {
    throw new Error(`Manifest height must be a positive number, got ${manifest.height}`)
  }

  if (typeof manifest.created_at !== 'string') {
    throw new Error(`Manifest created_at must be a string, got ${typeof manifest.created_at}`)
  }

  if (!Array.isArray(manifest.maps)) {
    throw new Error(`Manifest maps must be an array, got ${typeof manifest.maps}`)
  }

  const maps: MapInfo[] = []
  for (let i = 0; i < manifest.maps.length; i++) {
    const mapEntry = manifest.maps[i]
    if (!isMapInfo(mapEntry)) {
      throw new Error(`Invalid map entry at index ${i}: missing or invalid fields`)
    }
    maps.push(mapEntry)
  }

  if (maps.length === 0) {
    throw new Error('Manifest must contain at least one map')
  }

  return {
    version: manifest.version as number,
    source_image: manifest.source_image as string,
    width: manifest.width as number,
    height: manifest.height as number,
    created_at: manifest.created_at as string,
    maps,
  }
}

export interface MapTransform {
  scale: number
  offsetX: number
  offsetY: number
}

export function computeMapTransform(
  mapWidth: number,
  mapHeight: number,
  drawWidth: number,
  drawHeight: number,
  mode: MapFitMode,
): MapTransform {
  if (mapWidth <= 0 || mapHeight <= 0) {
    throw new Error(`Invalid map dimensions: ${mapWidth}×${mapHeight}`)
  }
  if (drawWidth <= 0 || drawHeight <= 0) {
    throw new Error(`Invalid drawing dimensions: ${drawWidth}×${drawHeight}`)
  }

  const mapAspect = mapWidth / mapHeight
  const drawAspect = drawWidth / drawHeight

  let scale: number
  let offsetX: number
  let offsetY: number

  if (mode === 'fit') {
    if (mapAspect > drawAspect) {
      scale = drawWidth / mapWidth
      offsetX = 0
      offsetY = (drawHeight - mapHeight * scale) / 2
    } else {
      scale = drawHeight / mapHeight
      offsetX = (drawWidth - mapWidth * scale) / 2
      offsetY = 0
    }
  } else {
    if (mapAspect > drawAspect) {
      scale = drawHeight / mapHeight
      offsetX = (drawWidth - mapWidth * scale) / 2
      offsetY = 0
    } else {
      scale = drawWidth / mapWidth
      offsetX = 0
      offsetY = (drawHeight - mapHeight * scale) / 2
    }
  }

  return { scale, offsetX, offsetY }
}

export function sampleMap(
  data: Float32Array,
  width: number,
  height: number,
  px: number,
  py: number,
): number {
  // Clamp coordinates to valid range
  const x = Math.max(0, Math.min(width - 1, px))
  const y = Math.max(0, Math.min(height - 1, py))

  // Get integer parts (floor)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)

  // Handle exact right/bottom edge
  if (x0 === width - 1 && y0 === height - 1) {
    return data[y0 * width + x0]
  }
  if (x0 === width - 1) {
    // Right edge - only interpolate vertically
    const y1 = Math.min(y0 + 1, height - 1)
    const fy = y - y0
    const v0 = data[y0 * width + x0]
    const v1 = data[y1 * width + x0]
    return v0 * (1 - fy) + v1 * fy
  }
  if (y0 === height - 1) {
    // Bottom edge - only interpolate horizontally
    const x1 = Math.min(x0 + 1, width - 1)
    const fx = x - x0
    const v0 = data[y0 * width + x0]
    const v1 = data[y0 * width + x1]
    return v0 * (1 - fx) + v1 * fx
  }

  // Normal case - bilinear interpolation
  const x1 = x0 + 1
  const y1 = y0 + 1

  // Get fractional parts
  const fx = x - x0
  const fy = y - y0

  // Get the four corner values
  const v00 = data[y0 * width + x0]
  const v10 = data[y0 * width + x1]
  const v01 = data[y1 * width + x0]
  const v11 = data[y1 * width + x1]

  // Bilinear interpolation
  const v0 = v00 * (1 - fx) + v10 * fx
  const v1 = v01 * (1 - fx) + v11 * fx
  return v0 * (1 - fy) + v1 * fy
}