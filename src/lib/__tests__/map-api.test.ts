import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { checkHealth, generateMaps, listSessions, deleteSession, getFullBaseUrl } from '../map-api'

let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetch = vi.fn()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  } as Response
}

describe('checkHealth', () => {
  it('returns true when server responds with ok status', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ status: 'ok' }))
    expect(await checkHealth()).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:8100/api/health')
  })

  it('returns false when server responds with non-ok status', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ status: 'error' }))
    expect(await checkHealth()).toBe(false)
  })

  it('returns false when fetch throws (server unreachable)', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'))
    expect(await checkHealth()).toBe(false)
  })

  it('returns false on HTTP error', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 500))
    expect(await checkHealth()).toBe(false)
  })
})

describe('generateMaps', () => {
  const mockManifest = {
    version: 1,
    source_image: 'portrait.jpg',
    width: 640,
    height: 480,
    created_at: '2026-03-20T14:30:00+00:00',
    maps: [
      {
        filename: 'density_target.bin',
        key: 'density_target',
        dtype: 'float32',
        shape: [480, 640],
        value_range: [0.0, 1.0],
        description: 'Density target',
      },
    ],
  }

  const mockResponse = {
    session_id: 'abc-123',
    manifest: mockManifest,
    base_url: '/api/maps/abc-123',
  }

  it('sends image as multipart form data', async () => {
    mockFetch.mockResolvedValue(jsonResponse(mockResponse))
    const file = new File(['fake-image'], 'portrait.jpg', { type: 'image/jpeg' })

    const result = await generateMaps(file)

    expect(result.session_id).toBe('abc-123')
    expect(result.manifest.width).toBe(640)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8100/api/generate',
      expect.objectContaining({ method: 'POST' }),
    )

    // Verify FormData was sent as the body
    const callInit = mockFetch.mock.calls[0][1] as RequestInit
    expect(callInit.body).toBeInstanceOf(FormData)
    const formData = callInit.body as FormData
    expect(formData.get('image')).toBeInstanceOf(File)
  })

  it('includes request_body when options provided', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse))
    const file = new File(['fake'], 'portrait.jpg', { type: 'image/jpeg' })

    await generateMaps(file, { maps: ['density_target', 'flow_x'] })

    // fetch is called with (url, init) — init contains FormData body
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8100/api/generate',
      expect.objectContaining({ method: 'POST' }),
    )
    const formData = mockFetch.mock.calls[0][1].body as FormData
    const requestBody = JSON.parse(formData.get('request_body') as string)
    expect(requestBody.maps).toEqual(['density_target', 'flow_x'])
  })

  it('does not include request_body when options are empty', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse))
    const file = new File(['fake'], 'portrait.jpg', { type: 'image/jpeg' })

    await generateMaps(file, {})

    const formData = mockFetch.mock.calls[0][1].body as FormData
    expect(formData.get('request_body')).toBeNull()
  })

  it('throws on API error with detail message', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ detail: 'No face detected in image' }, 422),
    )
    const file = new File(['fake'], 'portrait.jpg', { type: 'image/jpeg' })

    await expect(generateMaps(file)).rejects.toThrow('No face detected in image')
  })

  it('throws with fallback message when no detail in error', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 500))
    const file = new File(['fake'], 'portrait.jpg', { type: 'image/jpeg' })

    await expect(generateMaps(file)).rejects.toThrow('API error: 500')
  })
})

describe('listSessions', () => {
  it('returns session list', async () => {
    const sessions = [
      {
        session_id: 'abc-123',
        source_image: 'portrait.jpg',
        created_at: '2026-03-20T14:30:00+00:00',
        map_keys: ['density_target'],
        persistent: false,
      },
    ]
    mockFetch.mockResolvedValue(jsonResponse(sessions))

    const result = await listSessions()
    expect(result).toHaveLength(1)
    expect(result[0].session_id).toBe('abc-123')
    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:8100/api/sessions')
  })

  it('throws on error', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ detail: 'Server error' }, 500))
    await expect(listSessions()).rejects.toThrow('Server error')
  })
})

describe('deleteSession', () => {
  it('sends DELETE request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
    } as Response)

    await deleteSession('abc-123')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8100/api/maps/abc-123',
      { method: 'DELETE' },
    )
  })

  it('does not throw on 404 (already deleted)', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ detail: 'Not found' }, 404))
    await expect(deleteSession('abc-123')).resolves.toBeUndefined()
  })

  it('throws on other errors', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ detail: 'Server error' }, 500))
    await expect(deleteSession('abc-123')).rejects.toThrow('Server error')
  })
})

describe('getFullBaseUrl', () => {
  it('returns full URL for session', () => {
    expect(getFullBaseUrl('abc-123')).toBe('http://127.0.0.1:8100/api/maps/abc-123')
  })
})
