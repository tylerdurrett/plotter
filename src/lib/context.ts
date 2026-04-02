import type { PaperSize, SketchContext } from '@/lib/types'
import type { MapSampler } from '@/lib/maps'
import { getPaperSize, type Orientation } from '@/lib/paper'
import { createRandom } from '@/lib/random'

/**
 * Build a SketchContext from paper configuration.
 * Resolves paper dimensions, applies margins, and attaches the random factory.
 */
export function createSketchContext(
  paperSize: string | PaperSize,
  orientation?: Orientation,
  margin: number = 0,
  maps?: MapSampler,
): SketchContext {
  const name = typeof paperSize === 'string' ? paperSize : 'custom'
  const resolved = getPaperSize(paperSize, orientation)

  if (margin < 0) {
    throw new Error(`Margin must be non-negative: got ${margin}`)
  }

  if (margin * 2 >= resolved.width || margin * 2 >= resolved.height) {
    throw new Error(
      `Margin (${margin} cm per side) exceeds paper dimensions (${resolved.width} × ${resolved.height} cm)`,
    )
  }

  return {
    width: resolved.width - margin * 2,
    height: resolved.height - margin * 2,
    createRandom,
    paper: {
      width: resolved.width,
      height: resolved.height,
      name,
      margin,
    },
    maps,
  }
}
