import type { SketchModule, SketchContext, Polyline, MapFitMode, Vec2, TraceOptions } from '@/lib/types'
import { PAPER_SIZES } from '@/lib/paper'
import { scatterPoints, traceFlow } from '@/lib/maps'

const sketch: SketchModule = {
  params: {
    seed: { value: 42, min: 0, max: 9999, step: 1 },
    paperSize: {
      value: 'letter',
      options: Object.keys(PAPER_SIZES),
    },
    margin: { value: 1, min: 0, max: 5, step: 0.1 },

    // Map selection parameters
    mapBundle: {
      value: 'none',
      options: ['none'], // Will be dynamically populated
    },
    fitMode: {
      value: 'cover',
      options: ['cover', 'fit'],
    },

    // Map-driven drawing parameters
    seedCount: { value: 1000, min: 100, max: 5000, step: 100 },
    stepSize: { value: 0.1, min: 0.02, max: 0.2, step: 0.01 },
    maxSteps: { value: 500, min: 50, max: 2000, step: 50 },
    maxDistance: { value: 10, min: 1, max: 30, step: 1 },
    densityInfluence: { value: 1, min: 0, max: 3, step: 0.1 },
    minSpeed: { value: 0.1, min: 0, max: 1, step: 0.05 },
  },

  async setup(ctx: SketchContext) {
    // Preload required maps if a bundle is selected
    if (ctx.maps) {
      try {
        await Promise.all([
          ctx.maps.ensureMap('density_target'),
          ctx.maps.ensureMap('flow_x'),
          ctx.maps.ensureMap('flow_y'),
        ])

        // Try to load optional maps for speed modulation
        try {
          await ctx.maps.ensureMap('flow_speed')
        } catch {
          // flow_speed might not be available, try complexity as fallback
          try {
            await ctx.maps.ensureMap('complexity')
          } catch {
            // Neither speed map available, will run without speed modulation
          }
        }
      } catch (error) {
        console.error('Failed to preload maps:', error)
      }
    }
  },

  render(ctx: SketchContext, params: Record<string, unknown>): Polyline[] {
    const seed = params.seed as number
    const mapBundle = params.mapBundle as string
    const fitMode = params.fitMode as MapFitMode
    const seedCount = params.seedCount as number
    const stepSize = params.stepSize as number
    const maxSteps = params.maxSteps as number
    const maxDistance = params.maxDistance as number
    const densityInfluence = params.densityInfluence as number
    const minSpeed = params.minSpeed as number

    // If no map bundle is selected or available, return empty
    if (mapBundle === 'none' || !ctx.maps) {
      return []
    }

    const random = ctx.createRandom(seed)
    const lines: Polyline[] = []

    try {
      // Create density sampler for scattering points
      const densitySampler = (x: number, y: number): number => {
        return ctx.maps!.sample('density_target', x, y)
      }

      // Scatter seed points using density-weighted rejection sampling
      const seedPoints = scatterPoints(
        random,
        ctx.width,
        ctx.height,
        seedCount,
        densitySampler,
        densityInfluence
      )

      // Create flow sampler for tracing
      const flowSampler = (x: number, y: number): Vec2 => {
        return ctx.maps!.sampleFlow(x, y)
      }

      // Create speed sampler (prefer flow_speed, fallback to complexity)
      let speedSampler: ((x: number, y: number) => number) | undefined

      // Try to use flow_speed first, then complexity as fallback
      try {
        // Check if we can sample flow_speed
        ctx.maps.sample('flow_speed', 0, 0)
        speedSampler = (x: number, y: number): number => {
          return ctx.maps!.sample('flow_speed', x, y)
        }
      } catch {
        // flow_speed not available, try complexity
        try {
          ctx.maps.sample('complexity', 0, 0)
          speedSampler = (x: number, y: number): number => {
            return ctx.maps!.sample('complexity', x, y)
          }
        } catch {
          // Neither speed map available, speedSampler remains undefined
        }
      }

      // Trace flow field from each seed point
      for (const seedPoint of seedPoints) {
        const traceOptions: TraceOptions = {
          stepSize,
          maxSteps,
          maxDistance,
          bounds: {
            width: ctx.width,
            height: ctx.height,
          },
          speedSampler,
          minSpeed,
        }

        const polyline = traceFlow(seedPoint, flowSampler, traceOptions)

        // Only add polylines with at least 2 points (actual lines)
        if (polyline.length >= 2) {
          lines.push(polyline)
        }
      }
    } catch (error) {
      console.error('Error rendering with maps:', error)
    }

    return lines
  },
}

export default sketch