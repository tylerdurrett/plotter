import type { SketchModule, SketchContext, Polyline } from '@/lib/types'
import { line } from '@/lib/geometry'
import { PAPER_SIZES } from '@/lib/paper'

const sketch: SketchModule = {
  params: {
    seed: { value: 42, min: 0, max: 9999, step: 1 },
    rows: { value: 8, min: 1, max: 40, step: 1 },
    cols: { value: 6, min: 1, max: 40, step: 1 },
    margin: { value: 1.5, min: 0, max: 5, step: 0.1 },
    paperSize: {
      value: 'letter',
      options: Object.keys(PAPER_SIZES),
    },
  },

  render(ctx: SketchContext, params: Record<string, unknown>): Polyline[] {
    const rows = params.rows as number
    const cols = params.cols as number

    const lines: Polyline[] = []

    // Horizontal lines
    for (let i = 0; i <= rows; i++) {
      const y = (i / rows) * ctx.height
      lines.push(line(0, y, ctx.width, y))
    }

    // Vertical lines
    for (let j = 0; j <= cols; j++) {
      const x = (j / cols) * ctx.width
      lines.push(line(x, 0, x, ctx.height))
    }

    return lines
  },
}

export default sketch
