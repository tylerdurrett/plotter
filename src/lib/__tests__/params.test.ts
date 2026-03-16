import { describe, expect, it } from 'vitest'

import { extractParamValues } from '@/lib/params'

describe('extractParamValues', () => {
  it('extracts value from object-shaped params', () => {
    const params = {
      count: { value: 5, min: 1, max: 20, step: 1 },
      radius: { value: 8, min: 1, max: 15, step: 0.5 },
    }
    expect(extractParamValues(params)).toEqual({ count: 5, radius: 8 })
  })

  it('passes through raw primitive values', () => {
    const params = { opacity: 0.5, name: 'test', enabled: true }
    expect(extractParamValues(params)).toEqual({
      opacity: 0.5,
      name: 'test',
      enabled: true,
    })
  })

  it('handles select-style params with options', () => {
    const params = {
      paperSize: { value: 'letter', options: ['letter', 'a4', 'a3'] },
    }
    expect(extractParamValues(params)).toEqual({ paperSize: 'letter' })
  })

  it('handles mixed param types', () => {
    const params = {
      seed: { value: 42, min: 0, max: 9999, step: 1 },
      scale: 1.0,
      showGrid: { value: true },
    }
    expect(extractParamValues(params)).toEqual({
      seed: 42,
      scale: 1.0,
      showGrid: true,
    })
  })

  it('returns empty object for empty params', () => {
    expect(extractParamValues({})).toEqual({})
  })
})
