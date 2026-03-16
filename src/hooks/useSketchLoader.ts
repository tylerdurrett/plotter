import { useCallback, useMemo, useRef, useState } from 'react'
import type { SketchModule } from '@/lib/types'

/**
 * Lazy import map from import.meta.glob — each entry is a path → dynamic import function.
 * Paths are relative to this file: ../../sketches/<name>/index.ts
 */
const sketchModules = import.meta.glob<
  { default?: SketchModule } & SketchModule
>('../../sketches/*/index.ts')

/** Extract the sketch directory name from a glob path */
export function extractSketchName(path: string): string {
  const match = path.match(/sketches\/([^/]+)\/index\.ts$/)
  if (!match) throw new Error(`Invalid sketch path: ${path}`)
  return match[1]
}

/** Validate that a module satisfies the SketchModule contract */
export function validateSketchModule(
  mod: Record<string, unknown>,
): SketchModule {
  // Support both default export and named exports
  const resolved =
    mod.default && typeof mod.default === 'object'
      ? (mod.default as Record<string, unknown>)
      : mod

  if (typeof resolved.render !== 'function') {
    throw new Error('Sketch module must export a render() function')
  }
  if (!resolved.params || typeof resolved.params !== 'object') {
    throw new Error('Sketch module must export a params object')
  }

  return resolved as unknown as SketchModule
}

export interface UseSketchLoaderResult {
  /** Available sketch names derived from directory names */
  sketchList: string[]
  /** The currently loaded sketch module, or null */
  activeSketch: SketchModule | null
  /** Name of the currently loaded sketch, or null */
  activeSketchName: string | null
  /** Whether a sketch is currently being loaded */
  loading: boolean
  /** Error message from the last failed load, or null */
  error: string | null
  /** Dynamically import and activate a sketch by name */
  loadSketch(name: string): Promise<void>
}

export function useSketchLoader(): UseSketchLoaderResult {
  // Combined into a single state to keep sketch + name in sync atomically
  const [active, setActive] = useState<{
    sketch: SketchModule
    name: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build a name → import-function lookup once
  const { sketchList, importMap } = useMemo(() => {
    const map = new Map<string, () => Promise<Record<string, unknown>>>()
    for (const [path, importFn] of Object.entries(sketchModules)) {
      const name = extractSketchName(path)
      map.set(name, importFn as () => Promise<Record<string, unknown>>)
    }
    return {
      sketchList: Array.from(map.keys()).sort(),
      importMap: map,
    }
  }, [])

  // Guard against stale loads when loadSketch is called rapidly
  const loadIdRef = useRef(0)

  const loadSketch = useCallback(
    async (name: string) => {
      const importFn = importMap.get(name)
      if (!importFn) {
        setError(`Sketch "${name}" not found`)
        return
      }

      const id = ++loadIdRef.current
      setLoading(true)
      setError(null)

      try {
        const mod = await importFn()
        // Bail if a newer load was started while we awaited
        if (id !== loadIdRef.current) return

        const validated = validateSketchModule(mod)
        setActive({ sketch: validated, name })
      } catch (err) {
        if (id !== loadIdRef.current) return
        const message =
          err instanceof Error ? err.message : 'Failed to load sketch'
        setError(message)
        setActive(null)
      } finally {
        if (id === loadIdRef.current) {
          setLoading(false)
        }
      }
    },
    [importMap],
  )

  return {
    sketchList,
    activeSketch: active?.sketch ?? null,
    activeSketchName: active?.name ?? null,
    loading,
    error,
    loadSketch,
  }
}
