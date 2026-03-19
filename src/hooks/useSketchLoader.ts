import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SketchModule } from '@/lib/types'

/**
 * Lazy import map from import.meta.glob — each entry is a path → dynamic import function.
 * Paths are relative to this file: ../../sketches/<name>/index.ts
 */
const sketchModules = import.meta.glob<
  { default?: SketchModule } & SketchModule
>('../../sketches/*/index.ts')

/** localStorage key for persisting the last active sketch */
export const LAST_SKETCH_KEY = 'plotter:lastSketch'

/** Pick the initial sketch: last-used if still available, else first in list */
export function getInitialSketch(sketchList: string[]): string {
  const last = localStorage.getItem(LAST_SKETCH_KEY)
  return last && sketchList.includes(last) ? last : sketchList[0]
}

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
        // Remember last sketch so it restores after page refresh
        localStorage.setItem(LAST_SKETCH_KEY, name)
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

  // Listen for sketch HMR updates. Each sketch file calls
  // import.meta.hot.accept() inline and dispatches a 'sketch-hmr-update'
  // CustomEvent. We swap in the new module to preserve Leva state.
  useEffect(() => {
    if (!import.meta.hot) return

    const handler = (e: Event) => {
      const { path, module } = (e as CustomEvent).detail as {
        path: string
        module: Record<string, unknown>
      }

      const match = path.match(/sketches\/([^/]+)\//)
      if (!match) return
      const updatedName = match[1]

      // Only hot-swap if this is the currently active sketch
      if (updatedName !== active?.name) return

      try {
        const validated = validateSketchModule(module)
        setActive({ sketch: validated, name: updatedName })
      } catch (err) {
        console.warn(
          '[HMR] Updated sketch failed validation, keeping previous version:',
          err instanceof Error ? err.message : err,
        )
      }
    }

    window.addEventListener('sketch-hmr-update', handler)
    return () => window.removeEventListener('sketch-hmr-update', handler)
  }, [active?.name])

  return {
    sketchList,
    activeSketch: active?.sketch ?? null,
    activeSketchName: active?.name ?? null,
    loading,
    error,
    loadSketch,
  }
}
