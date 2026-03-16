// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { Readable } from 'node:stream'
import type http from 'node:http'
import type { Connect } from 'vite'
import { isValidName, handlePresetRequest } from '../vite-plugin-presets'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Temporary directory used as fake project root for each test. */
let tmpRoot: string

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preset-api-test-'))
  // Create the sketches directory so tests start with a realistic root
  await fs.mkdir(path.join(tmpRoot, 'sketches', 'my-sketch'), {
    recursive: true,
  })
})

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

/** Build a minimal mock request that satisfies Connect.IncomingMessage. */
function mockReq(
  method: string,
  url: string,
  body?: string,
): Connect.IncomingMessage {
  const readable = new Readable({ read() {} })
  if (body !== undefined) {
    readable.push(body)
  }
  readable.push(null) // end stream
  return Object.assign(readable, {
    method,
    url,
  }) as unknown as Connect.IncomingMessage
}

/** Capture response status, headers, and body from handlePresetRequest. */
interface MockResponse {
  status: number
  headers: Record<string, string | number>
  body: string
}

function mockRes(): { res: http.ServerResponse; result: () => MockResponse } {
  let status = 200
  const headers: Record<string, string | number> = {}
  const chunks: string[] = []

  const res = {
    headersSent: false,
    writeHead(s: number, h?: Record<string, string | number>) {
      status = s
      if (h) Object.assign(headers, h)
      res.headersSent = true
      return res
    },
    end(data?: string) {
      if (data) chunks.push(data)
    },
  } as unknown as http.ServerResponse

  return {
    res,
    result: () => ({ status, headers, body: chunks.join('') }),
  }
}

// ---------------------------------------------------------------------------
// isValidName
// ---------------------------------------------------------------------------

describe('isValidName', () => {
  it('accepts a typical sketch slug', () => {
    expect(isValidName('2026-03-15-concentric-circles')).toBe(true)
  })

  it('accepts lowercase with underscores', () => {
    expect(isValidName('my_preset')).toBe(true)
  })

  it('accepts single character', () => {
    expect(isValidName('a')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isValidName('')).toBe(false)
  })

  it('rejects path traversal with dots', () => {
    expect(isValidName('../etc')).toBe(false)
    expect(isValidName('..')).toBe(false)
    expect(isValidName('.hidden')).toBe(false)
  })

  it('rejects slashes', () => {
    expect(isValidName('foo/bar')).toBe(false)
    expect(isValidName('foo\\bar')).toBe(false)
  })

  it('rejects uppercase', () => {
    expect(isValidName('MyPreset')).toBe(false)
  })

  it('rejects names starting with hyphen', () => {
    expect(isValidName('-rf')).toBe(false)
  })

  it('rejects names over 100 characters', () => {
    expect(isValidName('a'.repeat(101))).toBe(false)
    expect(isValidName('a'.repeat(100))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// LIST — GET /__api/presets/:sketch
// ---------------------------------------------------------------------------

describe('LIST presets', () => {
  it('returns [] when presets directory does not exist', async () => {
    const req = mockReq('GET', '/__api/presets/my-sketch')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    const r = result()
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body)).toEqual([])
  })

  it('returns [] when presets directory is empty', async () => {
    await fs.mkdir(path.join(tmpRoot, 'sketches', 'my-sketch', 'presets'))
    const req = mockReq('GET', '/__api/presets/my-sketch')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(JSON.parse(result().body)).toEqual([])
  })

  it('returns sorted preset names without .json extension', async () => {
    const dir = path.join(tmpRoot, 'sketches', 'my-sketch', 'presets')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'zebra.json'), '{}')
    await fs.writeFile(path.join(dir, 'alpha.json'), '{}')
    await fs.writeFile(path.join(dir, 'middle.json'), '{}')

    const req = mockReq('GET', '/__api/presets/my-sketch')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(JSON.parse(result().body)).toEqual(['alpha', 'middle', 'zebra'])
  })

  it('ignores non-JSON files', async () => {
    const dir = path.join(tmpRoot, 'sketches', 'my-sketch', 'presets')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'good.json'), '{}')
    await fs.writeFile(path.join(dir, 'readme.txt'), 'ignore me')

    const req = mockReq('GET', '/__api/presets/my-sketch')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(JSON.parse(result().body)).toEqual(['good'])
  })
})

// ---------------------------------------------------------------------------
// READ — GET /__api/presets/:sketch/:name
// ---------------------------------------------------------------------------

describe('READ preset', () => {
  it('returns preset content with 200', async () => {
    const dir = path.join(tmpRoot, 'sketches', 'my-sketch', 'presets')
    await fs.mkdir(dir, { recursive: true })
    const data = { count: 5, seed: 42 }
    await fs.writeFile(path.join(dir, 'default.json'), JSON.stringify(data))

    const req = mockReq('GET', '/__api/presets/my-sketch/default')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    const r = result()
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body)).toEqual(data)
  })

  it('returns 404 for non-existent preset', async () => {
    const req = mockReq('GET', '/__api/presets/my-sketch/nope')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(404)
  })

  it('returns 400 for invalid preset name', async () => {
    const req = mockReq('GET', '/__api/presets/my-sketch/.hidden')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// WRITE — POST /__api/presets/:sketch/:name
// ---------------------------------------------------------------------------

describe('WRITE preset', () => {
  it('creates a preset file with correct content', async () => {
    const data = { count: 10, maxRadius: 5 }
    const req = mockReq(
      'POST',
      '/__api/presets/my-sketch/my-preset',
      JSON.stringify(data),
    )
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(204)

    // Verify file on disk
    const filePath = path.join(
      tmpRoot,
      'sketches',
      'my-sketch',
      'presets',
      'my-preset.json',
    )
    const content = await fs.readFile(filePath, 'utf-8')
    expect(JSON.parse(content)).toEqual(data)
  })

  it('creates the presets/ directory if it does not exist', async () => {
    const data = { seed: 1 }
    const req = mockReq(
      'POST',
      '/__api/presets/my-sketch/first',
      JSON.stringify(data),
    )
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(204)

    const stat = await fs.stat(
      path.join(tmpRoot, 'sketches', 'my-sketch', 'presets'),
    )
    expect(stat.isDirectory()).toBe(true)
  })

  it('overwrites an existing preset', async () => {
    const dir = path.join(tmpRoot, 'sketches', 'my-sketch', 'presets')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'old.json'), '{"v":1}')

    const req = mockReq('POST', '/__api/presets/my-sketch/old', '{"v":2}')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(204)

    const content = await fs.readFile(path.join(dir, 'old.json'), 'utf-8')
    expect(JSON.parse(content)).toEqual({ v: 2 })
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = mockReq('POST', '/__api/presets/my-sketch/bad', 'not json {{{')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(400)
    expect(JSON.parse(result().body).error).toContain('Invalid JSON')
  })

  it('returns 400 for invalid sketch name', async () => {
    // Use a name that passes segment parsing but fails validation
    const req = mockReq('POST', '/__api/presets/.hidden/test', '{}')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(400)
  })

  it('returns 400 for invalid preset name', async () => {
    const req = mockReq('POST', '/__api/presets/my-sketch/.secret', '{}')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(400)
  })

  it('returns 404 for path traversal with extra segments', async () => {
    // ../evil/test splits into 3 segments → 404 before validation runs
    const req = mockReq('POST', '/__api/presets/../evil/test', '{}')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(404)
  })

  it('pretty-prints the saved JSON', async () => {
    const req = mockReq(
      'POST',
      '/__api/presets/my-sketch/pretty',
      '{"a":1,"b":2}',
    )
    const { res } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)

    const filePath = path.join(
      tmpRoot,
      'sketches',
      'my-sketch',
      'presets',
      'pretty.json',
    )
    const content = await fs.readFile(filePath, 'utf-8')
    // Should be indented, not minified
    expect(content).toContain('\n')
    expect(content).toContain('  ')
  })
})

// ---------------------------------------------------------------------------
// DELETE — DELETE /__api/presets/:sketch/:name
// ---------------------------------------------------------------------------

describe('DELETE preset', () => {
  it('deletes an existing preset and returns 204', async () => {
    const dir = path.join(tmpRoot, 'sketches', 'my-sketch', 'presets')
    await fs.mkdir(dir, { recursive: true })
    const filePath = path.join(dir, 'doomed.json')
    await fs.writeFile(filePath, '{}')

    const req = mockReq('DELETE', '/__api/presets/my-sketch/doomed')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(204)

    // File should be gone
    await expect(fs.access(filePath)).rejects.toThrow()
  })

  it('returns 404 for non-existent preset', async () => {
    const req = mockReq('DELETE', '/__api/presets/my-sketch/ghost')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(404)
  })

  it('returns 400 for invalid preset name', async () => {
    const req = mockReq('DELETE', '/__api/presets/my-sketch/..')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('returns 405 for PUT on a preset', async () => {
    const req = mockReq('PUT', '/__api/presets/my-sketch/test')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(405)
  })

  it('returns 405 for POST on sketch-only URL', async () => {
    const req = mockReq('POST', '/__api/presets/my-sketch')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(405)
  })

  it('returns 404 for too many segments', async () => {
    const req = mockReq('GET', '/__api/presets/a/b/c')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(404)
  })

  it('returns 404 for no segments', async () => {
    const req = mockReq('GET', '/__api/presets/')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(404)
  })

  it('strips query string from URL', async () => {
    const dir = path.join(tmpRoot, 'sketches', 'my-sketch', 'presets')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'test.json'), '{"ok":true}')

    const req = mockReq('GET', '/__api/presets/my-sketch/test?cache=bust')
    const { res, result } = mockRes()
    await handlePresetRequest(tmpRoot, req, res)
    expect(result().status).toBe(200)
    expect(JSON.parse(result().body)).toEqual({ ok: true })
  })

  it('full CRUD round-trip', async () => {
    // Create
    const createReq = mockReq(
      'POST',
      '/__api/presets/my-sketch/roundtrip',
      '{"x":42}',
    )
    const { res: createRes, result: createResult } = mockRes()
    await handlePresetRequest(tmpRoot, createReq, createRes)
    expect(createResult().status).toBe(204)

    // List
    const listReq = mockReq('GET', '/__api/presets/my-sketch')
    const { res: listRes, result: listResult } = mockRes()
    await handlePresetRequest(tmpRoot, listReq, listRes)
    expect(JSON.parse(listResult().body)).toContain('roundtrip')

    // Read
    const readReq = mockReq('GET', '/__api/presets/my-sketch/roundtrip')
    const { res: readRes, result: readResult } = mockRes()
    await handlePresetRequest(tmpRoot, readReq, readRes)
    expect(JSON.parse(readResult().body)).toEqual({ x: 42 })

    // Delete
    const delReq = mockReq('DELETE', '/__api/presets/my-sketch/roundtrip')
    const { res: delRes, result: delResult } = mockRes()
    await handlePresetRequest(tmpRoot, delReq, delRes)
    expect(delResult().status).toBe(204)

    // Verify gone
    const listReq2 = mockReq('GET', '/__api/presets/my-sketch')
    const { res: listRes2, result: listResult2 } = mockRes()
    await handlePresetRequest(tmpRoot, listReq2, listRes2)
    expect(JSON.parse(listResult2().body)).toEqual([])
  })
})
