import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { parseManifest, computeMapTransform, sampleMap, MapBundle, scatterPoints, traceFlow, traceFlowNoise } from '../maps'
import type { MapManifest, Vec2, TraceOptions, TraceFlowNoiseOptions } from '@/lib/types'
import { createRandom } from '../random'

describe('parseManifest', () => {
  const validManifest = {
    version: 1,
    source_image: '20260318_181701_IMG_9613',
    width: 2316,
    height: 3088,
    created_at: '2026-03-18T23:19:19.599829+00:00',
    maps: [
      {
        filename: 'density_target.bin',
        key: 'density_target',
        dtype: 'float32',
        shape: [3088, 2316],
        value_range: [0.0, 1.0],
        description: 'How dark each region should be — density target for particle placement',
      },
      {
        filename: 'flow_x.bin',
        key: 'flow_x',
        dtype: 'float32',
        shape: [3088, 2316],
        value_range: [-1.0, 1.0],
        description: 'Flow field X component (unit vectors)',
      },
    ],
  }

  it('parses a valid manifest correctly', () => {
    const result = parseManifest(validManifest)
    expect(result.version).toBe(1)
    expect(result.source_image).toBe('20260318_181701_IMG_9613')
    expect(result.width).toBe(2316)
    expect(result.height).toBe(3088)
    expect(result.created_at).toBe('2026-03-18T23:19:19.599829+00:00')
    expect(result.maps).toHaveLength(2)
    expect(result.maps[0].key).toBe('density_target')
    expect(result.maps[1].key).toBe('flow_x')
  })

  it('parses the full tdog-test-1 manifest structure', () => {
    const fullManifest = {
      ...validManifest,
      maps: [
        ...validManifest.maps,
        {
          filename: 'flow_y.bin',
          key: 'flow_y',
          dtype: 'float32',
          shape: [3088, 2316],
          value_range: [-1.0, 1.0],
          description: 'Flow field Y component (unit vectors)',
        },
        {
          filename: 'importance.bin',
          key: 'importance',
          dtype: 'float32',
          shape: [3088, 2316],
          value_range: [0.0, 1.0],
          description: 'Feature and contour combined importance',
        },
        {
          filename: 'coherence.bin',
          key: 'coherence',
          dtype: 'float32',
          shape: [3088, 2316],
          value_range: [0.0, 1.0],
          description: 'Flow field confidence and reliability',
        },
        {
          filename: 'complexity.bin',
          key: 'complexity',
          dtype: 'float32',
          shape: [3088, 2316],
          value_range: [0.0, 1.0],
          description: 'Local image complexity for speed modulation',
        },
        {
          filename: 'flow_speed.bin',
          key: 'flow_speed',
          dtype: 'float32',
          shape: [3088, 2316],
          value_range: [0.0, 1.0],
          description: 'Particle speed scalar derived from complexity',
        },
      ],
    }

    const result = parseManifest(fullManifest)
    expect(result.maps).toHaveLength(7)
    const keys = result.maps.map(m => m.key)
    expect(keys).toEqual([
      'density_target',
      'flow_x',
      'flow_y',
      'importance',
      'coherence',
      'complexity',
      'flow_speed',
    ])
  })

  it('throws error when manifest is not an object', () => {
    expect(() => parseManifest(null)).toThrow('Manifest must be an object')
    expect(() => parseManifest(undefined)).toThrow('Manifest must be an object')
    expect(() => parseManifest('string')).toThrow('Manifest must be an object')
    expect(() => parseManifest(123)).toThrow('Manifest must be an object')
  })

  it('throws error for missing version', () => {
    const manifest = { ...validManifest, version: undefined }
    expect(() => parseManifest(manifest)).toThrow('Manifest version must be a number')
  })

  it('throws error for unsupported version', () => {
    const manifest = { ...validManifest, version: 2 }
    expect(() => parseManifest(manifest)).toThrow('Unsupported manifest version 2, expected 1')
  })

  it('throws error for missing source_image', () => {
    const manifest = { ...validManifest, source_image: undefined }
    expect(() => parseManifest(manifest)).toThrow('Manifest source_image must be a string')
  })

  it('throws error for invalid width', () => {
    const manifest = { ...validManifest, width: 0 }
    expect(() => parseManifest(manifest)).toThrow('Manifest width must be a positive number')

    const manifest2 = { ...validManifest, width: -100 }
    expect(() => parseManifest(manifest2)).toThrow('Manifest width must be a positive number')

    const manifest3 = { ...validManifest, width: 'not a number' }
    expect(() => parseManifest(manifest3)).toThrow('Manifest width must be a positive number')
  })

  it('throws error for invalid height', () => {
    const manifest = { ...validManifest, height: 0 }
    expect(() => parseManifest(manifest)).toThrow('Manifest height must be a positive number')

    const manifest2 = { ...validManifest, height: -100 }
    expect(() => parseManifest(manifest2)).toThrow('Manifest height must be a positive number')
  })

  it('throws error for missing created_at', () => {
    const manifest = { ...validManifest, created_at: undefined }
    expect(() => parseManifest(manifest)).toThrow('Manifest created_at must be a string')
  })

  it('throws error when maps is not an array', () => {
    const manifest = { ...validManifest, maps: 'not an array' }
    expect(() => parseManifest(manifest)).toThrow('Manifest maps must be an array')
  })

  it('throws error for empty maps array', () => {
    const manifest = { ...validManifest, maps: [] }
    expect(() => parseManifest(manifest)).toThrow('Manifest must contain at least one map')
  })

  it('throws error for invalid map entry', () => {
    const manifest = {
      ...validManifest,
      maps: [
        {
          filename: 'test.bin',
          key: 'invalid_key',
          dtype: 'float32',
          shape: [100, 100],
          value_range: [0, 1],
          description: 'test',
        },
      ],
    }
    expect(() => parseManifest(manifest)).toThrow('Invalid map entry at index 0')
  })

  it('throws error for map with missing filename', () => {
    const manifest = {
      ...validManifest,
      maps: [
        {
          key: 'density_target',
          dtype: 'float32',
          shape: [100, 100],
          value_range: [0, 1],
          description: 'test',
        },
      ],
    }
    expect(() => parseManifest(manifest)).toThrow('Invalid map entry at index 0')
  })

  it('throws error for map with invalid shape', () => {
    const manifest = {
      ...validManifest,
      maps: [
        {
          filename: 'test.bin',
          key: 'density_target',
          dtype: 'float32',
          shape: [100],
          value_range: [0, 1],
          description: 'test',
        },
      ],
    }
    expect(() => parseManifest(manifest)).toThrow('Invalid map entry at index 0')
  })

  it('throws error for map with invalid value_range', () => {
    const manifest = {
      ...validManifest,
      maps: [
        {
          filename: 'test.bin',
          key: 'density_target',
          dtype: 'float32',
          shape: [100, 100],
          value_range: [0],
          description: 'test',
        },
      ],
    }
    expect(() => parseManifest(manifest)).toThrow('Invalid map entry at index 0')
  })

  it('validates all valid map keys', () => {
    const validKeys = [
      'density_target',
      'flow_x',
      'flow_y',
      'importance',
      'coherence',
      'complexity',
      'flow_speed',
    ]

    validKeys.forEach(key => {
      const manifest = {
        ...validManifest,
        maps: [
          {
            filename: `${key}.bin`,
            key,
            dtype: 'float32',
            shape: [100, 100],
            value_range: [0, 1],
            description: `Test ${key}`,
          },
        ],
      }
      expect(() => parseManifest(manifest)).not.toThrow()
    })
  })

  it('exports the parsed manifest with correct type', () => {
    const result: MapManifest = parseManifest(validManifest)
    expect(result).toBeDefined()
    expect(result.version).toBe(1)
  })
})

describe('computeMapTransform', () => {
  const letterPaper = { width: 21.59, height: 27.94 }
  const tdogTestMap = { width: 2316, height: 3088 }

  describe('fit mode', () => {
    it('scales portrait map to fit portrait paper (taller map)', () => {
      const transform = computeMapTransform(
        tdogTestMap.width,
        tdogTestMap.height,
        letterPaper.width,
        letterPaper.height,
        'fit',
      )

      const expectedScale = letterPaper.height / tdogTestMap.height
      expect(transform.scale).toBeCloseTo(expectedScale, 6)
      expect(transform.offsetY).toBeCloseTo(0, 6)

      const expectedOffsetX = (letterPaper.width - tdogTestMap.width * expectedScale) / 2
      expect(transform.offsetX).toBeCloseTo(expectedOffsetX, 6)
    })

    it('scales landscape map to fit portrait paper (wider map)', () => {
      const wideMap = { width: 4000, height: 2000 }
      const transform = computeMapTransform(
        wideMap.width,
        wideMap.height,
        letterPaper.width,
        letterPaper.height,
        'fit',
      )

      const expectedScale = letterPaper.width / wideMap.width
      expect(transform.scale).toBeCloseTo(expectedScale, 6)
      expect(transform.offsetX).toBeCloseTo(0, 6)

      const expectedOffsetY = (letterPaper.height - wideMap.height * expectedScale) / 2
      expect(transform.offsetY).toBeCloseTo(expectedOffsetY, 6)
    })

    it('scales square map to fit portrait paper', () => {
      const squareMap = { width: 3000, height: 3000 }
      const transform = computeMapTransform(
        squareMap.width,
        squareMap.height,
        letterPaper.width,
        letterPaper.height,
        'fit',
      )

      const expectedScale = letterPaper.width / squareMap.width
      expect(transform.scale).toBeCloseTo(expectedScale, 6)
      expect(transform.offsetX).toBeCloseTo(0, 6)

      const expectedOffsetY = (letterPaper.height - squareMap.height * expectedScale) / 2
      expect(transform.offsetY).toBeCloseTo(expectedOffsetY, 6)
    })

    it('handles same aspect ratio with no offset', () => {
      const sameAspectMap = { width: 2159, height: 2794 }
      const transform = computeMapTransform(
        sameAspectMap.width,
        sameAspectMap.height,
        letterPaper.width,
        letterPaper.height,
        'fit',
      )

      const expectedScale = letterPaper.width / sameAspectMap.width
      expect(transform.scale).toBeCloseTo(expectedScale, 6)
      expect(transform.offsetX).toBeCloseTo(0, 6)
      expect(transform.offsetY).toBeCloseTo(0, 6)
    })

    it('scales tiny map to fit large paper', () => {
      const tinyMap = { width: 100, height: 100 }
      const transform = computeMapTransform(
        tinyMap.width,
        tinyMap.height,
        letterPaper.width,
        letterPaper.height,
        'fit',
      )

      const expectedScale = letterPaper.width / tinyMap.width
      expect(transform.scale).toBeCloseTo(expectedScale, 6)
      expect(transform.offsetX).toBeCloseTo(0, 6)

      const expectedOffsetY = (letterPaper.height - tinyMap.height * expectedScale) / 2
      expect(transform.offsetY).toBeCloseTo(expectedOffsetY, 6)
    })
  })

  describe('cover mode', () => {
    it('scales portrait map to cover portrait paper (taller map)', () => {
      const transform = computeMapTransform(
        tdogTestMap.width,
        tdogTestMap.height,
        letterPaper.width,
        letterPaper.height,
        'cover',
      )

      const expectedScale = letterPaper.width / tdogTestMap.width
      expect(transform.scale).toBeCloseTo(expectedScale, 6)
      expect(transform.offsetX).toBeCloseTo(0, 6)

      const expectedOffsetY = (letterPaper.height - tdogTestMap.height * expectedScale) / 2
      expect(transform.offsetY).toBeCloseTo(expectedOffsetY, 6)
      expect(transform.offsetY).toBeLessThan(0)
    })

    it('scales landscape map to cover portrait paper (wider map)', () => {
      const wideMap = { width: 4000, height: 2000 }
      const transform = computeMapTransform(
        wideMap.width,
        wideMap.height,
        letterPaper.width,
        letterPaper.height,
        'cover',
      )

      const expectedScale = letterPaper.height / wideMap.height
      expect(transform.scale).toBeCloseTo(expectedScale, 6)
      expect(transform.offsetY).toBeCloseTo(0, 6)

      const expectedOffsetX = (letterPaper.width - wideMap.width * expectedScale) / 2
      expect(transform.offsetX).toBeCloseTo(expectedOffsetX, 6)
      expect(transform.offsetX).toBeLessThan(0)
    })

    it('scales square map to cover portrait paper', () => {
      const squareMap = { width: 3000, height: 3000 }
      const transform = computeMapTransform(
        squareMap.width,
        squareMap.height,
        letterPaper.width,
        letterPaper.height,
        'cover',
      )

      const expectedScale = letterPaper.height / squareMap.height
      expect(transform.scale).toBeCloseTo(expectedScale, 6)
      expect(transform.offsetY).toBeCloseTo(0, 6)

      const expectedOffsetX = (letterPaper.width - squareMap.width * expectedScale) / 2
      expect(transform.offsetX).toBeCloseTo(expectedOffsetX, 6)
      expect(transform.offsetX).toBeLessThan(0)
    })

    it('handles same aspect ratio identically to fit mode', () => {
      const sameAspectMap = { width: 2159, height: 2794 }
      const fitTransform = computeMapTransform(
        sameAspectMap.width,
        sameAspectMap.height,
        letterPaper.width,
        letterPaper.height,
        'fit',
      )
      const coverTransform = computeMapTransform(
        sameAspectMap.width,
        sameAspectMap.height,
        letterPaper.width,
        letterPaper.height,
        'cover',
      )

      expect(coverTransform.scale).toBeCloseTo(fitTransform.scale, 6)
      expect(coverTransform.offsetX).toBeCloseTo(fitTransform.offsetX, 6)
      expect(coverTransform.offsetY).toBeCloseTo(fitTransform.offsetY, 6)
    })

    it('scales tiny map to cover large paper', () => {
      const tinyMap = { width: 100, height: 100 }
      const transform = computeMapTransform(
        tinyMap.width,
        tinyMap.height,
        letterPaper.width,
        letterPaper.height,
        'cover',
      )

      const expectedScale = letterPaper.height / tinyMap.height
      expect(transform.scale).toBeCloseTo(expectedScale, 6)
      expect(transform.offsetY).toBeCloseTo(0, 6)

      const expectedOffsetX = (letterPaper.width - tinyMap.width * expectedScale) / 2
      expect(transform.offsetX).toBeCloseTo(expectedOffsetX, 6)
      expect(transform.offsetX).toBeLessThan(0)
    })
  })

  describe('error handling', () => {
    it('throws error for zero map width', () => {
      expect(() =>
        computeMapTransform(0, 1000, letterPaper.width, letterPaper.height, 'fit'),
      ).toThrow('Invalid map dimensions: 0×1000')
    })

    it('throws error for negative map height', () => {
      expect(() =>
        computeMapTransform(1000, -500, letterPaper.width, letterPaper.height, 'fit'),
      ).toThrow('Invalid map dimensions: 1000×-500')
    })

    it('throws error for zero drawing width', () => {
      expect(() =>
        computeMapTransform(tdogTestMap.width, tdogTestMap.height, 0, letterPaper.height, 'fit'),
      ).toThrow('Invalid drawing dimensions: 0×27.94')
    })

    it('throws error for negative drawing height', () => {
      expect(() =>
        computeMapTransform(tdogTestMap.width, tdogTestMap.height, letterPaper.width, -10, 'fit'),
      ).toThrow('Invalid drawing dimensions: 21.59×-10')
    })
  })

  describe('coordinate transformation verification', () => {
    it('fit mode: map corners map to expected drawing positions', () => {
      const mapW = 2000
      const mapH = 3000
      const drawW = 20
      const drawH = 30

      const transform = computeMapTransform(mapW, mapH, drawW, drawH, 'fit')

      const topLeftX = 0 * transform.scale + transform.offsetX
      const topLeftY = 0 * transform.scale + transform.offsetY
      const bottomRightX = mapW * transform.scale + transform.offsetX
      const bottomRightY = mapH * transform.scale + transform.offsetY

      expect(topLeftX).toBeGreaterThanOrEqual(0)
      expect(topLeftY).toBeGreaterThanOrEqual(0)
      expect(bottomRightX).toBeLessThanOrEqual(drawW)
      expect(bottomRightY).toBeLessThanOrEqual(drawH)
    })

    it('cover mode: drawing corners are within map bounds', () => {
      const mapW = 3000
      const mapH = 2000
      const drawW = 20
      const drawH = 30

      const transform = computeMapTransform(mapW, mapH, drawW, drawH, 'cover')

      const drawTopLeftInMapX = (0 - transform.offsetX) / transform.scale
      const drawTopLeftInMapY = (0 - transform.offsetY) / transform.scale
      const drawBottomRightInMapX = (drawW - transform.offsetX) / transform.scale
      const drawBottomRightInMapY = (drawH - transform.offsetY) / transform.scale

      expect(drawTopLeftInMapX).toBeGreaterThanOrEqual(0)
      expect(drawTopLeftInMapY).toBeGreaterThanOrEqual(0)
      expect(drawBottomRightInMapX).toBeLessThanOrEqual(mapW)
      expect(drawBottomRightInMapY).toBeLessThanOrEqual(mapH)
    })
  })
})

describe('sampleMap', () => {
  // Create a simple 4x4 test grid with predictable values
  // Values are set to row * 10 + col for easy verification
  const create4x4Grid = (): Float32Array => {
    return new Float32Array([
      0, 1, 2, 3,      // row 0
      10, 11, 12, 13,  // row 1
      20, 21, 22, 23,  // row 2
      30, 31, 32, 33,  // row 3
    ])
  }

  describe('exact integer coordinates', () => {
    it('returns exact pixel values at integer coordinates', () => {
      const data = create4x4Grid()

      // Test each pixel center
      expect(sampleMap(data, 4, 4, 0, 0)).toBe(0)
      expect(sampleMap(data, 4, 4, 1, 0)).toBe(1)
      expect(sampleMap(data, 4, 4, 2, 0)).toBe(2)
      expect(sampleMap(data, 4, 4, 3, 0)).toBe(3)

      expect(sampleMap(data, 4, 4, 0, 1)).toBe(10)
      expect(sampleMap(data, 4, 4, 1, 1)).toBe(11)
      expect(sampleMap(data, 4, 4, 2, 1)).toBe(12)
      expect(sampleMap(data, 4, 4, 3, 1)).toBe(13)

      expect(sampleMap(data, 4, 4, 0, 2)).toBe(20)
      expect(sampleMap(data, 4, 4, 1, 2)).toBe(21)
      expect(sampleMap(data, 4, 4, 2, 2)).toBe(22)
      expect(sampleMap(data, 4, 4, 3, 2)).toBe(23)

      expect(sampleMap(data, 4, 4, 0, 3)).toBe(30)
      expect(sampleMap(data, 4, 4, 1, 3)).toBe(31)
      expect(sampleMap(data, 4, 4, 2, 3)).toBe(32)
      expect(sampleMap(data, 4, 4, 3, 3)).toBe(33)
    })
  })

  describe('bilinear interpolation', () => {
    it('interpolates correctly at (0.5, 0.5) between four pixels', () => {
      const data = create4x4Grid()

      // Sample at (0.5, 0.5) - should average pixels (0,0), (1,0), (0,1), (1,1)
      // Values are 0, 1, 10, 11
      // Bilinear: (0+1+10+11)/4 = 5.5
      const result = sampleMap(data, 4, 4, 0.5, 0.5)
      expect(result).toBeCloseTo(5.5, 6)
    })

    it('interpolates correctly at (1.5, 1.5) between four pixels', () => {
      const data = create4x4Grid()

      // Sample at (1.5, 1.5) - should average pixels (1,1), (2,1), (1,2), (2,2)
      // Values are 11, 12, 21, 22
      // Bilinear: (11+12+21+22)/4 = 16.5
      const result = sampleMap(data, 4, 4, 1.5, 1.5)
      expect(result).toBeCloseTo(16.5, 6)
    })

    it('interpolates correctly with non-uniform weights', () => {
      const data = create4x4Grid()

      // Sample at (0.25, 0.75) - closer to bottom-left
      // Pixels: (0,0)=0, (1,0)=1, (0,1)=10, (1,1)=11
      // fx = 0.25, fy = 0.75
      // Top row: 0 * 0.75 + 1 * 0.25 = 0.25
      // Bottom row: 10 * 0.75 + 11 * 0.25 = 10.25
      // Final: 0.25 * 0.25 + 10.25 * 0.75 = 7.75
      const result = sampleMap(data, 4, 4, 0.25, 0.75)
      expect(result).toBeCloseTo(7.75, 6)
    })

    it('interpolates correctly along horizontal edge', () => {
      const data = create4x4Grid()

      // Sample at (0.5, 0) - between pixels (0,0) and (1,0)
      // Should be average of 0 and 1 = 0.5
      const result = sampleMap(data, 4, 4, 0.5, 0)
      expect(result).toBeCloseTo(0.5, 6)
    })

    it('interpolates correctly along vertical edge', () => {
      const data = create4x4Grid()

      // Sample at (0, 0.5) - between pixels (0,0) and (0,1)
      // Should be average of 0 and 10 = 5
      const result = sampleMap(data, 4, 4, 0, 0.5)
      expect(result).toBeCloseTo(5, 6)
    })
  })

  describe('edge clamping', () => {
    it('clamps negative x coordinates to 0', () => {
      const data = create4x4Grid()

      expect(sampleMap(data, 4, 4, -1, 0)).toBe(0)  // Same as (0, 0)
      expect(sampleMap(data, 4, 4, -10, 1)).toBe(10)  // Same as (0, 1)
    })

    it('clamps negative y coordinates to 0', () => {
      const data = create4x4Grid()

      expect(sampleMap(data, 4, 4, 0, -1)).toBe(0)  // Same as (0, 0)
      expect(sampleMap(data, 4, 4, 1, -10)).toBe(1)  // Same as (1, 0)
    })

    it('clamps x coordinates beyond width to width-1', () => {
      const data = create4x4Grid()

      expect(sampleMap(data, 4, 4, 4, 0)).toBe(3)  // Same as (3, 0)
      expect(sampleMap(data, 4, 4, 10, 1)).toBe(13)  // Same as (3, 1)
    })

    it('clamps y coordinates beyond height to height-1', () => {
      const data = create4x4Grid()

      expect(sampleMap(data, 4, 4, 0, 4)).toBe(30)  // Same as (0, 3)
      expect(sampleMap(data, 4, 4, 1, 10)).toBe(31)  // Same as (1, 3)
    })

    it('clamps both x and y when out of bounds', () => {
      const data = create4x4Grid()

      expect(sampleMap(data, 4, 4, -5, -5)).toBe(0)  // Same as (0, 0)
      expect(sampleMap(data, 4, 4, 10, 10)).toBe(33)  // Same as (3, 3)
    })
  })

  describe('edge interpolation', () => {
    it('interpolates correctly along right edge', () => {
      const data = create4x4Grid()

      // Sample at (3, 0.5) - right edge, between rows 0 and 1
      // Should interpolate between 3 and 13
      const result = sampleMap(data, 4, 4, 3, 0.5)
      expect(result).toBeCloseTo(8, 6)
    })

    it('interpolates correctly along bottom edge', () => {
      const data = create4x4Grid()

      // Sample at (0.5, 3) - bottom edge, between columns 0 and 1
      // Should interpolate between 30 and 31
      const result = sampleMap(data, 4, 4, 0.5, 3)
      expect(result).toBeCloseTo(30.5, 6)
    })

    it('returns exact value at bottom-right corner', () => {
      const data = create4x4Grid()

      // Sample at (3, 3) - exact bottom-right corner
      expect(sampleMap(data, 4, 4, 3, 3)).toBe(33)
    })

    it('handles fractional coordinates near right edge', () => {
      const data = create4x4Grid()

      // Sample at (2.8, 0) - close to right edge but not on it
      // Should interpolate between pixels (2,0)=2 and (3,0)=3
      // fx = 0.8, so result = 2 * 0.2 + 3 * 0.8 = 2.8
      const result = sampleMap(data, 4, 4, 2.8, 0)
      expect(result).toBeCloseTo(2.8, 6)
    })

    it('handles fractional coordinates near bottom edge', () => {
      const data = create4x4Grid()

      // Sample at (0, 2.8) - close to bottom edge but not on it
      // Should interpolate between pixels (0,2)=20 and (0,3)=30
      // fy = 0.8, so result = 20 * 0.2 + 30 * 0.8 = 28
      const result = sampleMap(data, 4, 4, 0, 2.8)
      expect(result).toBeCloseTo(28, 6)
    })
  })

  describe('special cases', () => {
    it('handles 1x1 grid', () => {
      const data = new Float32Array([42])

      // Any coordinate should return the single value
      expect(sampleMap(data, 1, 1, 0, 0)).toBe(42)
      expect(sampleMap(data, 1, 1, 0.5, 0.5)).toBe(42)
      expect(sampleMap(data, 1, 1, -1, -1)).toBe(42)
      expect(sampleMap(data, 1, 1, 10, 10)).toBe(42)
    })

    it('handles 2x2 grid with uniform values', () => {
      const data = new Float32Array([5, 5, 5, 5])

      // Any coordinate should return 5
      expect(sampleMap(data, 2, 2, 0, 0)).toBe(5)
      expect(sampleMap(data, 2, 2, 0.5, 0.5)).toBe(5)
      expect(sampleMap(data, 2, 2, 1, 1)).toBe(5)
      expect(sampleMap(data, 2, 2, 0.25, 0.75)).toBe(5)
    })

    it('handles gradient data correctly', () => {
      // Create a horizontal gradient from 0 to 1
      const data = new Float32Array([
        0, 0.33, 0.67, 1,
        0, 0.33, 0.67, 1,
        0, 0.33, 0.67, 1,
        0, 0.33, 0.67, 1,
      ])

      // Sample along the middle row at various x positions
      expect(sampleMap(data, 4, 4, 0, 1.5)).toBeCloseTo(0, 6)
      expect(sampleMap(data, 4, 4, 1, 1.5)).toBeCloseTo(0.33, 2)
      expect(sampleMap(data, 4, 4, 2, 1.5)).toBeCloseTo(0.67, 2)
      expect(sampleMap(data, 4, 4, 3, 1.5)).toBeCloseTo(1, 6)

      // Sample at intermediate position
      expect(sampleMap(data, 4, 4, 1.5, 1.5)).toBeCloseTo(0.5, 2)
    })

    it('preserves exact values at all integer positions in larger grid', () => {
      const width = 10
      const height = 10
      const data = new Float32Array(width * height)

      // Fill with unique values
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          data[y * width + x] = y * 100 + x
        }
      }

      // Test sampling at all integer positions
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const expected = y * 100 + x
          const actual = sampleMap(data, width, height, x, y)
          expect(actual).toBe(expected)
        }
      }
    })
  })
})

describe('MapBundle', () => {
  // Mock fetch for tests
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Create a test manifest
  const createTestManifest = (): MapManifest => ({
    version: 1,
    source_image: 'test_image',
    width: 4,
    height: 4,
    created_at: '2024-01-01T00:00:00Z',
    maps: [
      {
        filename: 'density_target.bin',
        key: 'density_target',
        dtype: 'float32',
        shape: [4, 4],
        value_range: [0.0, 1.0],
        description: 'Test density map',
      },
      {
        filename: 'flow_x.bin',
        key: 'flow_x',
        dtype: 'float32',
        shape: [4, 4],
        value_range: [-1.0, 1.0],
        description: 'Test flow X',
      },
      {
        filename: 'flow_y.bin',
        key: 'flow_y',
        dtype: 'float32',
        shape: [4, 4],
        value_range: [-1.0, 1.0],
        description: 'Test flow Y',
      },
      {
        filename: 'complexity.bin',
        key: 'complexity',
        dtype: 'float32',
        shape: [4, 4],
        value_range: [0.0, 1.0],
        description: 'Test complexity',
      },
    ],
  })

  // Create test binary data (4x4 grid)
  const createTestBinaryData = (offset = 0): ArrayBuffer => {
    const data = new Float32Array(16)
    for (let i = 0; i < 16; i++) {
      data[i] = (i + offset) / 16
    }
    return data.buffer
  }

  // Helper to create successful JSON response
  const jsonResponse = (data: unknown): Response => {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Helper to create successful binary response
  const binaryResponse = (data: ArrayBuffer): Response => {
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    })
  }

  describe('MapBundle.load', () => {
    it('fetches only manifest.json on load', async () => {
      const manifest = createTestManifest()
      fetchMock.mockResolvedValueOnce(jsonResponse(manifest))

      const bundle = await MapBundle.load('/maps/test', 10, 10, 'fit')

      // Should have fetched only the manifest
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith('/maps/test/manifest.json')

      // Should have the manifest accessible
      expect(bundle.manifest).toEqual(manifest)
      expect(bundle.mapWidth).toBe(4)
      expect(bundle.mapHeight).toBe(4)
    })

    it('computes transform for fit mode', async () => {
      const manifest = createTestManifest()
      fetchMock.mockResolvedValueOnce(jsonResponse(manifest))

      const bundle = await MapBundle.load('/maps/test', 20, 20, 'fit')

      // With a 4x4 map on 20x20 paper in fit mode, scale should be 5
      // Verify by sampling - if transform is correct, sampling should work
      expect(bundle.mapWidth).toBe(4)
      expect(bundle.mapHeight).toBe(4)
    })

    it('computes transform for cover mode', async () => {
      const manifest = createTestManifest()
      fetchMock.mockResolvedValueOnce(jsonResponse(manifest))

      const bundle = await MapBundle.load('/maps/test', 20, 30, 'cover')

      // Bundle should be created with cover mode transform
      expect(bundle.manifest).toEqual(manifest)
    })

    it('throws error on failed manifest fetch', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 404, statusText: 'Not Found' }),
      )

      await expect(
        MapBundle.load('/maps/missing', 10, 10, 'fit'),
      ).rejects.toThrow('Failed to load manifest from /maps/missing/manifest.json: 404 Not Found')
    })

    it('throws error on invalid manifest JSON', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ invalid: 'manifest' }))

      await expect(MapBundle.load('/maps/test', 10, 10, 'fit')).rejects.toThrow()
    })
  })

  describe('ensureMap', () => {
    it('fetches .bin file on first call', async () => {
      const manifest = createTestManifest()
      const densityData = createTestBinaryData()

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(densityData))

      const bundle = await MapBundle.load('/maps/test', 10, 10, 'fit')

      // Initially only manifest was fetched
      expect(fetchMock).toHaveBeenCalledTimes(1)

      // Ensure density map
      await bundle.ensureMap('density_target')

      // Should have fetched the .bin file
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenNthCalledWith(2, '/maps/test/density_target.bin')
    })

    it('does not re-fetch on subsequent calls', async () => {
      const manifest = createTestManifest()
      const densityData = createTestBinaryData()

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(densityData))

      const bundle = await MapBundle.load('/maps/test', 10, 10, 'fit')

      // Ensure density map twice
      await bundle.ensureMap('density_target')
      await bundle.ensureMap('density_target')

      // Should have fetched only once
      expect(fetchMock).toHaveBeenCalledTimes(2) // manifest + one .bin file
    })

    it('fetches multiple different maps independently', async () => {
      const manifest = createTestManifest()
      const densityData = createTestBinaryData(0)
      const flowXData = createTestBinaryData(16)
      const flowYData = createTestBinaryData(32)

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(densityData))
        .mockResolvedValueOnce(binaryResponse(flowXData))
        .mockResolvedValueOnce(binaryResponse(flowYData))

      const bundle = await MapBundle.load('/maps/test', 10, 10, 'fit')

      await bundle.ensureMap('density_target')
      await bundle.ensureMap('flow_x')
      await bundle.ensureMap('flow_y')

      expect(fetchMock).toHaveBeenCalledTimes(4) // manifest + 3 maps
      expect(fetchMock).toHaveBeenCalledWith('/maps/test/density_target.bin')
      expect(fetchMock).toHaveBeenCalledWith('/maps/test/flow_x.bin')
      expect(fetchMock).toHaveBeenCalledWith('/maps/test/flow_y.bin')
    })

    it('throws error for non-existent map key', async () => {
      const manifest = createTestManifest()
      fetchMock.mockResolvedValueOnce(jsonResponse(manifest))

      const bundle = await MapBundle.load('/maps/test', 10, 10, 'fit')

      // @ts-expect-error - testing invalid key
      await expect(bundle.ensureMap('invalid_key')).rejects.toThrow(
        "Map key 'invalid_key' not found in manifest",
      )
    })

    it('throws error on failed .bin fetch', async () => {
      const manifest = createTestManifest()
      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(
          new Response(null, { status: 404, statusText: 'Not Found' }),
        )

      const bundle = await MapBundle.load('/maps/test', 10, 10, 'fit')

      await expect(bundle.ensureMap('density_target')).rejects.toThrow(
        "Failed to load map 'density_target' from /maps/test/density_target.bin: 404 Not Found",
      )
    })

    it('validates binary data size', async () => {
      const manifest = createTestManifest()
      // Wrong size data (8 values instead of 16)
      const wrongSizeData = new Float32Array(8).buffer

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(wrongSizeData))

      const bundle = await MapBundle.load('/maps/test', 10, 10, 'fit')

      await expect(bundle.ensureMap('density_target')).rejects.toThrow(
        "Map 'density_target' has incorrect size: expected 16 values, got 8",
      )
    })
  })

  describe('sample', () => {
    it('samples loaded map with correct bilinear interpolation', async () => {
      const manifest = createTestManifest()
      // Create predictable data: value = y * 4 + x
      const data = new Float32Array([
        0, 1, 2, 3,
        4, 5, 6, 7,
        8, 9, 10, 11,
        12, 13, 14, 15,
      ])

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(data.buffer))

      const bundle = await MapBundle.load('/maps/test', 4, 4, 'fit')
      await bundle.ensureMap('density_target')

      // With 4x4 map on 4x4 drawing area, scale is 1:1, no offset
      // So cm coords map directly to pixel coords
      expect(bundle.sample('density_target', 0, 0)).toBe(0)
      expect(bundle.sample('density_target', 1, 0)).toBe(1)
      expect(bundle.sample('density_target', 0, 1)).toBe(4)
      expect(bundle.sample('density_target', 3, 3)).toBe(15)

      // Test interpolation at (0.5, 0.5)
      // Should average pixels 0, 1, 4, 5 = (0+1+4+5)/4 = 2.5
      expect(bundle.sample('density_target', 0.5, 0.5)).toBeCloseTo(2.5, 6)
    })

    it('transforms coordinates based on fit mode', async () => {
      const manifest = createTestManifest()
      const data = new Float32Array(16).fill(1.0) // All values are 1.0

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(data.buffer))

      // 4x4 map on 8x8 drawing area - scale should be 2, offset 0
      const bundle = await MapBundle.load('/maps/test', 8, 8, 'fit')
      await bundle.ensureMap('density_target')

      // All samples should return 1.0 since all pixels are 1.0
      expect(bundle.sample('density_target', 4, 4)).toBe(1.0)
      expect(bundle.sample('density_target', 0, 0)).toBe(1.0)
      expect(bundle.sample('density_target', 7.9, 7.9)).toBe(1.0)
    })

    it('returns 0 for unmapped regions in fit mode', async () => {
      const manifest = createTestManifest()
      const data = new Float32Array(16).fill(1.0)

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(data.buffer))

      // 4x4 map on 8x12 drawing area (wider than tall)
      // Map will fit to height, leaving gaps on sides
      const bundle = await MapBundle.load('/maps/test', 12, 8, 'fit')
      await bundle.ensureMap('density_target')

      // Sample outside the mapped region should return 0
      expect(bundle.sample('density_target', 0, 4)).toBe(0) // Left of map
      expect(bundle.sample('density_target', 11.9, 4)).toBe(0) // Right of map

      // Sample inside the mapped region should return 1
      expect(bundle.sample('density_target', 6, 4)).toBe(1.0) // Center
    })

    it('throws error when sampling unloaded map', async () => {
      const manifest = createTestManifest()
      fetchMock.mockResolvedValueOnce(jsonResponse(manifest))

      const bundle = await MapBundle.load('/maps/test', 10, 10, 'fit')

      // Try to sample without ensuring the map
      expect(() => bundle.sample('density_target', 5, 5)).toThrow(
        "Map 'density_target' not loaded. Call ensureMap('density_target') first.",
      )
    })

    it('handles cover mode coordinate transformation', async () => {
      const manifest = createTestManifest()
      // Create gradient data for testing
      const data = new Float32Array([
        0, 0.25, 0.5, 0.75,
        0, 0.25, 0.5, 0.75,
        0, 0.25, 0.5, 0.75,
        0, 0.25, 0.5, 0.75,
      ])

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(data.buffer))

      // 4x4 map on 2x8 drawing area (taller than wide)
      // In cover mode, map will scale to width, cropping top/bottom
      const bundle = await MapBundle.load('/maps/test', 2, 8, 'cover')
      await bundle.ensureMap('density_target')

      // Sample in the visible region
      const value = bundle.sample('density_target', 1, 4)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(0.75)
    })
  })

  describe('sampleFlow', () => {
    it('samples both flow_x and flow_y together', async () => {
      const manifest = createTestManifest()
      const flowXData = new Float32Array(16).fill(0.5)
      const flowYData = new Float32Array(16).fill(-0.5)

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(flowXData.buffer))
        .mockResolvedValueOnce(binaryResponse(flowYData.buffer))

      const bundle = await MapBundle.load('/maps/test', 4, 4, 'fit')
      await bundle.ensureMap('flow_x')
      await bundle.ensureMap('flow_y')

      const flow = bundle.sampleFlow(2, 2)
      expect(flow).toEqual([0.5, -0.5])
    })

    it('throws error if flow_x not loaded', async () => {
      const manifest = createTestManifest()
      const flowYData = new Float32Array(16).fill(-0.5)

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(flowYData.buffer))

      const bundle = await MapBundle.load('/maps/test', 4, 4, 'fit')
      await bundle.ensureMap('flow_y')

      expect(() => bundle.sampleFlow(2, 2)).toThrow(
        "Map 'flow_x' not loaded. Call ensureMap('flow_x') first.",
      )
    })

    it('throws error if flow_y not loaded', async () => {
      const manifest = createTestManifest()
      const flowXData = new Float32Array(16).fill(0.5)

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(flowXData.buffer))

      const bundle = await MapBundle.load('/maps/test', 4, 4, 'fit')
      await bundle.ensureMap('flow_x')

      expect(() => bundle.sampleFlow(2, 2)).toThrow(
        "Map 'flow_y' not loaded. Call ensureMap('flow_y') first.",
      )
    })

    it('returns Vec2 with interpolated flow values', async () => {
      const manifest = createTestManifest()
      // Create varying flow data
      const flowXData = new Float32Array([
        0, 0.25, 0.5, 0.75,
        0, 0.25, 0.5, 0.75,
        0, 0.25, 0.5, 0.75,
        0, 0.25, 0.5, 0.75,
      ])
      const flowYData = new Float32Array([
        0, 0, 0, 0,
        0.25, 0.25, 0.25, 0.25,
        0.5, 0.5, 0.5, 0.5,
        0.75, 0.75, 0.75, 0.75,
      ])

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(flowXData.buffer))
        .mockResolvedValueOnce(binaryResponse(flowYData.buffer))

      const bundle = await MapBundle.load('/maps/test', 4, 4, 'fit')
      await bundle.ensureMap('flow_x')
      await bundle.ensureMap('flow_y')

      // Sample at (1.5, 1.5) - should interpolate
      const flow = bundle.sampleFlow(1.5, 1.5)
      expect(flow[0]).toBeCloseTo(0.375, 6) // Between 0.25 and 0.5
      expect(flow[1]).toBeCloseTo(0.375, 6) // Between 0.25 and 0.5
    })
  })

  describe('readonly properties', () => {
    it('exposes manifest as readonly', async () => {
      const manifest = createTestManifest()
      fetchMock.mockResolvedValueOnce(jsonResponse(manifest))

      const bundle = await MapBundle.load('/maps/test', 10, 10, 'fit')

      expect(bundle.manifest).toEqual(manifest)
      expect(bundle.manifest.version).toBe(1)
      expect(bundle.manifest.maps).toHaveLength(4)
    })

    it('exposes mapWidth and mapHeight', async () => {
      const manifest = createTestManifest()
      fetchMock.mockResolvedValueOnce(jsonResponse(manifest))

      const bundle = await MapBundle.load('/maps/test', 10, 10, 'fit')

      expect(bundle.mapWidth).toBe(4)
      expect(bundle.mapHeight).toBe(4)
    })
  })

  describe('integration tests', () => {
    it('complete workflow: load, ensure, sample multiple maps', async () => {
      const manifest = createTestManifest()
      const densityData = new Float32Array(16)
      const flowXData = new Float32Array(16)
      const flowYData = new Float32Array(16)
      const complexityData = new Float32Array(16)

      // Fill with test patterns
      for (let i = 0; i < 16; i++) {
        densityData[i] = i / 16
        flowXData[i] = Math.cos(i * Math.PI / 8)
        flowYData[i] = Math.sin(i * Math.PI / 8)
        complexityData[i] = 1 - i / 16
      }

      fetchMock
        .mockResolvedValueOnce(jsonResponse(manifest))
        .mockResolvedValueOnce(binaryResponse(densityData.buffer))
        .mockResolvedValueOnce(binaryResponse(flowXData.buffer))
        .mockResolvedValueOnce(binaryResponse(flowYData.buffer))
        .mockResolvedValueOnce(binaryResponse(complexityData.buffer))

      const bundle = await MapBundle.load('/maps/test', 8, 8, 'fit')

      // Load all maps
      await bundle.ensureMap('density_target')
      await bundle.ensureMap('flow_x')
      await bundle.ensureMap('flow_y')
      await bundle.ensureMap('complexity')

      // Sample various maps
      const density = bundle.sample('density_target', 4, 4)
      const flow = bundle.sampleFlow(4, 4)
      const complexity = bundle.sample('complexity', 4, 4)

      // All should return valid values
      expect(typeof density).toBe('number')
      expect(Array.isArray(flow)).toBe(true)
      expect(flow).toHaveLength(2)
      expect(typeof complexity).toBe('number')

      // Re-ensuring should not cause additional fetches
      await bundle.ensureMap('density_target')
      expect(fetchMock).toHaveBeenCalledTimes(5) // manifest + 4 maps, no extras
    })
  })

  describe('MapBundle.fromApiResponse', () => {
    it('creates a bundle from inline manifest without fetching', () => {
      const manifest = createTestManifest()

      const bundle = MapBundle.fromApiResponse(manifest, 'http://localhost:8100/api/maps/abc-123', 10, 10, 'fit')

      // No fetch calls — manifest is provided inline
      expect(fetchMock).not.toHaveBeenCalled()
      expect(bundle.manifest).toEqual(manifest)
      expect(bundle.mapWidth).toBe(4)
      expect(bundle.mapHeight).toBe(4)
    })

    it('validates the manifest', () => {
      expect(() =>
        MapBundle.fromApiResponse({ invalid: true }, 'http://localhost:8100/api/maps/abc', 10, 10, 'fit'),
      ).toThrow()
    })

    it('ensureMap fetches from the provided baseUrl', async () => {
      const manifest = createTestManifest()
      const densityData = createTestBinaryData()

      const bundle = MapBundle.fromApiResponse(manifest, 'http://localhost:8100/api/maps/abc-123', 10, 10, 'cover')

      fetchMock.mockResolvedValueOnce(binaryResponse(densityData))

      await bundle.ensureMap('density_target')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:8100/api/maps/abc-123/density_target.bin')
    })

    it('computes correct transform for cover mode', () => {
      const manifest = createTestManifest() // 4x4 map
      // 20x10 draw area with 4x4 map in cover mode
      // mapAspect=1 > drawAspect=0.5 → scale by height: scale=10/4=2.5
      const bundle = MapBundle.fromApiResponse(manifest, 'http://localhost:8100/api/maps/abc', 20, 10, 'cover')
      expect(bundle.manifest.width).toBe(4)
      expect(bundle.manifest.height).toBe(4)
    })
  })
})

describe('scatterPoints', () => {
  describe('uniform distribution with constant density', () => {
    it('returns approximately uniform distribution with constant density = 1.0', () => {
      const random = createRandom(42)
      const width = 10
      const height = 10
      const count = 100
      const densitySampler = () => 1.0 // Constant density everywhere
      const influence = 1

      const points = scatterPoints(random, width, height, count, densitySampler, influence)

      // Should return exactly the requested count
      expect(points).toHaveLength(count)

      // All points should be within bounds
      points.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(width)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(height)
      })

      // Check distribution is roughly uniform by dividing into quadrants
      const quadrants = [0, 0, 0, 0] // TL, TR, BL, BR
      points.forEach(([x, y]) => {
        const qx = x < width / 2 ? 0 : 1
        const qy = y < height / 2 ? 0 : 2
        quadrants[qx + qy]++
      })

      // Each quadrant should have roughly 25% of points (with some tolerance)
      quadrants.forEach(count => {
        expect(count).toBeGreaterThan(15) // At least 15%
        expect(count).toBeLessThan(35) // At most 35%
      })
    })

    it('returns uniform distribution when influence = 0 regardless of density', () => {
      const random = createRandom(123)
      const width = 10
      const height = 10
      const count = 100
      // Non-uniform density that should be ignored
      const densitySampler = (x: number) => x < width / 2 ? 0.1 : 0.9
      const influence = 0 // Should ignore density

      const points = scatterPoints(random, width, height, count, densitySampler, influence)

      expect(points).toHaveLength(count)

      // Count points on each half
      let leftCount = 0
      let rightCount = 0
      points.forEach(([x]) => {
        if (x < width / 2) leftCount++
        else rightCount++
      })

      // Should be roughly 50/50 despite different densities
      expect(leftCount).toBeGreaterThan(35)
      expect(leftCount).toBeLessThan(65)
      expect(rightCount).toBeGreaterThan(35)
      expect(rightCount).toBeLessThan(65)
    })
  })

  describe('density-weighted distribution', () => {
    it('concentrates points in high-density regions with left/right split', () => {
      const random = createRandom(456)
      const width = 10
      const height = 10
      const count = 100
      // Left half has density 1.0, right half has density 0.0
      const densitySampler = (x: number) => x < width / 2 ? 1.0 : 0.0
      const influence = 1

      const points = scatterPoints(random, width, height, count, densitySampler, influence)

      // Count points on each half
      let leftCount = 0
      let rightCount = 0
      points.forEach(([x]) => {
        if (x < width / 2) leftCount++
        else rightCount++
      })

      // Nearly all points should be on the left (high density)
      expect(leftCount).toBe(count)
      expect(rightCount).toBe(0)
    })

    it('creates gradient distribution with linear density', () => {
      const random = createRandom(789)
      const width = 10
      const height = 10
      const count = 200
      // Linear gradient from left (0) to right (1)
      const densitySampler = (x: number) => x / width
      const influence = 1

      const points = scatterPoints(random, width, height, count, densitySampler, influence)

      // Divide into thirds and count
      let leftThird = 0
      let middleThird = 0
      let rightThird = 0
      points.forEach(([x]) => {
        if (x < width / 3) leftThird++
        else if (x < 2 * width / 3) middleThird++
        else rightThird++
      })

      // Should have increasing counts from left to right
      expect(leftThird).toBeLessThan(middleThird)
      expect(middleThird).toBeLessThan(rightThird)
    })

    it('concentrates points more strongly with higher influence', () => {
      const random1 = createRandom(111)
      const random2 = createRandom(111) // Same seed for fair comparison
      const width = 10
      const height = 10
      const count = 100
      // Center has high density, edges have low density
      const densitySampler = (x: number, y: number) => {
        const dx = Math.abs(x - width / 2) / (width / 2)
        const dy = Math.abs(y - height / 2) / (height / 2)
        const dist = Math.max(dx, dy)
        return Math.max(0, 1 - dist)
      }

      // Generate with influence = 1
      const points1 = scatterPoints(random1, width, height, count, densitySampler, 1)

      // Generate with influence = 3 (stronger concentration)
      const points3 = scatterPoints(random2, width, height, count, densitySampler, 3)

      // Count points near center (within 25% of center)
      const centerRadius = Math.min(width, height) * 0.25
      const countNearCenter = (pts: Array<[number, number]>) => {
        return pts.filter(([x, y]) => {
          const dx = x - width / 2
          const dy = y - height / 2
          return Math.sqrt(dx * dx + dy * dy) < centerRadius
        }).length
      }

      const centerCount1 = countNearCenter(points1)
      const centerCount3 = countNearCenter(points3)

      // Higher influence should have more points near center
      expect(centerCount3).toBeGreaterThan(centerCount1)
    })
  })

  describe('edge cases and special conditions', () => {
    it('handles zero density everywhere gracefully', () => {
      const random = createRandom(222)
      const width = 10
      const height = 10
      const count = 50
      const densitySampler = () => 0.0 // Zero density everywhere
      const influence = 1

      const points = scatterPoints(random, width, height, count, densitySampler, influence)

      // Should return empty or very few points since density is 0
      expect(points.length).toBeLessThanOrEqual(count)
      // With zero density and rejection sampling, we expect 0 points
      expect(points.length).toBe(0)
    })

    it('handles very sparse density regions', () => {
      const random = createRandom(333)
      const width = 10
      const height = 10
      const count = 20
      // Very small density in a tiny region
      const densitySampler = (x: number, y: number) => {
        if (x > 4.5 && x < 5.5 && y > 4.5 && y < 5.5) return 0.01
        return 0
      }
      const influence = 1

      const points = scatterPoints(random, width, height, count, densitySampler, influence)

      // May return fewer points than requested due to sparse density
      expect(points.length).toBeLessThanOrEqual(count)

      // All returned points should be in the small high-density region
      points.forEach(([x, y]) => {
        if (points.length > 0) {
          // If we got any points, they should be near the center
          expect(Math.abs(x - 5)).toBeLessThan(2)
          expect(Math.abs(y - 5)).toBeLessThan(2)
        }
      })
    })

    it('clamps negative density values to 0', () => {
      const random = createRandom(444)
      const width = 10
      const height = 10
      const count = 50
      // Invalid negative density
      const densitySampler = () => -0.5
      const influence = 1

      const points = scatterPoints(random, width, height, count, densitySampler, influence)

      // Should treat negative as 0, so no points
      expect(points.length).toBe(0)
    })

    it('clamps density values above 1 to 1', () => {
      const random = createRandom(555)
      const width = 10
      const height = 10
      const count = 50
      // Invalid density > 1
      const densitySampler = () => 2.5
      const influence = 1

      const points = scatterPoints(random, width, height, count, densitySampler, influence)

      // Should treat as 1.0, so all points accepted
      expect(points).toHaveLength(count)
    })

    it('returns exact count when possible', () => {
      const random = createRandom(666)
      const width = 10
      const height = 10
      const count = 37 // Unusual number
      const densitySampler = () => 1.0
      const influence = 1

      const points = scatterPoints(random, width, height, count, densitySampler, influence)

      // Should return exactly the requested count
      expect(points).toHaveLength(count)
    })

    it('handles very small areas', () => {
      const random = createRandom(777)
      const width = 0.1
      const height = 0.1
      const count = 10
      const densitySampler = () => 1.0
      const influence = 1

      const points = scatterPoints(random, width, height, count, densitySampler, influence)

      expect(points).toHaveLength(count)

      // All points should be within the tiny bounds
      points.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(width)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(height)
      })
    })

    it('handles large point counts efficiently', () => {
      const random = createRandom(888)
      const width = 100
      const height = 100
      const count = 1000
      const densitySampler = () => 0.8
      const influence = 1

      const start = Date.now()
      const points = scatterPoints(random, width, height, count, densitySampler, influence)
      const duration = Date.now() - start

      // Should complete quickly even with many points
      expect(duration).toBeLessThan(100) // Less than 100ms

      // Should return the requested count (with high density, this should be achievable)
      expect(points.length).toBeGreaterThan(count * 0.9) // At least 90% of requested
    })
  })

  describe('influence parameter behavior', () => {
    it('influence = 0 always produces uniform distribution', () => {
      const random = createRandom(999)
      const width = 10
      const height = 10
      const count = 100
      // Complex density pattern that should be completely ignored
      const densitySampler = (x: number, y: number) => {
        return Math.sin(x) * Math.cos(y) * 0.5 + 0.5
      }
      const influence = 0

      const points = scatterPoints(random, width, height, count, densitySampler, influence)

      expect(points).toHaveLength(count)

      // Check uniformity by grid cells
      const gridSize = 4
      const grid = Array(gridSize * gridSize).fill(0)
      points.forEach(([x, y]) => {
        const gx = Math.floor(x / width * gridSize)
        const gy = Math.floor(y / height * gridSize)
        const idx = gy * gridSize + gx
        if (idx >= 0 && idx < grid.length) grid[idx]++
      })

      // Each cell should have roughly equal counts
      const expectedPerCell = count / (gridSize * gridSize)
      grid.forEach(cellCount => {
        expect(cellCount).toBeGreaterThan(expectedPerCell * 0.3)
        expect(cellCount).toBeLessThan(expectedPerCell * 2.0)
      })
    })

    it('higher influence creates stronger concentration', () => {
      const width = 10
      const height = 10
      const count = 100
      // Radial density: high at center, low at edges
      const densitySampler = (x: number, y: number) => {
        const dx = (x - width / 2) / (width / 2)
        const dy = (y - height / 2) / (height / 2)
        const r = Math.sqrt(dx * dx + dy * dy)
        return Math.max(0, 1 - r)
      }

      // Test with different influence values
      const influences = [0.5, 1, 2, 4]
      const centerCounts: number[] = []

      influences.forEach(influence => {
        const random = createRandom(1234) // Same seed for comparison
        const points = scatterPoints(random, width, height, count, densitySampler, influence)

        // Count points within center region (25% radius)
        const centerRadius = Math.min(width, height) * 0.25
        const centerCount = points.filter(([x, y]) => {
          const dx = x - width / 2
          const dy = y - height / 2
          return Math.sqrt(dx * dx + dy * dy) < centerRadius
        }).length

        centerCounts.push(centerCount)
      })

      // Each influence level should have more center concentration than the previous
      for (let i = 1; i < centerCounts.length; i++) {
        expect(centerCounts[i]).toBeGreaterThanOrEqual(centerCounts[i - 1])
      }
    })
  })
})

describe('traceFlow', () => {
  describe('basic tracing', () => {
    it('traces a horizontal line with constant rightward flow', () => {
      const start: Vec2 = [0, 5]
      const flowSampler = (): Vec2 => [1, 0] // Constant rightward flow
      const options: TraceOptions = {
        stepSize: 0.1,
        maxSteps: 10,
        maxDistance: 10,
        bounds: { width: 20, height: 10 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should have 11 points (start + 10 steps)
      expect(polyline).toHaveLength(11)

      // All points should have y=5 (horizontal line)
      polyline.forEach(point => {
        expect(point[1]).toBe(5)
      })

      // X coordinates should increase by stepSize
      for (let i = 0; i < polyline.length; i++) {
        expect(polyline[i][0]).toBeCloseTo(i * 0.1, 5)
      }
    })

    it('traces a vertical line with constant upward flow', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [0, -1] // Constant upward flow
      const options: TraceOptions = {
        stepSize: 0.2,
        maxSteps: 20,
        maxDistance: 10,
        bounds: { width: 10, height: 20 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should trace upward
      expect(polyline.length).toBeGreaterThan(1)

      // All points should have x=5 (vertical line)
      polyline.forEach(point => {
        expect(point[0]).toBe(5)
      })

      // Y coordinates should decrease (going up)
      for (let i = 1; i < polyline.length; i++) {
        expect(polyline[i][1]).toBeLessThan(polyline[i - 1][1])
      }
    })

    it('traces curved path with circular flow field', () => {
      const start: Vec2 = [10, 5]
      // Circular flow field: at (x, y), flow is perpendicular to radius
      const flowSampler = (x: number, y: number): Vec2 => {
        const dx = x - 10
        const dy = y - 10
        const r = Math.sqrt(dx * dx + dy * dy)
        if (r < 0.001) return [0, 0]
        // Perpendicular to radius vector, normalized
        return [-dy / r, dx / r]
      }
      const options: TraceOptions = {
        stepSize: 0.1,
        maxSteps: 50,
        maxDistance: 10,
        bounds: { width: 20, height: 20 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should create a curved path
      expect(polyline.length).toBeGreaterThan(10)

      // Check that path curves (not a straight line)
      // by verifying that angles between successive segments vary
      const angles: number[] = []
      for (let i = 2; i < polyline.length; i++) {
        const dx1 = polyline[i - 1][0] - polyline[i - 2][0]
        const dy1 = polyline[i - 1][1] - polyline[i - 2][1]
        const dx2 = polyline[i][0] - polyline[i - 1][0]
        const dy2 = polyline[i][1] - polyline[i - 1][1]
        const angle1 = Math.atan2(dy1, dx1)
        const angle2 = Math.atan2(dy2, dx2)
        angles.push(angle2 - angle1)
      }

      // Angles should be consistently changing (circular motion)
      const avgAngleChange = angles.reduce((a, b) => a + b, 0) / angles.length
      expect(Math.abs(avgAngleChange)).toBeGreaterThan(0.01)
    })
  })

  describe('stopping conditions', () => {
    it('stops at maxSteps limit', () => {
      const start: Vec2 = [0, 0]
      const flowSampler = (): Vec2 => [1, 0]
      const options: TraceOptions = {
        stepSize: 0.1,
        maxSteps: 5, // Limited steps
        maxDistance: 100, // High distance limit
        bounds: { width: 100, height: 100 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should have exactly 6 points (start + 5 steps)
      expect(polyline).toHaveLength(6)
    })

    it('stops at maxDistance limit', () => {
      const start: Vec2 = [0, 0]
      const flowSampler = (): Vec2 => [1, 0]
      const options: TraceOptions = {
        stepSize: 0.5,
        maxSteps: 100, // High step limit
        maxDistance: 2, // Limited distance
        bounds: { width: 100, height: 100 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Calculate total distance
      let totalDistance = 0
      for (let i = 1; i < polyline.length; i++) {
        const dx = polyline[i][0] - polyline[i - 1][0]
        const dy = polyline[i][1] - polyline[i - 1][1]
        totalDistance += Math.sqrt(dx * dx + dy * dy)
      }

      // Should not exceed maxDistance (with small tolerance)
      expect(totalDistance).toBeLessThanOrEqual(2.5)
      expect(polyline.length).toBeGreaterThan(1)
      expect(polyline.length).toBeLessThan(10) // Should stop before maxSteps
    })

    it('stops when exiting bounds (right edge)', () => {
      const start: Vec2 = [9.5, 5]
      const flowSampler = (): Vec2 => [1, 0] // Rightward flow
      const options: TraceOptions = {
        stepSize: 0.2,
        maxSteps: 100,
        maxDistance: 100,
        bounds: { width: 10, height: 10 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should stop at boundary
      const lastPoint = polyline[polyline.length - 1]
      expect(lastPoint[0]).toBeLessThanOrEqual(10)

      // Should have stopped early (not all 100 steps)
      expect(polyline.length).toBeLessThan(20)
    })

    it('stops when exiting bounds (top edge)', () => {
      const start: Vec2 = [5, 0.5]
      const flowSampler = (): Vec2 => [0, -1] // Upward flow
      const options: TraceOptions = {
        stepSize: 0.2,
        maxSteps: 100,
        maxDistance: 100,
        bounds: { width: 10, height: 10 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should stop at boundary
      const lastPoint = polyline[polyline.length - 1]
      expect(lastPoint[1]).toBeGreaterThanOrEqual(0)

      // Should have stopped early
      expect(polyline.length).toBeLessThan(20)
    })

    it('stops immediately with zero flow', () => {
      const start: Vec2 = [5, 5]
      const flowSampler = (): Vec2 => [0, 0] // Zero flow
      const options: TraceOptions = {
        stepSize: 0.1,
        maxSteps: 100,
        maxDistance: 100,
        bounds: { width: 10, height: 10 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should only have the starting point
      expect(polyline).toHaveLength(1)
      expect(polyline[0]).toEqual(start)
    })

    it('stops when encountering near-zero flow', () => {
      const start: Vec2 = [5, 5]
      let stepCount = 0
      const flowSampler = (): Vec2 => {
        stepCount++
        // Flow becomes zero after a few steps
        return stepCount <= 3 ? [1, 0] : [0.000001, 0.000001]
      }
      const options: TraceOptions = {
        stepSize: 0.1,
        maxSteps: 100,
        maxDistance: 100,
        bounds: { width: 10, height: 10 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should stop after flow becomes near-zero
      expect(polyline.length).toBeGreaterThan(1)
      expect(polyline.length).toBeLessThan(6)
    })
  })

  describe('speed modulation', () => {
    it('modulates step size based on speed sampler', () => {
      const start: Vec2 = [0, 5]
      const flowSampler = (): Vec2 => [1, 0]
      let sampleCount = 0
      const speedSampler = (x: number): number => {
        sampleCount++
        // Speed decreases along x
        return Math.max(0, 1 - x / 10)
      }
      const options: TraceOptions = {
        stepSize: 0.2,
        maxSteps: 20,
        maxDistance: 100,
        bounds: { width: 20, height: 10 },
        speedSampler,
        minSpeed: 0.1,
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Speed sampler should have been called
      expect(sampleCount).toBeGreaterThan(0)

      // Step sizes should decrease as we move along x
      const stepSizes: number[] = []
      for (let i = 1; i < polyline.length; i++) {
        stepSizes.push(polyline[i][0] - polyline[i - 1][0])
      }

      // Later steps should be smaller than earlier steps
      if (stepSizes.length > 2) {
        const earlyAvg = stepSizes.slice(0, 2).reduce((a, b) => a + b, 0) / 2
        const lateAvg = stepSizes.slice(-2).reduce((a, b) => a + b, 0) / 2
        expect(lateAvg).toBeLessThan(earlyAvg)
      }
    })

    it('respects minSpeed parameter', () => {
      const start: Vec2 = [0, 5]
      const flowSampler = (): Vec2 => [1, 0]
      const speedSampler = (): number => 0 // Always zero speed
      const minSpeed = 0.2
      const options: TraceOptions = {
        stepSize: 1.0,
        maxSteps: 10,
        maxDistance: 100,
        bounds: { width: 20, height: 10 },
        speedSampler,
        minSpeed,
      }

      const polyline = traceFlow(start, flowSampler, options)

      // With speed=0 and minSpeed=0.2, each step should be 0.2 * stepSize = 0.2
      for (let i = 1; i < polyline.length; i++) {
        const stepDist = polyline[i][0] - polyline[i - 1][0]
        expect(stepDist).toBeCloseTo(0.2, 5)
      }
    })

    it('clamps speed values to [0, 1] range', () => {
      const start: Vec2 = [0, 5]
      const flowSampler = (): Vec2 => [1, 0]
      const speedSampler = (x: number): number => {
        // Return invalid values
        return x < 5 ? -0.5 : 1.5
      }
      const options: TraceOptions = {
        stepSize: 0.2,
        maxSteps: 30,
        maxDistance: 100,
        bounds: { width: 20, height: 10 },
        speedSampler,
        minSpeed: 0.1,
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should complete without errors
      expect(polyline.length).toBeGreaterThan(1)

      // Step sizes should be reasonable (clamped values)
      for (let i = 1; i < polyline.length; i++) {
        const stepDist = polyline[i][0] - polyline[i - 1][0]
        expect(stepDist).toBeGreaterThan(0)
        expect(stepDist).toBeLessThanOrEqual(0.2)
      }
    })
  })

  describe('edge cases', () => {
    it('handles starting point at boundary', () => {
      const start: Vec2 = [10, 5] // Right edge
      const flowSampler = (): Vec2 => [1, 0] // Flow out of bounds
      const options: TraceOptions = {
        stepSize: 0.1,
        maxSteps: 10,
        maxDistance: 100,
        bounds: { width: 10, height: 10 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should only have starting point (immediate exit)
      expect(polyline).toHaveLength(1)
      expect(polyline[0]).toEqual(start)
    })

    it('handles starting point outside bounds', () => {
      const start: Vec2 = [15, 5] // Outside bounds
      const flowSampler = (): Vec2 => [-1, 0] // Flow back toward bounds
      const options: TraceOptions = {
        stepSize: 0.1,
        maxSteps: 10,
        maxDistance: 100,
        bounds: { width: 10, height: 10 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should stop immediately
      expect(polyline).toHaveLength(1)
    })

    it('handles non-normalized flow vectors', () => {
      const start: Vec2 = [5, 5]
      const flowSampler = (): Vec2 => [3, 4] // Non-unit vector (magnitude 5)
      const options: TraceOptions = {
        stepSize: 0.1,
        maxSteps: 10,
        maxDistance: 100,
        bounds: { width: 10, height: 10 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should normalize and trace correctly
      expect(polyline.length).toBeGreaterThan(1)

      // Check that steps are consistent size (0.1)
      for (let i = 1; i < polyline.length; i++) {
        const dx = polyline[i][0] - polyline[i - 1][0]
        const dy = polyline[i][1] - polyline[i - 1][1]
        const dist = Math.sqrt(dx * dx + dy * dy)
        expect(dist).toBeCloseTo(0.1, 5)
      }
    })

    it('handles very small step sizes', () => {
      const start: Vec2 = [5, 5]
      const flowSampler = (): Vec2 => [1, 0]
      const options: TraceOptions = {
        stepSize: 0.001,
        maxSteps: 100,
        maxDistance: 0.1,
        bounds: { width: 10, height: 10 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should trace with tiny steps
      expect(polyline.length).toBeGreaterThan(50)

      // Total distance should be close to maxDistance
      let totalDist = 0
      for (let i = 1; i < polyline.length; i++) {
        totalDist += Math.abs(polyline[i][0] - polyline[i - 1][0])
      }
      expect(totalDist).toBeLessThanOrEqual(0.11) // Small tolerance
    })

    it('handles zero maxSteps', () => {
      const start: Vec2 = [5, 5]
      const flowSampler = (): Vec2 => [1, 0]
      const options: TraceOptions = {
        stepSize: 0.1,
        maxSteps: 0,
        maxDistance: 100,
        bounds: { width: 10, height: 10 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should only have starting point
      expect(polyline).toHaveLength(1)
      expect(polyline[0]).toEqual(start)
    })

    it('handles zero maxDistance', () => {
      const start: Vec2 = [5, 5]
      const flowSampler = (): Vec2 => [1, 0]
      const options: TraceOptions = {
        stepSize: 0.1,
        maxSteps: 100,
        maxDistance: 0,
        bounds: { width: 10, height: 10 },
      }

      const polyline = traceFlow(start, flowSampler, options)

      // Should only have starting point
      expect(polyline).toHaveLength(1)
      expect(polyline[0]).toEqual(start)
    })
  })
})

describe('traceFlowNoise', () => {
  const random = createRandom(42)
  const baseOptions: TraceFlowNoiseOptions = {
    stepSize: 0.1,
    maxSteps: 50,
    maxDistance: 100,
    bounds: { width: 20, height: 20 },
    noise: random.noise2D,
    noiseScale: 1.0,
    noiseInfluence: 0,
  }

  // Helper: get the single segment from a result (most tests produce one segment)
  const single = (segments: Vec2[][]): Vec2[] => {
    expect(segments.length).toBe(1)
    return segments[0]
  }

  // Helper: flatten all segments into one point array
  const flatten = (segments: Vec2[][]): Vec2[] => segments.flat()

  describe('with noiseInfluence = 0 (pure flow)', () => {
    it('traces identically to traceFlow for constant flow', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [1, 0]
      const options: TraceFlowNoiseOptions = { ...baseOptions, noiseInfluence: 0 }

      const noiseResult = single(traceFlowNoise(start, flowSampler, options))
      const flowResult = traceFlow(start, flowSampler, {
        stepSize: 0.1,
        maxSteps: 50,
        maxDistance: 100,
        bounds: { width: 20, height: 20 },
      })

      expect(noiseResult).toHaveLength(flowResult.length)
      for (let i = 0; i < noiseResult.length; i++) {
        expect(noiseResult[i][0]).toBeCloseTo(flowResult[i][0], 5)
        expect(noiseResult[i][1]).toBeCloseTo(flowResult[i][1], 5)
      }
    })
  })

  describe('noise perturbation', () => {
    it('produces different path than pure flow when noiseInfluence > 0', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const pureFlow = single(traceFlowNoise(start, flowSampler, { ...baseOptions, noiseInfluence: 0 }))
      const withNoise = single(traceFlowNoise(start, flowSampler, { ...baseOptions, noiseInfluence: 0.5 }))

      expect(pureFlow.length).toBeGreaterThan(1)
      expect(withNoise.length).toBeGreaterThan(1)

      let hasDifference = false
      const minLen = Math.min(pureFlow.length, withNoise.length)
      for (let i = 1; i < minLen; i++) {
        if (Math.abs(pureFlow[i][1] - withNoise[i][1]) > 0.001) {
          hasDifference = true
          break
        }
      }
      expect(hasDifference).toBe(true)
    })

    it('respects noiseScale — both scales produce noise-affected paths', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const largeScale = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions, noiseInfluence: 0.5, noiseScale: 5.0,
      }))
      const smallScale = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions, noiseInfluence: 0.5, noiseScale: 0.2,
      }))

      expect(largeScale.length).toBeGreaterThan(5)
      expect(smallScale.length).toBeGreaterThan(5)

      const yVariance = (pts: Vec2[]) => {
        const ys = pts.map(p => p[1])
        const mean = ys.reduce((a, b) => a + b, 0) / ys.length
        return ys.reduce((sum, y) => sum + (y - mean) ** 2, 0) / ys.length
      }

      expect(yVariance(smallScale)).toBeGreaterThan(0)
      expect(yVariance(largeScale)).toBeGreaterThan(0)
    })

    it('supports noiseInfluence as a per-position function', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const spatialInfluence = (x: number): number => x > 10 ? 0.8 : 0.0
      const result = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions, noiseInfluence: spatialInfluence,
      }))

      expect(result.length).toBeGreaterThan(1)

      const earlyPoints = result.filter(p => p[0] < 9)
      earlyPoints.forEach(p => {
        expect(p[1]).toBeCloseTo(10, 0)
      })
    })
  })

  describe('tone modulation', () => {
    it('produces shorter traces for low tone values', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const highTone = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        toneSampler: () => 1.0,
        toneInfluence: 1.0,
        maxSteps: 100,
      }))

      const lowTone = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        toneSampler: () => 0.1,
        toneInfluence: 1.0,
        maxSteps: 100,
      }))

      expect(highTone.length).toBeGreaterThan(lowTone.length)
    })

    it('has no effect when toneInfluence is 0', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const withTone = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        toneSampler: () => 0.1,
        toneInfluence: 0,
        maxSteps: 20,
      }))

      const withoutTone = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        maxSteps: 20,
      }))

      expect(withTone.length).toBe(withoutTone.length)
    })

    it('clamps tone values to [0, 1]', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const overTone = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        toneSampler: () => 2.0,
        toneInfluence: 1.0,
        maxSteps: 20,
      }))

      const normalTone = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        toneSampler: () => 1.0,
        toneInfluence: 1.0,
        maxSteps: 20,
      }))

      expect(overTone.length).toBe(normalTone.length)
    })
  })

  describe('tone threshold (pen-up/pen-down)', () => {
    it('splits path into segments based on tone threshold', () => {
      const start: Vec2 = [0, 10]
      const flowSampler = (): Vec2 => [1, 0]

      // Tone is high for x < 5, low for 5 <= x < 10, high again for x >= 10
      const toneSampler = (x: number): number => (x < 5 || x >= 10) ? 0.8 : 0.1

      const segments = traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        toneSampler,
        toneThreshold: 0.5,
        maxSteps: 180,
      })

      // Should produce 2 segments: one for x < 5, one for x >= 10
      expect(segments.length).toBe(2)

      // First segment should be in x < 5 region
      segments[0].forEach(p => expect(p[0]).toBeLessThan(5.1))

      // Second segment should be in x >= 10 region
      segments[1].forEach(p => expect(p[0]).toBeGreaterThanOrEqual(9.9))
    })

    it('returns no segments when all tone is below threshold', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const segments = traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        toneSampler: () => 0.1,
        toneThreshold: 0.5,
        maxSteps: 20,
      })

      expect(segments).toHaveLength(0)
    })

    it('returns single segment when all tone is above threshold', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const segments = traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        toneSampler: () => 0.8,
        toneThreshold: 0.5,
        maxSteps: 20,
      })

      expect(segments).toHaveLength(1)
      expect(segments[0].length).toBeGreaterThan(1)
    })

    it('has no effect when toneThreshold is 0', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const withThreshold = traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        toneSampler: () => 0.1,
        toneThreshold: 0,
        maxSteps: 20,
      })

      // Should return full path as single segment (threshold 0 = no pen-up)
      expect(withThreshold).toHaveLength(1)
      expect(withThreshold[0].length).toBe(21)
    })
  })

  describe('bidirectional tracing', () => {
    it('extends path in both directions from seed', () => {
      const start: Vec2 = [10, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const uniPath = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions, bidirectional: false, maxSteps: 10,
      }))
      const biPath = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions, bidirectional: true, maxSteps: 10,
      }))

      // Unidirectional starts at seed and only goes right
      expect(uniPath[0][0]).toBeCloseTo(10, 5)
      expect(uniPath[uniPath.length - 1][0]).toBeGreaterThan(10)

      // Bidirectional extends left AND right of seed
      expect(biPath[0][0]).toBeLessThan(10)
      expect(biPath[biPath.length - 1][0]).toBeGreaterThan(10)
    })

    it('contains the seed point', () => {
      const start: Vec2 = [10, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const path = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions, bidirectional: true, maxSteps: 20,
      }))

      const hasSeed = path.some(
        p => Math.abs(p[0] - 10) < 0.001 && Math.abs(p[1] - 10) < 0.001,
      )
      expect(hasSeed).toBe(true)
    })

    it('backward part traces in opposite direction', () => {
      const start: Vec2 = [10, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const path = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions, bidirectional: true, maxSteps: 20,
      }))

      expect(path[0][0]).toBeLessThan(10)
      expect(path[path.length - 1][0]).toBeGreaterThan(10)
    })
  })

  describe('stopping conditions', () => {
    it('stops at bounds', () => {
      const start: Vec2 = [19, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const path = single(traceFlowNoise(start, flowSampler, baseOptions))
      const lastPoint = path[path.length - 1]
      expect(lastPoint[0]).toBeLessThanOrEqual(20)
    })

    it('stops at maxDistance', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const path = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions, maxDistance: 1.0,
      }))

      let totalDist = 0
      for (let i = 1; i < path.length; i++) {
        const dx = path[i][0] - path[i - 1][0]
        const dy = path[i][1] - path[i - 1][1]
        totalDist += Math.sqrt(dx * dx + dy * dy)
      }
      expect(totalDist).toBeLessThanOrEqual(1.1)
    })

    it('returns empty on zero flow', () => {
      const start: Vec2 = [5, 10]
      const flowSampler = (): Vec2 => [0, 0]

      // Zero flow = only 1 point = fewer than 2 = no segments returned
      const result = traceFlowNoise(start, flowSampler, baseOptions)
      expect(result).toHaveLength(0)
    })
  })

  describe('speed modulation', () => {
    it('modulates step size via speedSampler', () => {
      const start: Vec2 = [0, 10]
      const flowSampler = (): Vec2 => [1, 0]

      const fast = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        speedSampler: () => 1.0,
        maxSteps: 10,
      }))
      const slow = single(traceFlowNoise(start, flowSampler, {
        ...baseOptions,
        speedSampler: () => 0.0,
        minSpeed: 0.2,
        maxSteps: 10,
      }))

      const lastFast = fast[fast.length - 1][0]
      const lastSlow = slow[slow.length - 1][0]
      expect(lastFast).toBeGreaterThan(lastSlow)
    })
  })
})