import type { SketchModule, SketchContext, Polyline } from '@/lib/types'
import { line } from '@/lib/geometry'
import { PAPER_SIZES } from '@/lib/paper'

const sketch: SketchModule = {
  params: {
    seed: { value: 42, min: 0, max: 9999, step: 1 },
    rows: { value: 8, min: 2, max: 30, step: 1 },
    cols: { value: 6, min: 2, max: 30, step: 1 },
    lineLength: { value: 0.8, min: 0.1, max: 3, step: 0.1 },
    // Consumed by the framework to build SketchContext; not used directly in render.
    paperSize: {
      value: 'letter',
      options: Object.keys(PAPER_SIZES),
    },
  },

  render(ctx: SketchContext, params: Record<string, unknown>): Polyline[] {
    const seed = params.seed as number
    const rows = params.rows as number
    const cols = params.cols as number
    const lineLength = params.lineLength as number

    const random = ctx.createRandom(seed)
    const lines: Polyline[] = []
    const half = lineLength / 2

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Center of each grid cell
        const cx = ((c + 0.5) / cols) * ctx.width
        const cy = ((r + 0.5) / rows) * ctx.height

        // Random rotation via onCircle (returns a point on the perimeter)
        const [dx, dy] = random.onCircle(half)

        lines.push(line(cx - dx, cy - dy, cx + dx, cy + dy))
      }
    }

    return lines
  },
}

export default sketch
