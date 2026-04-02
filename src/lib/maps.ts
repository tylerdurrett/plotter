import type { MapManifest, MapInfo, MapKey, MapFitMode, Vec2, Random, Polyline, TraceOptions, TraceFlowNoiseOptions, IntermediateMapKey, CompositionParams } from '@/lib/types'
import { composite, allocateOutputs, DEFAULT_COMPOSITION_PARAMS, type CompositorInputs } from './map-compositor'

/** Common interface for anything that can sample maps (MapBundle or CompositeMapBundle) */
export interface MapSampler {
  sample(key: MapKey, x: number, y: number): number
  sampleFlow(x: number, y: number): Vec2
  ensureMap(key: MapKey): Promise<void>
  readonly manifest: MapManifest
  readonly mapWidth: number
  readonly mapHeight: number
}

const VALID_MAP_KEYS = new Set<MapKey>([
  'density_target',
  'flow_x',
  'flow_y',
  'importance',
  'coherence',
  'complexity',
  'flow_speed',
])

const VALID_INTERMEDIATE_KEYS = new Set<IntermediateMapKey>([
  'feature_influence',
  'contour_influence',
  'tonal',
  'etf_flow_x',
  'etf_flow_y',
  'contour_flow_x',
  'contour_flow_y',
  'coherence',
  'complexity',
])

function isMapKey(key: unknown): key is MapKey {
  return typeof key === 'string' && VALID_MAP_KEYS.has(key as MapKey)
}

function isIntermediateMapKey(key: unknown): key is IntermediateMapKey {
  return typeof key === 'string' && VALID_INTERMEDIATE_KEYS.has(key as IntermediateMapKey)
}

function isMapInfo(obj: unknown, version: number): obj is MapInfo {
  if (!obj || typeof obj !== 'object') return false

  const m = obj as Record<string, unknown>

  if (typeof m.filename !== 'string') return false
  // v2 manifests use intermediate keys; v1 uses final map keys
  const validKey = version === 2 ? isIntermediateMapKey(m.key) : isMapKey(m.key)
  if (!validKey) return false
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

  if (manifest.version !== 1 && manifest.version !== 2) {
    throw new Error(`Unsupported manifest version ${manifest.version}, expected 1 or 2`)
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
    if (!isMapInfo(mapEntry, manifest.version as number)) {
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

/**
 * Sample a map array with coordinate transform and fit-mode boundary check.
 * Shared by MapBundle and CompositeMapBundle to avoid duplicating this logic.
 */
function sampleTransformed(
  data: Float32Array,
  width: number,
  height: number,
  transform: MapTransform,
  fitMode: MapFitMode,
  x: number,
  y: number,
): number {
  if (fitMode === 'fit') {
    const mapScaledWidth = width * transform.scale
    const mapScaledHeight = height * transform.scale
    if (
      x < transform.offsetX ||
      x > transform.offsetX + mapScaledWidth ||
      y < transform.offsetY ||
      y > transform.offsetY + mapScaledHeight
    ) {
      return 0
    }
  }

  const px = (x - transform.offsetX) / transform.scale
  const py = (y - transform.offsetY) / transform.scale
  return sampleMap(data, width, height, px, py)
}

export class MapBundle implements MapSampler {
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

  /**
   * Create a MapBundle from an API generate response (manifest already in hand).
   * Skips the manifest.json fetch — useful immediately after POST /api/generate.
   */
  static fromApiResponse(
    manifestJson: unknown,
    baseUrl: string,
    drawWidth: number,
    drawHeight: number,
    fitMode: MapFitMode,
  ): MapBundle {
    const manifest = parseManifest(manifestJson)
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
    const data = this.mapCache.get(key)
    if (!data) {
      throw new Error(
        `Map '${key}' not loaded. Call ensureMap('${key}') first.`,
      )
    }
    return sampleTransformed(data, this._manifest.width, this._manifest.height, this.transform, this.fitMode, x, y)
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

// Map from intermediate key names to CompositorInputs field names
const INTERMEDIATE_KEY_TO_FIELD: Record<string, keyof CompositorInputs> = {
  feature_influence: 'featureInfluence',
  contour_influence: 'contourInfluence',
  tonal: 'tonal',
  etf_flow_x: 'etfFlowX',
  etf_flow_y: 'etfFlowY',
  contour_flow_x: 'contourFlowX',
  contour_flow_y: 'contourFlowY',
  coherence: 'coherence',
  complexity: 'complexity',
}

/**
 * Map bundle that holds intermediate pipeline outputs and composites
 * them client-side for realtime slider-driven remixing.
 *
 * Implements the same MapSampler interface as MapBundle — sketches
 * cannot tell the difference.
 */
export class CompositeMapBundle implements MapSampler {
  private intermediates: CompositorInputs
  private composed: CompositorOutputs
  private _compositionParams: CompositionParams
  private transform: MapTransform
  private fitMode: MapFitMode
  private _manifest: MapManifest
  /** The original v2 manifest from the server (for reference) */
  readonly intermediateManifest: MapManifest

  private constructor(
    intermediateManifest: MapManifest,
    intermediates: CompositorInputs,
    transform: MapTransform,
    fitMode: MapFitMode,
    params: CompositionParams,
  ) {
    this.intermediateManifest = intermediateManifest
    this.intermediates = intermediates
    this.transform = transform
    this.fitMode = fitMode
    this._compositionParams = { ...params }

    // Pre-allocate and run initial composition
    this.composed = allocateOutputs(intermediates.width * intermediates.height)
    composite(intermediates, params, this.composed)

    // Build a synthetic v1 manifest so downstream consumers see standard map keys
    this._manifest = {
      version: 1,
      source_image: intermediateManifest.source_image,
      width: intermediateManifest.width,
      height: intermediateManifest.height,
      created_at: intermediateManifest.created_at,
      maps: [
        { filename: 'density_target.bin', key: 'density_target' as MapKey, dtype: 'float32', shape: [intermediateManifest.height, intermediateManifest.width], value_range: [0, 1], description: 'Composed density target' },
        { filename: 'flow_x.bin', key: 'flow_x' as MapKey, dtype: 'float32', shape: [intermediateManifest.height, intermediateManifest.width], value_range: [-1, 1], description: 'Composed flow X' },
        { filename: 'flow_y.bin', key: 'flow_y' as MapKey, dtype: 'float32', shape: [intermediateManifest.height, intermediateManifest.width], value_range: [-1, 1], description: 'Composed flow Y' },
        { filename: 'importance.bin', key: 'importance' as MapKey, dtype: 'float32', shape: [intermediateManifest.height, intermediateManifest.width], value_range: [0, 1], description: 'Composed importance' },
        { filename: 'coherence.bin', key: 'coherence' as MapKey, dtype: 'float32', shape: [intermediateManifest.height, intermediateManifest.width], value_range: [0, 1], description: 'ETF coherence (pass-through)' },
        { filename: 'complexity.bin', key: 'complexity' as MapKey, dtype: 'float32', shape: [intermediateManifest.height, intermediateManifest.width], value_range: [0, 1], description: 'Complexity (pass-through)' },
        { filename: 'flow_speed.bin', key: 'flow_speed' as MapKey, dtype: 'float32', shape: [intermediateManifest.height, intermediateManifest.width], value_range: [0, 1], description: 'Composed flow speed' },
      ],
    }
  }

  /**
   * Load intermediate maps from a v2 API session and composite them.
   * Fetches all 9 .bin files in parallel.
   */
  static async load(
    baseUrl: string,
    drawWidth: number,
    drawHeight: number,
    fitMode: MapFitMode,
    params?: CompositionParams,
  ): Promise<CompositeMapBundle> {
    // Fetch v2 manifest
    const manifestUrl = `${baseUrl}/manifest.json`
    const res = await fetch(manifestUrl)
    if (!res.ok) {
      throw new Error(`Failed to load manifest from ${manifestUrl}: ${res.status} ${res.statusText}`)
    }
    const manifestJson = await res.json()
    const manifest = parseManifest(manifestJson)

    if (manifest.version !== 2) {
      throw new Error(`CompositeMapBundle requires manifest version 2, got ${manifest.version}`)
    }

    return CompositeMapBundle.fromManifest(manifest, baseUrl, drawWidth, drawHeight, fitMode, params)
  }

  /**
   * Create from an already-parsed manifest (e.g. from API response).
   */
  static async fromManifest(
    manifest: MapManifest,
    baseUrl: string,
    drawWidth: number,
    drawHeight: number,
    fitMode: MapFitMode,
    params?: CompositionParams,
  ): Promise<CompositeMapBundle> {
    const compositionParams = params ?? DEFAULT_COMPOSITION_PARAMS

    // Fetch all intermediate .bin files in parallel
    const fetches = manifest.maps.map(async (mapInfo) => {
      const binUrl = `${baseUrl}/${mapInfo.filename}`
      const res = await fetch(binUrl)
      if (!res.ok) {
        throw new Error(`Failed to load intermediate map '${mapInfo.key}': ${res.status}`)
      }
      const buffer = await res.arrayBuffer()
      const data = new Float32Array(buffer)
      const expected = mapInfo.shape[0] * mapInfo.shape[1]
      if (data.length !== expected) {
        throw new Error(`Map '${mapInfo.key}' size mismatch: expected ${expected}, got ${data.length}`)
      }
      return { key: mapInfo.key, data }
    })

    const results = await Promise.all(fetches)

    // Build CompositorInputs directly from fetched arrays to avoid
    // double allocation (zero-fill + copy). Missing keys get zero-filled.
    const pixelCount = manifest.width * manifest.height
    const fetched = new Map(results.map(r => [r.key, r.data]))
    const getOrZero = (key: string) => fetched.get(key) ?? new Float32Array(pixelCount)

    const inputs: CompositorInputs = {
      featureInfluence: getOrZero('feature_influence'),
      contourInfluence: getOrZero('contour_influence'),
      tonal: getOrZero('tonal'),
      etfFlowX: getOrZero('etf_flow_x'),
      etfFlowY: getOrZero('etf_flow_y'),
      contourFlowX: getOrZero('contour_flow_x'),
      contourFlowY: getOrZero('contour_flow_y'),
      coherence: getOrZero('coherence'),
      complexity: getOrZero('complexity'),
      width: manifest.width,
      height: manifest.height,
    }

    const transform = computeMapTransform(
      manifest.width, manifest.height, drawWidth, drawHeight, fitMode,
    )

    return new CompositeMapBundle(manifest, inputs, transform, fitMode, compositionParams)
  }

  /**
   * Recompose with new parameters. ~1-2ms, no allocation.
   * Call this when mix sliders change.
   */
  recompose(params: CompositionParams): void {
    this._compositionParams = { ...params }
    composite(this.intermediates, params, this.composed)
  }

  /** All maps are pre-composed — validates key but does not fetch. */
  async ensureMap(key: MapKey): Promise<void> {
    this.getComposedArray(key) // validates key exists
  }

  sample(key: MapKey, x: number, y: number): number {
    const data = this.getComposedArray(key)
    return sampleTransformed(data, this._manifest.width, this._manifest.height, this.transform, this.fitMode, x, y)
  }

  sampleFlow(x: number, y: number): Vec2 {
    return [this.sample('flow_x', x, y), this.sample('flow_y', x, y)]
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

  private getComposedArray(key: MapKey): Float32Array {
    switch (key) {
      case 'density_target': return this.composed.densityTarget
      case 'importance':     return this.composed.importance
      case 'flow_x':         return this.composed.flowX
      case 'flow_y':         return this.composed.flowY
      case 'coherence':      return this.composed.coherence
      case 'complexity':     return this.composed.complexity
      case 'flow_speed':     return this.composed.flowSpeed
      default: throw new Error(`Unknown map key: ${key}`)
    }
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

/**
 * Trace a path through a flow field with noise perturbation and tone modulation.
 *
 * Blends flow direction with noise-derived direction at each step.
 * Supports tone-modulated line length, pen-up/pen-down via tone threshold,
 * and bidirectional tracing (forward + backward from seed).
 *
 * Returns multiple polyline segments — the pen lifts where tone < toneThreshold.
 * The particle continues tracing through light areas (so it can reach
 * disconnected dark regions), but those segments are omitted from output.
 */
export function traceFlowNoise(
  start: Vec2,
  flowSampler: (x: number, y: number) => Vec2,
  options: TraceFlowNoiseOptions,
): Polyline[] {
  const {
    noise,
    noiseScale,
    noiseInfluence,
    toneSampler,
    toneInfluence = 0,
    toneThreshold = 0,
    bidirectional = false,
  } = options

  // Compute effective maxSteps based on tone at start point
  let effectiveMaxSteps = options.maxSteps
  if (toneSampler && toneInfluence > 0) {
    const toneValue = Math.max(0, Math.min(1, toneSampler(start[0], start[1])))
    // lerp(1, toneValue, toneInfluence) — at toneInfluence=1, maxSteps scales directly with tone
    const scaleFactor = 1 - toneInfluence + toneInfluence * toneValue
    effectiveMaxSteps = Math.round(options.maxSteps * scaleFactor)
  }

  const traceDirection = (
    seed: Vec2,
    direction: 1 | -1,
    maxSteps: number,
  ): Vec2[] => {
    const { stepSize, maxDistance, bounds, speedSampler, minSpeed = 0.1 } = options
    const points: Vec2[] = [seed]
    let currentPos: Vec2 = [...seed] as Vec2
    let totalDistance = 0

    for (let step = 0; step < maxSteps; step++) {
      const flow = flowSampler(currentPos[0], currentPos[1])
      const dirFlow: Vec2 = [flow[0] * direction, flow[1] * direction]

      const flowMagnitude = Math.sqrt(dirFlow[0] * dirFlow[0] + dirFlow[1] * dirFlow[1])
      if (flowMagnitude < 0.00001) break

      const flowDir: Vec2 = [dirFlow[0] / flowMagnitude, dirFlow[1] / flowMagnitude]

      const noiseAngle = noise(currentPos[0] / noiseScale, currentPos[1] / noiseScale) * Math.PI
      const noiseDir: Vec2 = [Math.cos(noiseAngle), Math.sin(noiseAngle)]

      const ni = typeof noiseInfluence === 'function'
        ? Math.max(0, Math.min(1, noiseInfluence(currentPos[0], currentPos[1])))
        : noiseInfluence

      const blendX = flowDir[0] * (1 - ni) + noiseDir[0] * ni
      const blendY = flowDir[1] * (1 - ni) + noiseDir[1] * ni
      const blendMag = Math.sqrt(blendX * blendX + blendY * blendY)
      if (blendMag < 0.00001) break

      const finalDir: Vec2 = [blendX / blendMag, blendY / blendMag]

      let actualStepSize = stepSize
      if (speedSampler) {
        const speed = Math.max(0, Math.min(1, speedSampler(currentPos[0], currentPos[1])))
        actualStepSize = stepSize * (minSpeed + (1 - minSpeed) * speed)
      }

      const nextPos: Vec2 = [
        currentPos[0] + finalDir[0] * actualStepSize,
        currentPos[1] + finalDir[1] * actualStepSize,
      ]

      if (nextPos[0] < 0 || nextPos[0] > bounds.width ||
          nextPos[1] < 0 || nextPos[1] > bounds.height) {
        break
      }

      const stepDistance = Math.sqrt(
        (nextPos[0] - currentPos[0]) ** 2 +
        (nextPos[1] - currentPos[1]) ** 2,
      )
      totalDistance += stepDistance
      if (totalDistance > maxDistance) break

      points.push(nextPos)
      currentPos = nextPos
    }

    return points
  }

  // Get the full traced path (all points, regardless of tone)
  let fullPath: Vec2[]
  if (bidirectional) {
    const halfSteps = Math.ceil(effectiveMaxSteps / 2)
    const backward = traceDirection(start, -1, halfSteps)
    const forward = traceDirection(start, 1, halfSteps)
    const backwardReversed = backward.slice(1).reverse()
    fullPath = [...backwardReversed, ...forward]
  } else {
    fullPath = traceDirection(start, 1, effectiveMaxSteps)
  }

  // Split path into segments based on tone threshold (pen-up/pen-down)
  if (toneThreshold > 0 && toneSampler) {
    const segments: Polyline[] = []
    let currentSegment: Vec2[] = []

    for (const point of fullPath) {
      const tone = toneSampler(point[0], point[1])
      if (tone >= toneThreshold) {
        // Pen down — add to current segment
        currentSegment.push(point)
      } else {
        // Pen up — flush current segment if it has enough points
        if (currentSegment.length >= 2) {
          segments.push(currentSegment)
        }
        currentSegment = []
      }
    }

    // Flush final segment
    if (currentSegment.length >= 2) {
      segments.push(currentSegment)
    }

    return segments
  }

  // No threshold — return the full path as a single segment (if long enough)
  return fullPath.length >= 2 ? [fullPath] : []
}