import type { MapManifest } from '@/lib/types'

const MAP_API_BASE = 'http://127.0.0.1:8100'

/** Prefix used to distinguish API session IDs from local bundle names in param values */
export const API_PREFIX = 'api:'

export interface PreviewInfo {
  category: string
  name: string
  url: string
}

export interface GenerateResponse {
  session_id: string
  manifest: MapManifest
  base_url: string
  previews?: PreviewInfo[]
}

export interface GenerateOptions {
  maps?: string[]
  config?: Record<string, unknown>
  mode?: 'intermediates'
}

export interface SessionInfo {
  session_id: string
  source_image: string
  created_at: string
  map_keys: string[]
  persistent: boolean
  previews?: PreviewInfo[]
}

// ---------------------------------------------------------------------------
// Pipeline config types — mirrors the API's GenerateConfigSchema
// ---------------------------------------------------------------------------

export interface PipelineConfig {
  density?: {
    gamma?: number
    feature_weight?: number
    contour_weight?: number
    tonal_weight?: number
    importance_weight?: number
  }
  features?: {
    weights?: { eyes?: number; mouth?: number }
  }
  contour?: {
    direction?: string
    contour_thickness?: number
  }
  flow?: {
    blend_mode?: string
    coherence_power?: number
    etf?: {
      blur_sigma?: number
      refine_iterations?: number
    }
  }
  complexity?: {
    metric?: string
    sigma?: number
  }
  flow_speed?: {
    speed_min?: number
    speed_max?: number
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${MAP_API_BASE}/api/health`)
    if (!res.ok) return false
    const body = (await res.json()) as { status?: string }
    return body.status === 'ok'
  } catch {
    return false
  }
}

export async function generateMaps(
  imageFile: File,
  options?: GenerateOptions,
): Promise<GenerateResponse> {
  const formData = new FormData()
  formData.append('image', imageFile)

  if (options) {
    const requestBody: Record<string, unknown> = {}
    if (options.maps) requestBody.maps = options.maps
    if (options.config) requestBody.config = options.config
    if (options.mode) requestBody.mode = options.mode
    if (Object.keys(requestBody).length > 0) {
      formData.append('request_body', JSON.stringify(requestBody))
    }
  }

  const res = await fetch(`${MAP_API_BASE}/api/generate`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const detail = await parseErrorDetail(res)
    throw new Error(detail)
  }

  return (await res.json()) as GenerateResponse
}

export async function listSessions(): Promise<SessionInfo[]> {
  const res = await fetch(`${MAP_API_BASE}/api/sessions`)

  if (!res.ok) {
    const detail = await parseErrorDetail(res)
    throw new Error(detail)
  }

  return (await res.json()) as SessionInfo[]
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${MAP_API_BASE}/api/maps/${sessionId}`, {
    method: 'DELETE',
  })

  if (!res.ok && res.status !== 404) {
    const detail = await parseErrorDetail(res)
    throw new Error(detail)
  }
}

/** Build the full base URL for fetching .bin files from an API session. */
export function getFullBaseUrl(sessionId: string): string {
  return `${MAP_API_BASE}/api/maps/${sessionId}`
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string }
    return body.detail ?? `API error: ${res.status} ${res.statusText}`
  } catch {
    return `API error: ${res.status} ${res.statusText}`
  }
}
