import { describe, expect, it } from 'vitest'

import { createSketchContext } from '@/lib/context'

describe('createSketchContext', () => {
  it('returns correct dimensions for letter portrait (default orientation)', () => {
    const ctx = createSketchContext('letter')
    expect(ctx.width).toBe(21.59)
    expect(ctx.height).toBe(27.94)
  })

  it('returns correct dimensions for a4 landscape', () => {
    const ctx = createSketchContext('a4', 'landscape')
    expect(ctx.width).toBe(29.7)
    expect(ctx.height).toBe(21.0)
  })

  it('margin reduces effective width and height', () => {
    const ctx = createSketchContext('letter', 'portrait', 1.5)
    expect(ctx.width).toBeCloseTo(18.59, 10)
    expect(ctx.height).toBeCloseTo(24.94, 10)
  })

  it('default margin is 0', () => {
    const ctx = createSketchContext('a4')
    expect(ctx.width).toBe(21.0)
    expect(ctx.height).toBe(29.7)
  })

  it('paper metadata contains full paper dimensions, name, and margin', () => {
    const ctx = createSketchContext('letter', 'portrait', 2)
    expect(ctx.paper).toEqual({
      width: 21.59,
      height: 27.94,
      name: 'letter',
      margin: 2,
    })
  })

  it('uses "custom" as paper name for PaperSize objects', () => {
    const ctx = createSketchContext({ width: 15, height: 20 })
    expect(ctx.paper.name).toBe('custom')
  })

  it('landscape swaps paper dimensions in metadata', () => {
    const ctx = createSketchContext('letter', 'landscape', 1)
    expect(ctx.paper.width).toBe(27.94)
    expect(ctx.paper.height).toBe(21.59)
    expect(ctx.width).toBeCloseTo(25.94, 10)
    expect(ctx.height).toBeCloseTo(19.59, 10)
  })

  it('createRandom returns a working seeded random instance', () => {
    const ctx = createSketchContext('a4')
    const rng = ctx.createRandom(42)
    expect(typeof rng.value).toBe('function')
    expect(typeof rng.range).toBe('function')
    expect(typeof rng.noise2D).toBe('function')

    // Determinism: same seed produces same first value
    const a = ctx.createRandom(42).value()
    const b = ctx.createRandom(42).value()
    expect(a).toBe(b)
  })

  it('throws for unknown paper name', () => {
    expect(() => createSketchContext('unknown')).toThrow('Unknown paper size')
  })

  it('throws for negative margin', () => {
    expect(() => createSketchContext('letter', 'portrait', -1)).toThrow(
      'Margin must be non-negative',
    )
  })

  it('throws when margin exceeds paper dimensions', () => {
    // a4 portrait width is 21.0, margin 11 * 2 = 22 > 21
    expect(() => createSketchContext('a4', 'portrait', 11)).toThrow(
      'exceeds paper dimensions',
    )
  })

  it('accepts custom PaperSize with margin', () => {
    const ctx = createSketchContext({ width: 10, height: 15 }, 'portrait', 2)
    expect(ctx.width).toBe(6)
    expect(ctx.height).toBe(11)
    expect(ctx.paper.name).toBe('custom')
  })
})
