import type { SketchModule, SketchContext, Polyline, MapFitMode } from '@/lib/types'
import { PAPER_SIZES } from '@/lib/paper'

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

        // Try to load optional maps, but don't fail if they're not available
        try {
          await ctx.maps.ensureMap('flow_speed')
        } catch {
          // flow_speed might not be available in all bundles
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

    // For now, just create a simple test pattern to verify the connection works
    // The full flow field algorithm will be implemented in Phase 4
    try {
      // Test that we can sample from the maps
      const testX = ctx.width / 2
      const testY = ctx.height / 2
      const density = ctx.maps.sample('density_target', testX, testY)
      const [flowX, flowY] = ctx.maps.sampleFlow(testX, testY)

      console.log(`Map sampling test - density: ${density}, flow: [${flowX}, ${flowY}]`)

      // Create a simple grid of short lines as a placeholder
      const gridSize = 10
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const x = ((c + 0.5) / gridSize) * ctx.width
          const y = ((r + 0.5) / gridSize) * ctx.height

          // Sample the flow at this position
          const [fx, fy] = ctx.maps.sampleFlow(x, y)

          // Create a short line in the flow direction
          const length = stepSize * 5
          const line: Polyline = [
            [x, y],
            [x + fx * length, y + fy * length],
          ]
          lines.push(line)
        }
      }
    } catch (error) {
      console.error('Error rendering with maps:', error)
    }

    return lines
  },
}

export default sketch