// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import type http from 'node:http'
import { handleMapsRequest } from '../vite-plugin-maps'
import type { MapManifest } from '../../lib/types'

let tmpRoot: string

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'maps-api-test-'))
  await fs.mkdir(path.join(tmpRoot, 'public', 'maps'), { recursive: true })
})

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

interface MockResponse {
  status: number
  headers: Record<string, string | number>
  body: string
}

function mockRes(): http.ServerResponse & { result: MockResponse } {
  const result: MockResponse = { status: 200, headers: {}, body: '' }
  const chunks: string[] = []

  return {
    result,
    writeHead(status: number, headers?: Record<string, string | number>) {
      result.status = status
      if (headers) result.headers = headers
    },
    end(chunk?: string | Buffer) {
      if (chunk) chunks.push(chunk.toString())
      result.body = chunks.join('')
    },
    headersSent: false,
  } as http.ServerResponse & { result: MockResponse }
}

const validManifest: MapManifest = {
  version: 1,
  source_image: 'test-image',
  width: 100,
  height: 200,
  created_at: '2024-01-01T00:00:00Z',
  maps: [
    {
      filename: 'density_target.bin',
      key: 'density_target',
      dtype: 'float32',
      shape: [200, 100],
      value_range: [0, 1],
      description: 'Density map',
    },
  ],
}

describe('handleMapsRequest', () => {
  it('returns empty array when maps directory does not exist', async () => {
    await fs.rm(path.join(tmpRoot, 'public', 'maps'), { recursive: true })
    const res = mockRes()

    await handleMapsRequest(tmpRoot, res)

    expect(res.result.status).toBe(200)
    const body = JSON.parse(res.result.body)
    expect(body).toEqual([])
  })

  it('returns empty array when maps directory is empty', async () => {
    const res = mockRes()

    await handleMapsRequest(tmpRoot, res)

    expect(res.result.status).toBe(200)
    const body = JSON.parse(res.result.body)
    expect(body).toEqual([])
  })

  it('returns single bundle with valid manifest and no previews', async () => {
    const bundlePath = path.join(tmpRoot, 'public', 'maps', 'test-bundle')
    await fs.mkdir(path.join(bundlePath, 'export'), { recursive: true })
    await fs.writeFile(
      path.join(bundlePath, 'export', 'manifest.json'),
      JSON.stringify(validManifest),
      'utf-8',
    )

    const res = mockRes()
    await handleMapsRequest(tmpRoot, res)

    expect(res.result.status).toBe(200)
    const body = JSON.parse(res.result.body)
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('test-bundle')
    expect(body[0].manifest).toEqual(validManifest)
    expect(body[0].previewUrl).toBe('/maps/test-bundle/export/previews/density/density_target.png')
    expect(body[0].availablePreviews).toEqual([])
  })

  it('returns bundle with discovered preview images', async () => {
    const bundlePath = path.join(tmpRoot, 'public', 'maps', 'test-bundle')
    await fs.mkdir(path.join(bundlePath, 'export'), { recursive: true })
    await fs.writeFile(
      path.join(bundlePath, 'export', 'manifest.json'),
      JSON.stringify(validManifest),
      'utf-8',
    )

    // Create preview directories with PNG files
    await fs.mkdir(path.join(bundlePath, 'export', 'previews', 'density'), { recursive: true })
    await fs.mkdir(path.join(bundlePath, 'export', 'previews', 'flow'), { recursive: true })
    await fs.writeFile(path.join(bundlePath, 'export', 'previews', 'density', 'density_target.png'), '', 'utf-8')
    await fs.writeFile(path.join(bundlePath, 'export', 'previews', 'density', 'luminance.png'), '', 'utf-8')
    await fs.writeFile(path.join(bundlePath, 'export', 'previews', 'flow', 'flow_lic.png'), '', 'utf-8')
    await fs.writeFile(path.join(bundlePath, 'export', 'previews', 'density', 'contact_sheet.png'), '', 'utf-8')

    const res = mockRes()
    await handleMapsRequest(tmpRoot, res)

    expect(res.result.status).toBe(200)
    const body = JSON.parse(res.result.body)
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('test-bundle')
    expect(body[0].availablePreviews).toHaveLength(3)
    expect(body[0].availablePreviews).toContainEqual({
      category: 'density',
      name: 'density_target',
      path: 'density/density_target'
    })
    expect(body[0].availablePreviews).toContainEqual({
      category: 'density',
      name: 'luminance',
      path: 'density/luminance'
    })
    expect(body[0].availablePreviews).toContainEqual({
      category: 'flow',
      name: 'flow_lic',
      path: 'flow/flow_lic'
    })
    // contact_sheet should be filtered out
    expect(body[0].availablePreviews).not.toContainEqual(
      expect.objectContaining({ name: 'contact_sheet' })
    )
  })

  it('returns multiple bundles sorted by name', async () => {
    const bundles = ['bundle-b', 'bundle-a', 'bundle-c']

    for (const name of bundles) {
      const bundlePath = path.join(tmpRoot, 'public', 'maps', name)
      await fs.mkdir(path.join(bundlePath, 'export'), { recursive: true })
      await fs.writeFile(
        path.join(bundlePath, 'export', 'manifest.json'),
        JSON.stringify({ ...validManifest, source_image: name }),
        'utf-8',
      )
    }

    const res = mockRes()
    await handleMapsRequest(tmpRoot, res)

    expect(res.result.status).toBe(200)
    const body = JSON.parse(res.result.body)
    expect(body).toHaveLength(3)
    expect(body.map((b: any) => b.name)).toEqual(['bundle-a', 'bundle-b', 'bundle-c'])
    // Each should have availablePreviews (even if empty)
    body.forEach((bundle: any) => {
      expect(bundle).toHaveProperty('availablePreviews')
      expect(Array.isArray(bundle.availablePreviews)).toBe(true)
    })
  })

  it('skips directories without manifest.json', async () => {
    const bundleWithManifest = path.join(tmpRoot, 'public', 'maps', 'with-manifest')
    await fs.mkdir(path.join(bundleWithManifest, 'export'), { recursive: true })
    await fs.writeFile(
      path.join(bundleWithManifest, 'export', 'manifest.json'),
      JSON.stringify(validManifest),
      'utf-8',
    )

    const bundleWithoutManifest = path.join(tmpRoot, 'public', 'maps', 'without-manifest')
    await fs.mkdir(bundleWithoutManifest, { recursive: true })

    const res = mockRes()
    await handleMapsRequest(tmpRoot, res)

    expect(res.result.status).toBe(200)
    const body = JSON.parse(res.result.body)
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('with-manifest')
  })

  it('skips directories with invalid manifest', async () => {
    const validBundle = path.join(tmpRoot, 'public', 'maps', 'valid')
    await fs.mkdir(path.join(validBundle, 'export'), { recursive: true })
    await fs.writeFile(
      path.join(validBundle, 'export', 'manifest.json'),
      JSON.stringify(validManifest),
      'utf-8',
    )

    const invalidBundle = path.join(tmpRoot, 'public', 'maps', 'invalid')
    await fs.mkdir(path.join(invalidBundle, 'export'), { recursive: true })
    await fs.writeFile(
      path.join(invalidBundle, 'export', 'manifest.json'),
      '{ "invalid": "json structure" }',
      'utf-8',
    )

    const res = mockRes()
    await handleMapsRequest(tmpRoot, res)

    expect(res.result.status).toBe(200)
    const body = JSON.parse(res.result.body)
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('valid')
  })

  it('skips non-directory entries in maps folder', async () => {
    const bundlePath = path.join(tmpRoot, 'public', 'maps', 'test-bundle')
    await fs.mkdir(path.join(bundlePath, 'export'), { recursive: true })
    await fs.writeFile(
      path.join(bundlePath, 'export', 'manifest.json'),
      JSON.stringify(validManifest),
      'utf-8',
    )

    await fs.writeFile(
      path.join(tmpRoot, 'public', 'maps', 'README.md'),
      'This is a readme file',
      'utf-8',
    )

    const res = mockRes()
    await handleMapsRequest(tmpRoot, res)

    expect(res.result.status).toBe(200)
    const body = JSON.parse(res.result.body)
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('test-bundle')
  })

  it('handles filesystem errors gracefully', async () => {
    const originalReaddir = fs.readdir
    vi.spyOn(fs, 'readdir').mockRejectedValueOnce(new Error('Filesystem error'))

    const res = mockRes()
    await expect(handleMapsRequest(tmpRoot, res)).rejects.toThrow('Filesystem error')

    vi.mocked(fs.readdir).mockRestore()
  })
})