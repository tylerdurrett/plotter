import { describe, expect, it } from 'vitest'

import {
  extractSketchName,
  validateSketchModule,
} from '@/hooks/useSketchLoader'
import type { SketchModule } from '@/lib/types'

describe('extractSketchName', () => {
  it('extracts directory name from a valid glob path', () => {
    expect(
      extractSketchName('../../sketches/2026-03-15-concentric-circles/index.ts'),
    ).toBe('2026-03-15-concentric-circles')
  })

  it('extracts name from a path with different prefix', () => {
    expect(extractSketchName('/abs/sketches/my-sketch/index.ts')).toBe(
      'my-sketch',
    )
  })

  it('throws for an invalid path', () => {
    expect(() => extractSketchName('invalid/path.ts')).toThrow(
      'Invalid sketch path',
    )
  })
})

describe('validateSketchModule', () => {
  it('accepts a valid module with render and params', () => {
    const mod = {
      params: { count: 5 },
      render: () => [],
    }
    const result = validateSketchModule(mod)
    expect(result.params).toEqual({ count: 5 })
    expect(typeof result.render).toBe('function')
  })

  it('accepts a module with a default export', () => {
    const inner: SketchModule = {
      params: { n: 1 },
      render: () => [],
    }
    const mod = { default: inner }
    const result = validateSketchModule(mod as Record<string, unknown>)
    expect(result.params).toEqual({ n: 1 })
  })

  it('accepts a module with optional setup function', () => {
    const mod = {
      params: {},
      render: () => [],
      setup: () => {},
    }
    const result = validateSketchModule(mod)
    expect(typeof result.setup).toBe('function')
  })

  it('throws when render is missing', () => {
    expect(() => validateSketchModule({ params: {} })).toThrow(
      'render() function',
    )
  })

  it('throws when params is missing', () => {
    expect(() => validateSketchModule({ render: () => [] })).toThrow(
      'params object',
    )
  })

  it('throws when params is not an object', () => {
    expect(() =>
      validateSketchModule({ render: () => [], params: 'invalid' }),
    ).toThrow('params object')
  })
})
