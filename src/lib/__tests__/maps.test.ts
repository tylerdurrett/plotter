import { describe, expect, it } from 'vitest'
import { parseManifest, computeMapTransform } from '../maps'
import type { MapManifest } from '@/lib/types'

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