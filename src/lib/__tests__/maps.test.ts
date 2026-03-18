import { describe, expect, it } from 'vitest'
import { parseManifest } from '../maps'
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