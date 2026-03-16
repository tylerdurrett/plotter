import { useEffect, useMemo, useRef } from 'react'

import { ControlPanel } from '@/components/ControlPanel'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SketchViewer } from '@/components/SketchViewer'
import { useSketchLoader } from '@/hooks/useSketchLoader'
import { createSketchContext } from '@/lib/context'
import { extractParamValues } from '@/lib/params'
import { PAPER_SIZES } from '@/lib/paper'
import type { Polyline, SketchModule } from '@/lib/types'

/** Derive param values and build a SketchContext from a sketch's param schema */
function buildSketchContext(sketch: SketchModule) {
  const paramValues = extractParamValues(sketch.params)
  const paperSize = (paramValues.paperSize as string) ?? 'letter'
  const margin = (paramValues.margin as number) ?? 0
  const ctx = createSketchContext(paperSize, undefined, margin)
  return { ctx, paramValues, margin }
}

const FALLBACK = {
  lines: [] as Polyline[],
  paperSize: PAPER_SIZES.letter,
  margin: 0,
  renderError: null as string | null,
}

function App() {
  const {
    sketchList,
    activeSketch,
    activeSketchName,
    loading,
    error,
    loadSketch,
  } = useSketchLoader()

  // Load the first sketch on mount
  useEffect(() => {
    if (sketchList.length > 0 && !activeSketchName) {
      loadSketch(sketchList[0])
    }
  }, [sketchList, activeSketchName, loadSketch])

  // Call setup once per sketch load (not on every param change)
  const setupRanForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeSketch || !activeSketchName) return
    if (setupRanForRef.current === activeSketchName) return
    setupRanForRef.current = activeSketchName
    if (!activeSketch.setup) return
    const { ctx } = buildSketchContext(activeSketch)
    activeSketch.setup(ctx)
  }, [activeSketch, activeSketchName])

  // Extract param values and compute polylines (render error derived inline, not via state)
  const { lines, paperSize, margin, renderError } = useMemo(() => {
    if (!activeSketch) return FALLBACK

    try {
      const { ctx, paramValues, margin } = buildSketchContext(activeSketch)
      const result = activeSketch.render(ctx, paramValues)
      return {
        lines: result,
        paperSize: { width: ctx.paper.width, height: ctx.paper.height },
        margin,
        renderError: null,
      }
    } catch (err) {
      return {
        ...FALLBACK,
        renderError: err instanceof Error ? err.message : 'Render failed',
      }
    }
  }, [activeSketch])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading sketch…</p>
      </div>
    )
  }

  if (error || renderError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-destructive">{error ?? renderError}</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen text-foreground">
      <div className="flex-1">
        <ErrorBoundary>
          <SketchViewer
            lines={lines}
            paperSize={paperSize}
            margin={margin}
            className="h-full"
          />
        </ErrorBoundary>
      </div>
      {activeSketch && (
        <div className="w-75 shrink-0 overflow-y-auto border-l border-border bg-card">
          <ControlPanel
            key={activeSketchName}
            params={activeSketch.params}
            onChange={() => {}}
          />
        </div>
      )}
    </div>
  )
}

export default App
