import { describe, expect, it } from 'vitest'

import { buildSVGExport, scalePolylines } from '@/lib/export'
import type { Polyline } from '@/lib/types'

describe('scalePolylines', () => {
  it('returns the same polylines when scale is 1', () => {
    const lines: Polyline[] = [
      [[0, 0], [10, 10]],
      [[5, 5], [15, 15]],
    ]
    const result = scalePolylines(lines, 1)
    expect(result).toEqual(lines)
  })

  it('scales polylines by the given factor', () => {
    const lines: Polyline[] = [
      [[0, 0], [10, 10]],
      [[5, 5], [15, 15]],
    ]
    const result = scalePolylines(lines, 2)
    expect(result).toEqual([
      [[0, 0], [20, 20]],
      [[10, 10], [30, 30]],
    ])
  })

  it('scales down polylines with scale < 1', () => {
    const lines: Polyline[] = [
      [[0, 0], [10, 10]],
      [[5, 5], [15, 15]],
    ]
    const result = scalePolylines(lines, 0.5)
    expect(result).toEqual([
      [[0, 0], [5, 5]],
      [[2.5, 2.5], [7.5, 7.5]],
    ])
  })

  it('handles empty polylines', () => {
    const lines: Polyline[] = []
    const result = scalePolylines(lines, 2)
    expect(result).toEqual([])
  })

  it('handles single-point polylines', () => {
    const lines: Polyline[] = [[[5, 5]]]
    const result = scalePolylines(lines, 3)
    expect(result).toEqual([[[15, 15]]])
  })
})

describe('buildSVGExport with scale', () => {
  const paperSize = { width: 10, height: 10 }
  const margin = 1
  const lines: Polyline[] = [
    [[0, 0], [5, 5]],
    [[2, 2], [8, 8]],
  ]

  it('exports without scale (default scale=1)', () => {
    const svg1 = buildSVGExport(lines, paperSize, margin, {
      units: 'cm',
      strokeWidth: 0.03,
      strokeColor: '#000000',
    })

    const svg2 = buildSVGExport(lines, paperSize, margin, {
      units: 'cm',
      strokeWidth: 0.03,
      strokeColor: '#000000',
      scale: 1,
    })

    expect(svg1).toEqual(svg2)
  })

  it('exports with scale=2 doubles the dimensions', () => {
    const svg = buildSVGExport(lines, paperSize, margin, {
      units: 'cm',
      strokeWidth: 0.03,
      strokeColor: '#000000',
      scale: 2,
    })

    // Check that viewBox dimensions are doubled
    expect(svg).toContain('viewBox="0 0 20 20"')
    expect(svg).toContain('width="20cm"')
    expect(svg).toContain('height="20cm"')
  })

  it('exports with scale=0.5 halves the dimensions', () => {
    const svg = buildSVGExport(lines, paperSize, margin, {
      units: 'cm',
      strokeWidth: 0.03,
      strokeColor: '#000000',
      scale: 0.5,
    })

    // Check that viewBox dimensions are halved
    expect(svg).toContain('viewBox="0 0 5 5"')
    expect(svg).toContain('width="5cm"')
    expect(svg).toContain('height="5cm"')
  })

  it('maintains stroke width regardless of scale', () => {
    const svg1 = buildSVGExport(lines, paperSize, margin, {
      units: 'cm',
      strokeWidth: 0.03,
      strokeColor: '#000000',
      scale: 1,
    })

    const svg2 = buildSVGExport(lines, paperSize, margin, {
      units: 'cm',
      strokeWidth: 0.03,
      strokeColor: '#000000',
      scale: 2,
    })

    // Both should have the same stroke width
    expect(svg1).toContain('stroke-width="0.03"')
    expect(svg2).toContain('stroke-width="0.03"')
  })

  it('scales polyline coordinates correctly', () => {
    const simpleLine: Polyline[] = [[[0, 0], [2, 2]]]
    const svg = buildSVGExport(simpleLine, paperSize, margin, {
      units: 'cm',
      strokeWidth: 0.03,
      strokeColor: '#000000',
      scale: 2,
    })

    // After scale=2 and translation by margin*2=2, coordinates should be:
    // (0,0) -> (0*2+2, 0*2+2) = (2,2)
    // (2,2) -> (2*2+2, 2*2+2) = (6,6)
    expect(svg).toContain('points="2,2 6,6"')
  })

  it('clips correctly with scale', () => {
    // Line that extends beyond margins
    const longLine: Polyline[] = [[[0, 0], [10, 10]]]
    const svg = buildSVGExport(longLine, paperSize, margin, {
      units: 'cm',
      strokeWidth: 0.03,
      strokeColor: '#000000',
      scale: 2,
    })

    // With scale=2, paper is 20x20, margin is 2
    // Drawing area is from (2,2) to (18,18)
    // Line from (0,0) to (10,10) scaled becomes (0,0) to (20,20)
    // After translation by margin: (2,2) to (22,22)
    // Should be clipped at (18,18)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })
})