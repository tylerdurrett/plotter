import { describe, expect, it } from 'vitest'

import { createSketchContext } from '@/lib/context'

import gridder from '../../../sketches/2026-03-16-gridder/index'

/** Build default params from the sketch's param definitions */
function getDefaultParams(): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(gridder.params)) {
    if (typeof schema === 'object' && schema !== null && 'value' in schema) {
      defaults[key] = (schema as { value: unknown }).value
    } else {
      defaults[key] = schema
    }
  }
  return defaults
}

describe('gridder sketch', () => {
  it('exports a valid SketchModule with params and render', () => {
    expect(gridder.params).toBeDefined()
    expect(typeof gridder.render).toBe('function')
  })

  it('has all expected parameters', () => {
    const keys = Object.keys(gridder.params)
    expect(keys).toContain('seed')
    expect(keys).toContain('numColumns')
    expect(keys).toContain('paperSize')
    expect(keys).toContain('margin')
  })

  it('renders non-empty polylines with default params', () => {
    const ctx = createSketchContext('letter')
    const params = { ...getDefaultParams(), numColumns: 6 }
    const result = gridder.render(ctx, params)

    expect(result.length).toBeGreaterThan(0)
    for (const polyline of result) {
      expect(polyline).toHaveLength(2)
      for (const point of polyline) {
        expect(point).toHaveLength(2)
        expect(typeof point[0]).toBe('number')
        expect(typeof point[1]).toBe('number')
      }
    }
  })

  it('produces exactly numColumns * numRows polylines', () => {
    const ctx = createSketchContext('letter')
    const numColumns = 6
    const params = { ...getDefaultParams(), numColumns }
    const result = gridder.render(ctx, params)

    const squareSize = ctx.width / numColumns
    const numRows = Math.ceil(ctx.height / squareSize)
    expect(result).toHaveLength(numColumns * numRows)
  })

  it('all points are within grid bounds', () => {
    const ctx = createSketchContext('letter')
    const numColumns = 8
    const params = { ...getDefaultParams(), numColumns }
    const result = gridder.render(ctx, params)

    // Grid can extend slightly past canvas height due to Math.ceil on numRows
    const squareSize = ctx.width / numColumns
    const numRows = Math.ceil(ctx.height / squareSize)
    const gridWidth = numColumns * squareSize
    const gridHeight = numRows * squareSize

    for (const polyline of result) {
      for (const [x, y] of polyline) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(gridWidth + 0.001)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(gridHeight + 0.001)
      }
    }
  })

  it('is deterministic — same seed produces identical output', () => {
    const ctx = createSketchContext('letter')
    const params = { ...getDefaultParams(), numColumns: 6 }

    const result1 = gridder.render(ctx, params)
    const result2 = gridder.render(ctx, params)

    expect(result1).toEqual(result2)
  })

  it('different seeds produce different output', () => {
    const ctx = createSketchContext('letter')
    const base = { ...getDefaultParams(), numColumns: 6 }

    const result1 = gridder.render(ctx, { ...base, seed: 42 })
    const result2 = gridder.render(ctx, { ...base, seed: 99 })

    const flat1 = result1.flat()
    const flat2 = result2.flat()
    const same =
      flat1.length === flat2.length &&
      flat1.every((p, i) => p[0] === flat2[i]?.[0] && p[1] === flat2[i]?.[1])
    expect(same).toBe(false)
  })

  it('each polyline is a 2-point line segment', () => {
    const ctx = createSketchContext('letter')
    const params = { ...getDefaultParams(), numColumns: 10 }
    const result = gridder.render(ctx, params)

    for (const polyline of result) {
      expect(polyline).toHaveLength(2)
    }
  })
})
