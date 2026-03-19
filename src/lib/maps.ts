import type { MapManifest, MapInfo, MapKey, MapFitMode, Vec2, Random, Polyline, TraceOptions } from '@/lib/types'

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

export class MapBundle {
  private _manifest: MapManifest
  private baseUrl: string
  private transform: MapTransform
  private mapCache: Map<MapKey, Float32Array>
  private fitMode: MapFitMode

  private constructor(
    manifest: MapManifest,
    baseUrl: string,
    transform: MapTransform,
    fitMode: MapFitMode,
  ) {
    this._manifest = manifest
    this.baseUrl = baseUrl
    this.transform = transform
    this.fitMode = fitMode
    this.mapCache = new Map()
  }

  static async load(
    baseUrl: string,
    drawWidth: number,
    drawHeight: number,
    fitMode: MapFitMode,
  ): Promise<MapBundle> {
    // Fetch manifest.json
    const manifestUrl = `${baseUrl}/manifest.json`
    const response = await fetch(manifestUrl)

    if (!response.ok) {
      throw new Error(
        `Failed to load manifest from ${manifestUrl}: ${response.status} ${response.statusText}`,
      )
    }

    const manifestJson = await response.json()
    const manifest = parseManifest(manifestJson)

    // Compute coordinate transform
    const transform = computeMapTransform(
      manifest.width,
      manifest.height,
      drawWidth,
      drawHeight,
      fitMode,
    )

    return new MapBundle(manifest, baseUrl, transform, fitMode)
  }

  async ensureMap(key: MapKey): Promise<void> {
    // Check if already cached
    if (this.mapCache.has(key)) {
      return
    }

    // Find map info in manifest
    const mapInfo = this._manifest.maps.find(m => m.key === key)
    if (!mapInfo) {
      throw new Error(`Map key '${key}' not found in manifest`)
    }

    // Fetch the .bin file
    const binUrl = `${this.baseUrl}/${mapInfo.filename}`
    const response = await fetch(binUrl)

    if (!response.ok) {
      throw new Error(
        `Failed to load map '${key}' from ${binUrl}: ${response.status} ${response.statusText}`,
      )
    }

    // Convert to Float32Array
    const arrayBuffer = await response.arrayBuffer()
    const float32Array = new Float32Array(arrayBuffer)

    // Validate size
    const expectedSize = mapInfo.shape[0] * mapInfo.shape[1]
    if (float32Array.length !== expectedSize) {
      throw new Error(
        `Map '${key}' has incorrect size: expected ${expectedSize} values, got ${float32Array.length}`,
      )
    }

    // Cache it
    this.mapCache.set(key, float32Array)
  }

  sample(key: MapKey, x: number, y: number): number {
    // Check if map is loaded
    const data = this.mapCache.get(key)
    if (!data) {
      throw new Error(
        `Map '${key}' not loaded. Call ensureMap('${key}') first.`,
      )
    }

    // In fit mode, check if the point is in an unmapped region
    if (this.fitMode === 'fit') {
      // Check if point is outside the scaled map region
      const mapScaledWidth = this._manifest.width * this.transform.scale
      const mapScaledHeight = this._manifest.height * this.transform.scale

      if (
        x < this.transform.offsetX ||
        x > this.transform.offsetX + mapScaledWidth ||
        y < this.transform.offsetY ||
        y > this.transform.offsetY + mapScaledHeight
      ) {
        return 0
      }
    }

    // Transform from cm-coords to pixel-coords
    const px = (x - this.transform.offsetX) / this.transform.scale
    const py = (y - this.transform.offsetY) / this.transform.scale

    // Sample using bilinear interpolation
    // sampleMap already handles clamping for out-of-bounds coordinates
    return sampleMap(data, this._manifest.width, this._manifest.height, px, py)
  }

  sampleFlow(x: number, y: number): Vec2 {
    // Ensure both flow maps are loaded
    if (!this.mapCache.has('flow_x')) {
      throw new Error("Map 'flow_x' not loaded. Call ensureMap('flow_x') first.")
    }
    if (!this.mapCache.has('flow_y')) {
      throw new Error("Map 'flow_y' not loaded. Call ensureMap('flow_y') first.")
    }

    const fx = this.sample('flow_x', x, y)
    const fy = this.sample('flow_y', x, y)
    return [fx, fy]
  }

  get manifest(): MapManifest {
    return this._manifest
  }

  get mapWidth(): number {
    return this._manifest.width
  }

  get mapHeight(): number {
    return this._manifest.height
  }
}

/**
 * Scatter points using density-weighted rejection sampling.
 *
 * @param random - Seeded random number generator
 * @param width - Width of the area in cm
 * @param height - Height of the area in cm
 * @param count - Target number of points to generate
 * @param densitySampler - Function that returns density value [0,1] at given position
 * @param influence - Controls how strongly density affects distribution (0=uniform, 1=proportional, >1=concentrated)
 * @returns Array of scattered points
 */
export function scatterPoints(
  random: Random,
  width: number,
  height: number,
  count: number,
  densitySampler: (x: number, y: number) => number,
  influence: number,
): Vec2[] {
  const points: Vec2[] = []
  const oversampleFactor = 3 // Oversample to compensate for rejections
  const maxAttempts = count * oversampleFactor * 10 // Prevent infinite loops
  let attempts = 0

  // For influence = 0, we want uniform distribution regardless of density
  // For influence > 0, we use density^influence as the acceptance probability

  while (points.length < count && attempts < maxAttempts) {
    attempts++

    // Generate uniform random candidate
    const x = random.range(0, width)
    const y = random.range(0, height)

    if (influence === 0) {
      // Uniform distribution - always accept
      points.push([x, y])
    } else {
      // Sample density at this position
      const density = densitySampler(x, y)

      // Clamp density to valid range [0, 1]
      const clampedDensity = Math.max(0, Math.min(1, density))

      // Calculate acceptance probability
      const acceptanceProbability = Math.pow(clampedDensity, influence)

      // Accept or reject based on probability
      if (random.value() < acceptanceProbability) {
        points.push([x, y])
      }
    }
  }

  // Return exactly count points (or fewer if we couldn't generate enough)
  return points.slice(0, count)
}

/**
 * Trace a path through a flow field from a starting point.
 *
 * @param start - Starting position in cm
 * @param flowSampler - Function that returns flow vector [fx, fy] at given position
 * @param options - Tracing options including step size, limits, and speed modulation
 * @returns Polyline (array of points) representing the traced path
 */
export function traceFlow(
  start: Vec2,
  flowSampler: (x: number, y: number) => Vec2,
  options: TraceOptions,
): Polyline {
  const { stepSize, maxSteps, maxDistance, bounds, speedSampler, minSpeed = 0.1 } = options

  // Initialize polyline with starting point
  const polyline: Polyline = [start]
  let currentPos: Vec2 = [...start] as Vec2
  let totalDistance = 0

  // Trace for up to maxSteps
  for (let step = 0; step < maxSteps; step++) {
    // Sample flow at current position
    const flow = flowSampler(currentPos[0], currentPos[1])

    // Check for zero flow (avoid division by zero and infinite loops)
    const flowMagnitude = Math.sqrt(flow[0] * flow[0] + flow[1] * flow[1])
    if (flowMagnitude < 0.00001) {
      // Zero or near-zero flow, stop tracing
      break
    }

    // Normalize flow to get direction
    const flowDirection: Vec2 = [
      flow[0] / flowMagnitude,
      flow[1] / flowMagnitude
    ]

    // Calculate step distance (potentially modulated by speed)
    let actualStepSize = stepSize
    if (speedSampler) {
      const speed = speedSampler(currentPos[0], currentPos[1])
      // Clamp speed to [0, 1] range
      const clampedSpeed = Math.max(0, Math.min(1, speed))
      // Modulate step size: speed=1 → full step, speed→0 → minSpeed*step
      actualStepSize = stepSize * (minSpeed + (1 - minSpeed) * clampedSpeed)
    }

    // Advance position
    const nextPos: Vec2 = [
      currentPos[0] + flowDirection[0] * actualStepSize,
      currentPos[1] + flowDirection[1] * actualStepSize
    ]

    // Check bounds
    if (nextPos[0] < 0 || nextPos[0] > bounds.width ||
        nextPos[1] < 0 || nextPos[1] > bounds.height) {
      // Out of bounds, stop tracing
      break
    }

    // Update total distance
    const stepDistance = Math.sqrt(
      (nextPos[0] - currentPos[0]) ** 2 +
      (nextPos[1] - currentPos[1]) ** 2
    )
    totalDistance += stepDistance

    // Check max distance
    if (totalDistance > maxDistance) {
      // Exceeded max distance, stop tracing
      break
    }

    // Add point to polyline and continue
    polyline.push(nextPos)
    currentPos = nextPos
  }

  return polyline
}