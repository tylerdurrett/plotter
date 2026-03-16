import type { SketchModule, SketchContext, Polyline } from '@/lib/types'
import { circle } from '@/lib/geometry'
import { PAPER_SIZES } from '@/lib/paper'

const sketch: SketchModule = {
  params: {
    seed: { value: 42, min: 0, max: 9999, step: 1 },
    count: { value: 5, min: 1, max: 20, step: 1 },
    maxRadius: { value: 8, min: 1, max: 15, step: 0.5 },
    margin: { value: 1.5, min: 0, max: 5, step: 0.1 },
    paperSize: {
      value: 'letter',
      options: Object.keys(PAPER_SIZES),
    },
  },

  render(ctx: SketchContext, params: Record<string, unknown>): Polyline[] {
    const count = params.count as number
    const maxRadius = params.maxRadius as number

    const cx = ctx.width / 2
    const cy = ctx.height / 2
    const step = maxRadius / count

    const lines: Polyline[] = []
    for (let i = 1; i <= count; i++) {
      lines.push(circle(cx, cy, step * i))
    }

    return lines
  },
}

export default sketch
