import { describe, expect, it } from 'vitest'

import { createSketchContext } from '@/lib/context'

import sketch from '../../../sketches/2026-03-16-spatial-hash-attraction/index'

/** Build default params from the sketch's param definitions */
function getDefaultParams(): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(sketch.params)) {
    if (typeof schema === 'object' && schema !== null && 'value' in schema) {
      defaults[key] = (schema as { value: unknown }).value
    } else {
      defaults[key] = schema
    }
  }
  return defaults
}

describe('spatial-hash-attraction sketch', () => {
  it('exports a valid SketchModule with params and render', () => {
    expect(sketch.params).toBeDefined()
    expect(typeof sketch.render).toBe('function')
  })

  it('has all expected parameters', () => {
    const keys = Object.keys(sketch.params)
    expect(keys).toContain('seed')
    expect(keys).toContain('paperSize')
    expect(keys).toContain('margin')
    expect(keys).toContain('maxFrames')
    expect(keys).toContain('maxVel')
    expect(keys).toContain('cellSize')
    expect(keys).toContain('maxDistFromCenter')
    expect(keys).toContain('centerPull')
    expect(keys).toContain('minDist')
    expect(keys).toContain('separation')
    expect(keys).toContain('noiseStrength')
    expect(keys).toContain('noiseZoom')
  })

  it('renders non-empty polylines with reduced maxFrames', () => {
    const ctx = createSketchContext('letter')
    const params = { ...getDefaultParams(), maxFrames: 500 }
    const result = sketch.render(ctx, params)

    expect(result.length).toBeGreaterThan(0)
    for (const polyline of result) {
      expect(polyline.length).toBeGreaterThan(0)
      for (const point of polyline) {
        expect(point).toHaveLength(2)
        expect(typeof point[0]).toBe('number')
        expect(typeof point[1]).toBe('number')
      }
    }
  })

  it('returns exactly 1 polyline (single fiber path)', () => {
    const ctx = createSketchContext('letter')
    const params = { ...getDefaultParams(), maxFrames: 500 }
    const result = sketch.render(ctx, params)

    expect(result).toHaveLength(1)
  })

  it('polyline length equals maxFrames + 1', () => {
    const ctx = createSketchContext('letter')
    const maxFrames = 200
    const params = { ...getDefaultParams(), maxFrames }
    const result = sketch.render(ctx, params)

    expect(result[0]).toHaveLength(maxFrames + 1)
  })

  it('is deterministic — same seed produces identical output', () => {
    const ctx = createSketchContext('letter')
    const params = { ...getDefaultParams(), maxFrames: 500 }

    const result1 = sketch.render(ctx, params)
    const result2 = sketch.render(ctx, params)

    expect(result1).toEqual(result2)
  })

  it('different seeds produce different output', () => {
    const ctx = createSketchContext('letter')
    const base = { ...getDefaultParams(), maxFrames: 500 }

    const result1 = sketch.render(ctx, { ...base, seed: 42 })
    const result2 = sketch.render(ctx, { ...base, seed: 99 })

    const flat1 = result1.flat()
    const flat2 = result2.flat()
    const same =
      flat1.length === flat2.length &&
      flat1.every((p, i) => p[0] === flat2[i]?.[0] && p[1] === flat2[i]?.[1])
    expect(same).toBe(false)
  })
})
