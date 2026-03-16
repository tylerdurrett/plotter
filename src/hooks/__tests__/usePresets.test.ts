import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { usePresets } from '@/hooks/usePresets'

// Mock fetch globally for each test
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  globalThis.fetch = fetchMock
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Helper to create a successful JSON Response */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Helper to create an error JSON Response */
function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Helper to create a 204 No Content Response */
function noContentResponse(): Response {
  return new Response(null, { status: 204 })
}

describe('usePresets', () => {
  describe('initial state', () => {
    it('returns empty presets when sketchName is null', () => {
      fetchMock.mockResolvedValue(jsonResponse([]))
      const { result } = renderHook(() => usePresets(null))
      expect(result.current.presets).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('fetches preset list on mount when sketchName is provided', async () => {
      fetchMock.mockResolvedValue(jsonResponse(['warm', 'cool']))
      const { result } = renderHook(() =>
        usePresets('2026-03-15-concentric-circles'),
      )

      expect(result.current.loading).toBe(true)
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.presets).toEqual(['warm', 'cool'])
      expect(fetchMock).toHaveBeenCalledWith(
        '/__api/presets/2026-03-15-concentric-circles',
      )
    })
  })

  describe('sketch switching', () => {
    it('refetches preset list when sketchName changes', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(['preset-a']))
      const { result, rerender } = renderHook(
        ({ name }: { name: string }) => usePresets(name),
        { initialProps: { name: 'sketch-1' } },
      )
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.presets).toEqual(['preset-a'])

      fetchMock.mockResolvedValueOnce(jsonResponse(['preset-b', 'preset-c']))
      rerender({ name: 'sketch-2' })
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.presets).toEqual(['preset-b', 'preset-c'])
    })

    it('clears presets when sketchName becomes null', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(['preset-a']))
      const { result, rerender } = renderHook(
        ({ name }: { name: string | null }) => usePresets(name),
        { initialProps: { name: 'sketch-1' as string | null } },
      )
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.presets).toEqual(['preset-a'])

      rerender({ name: null })
      expect(result.current.presets).toEqual([])
      expect(result.current.error).toBeNull()
    })
  })

  describe('loadPreset', () => {
    it('fetches and returns preset params', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({ count: 10, seed: 42 }))

      const { result } = renderHook(() => usePresets('my-sketch'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      let params: Record<string, unknown> | undefined
      await act(async () => {
        params = await result.current.loadPreset('warm')
      })

      expect(params).toEqual({ count: 10, seed: 42 })
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/__api/presets/my-sketch/warm',
      )
    })

    it('sets error and throws on 404', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(errorResponse('Preset "missing" not found', 404))

      const { result } = renderHook(() => usePresets('my-sketch'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await expect(result.current.loadPreset('missing')).rejects.toThrow(
          'Preset "missing" not found',
        )
      })
      expect(result.current.error).toBe('Preset "missing" not found')
    })

    it('throws when no sketch is selected', async () => {
      const { result } = renderHook(() => usePresets(null))
      await expect(result.current.loadPreset('any')).rejects.toThrow(
        'No sketch selected',
      )
    })
  })

  describe('savePreset', () => {
    it('POSTs params and refreshes the list', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(noContentResponse())
        .mockResolvedValueOnce(jsonResponse(['saved-one']))

      const { result } = renderHook(() => usePresets('my-sketch'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.savePreset('saved-one', { count: 7 })
      })

      // Verify POST call
      expect(fetchMock).toHaveBeenCalledWith(
        '/__api/presets/my-sketch/saved-one',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 7 }),
        },
      )

      // List was refreshed after save
      await waitFor(() => expect(result.current.presets).toEqual(['saved-one']))
    })

    it('sets error and throws on save failure', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(errorResponse('Invalid JSON body', 400))

      const { result } = renderHook(() => usePresets('my-sketch'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await expect(
          result.current.savePreset('bad', { count: 7 }),
        ).rejects.toThrow('Invalid JSON body')
      })
      expect(result.current.error).toBe('Invalid JSON body')
    })

    it('throws when no sketch is selected', async () => {
      const { result } = renderHook(() => usePresets(null))
      await expect(result.current.savePreset('any', { x: 1 })).rejects.toThrow(
        'No sketch selected',
      )
    })
  })

  describe('deletePreset', () => {
    it('sends DELETE and refreshes the list', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(['to-delete']))
        .mockResolvedValueOnce(noContentResponse())
        .mockResolvedValueOnce(jsonResponse([]))

      const { result } = renderHook(() => usePresets('my-sketch'))
      await waitFor(() => expect(result.current.presets).toEqual(['to-delete']))

      await act(async () => {
        await result.current.deletePreset('to-delete')
      })

      expect(fetchMock).toHaveBeenCalledWith(
        '/__api/presets/my-sketch/to-delete',
        { method: 'DELETE' },
      )

      // List was refreshed after delete
      await waitFor(() => expect(result.current.presets).toEqual([]))
    })

    it('sets error and throws on 404', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(errorResponse('Preset "gone" not found', 404))

      const { result } = renderHook(() => usePresets('my-sketch'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await expect(result.current.deletePreset('gone')).rejects.toThrow(
          'Preset "gone" not found',
        )
      })
      expect(result.current.error).toBe('Preset "gone" not found')
    })

    it('throws when no sketch is selected', async () => {
      const { result } = renderHook(() => usePresets(null))
      await expect(result.current.deletePreset('any')).rejects.toThrow(
        'No sketch selected',
      )
    })
  })

  describe('refreshPresets', () => {
    it('re-fetches the preset list', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(['a']))
        .mockResolvedValueOnce(jsonResponse(['a', 'b']))

      const { result } = renderHook(() => usePresets('my-sketch'))
      await waitFor(() => expect(result.current.presets).toEqual(['a']))

      await act(async () => {
        await result.current.refreshPresets()
      })

      await waitFor(() => expect(result.current.presets).toEqual(['a', 'b']))
    })

    it('is a no-op when sketchName is null', async () => {
      const { result } = renderHook(() => usePresets(null))

      await act(async () => {
        await result.current.refreshPresets()
      })

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('handles network errors on initial fetch', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'))
      const { result } = renderHook(() => usePresets('my-sketch'))

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.error).toBe('Network error')
      expect(result.current.presets).toEqual([])
    })

    it('clears error on successful operation', async () => {
      // First fetch fails
      fetchMock.mockRejectedValueOnce(new Error('Network error'))
      const { result } = renderHook(() => usePresets('my-sketch'))
      await waitFor(() => expect(result.current.error).toBe('Network error'))

      // Refresh succeeds, clears error
      fetchMock.mockResolvedValueOnce(jsonResponse(['a']))
      await act(async () => {
        await result.current.refreshPresets()
      })
      await waitFor(() => {
        expect(result.current.error).toBeNull()
        expect(result.current.presets).toEqual(['a'])
      })
    })
  })
})
