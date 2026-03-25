import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useMapApi } from '../useMapApi'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  globalThis.fetch = fetchMock
})

afterEach(() => {
  vi.restoreAllMocks()
})

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const mockSession = {
  session_id: 'abc-123',
  source_image: 'portrait.jpg',
  created_at: '2026-03-20T14:30:00+00:00',
  map_keys: ['density_target'],
  persistent: false,
}

describe('useMapApi', () => {
  it('runs health check on mount and reports available', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: 'ok' })) // health check
      .mockResolvedValueOnce(jsonResponse([mockSession])) // sessions

    const { result } = renderHook(() => useMapApi())

    expect(result.current.checking).toBe(true)

    await waitFor(() => expect(result.current.checking).toBe(false))

    expect(result.current.apiAvailable).toBe(true)
    expect(result.current.sessions).toEqual([mockSession])
  })

  it('reports unavailable when health check fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Connection refused'))

    const { result } = renderHook(() => useMapApi())

    await waitFor(() => expect(result.current.checking).toBe(false))

    expect(result.current.apiAvailable).toBe(false)
    expect(result.current.sessions).toEqual([])
  })

  it('does not fetch sessions when API is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'error' }))

    const { result } = renderHook(() => useMapApi())

    await waitFor(() => expect(result.current.checking).toBe(false))

    // Only health check call, no sessions call
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.sessions).toEqual([])
  })

  it('generate calls API and refreshes sessions', async () => {
    const generateResponse = {
      session_id: 'new-123',
      manifest: {
        version: 1,
        source_image: 'new.jpg',
        width: 640,
        height: 480,
        created_at: '2026-03-20T15:00:00+00:00',
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
      },
      base_url: '/api/maps/new-123',
    }

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: 'ok' })) // health check
      .mockResolvedValueOnce(jsonResponse([])) // initial sessions
      .mockResolvedValueOnce(jsonResponse(generateResponse)) // generate
      .mockResolvedValueOnce(jsonResponse([mockSession])) // refresh sessions after generate

    const { result } = renderHook(() => useMapApi())

    await waitFor(() => expect(result.current.checking).toBe(false))

    const file = new File(['fake'], 'portrait.jpg', { type: 'image/jpeg' })
    let response: unknown

    await act(async () => {
      response = await result.current.generate(file)
    })

    expect(response).toEqual(generateResponse)
    expect(result.current.generating).toBe(false)
    expect(result.current.sessions).toEqual([mockSession])
  })

  it('generate sets error on failure', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: 'ok' })) // health check
      .mockResolvedValueOnce(jsonResponse([])) // initial sessions
      .mockResolvedValueOnce(jsonResponse({ detail: 'No face detected' }, 422)) // generate fails

    const { result } = renderHook(() => useMapApi())

    await waitFor(() => expect(result.current.checking).toBe(false))

    const file = new File(['fake'], 'portrait.jpg', { type: 'image/jpeg' })

    await act(async () => {
      try {
        await result.current.generate(file)
      } catch {
        // expected
      }
    })

    expect(result.current.error).toBe('No face detected')
    expect(result.current.generating).toBe(false)
  })

  it('deleteSession removes session from list', async () => {
    const session2 = { ...mockSession, session_id: 'def-456' }
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: 'ok' })) // health check
      .mockResolvedValueOnce(jsonResponse([mockSession, session2])) // sessions
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // delete

    const { result } = renderHook(() => useMapApi())

    await waitFor(() => expect(result.current.sessions).toHaveLength(2))

    await act(async () => {
      await result.current.deleteSession('abc-123')
    })

    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].session_id).toBe('def-456')
  })

  it('refreshSessions re-fetches session list', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: 'ok' })) // health check
      .mockResolvedValueOnce(jsonResponse([])) // initial sessions

    const { result } = renderHook(() => useMapApi())

    await waitFor(() => expect(result.current.checking).toBe(false))

    fetchMock.mockResolvedValueOnce(jsonResponse([mockSession])) // refresh

    await act(async () => {
      result.current.refreshSessions()
    })

    await waitFor(() => expect(result.current.sessions).toHaveLength(1))
  })
})
