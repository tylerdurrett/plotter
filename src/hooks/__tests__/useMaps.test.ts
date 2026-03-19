import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useMaps } from '../useMaps'
import type { MapBundleInfo } from '../../plugins/vite-plugin-maps'

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

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const mockBundle: MapBundleInfo = {
  name: 'test-bundle',
  manifest: {
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
  },
  previewUrl: '/maps/test-bundle/export/previews/density/density_target.png',
}

describe('useMaps', () => {
  it('fetches bundles on mount', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([mockBundle]))

    const { result } = renderHook(() => useMaps())

    expect(result.current.loading).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/__api/maps')

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bundles).toEqual([mockBundle])
    expect(result.current.error).toBeNull()
  })

  it('handles empty bundles list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]))

    const { result } = renderHook(() => useMaps())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bundles).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('handles multiple bundles', async () => {
    const bundle2 = { ...mockBundle, name: 'test-bundle-2' }
    fetchMock.mockResolvedValueOnce(jsonResponse([mockBundle, bundle2]))

    const { result } = renderHook(() => useMaps())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bundles).toHaveLength(2)
    expect(result.current.bundles[0].name).toBe('test-bundle')
    expect(result.current.bundles[1].name).toBe('test-bundle-2')
  })

  it('handles API errors with error message', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse('Server error', 500))

    const { result } = renderHook(() => useMaps())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bundles).toEqual([])
    expect(result.current.error).toBe('Server error')
  })

  it('handles network errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useMaps())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bundles).toEqual([])
    expect(result.current.error).toBe('Network error')
  })

  it('handles non-Error thrown values', async () => {
    fetchMock.mockRejectedValueOnce('String error')

    const { result } = renderHook(() => useMaps())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bundles).toEqual([])
    expect(result.current.error).toBe('Failed to fetch map bundles')
  })

  it('refresh function re-fetches bundles', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([mockBundle]))

    const { result } = renderHook(() => useMaps())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const bundle2 = { ...mockBundle, name: 'test-bundle-2' }
    fetchMock.mockResolvedValueOnce(jsonResponse([mockBundle, bundle2]))

    act(() => {
      result.current.refresh()
    })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.bundles).toHaveLength(2)
  })

  it('clears error on successful refresh', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Initial error'))

    const { result } = renderHook(() => useMaps())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Initial error')

    fetchMock.mockResolvedValueOnce(jsonResponse([mockBundle]))
    act(() => {
      result.current.refresh()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.bundles).toEqual([mockBundle])
  })
})