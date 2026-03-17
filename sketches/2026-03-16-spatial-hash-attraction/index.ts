import type { SketchModule, SketchContext, Polyline, Vec2 } from '@/lib/types'
import { vec } from '@/lib/vec'
import { PAPER_SIZES } from '@/lib/paper'

/**
 * Simple spatial hash for point-sized objects.
 * Stores indices into an external positions array for fast neighbor lookup.
 */
class SpatialHash {
  private cellSize: number
  private cells = new Map<number, number[]>()

  constructor(cellSize: number) {
    this.cellSize = cellSize
  }

  private hash(pos: Vec2): number {
    const xIndex = Math.floor(pos[0] / this.cellSize)
    const yIndex = Math.floor(pos[1] / this.cellSize)
    return (xIndex << 16) ^ yIndex
  }

  insert(index: number, pos: Vec2): void {
    const h = this.hash(pos)
    let cell = this.cells.get(h)
    if (!cell) {
      cell = []
      this.cells.set(h, cell)
    }
    cell.push(index)
  }

  /** Returns all indices in the same cell as the given position */
  getNeighborIndices(pos: Vec2): number[] {
    return this.cells.get(this.hash(pos)) ?? []
  }
}

const sketch: SketchModule = {
  params: {
    seed: { value: 42, min: 0, max: 9999, step: 1 },
    paperSize: {
      value: 'letter',
      options: Object.keys(PAPER_SIZES),
    },
    margin: { value: 1.5, min: 0, max: 5, step: 0.1 },
    maxFrames: { value: 25000, min: 10, max: 55000, step: 1 },
    maxVel: { value: 0.1, min: 0.01, max: 1, step: 0.001 },
    cellSize: { value: 0.6, min: 0.01, max: 10, step: 0.01 },
    maxDistFromCenter: { value: 9.2, min: 0.1, max: 15, step: 0.1 },
    centerPull: { value: 0.00486, min: 0.000001, max: 0.1, step: 0.000001 },
    minDist: { value: 2.449, min: 0.01, max: 10, step: 0.001 },
    separation: { value: 0.008, min: 0.000001, max: 0.1, step: 0.000001 },
    noiseStrength: { value: 0, min: 0, max: 0.05, step: 0.0001 },
    noiseZoom: { value: 0.184, min: 0.0001, max: 0.5, step: 0.0001 },
  },

  render(ctx: SketchContext, params: Record<string, unknown>): Polyline[] {
    const seed = params.seed as number
    const maxFrames = params.maxFrames as number
    const maxVel = params.maxVel as number
    const cellSize = params.cellSize as number
    const maxDistFromCenter = params.maxDistFromCenter as number
    const centerPull = params.centerPull as number
    const minDist = params.minDist as number
    const separationStrength = params.separation as number
    const noiseStrength = params.noiseStrength as number
    const noiseZoom = params.noiseZoom as number

    const { width, height } = ctx
    const random = ctx.createRandom(seed)
    const center: Vec2 = [width / 2, height / 2]
    const minDistSqr = minDist * minDist
    const maxVelSqr = maxVel * maxVel

    // Spatial hash for efficient neighbor queries
    const spatialHash = new SpatialHash(cellSize)
    const positions: Vec2[] = []

    // Initialize root node at center with small random offset
    let pos: Vec2 = vec.add(center, random.insideCircle(2))
    let vel: Vec2 = random.insideCircle(maxVel)
    let acc: Vec2 = [0, 0]

    // Store initial position
    positions.push(pos)
    spatialHash.insert(0, pos)

    for (let frame = 0; frame < maxFrames; frame++) {
      // --- Center attraction ---
      // Ported from old code: pulls leaf back when it strays beyond maxDistFromCenter
      const distFromCenter = vec.dist(pos, center)
      if (distFromCenter > maxDistFromCenter) {
        const dir = vec.normalize(vec.sub(pos, center))
        const force = vec.scale(dir, distFromCenter * centerPull / maxDistFromCenter)
        acc = vec.sub(acc, force)
      }

      // --- Neighbor separation via spatial hash ---
      const neighborIndices = spatialHash.getNeighborIndices(pos)
      for (let i = 0; i < neighborIndices.length; i++) {
        const other = positions[neighborIndices[i]]
        const diff = vec.sub(pos, other)
        const dSqr = vec.lenSq(diff)

        if (dSqr > 0 && dSqr < minDistSqr) {
          // Separation force proportional to distance
          const magnitude = Math.sqrt(dSqr) * separationStrength
          acc = vec.add(acc, vec.scale(vec.normalize(diff), magnitude))
        }
      }

      // Apply acceleration to velocity
      vel = vec.add(vel, acc)

      // --- Noise influence ---
      // Single noise lookup → angle → directional force (matches old behavior)
      if (noiseStrength > 0) {
        const noise = random.noise2D(pos[0] * noiseZoom, pos[1] * noiseZoom)
        // Multiply by 15 to map [-1,1] noise into ~[-860°,860°] for chaotic swirl (ported from original)
        const angle = noise * 15
        vel = vec.add(vel, [
          Math.cos(angle) * noiseStrength,
          Math.sin(angle) * noiseStrength,
        ])
      }

      // Enforce max speed
      if (vec.lenSq(vel) > maxVelSqr) {
        vel = vec.scale(vec.normalize(vel), maxVel)
      }

      // Integration: update position, reset acceleration
      pos = vec.add(pos, vel)
      acc = [0, 0]

      // Store new position
      positions.push(pos)
      spatialHash.insert(positions.length - 1, pos)
    }

    return [positions]
  },
}

export default sketch
