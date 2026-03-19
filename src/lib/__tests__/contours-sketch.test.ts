import { describe, expect, it } from 'vitest'

import { createSketchContext } from '@/lib/context'

// Import the sketch module
import contours from '../../../sketches/2026-03-16-contours/index'

/** Build default params from the sketch's param definitions */
function getDefaultParams(): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(contours.params)) {
    if (typeof schema === 'object' && schema !== null && 'value' in schema) {
      defaults[key] = (schema as { value: unknown }).value
    } else {
      defaults[key] = schema
    }
  }
  return defaults
}

describe('contours sketch', () => {
  it('exports a valid SketchModule with params and render', () => {
    expect(contours.params).toBeDefined()
    expect(typeof contours.render).toBe('function')
  })

  it('has all expected parameters', () => {
    const keys = Object.keys(contours.params)
    expect(keys).toContain('seed')
    expect(keys).toContain('paperSize')
    expect(keys).toContain('margin')
    expect(keys).toContain('xResolution')
    expect(keys).toContain('numLayers')
    expect(keys).toContain('horizon')
    expect(keys).toContain('maxHeight')
    expect(keys).toContain('peakHeight')
    expect(keys).toContain('noiseScale')
    expect(keys).toContain('noise2Multiplier')
    expect(keys).toContain('zDistance')
  })

  it('renders non-empty polylines with default params', () => {
    const ctx = createSketchContext('tabloid')
    const params = { ...getDefaultParams(), numLayers: 20, xResolution: 20 }
    const result = contours.render(ctx, params)

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

  it('is deterministic — same seed produces identical output', () => {
    const ctx = createSketchContext('tabloid')
    const params = { ...getDefaultParams(), numLayers: 10, xResolution: 10 }

    const result1 = contours.render(ctx, params)
    const result2 = contours.render(ctx, params)

    expect(result1).toEqual(result2)
  })

  it('different seeds produce different output', () => {
    const ctx = createSketchContext('tabloid')
    const base = { ...getDefaultParams(), numLayers: 10, xResolution: 10 }

    const result1 = contours.render(ctx, { ...base, seed: 42 })
    const result2 = contours.render(ctx, { ...base, seed: 99 })

    // Flatten to compare — different seeds should produce different points
    const flat1 = result1.flat()
    const flat2 = result2.flat()
    const same = flat1.length === flat2.length &&
      flat1.every((p, i) => p[0] === flat2[i]?.[0] && p[1] === flat2[i]?.[1])
    expect(same).toBe(false)
  })

  it('hidden line removal produces fewer total segments than raw layers', () => {
    const ctx = createSketchContext('tabloid')
    const params = {
      ...getDefaultParams(),
      numLayers: 50,
      xResolution: 30,
      // Ensure enough noise to cause visible occlusion
      noise2Multiplier: 5,
      peakHeight: 10,
    }
    const result = contours.render(ctx, params)

    // Total points in output should be less than numLayers * xResolution
    // because hidden line removal culls occluded points
    const totalPoints = result.reduce((sum, p) => sum + p.length, 0)
    const maxPossiblePoints = 50 * 30
    expect(totalPoints).toBeLessThan(maxPossiblePoints)
  })

  it('returns empty array when numLayers is 0', () => {
    const ctx = createSketchContext('tabloid')
    const params = { ...getDefaultParams(), numLayers: 0 }
    const result = contours.render(ctx, params)
    expect(result).toEqual([])
  })

  it('works with minimum xResolution of 2', () => {
    const ctx = createSketchContext('tabloid')
    const params = { ...getDefaultParams(), numLayers: 5, xResolution: 2 }
    const result = contours.render(ctx, params)
    expect(result.length).toBeGreaterThan(0)
  })
})
