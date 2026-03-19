import { useCallback, useEffect, useState } from 'react'
import type { MapBundleInfo } from '../plugins/vite-plugin-maps'

const API_URL = '/__api/maps'

export interface UseMapsResult {
  bundles: MapBundleInfo[]
  loading: boolean
  error: string | null
  refresh: () => void
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? fallback
  } catch {
    return fallback
  }
}

export function useMaps(): UseMapsResult {
  const [bundles, setBundles] = useState<MapBundleInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBundles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(API_URL)
      if (!res.ok) {
        throw new Error(await parseError(res, 'Failed to fetch map bundles'))
      }

      const data = (await res.json()) as MapBundleInfo[]
      setBundles(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch map bundles'
      setError(message)
      setBundles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBundles()
  }, [fetchBundles])

  return {
    bundles,
    loading,
    error,
    refresh: fetchBundles,
  }
}