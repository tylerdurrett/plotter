import type { SketchModule, SketchContext, Polyline, Vec2, TraceFlowNoiseOptions } from '@/lib/types'
import { PAPER_SIZES } from '@/lib/paper'
import { scatterPoints, traceFlowNoise } from '@/lib/maps'

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

    // Scatter parameters
    seedCount: { value: 1000, min: 50, max: 20000, step: 50 },
    densityInfluence: { value: 1, min: 0, max: 3, step: 0.1 },
    scatterDensityFloor: { value: 0.05, min: 0, max: 1, step: 0.01 },

    // Trace parameters
    stepSize: { value: 0.1, min: 0.02, max: 0.2, step: 0.01 },
    maxSteps: { value: 500, min: 50, max: 2000, step: 50 },
    maxDistance: { value: 10, min: 1, max: 30, step: 1 },
    minSpeed: { value: 0.1, min: 0, max: 1, step: 0.05 },

    // Noise perturbation
    noiseInfluence: { value: 0.3, min: 0, max: 1, step: 0.05 },
    noiseScale: { value: 1.0, min: 0.1, max: 5.0, step: 0.1 },

    // Tone modulation
    toneInfluence: { value: 0.7, min: 0, max: 1, step: 0.05 },
    toneThreshold: { value: 0.15, min: 0, max: 1, step: 0.01 },

    // Drawing behavior
    bidirectional: { value: true, options: [true, false] },
    coherenceBlend: { value: false, options: [true, false] },
  },

  async setup(ctx: SketchContext) {
    if (ctx.maps) {
      try {
        await Promise.all([
          ctx.maps.ensureMap('density_target'),
          ctx.maps.ensureMap('flow_x'),
          ctx.maps.ensureMap('flow_y'),
        ])

        // Try optional maps
        try { await ctx.maps.ensureMap('flow_speed') } catch {
          try { await ctx.maps.ensureMap('complexity') } catch { /* no speed map */ }
        }
        try { await ctx.maps.ensureMap('coherence') } catch { /* no coherence map */ }
      } catch (error) {
        console.error('Failed to preload maps:', error)
      }
    }
  },

  render(ctx: SketchContext, params: Record<string, unknown>): Polyline[] {
    const seed = params.seed as number
    const mapBundle = params.mapBundle as string
    const seedCount = params.seedCount as number
    const stepSize = params.stepSize as number
    const maxSteps = params.maxSteps as number
    const maxDistance = params.maxDistance as number
    const densityInfluence = params.densityInfluence as number
    const minSpeed = params.minSpeed as number
    const noiseInfluence = params.noiseInfluence as number
    const noiseScale = params.noiseScale as number
    const toneInfluence = params.toneInfluence as number
    const toneThreshold = params.toneThreshold as number
    const bidirectional = params.bidirectional as boolean
    const coherenceBlend = params.coherenceBlend as boolean
    const scatterDensityFloor = params.scatterDensityFloor as number

    if (mapBundle === 'none' || !ctx.maps) {
      return []
    }

    const random = ctx.createRandom(seed)
    const lines: Polyline[] = []

    try {
      // Density sampler with floor applied — ensures light areas still get some points
      const densitySampler = (x: number, y: number): number => {
        const raw = ctx.maps!.sample('density_target', x, y)
        return scatterDensityFloor + (1 - scatterDensityFloor) * raw
      }

      const seedPoints = scatterPoints(
        random,
        ctx.width,
        ctx.height,
        seedCount,
        densitySampler,
        densityInfluence,
      )

      // Shuffle for natural overlap ordering
      const shuffledSeeds = random.shuffle(seedPoints)

      // Flow sampler
      const flowSampler = (x: number, y: number): Vec2 => {
        return ctx.maps!.sampleFlow(x, y)
      }

      // Tone sampler (raw density, no floor — we want actual tonal values)
      const toneSampler = (x: number, y: number): number => {
        return ctx.maps!.sample('density_target', x, y)
      }

      // Speed sampler
      let speedSampler: ((x: number, y: number) => number) | undefined
      try {
        ctx.maps.sample('flow_speed', 0, 0)
        speedSampler = (x: number, y: number) => ctx.maps!.sample('flow_speed', x, y)
      } catch {
        try {
          ctx.maps.sample('complexity', 0, 0)
          speedSampler = (x: number, y: number) => ctx.maps!.sample('complexity', x, y)
        } catch { /* no speed map */ }
      }

      // Build noise influence: constant or coherence-driven
      let resolvedNoiseInfluence: number | ((x: number, y: number) => number) = noiseInfluence
      if (coherenceBlend) {
        try {
          ctx.maps.sample('coherence', 0, 0)
          // High coherence (edges) → low noise, low coherence (smooth) → high noise
          resolvedNoiseInfluence = (x: number, y: number): number => {
            const coherence = ctx.maps!.sample('coherence', x, y)
            return noiseInfluence * (1 - coherence)
          }
        } catch {
          // Coherence map not available, fall back to constant
        }
      }

      for (const seedPoint of shuffledSeeds) {
        const traceOptions: TraceFlowNoiseOptions = {
          stepSize,
          maxSteps,
          maxDistance,
          bounds: { width: ctx.width, height: ctx.height },
          speedSampler,
          minSpeed,
          noise: random.noise2D,
          noiseScale,
          noiseInfluence: resolvedNoiseInfluence,
          toneSampler,
          toneInfluence,
          toneThreshold,
          bidirectional,
        }

        const segments = traceFlowNoise(seedPoint, flowSampler, traceOptions)
        lines.push(...segments)
      }
    } catch (error) {
      console.error('Error rendering with maps:', error)
    }

    return lines
  },
}

export default sketch
