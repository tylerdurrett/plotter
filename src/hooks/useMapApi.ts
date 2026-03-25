import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkHealth,
  generateMaps,
  listSessions,
  deleteSession as apiDeleteSession,
  type GenerateResponse,
  type GenerateOptions,
} from '@/lib/map-api'

const HEALTH_CHECK_INTERVAL = 30_000

export interface UseMapApiResult {
  apiAvailable: boolean
  checking: boolean
  sessions: SessionInfo[]
  generating: boolean
  error: string | null
  generate: (file: File, options?: GenerateOptions) => Promise<GenerateResponse>
  refreshSessions: () => void
  deleteSession: (sessionId: string) => Promise<void>
}

// Re-export for convenience — consumers can also import directly from @/lib/map-api
import type { SessionInfo } from '@/lib/map-api'

export function useMapApi(enabled = true): UseMapApiResult {
  const [apiAvailable, setApiAvailable] = useState(false)
  const [checking, setChecking] = useState(true)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const runHealthCheck = useCallback(async () => {
    setChecking(true)
    const healthy = await checkHealth()
    if (!mountedRef.current) return
    setApiAvailable(healthy)
    setChecking(false)
    return healthy
  }, [])

  const fetchSessions = useCallback(async () => {
    try {
      const result = await listSessions()
      if (!mountedRef.current) return
      setSessions(result)
    } catch {
      // Session fetch failure is non-critical — keep existing list
    }
  }, [])

  // Health check on mount + periodic polling — only when enabled
  useEffect(() => {
    if (!enabled) {
      setChecking(false)
      return
    }

    mountedRef.current = true

    const init = async () => {
      const healthy = await runHealthCheck()
      if (healthy) await fetchSessions()
    }
    init()

    const interval = setInterval(async () => {
      const healthy = await runHealthCheck()
      if (healthy) await fetchSessions()
    }, HEALTH_CHECK_INTERVAL)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [enabled, runHealthCheck, fetchSessions])

  const generate = useCallback(
    async (file: File, options?: GenerateOptions): Promise<GenerateResponse> => {
      setGenerating(true)
      setError(null)
      try {
        const response = await generateMaps(file, options)
        if (mountedRef.current) {
          await fetchSessions()
        }
        return response
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Map generation failed'
        if (mountedRef.current) setError(message)
        throw err
      } finally {
        if (mountedRef.current) setGenerating(false)
      }
    },
    [fetchSessions],
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await apiDeleteSession(sessionId)
      if (mountedRef.current) {
        setSessions(prev => prev.filter(s => s.session_id !== sessionId))
      }
    },
    [],
  )

  return {
    apiAvailable,
    checking,
    sessions,
    generating,
    error,
    generate,
    refreshSessions: fetchSessions,
    deleteSession: handleDeleteSession,
  }
}
