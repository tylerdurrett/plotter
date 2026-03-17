import type { SketchModule, SketchContext, Polyline, Point } from '@/lib/types'
import { mapRange } from '@/lib/math'
import { PAPER_SIZES } from '@/lib/paper'

const sketch: SketchModule = {
  params: {
    seed: { value: 42, min: 0, max: 9999, step: 1 },
    paperSize: {
      value: 'tabloid',
      options: Object.keys(PAPER_SIZES),
    },
    margin: { value: 0, min: 0, max: 5, step: 0.1 },
    xResolution: { value: 136, min: 2, max: 4000, step: 1 },
    numLayers: { value: 1154, min: 1, max: 8000, step: 1 },
    horizon: { value: 0, min: -0.2, max: 1, step: 0.001 },
    maxHeight: { value: 0.94, min: 0, max: 1.2, step: 0.01 },
    peakHeight: { value: 6.192, min: 0, max: 20, step: 0.001 },
    noiseScale: { value: 0.027, min: 0.004, max: 1, step: 0.001 },
    noiseOffsetX: { value: 0, min: 0, max: 1, step: 0.001 },
    noiseOffsetY: { value: 0, min: 0, max: 1, step: 0.001 },
    noiseOffsetZ: { value: 0, min: 0, max: 1, step: 0.001 },
    noise0Multiplier: { value: 0, min: 0, max: 10, step: 0.001 },
    noise1Multiplier: { value: 0, min: 0, max: 10, step: 0.001 },
    noise2Multiplier: { value: 2.324, min: 0, max: 10, step: 0.001 },
    noise3Multiplier: { value: 0, min: 0, max: 10, step: 0.001 },
    noise4Multiplier: { value: 0, min: 0, max: 10, step: 0.001 },
    zDistance: { value: 500, min: 0.01, max: 1000, step: 0.001 },
  },

  render(ctx: SketchContext, params: Record<string, unknown>): Polyline[] {
    const seed = params.seed as number
    const xResolution = params.xResolution as number
    const numLayers = params.numLayers as number
    const horizon = params.horizon as number
    const maxHeight = params.maxHeight as number
    const peakHeight = params.peakHeight as number
    const noiseScale = params.noiseScale as number
    const noiseOffsetX = params.noiseOffsetX as number
    const noiseOffsetY = params.noiseOffsetY as number
    const noiseOffsetZ = params.noiseOffsetZ as number
    const noise0Multiplier = params.noise0Multiplier as number
    const noise1Multiplier = params.noise1Multiplier as number
    const noise2Multiplier = params.noise2Multiplier as number
    const noise3Multiplier = params.noise3Multiplier as number
    const noise4Multiplier = params.noise4Multiplier as number
    const zDistance = params.zDistance as number

    const { width, height } = ctx
    const random = ctx.createRandom(seed)

    function getNoise3D(x: number, z: number, octave: number): number {
      return random.noise3D(
        x * noiseScale * octave + noiseOffsetX,
        z * noiseScale * octave + noiseOffsetY,
        noiseOffsetZ,
      )
    }

    // Generate contour lines
    const xStep = width / (xResolution - 1)
    const horizonY = height * horizon
    const maxHeightY = height * maxHeight
    const contours: Point[][] = []

    for (let i = 0; i < numLayers; i++) {
      const iPercent = i / numLayers
      const iVal = Math.sqrt(iPercent)
      const yBaseline = mapRange(iVal, 0, 1, horizonY, maxHeightY)
      const z = mapRange(iVal, 0, 1, 0.01, zDistance)

      const contour: Point[] = []
      for (let j = 0; j < xResolution; j++) {
        const x = j * xStep
        const noise0 =
          getNoise3D(x, z, 0.1) * iVal * peakHeight * 10 * noise0Multiplier
        const noise1 =
          getNoise3D(x, z, 1) * iVal * peakHeight * noise1Multiplier
        const noise2 =
          getNoise3D(x, z, 10) * iVal * peakHeight * 0.1 * noise2Multiplier
        const noise3 =
          getNoise3D(x, z, 100) * iVal * peakHeight * 0.01 * noise3Multiplier
        const noise4 =
          getNoise3D(x, z, 1000) * iVal * peakHeight * 0.001 * noise4Multiplier
        const y =
          height - yBaseline + noise0 + noise1 + noise2 + noise3 + noise4
        contour.push([x, y])
      }
      contours.push(contour)
    }

    // Hidden line removal: track minimum Y per column,
    // break contours into visible segments where points are above previous contours
    const culled: Polyline[] = []
    const maxYs = new Array(xResolution).fill(height)

    for (let i = 0; i < contours.length; i++) {
      const contour = contours[i]
      const segments: Polyline[] = []
      let currentSegment: Point[] = []

      for (let j = 0; j < contour.length; j++) {
        const point = contour[j]
        if (point[1] < maxYs[j]) {
          maxYs[j] = point[1]
          currentSegment.push(point)
        } else {
          if (currentSegment.length > 0) segments.push(currentSegment)
          currentSegment = []
        }
      }
      if (currentSegment.length > 0) segments.push(currentSegment)

      // Alternate direction for pen-plotter travel optimization
      if (i % 2 === 0) {
        culled.push(...segments)
      } else {
        const reversed: Polyline[] = []
        for (const segment of segments) {
          reversed.push(segment.reverse())
        }
        culled.push(...reversed.reverse())
      }
    }

    // Reverse for proper draw order
    return culled.reverse()
  },
}

export default sketch
