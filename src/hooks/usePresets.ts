import { useCallback, useEffect, useRef, useState } from 'react'

const API_BASE = '/__api/presets'

export interface UsePresetsResult {
  /** Available preset names for the current sketch */
  presets: string[]
  /** Whether the preset list is being fetched (not set for individual load/save/delete) */
  loading: boolean
  /** Error message from the last failed operation, or null */
  error: string | null
  /** Fetch preset params by name */
  loadPreset(name: string): Promise<Record<string, unknown>>
  /** Save current params as a named preset */
  savePreset(name: string, params: Record<string, unknown>): Promise<void>
  /** Delete a preset by name */
  deletePreset(name: string): Promise<void>
  /** Re-fetch the preset list */
  refreshPresets(): Promise<void>
}

/**
 * Parse an API error response or network failure into a message string.
 * The preset API returns `{ error: "..." }` for 4xx/5xx responses.
 */
async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? fallback
  } catch {
    return fallback
  }
}

/** Build a preset API URL for a sketch, optionally with a preset name. */
function presetUrl(sketch: string, name?: string): string {
  const base = `${API_BASE}/${encodeURIComponent(sketch)}`
  return name ? `${base}/${encodeURIComponent(name)}` : base
}

/**
 * Hook for preset CRUD against the Vite dev-server preset API.
 * Automatically fetches the preset list when sketchName changes.
 */
export function usePresets(sketchName: string | null): UsePresetsResult {
  const [presets, setPresets] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Guard against stale fetches when sketchName changes rapidly
  const fetchIdRef = useRef(0)

  const fetchPresetList = useCallback(async (sketch: string, id: number) => {
    const res = await fetch(presetUrl(sketch))
    if (id !== fetchIdRef.current) return
    if (!res.ok) {
      throw new Error(await parseError(res, 'Failed to list presets'))
    }
    const names = (await res.json()) as string[]
    // Avoid re-render when the list hasn't changed
    setPresets((prev) => {
      if (prev.length === names.length && prev.every((n, i) => n === names[i]))
        return prev
      return names
    })
  }, [])

  const refreshPresets = useCallback(async () => {
    if (!sketchName) return
    const id = ++fetchIdRef.current
    setLoading(true)
    setError(null)
    try {
      await fetchPresetList(sketchName, id)
    } catch (err) {
      if (id !== fetchIdRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to list presets')
    } finally {
      if (id === fetchIdRef.current) setLoading(false)
    }
  }, [sketchName, fetchPresetList])

  // Auto-fetch preset list when sketch changes
  useEffect(() => {
    if (!sketchName) {
      setPresets([])
      setError(null)
      return
    }
    // Delegate to refreshPresets to avoid duplicating fetch/error/loading logic
    refreshPresets()
  }, [sketchName, refreshPresets])

  const loadPreset = useCallback(
    async (name: string): Promise<Record<string, unknown>> => {
      if (!sketchName) throw new Error('No sketch selected')
      setError(null)
      const res = await fetch(presetUrl(sketchName, name))
      if (!res.ok) {
        const msg = await parseError(res, `Failed to load preset "${name}"`)
        setError(msg)
        throw new Error(msg)
      }
      return (await res.json()) as Record<string, unknown>
    },
    [sketchName],
  )

  const savePreset = useCallback(
    async (name: string, params: Record<string, unknown>): Promise<void> => {
      if (!sketchName) throw new Error('No sketch selected')
      setError(null)
      const res = await fetch(presetUrl(sketchName, name), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const msg = await parseError(res, `Failed to save preset "${name}"`)
        setError(msg)
        throw new Error(msg)
      }
      // Refresh the list to include the new preset
      await refreshPresets()
    },
    [sketchName, refreshPresets],
  )

  const deletePreset = useCallback(
    async (name: string): Promise<void> => {
      if (!sketchName) throw new Error('No sketch selected')
      setError(null)
      const res = await fetch(presetUrl(sketchName, name), {
        method: 'DELETE',
      })
      if (!res.ok) {
        const msg = await parseError(res, `Failed to delete preset "${name}"`)
        setError(msg)
        throw new Error(msg)
      }
      // Refresh the list to reflect removal
      await refreshPresets()
    },
    [sketchName, refreshPresets],
  )

  return {
    presets,
    loading,
    error,
    loadPreset,
    savePreset,
    deletePreset,
    refreshPresets,
  }
}
