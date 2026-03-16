import { useCallback, useEffect, useRef, useState } from 'react'

import {
  ControlPanel,
  type ControlPanelHandle,
} from '@/components/ControlPanel'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { SketchViewer } from '@/components/SketchViewer'
import { useSketchLoader } from '@/hooks/useSketchLoader'
import { createSketchContext } from '@/lib/context'
import { extractParamValues } from '@/lib/params'
import { PAPER_SIZES } from '@/lib/paper'
import type { PaperSize, Polyline, SketchModule } from '@/lib/types'

/** Build a SketchContext from explicit param values */
function buildContext(paramValues: Record<string, unknown>) {
  const paperSize = (paramValues.paperSize as string) ?? 'letter'
  const margin = (paramValues.margin as number) ?? 0
  return createSketchContext(paperSize, undefined, margin)
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

  const controlPanelRef = useRef<ControlPanelHandle>(null)

  // Render output state — updated imperatively from the rAF loop
  const [lines, setLines] = useState<Polyline[]>([])
  const [paperSize, setPaperSize] = useState<PaperSize>(PAPER_SIZES.letter)
  const [margin, setMargin] = useState(0)
  const [renderError, setRenderError] = useState<string | null>(null)

  // Keep a ref to the active sketch so the rAF callback always sees the latest
  const sketchRef = useRef<SketchModule | null>(null)
  useEffect(() => {
    sketchRef.current = activeSketch
  }, [activeSketch])

  // --- rAF-throttled render loop ---
  // Coalesces rapid param changes (e.g. slider drags) to one render per frame.
  const pendingParamsRef = useRef<Record<string, unknown> | null>(null)
  const rafIdRef = useRef<number>(0)

  const flushRender = useCallback(() => {
    rafIdRef.current = 0
    const params = pendingParamsRef.current
    const sketch = sketchRef.current
    if (!params || !sketch) return

    try {
      const ctx = buildContext(params)
      const result = sketch.render(ctx, params)
      setLines(result)
      // Avoid new object reference when dimensions haven't changed,
      // which would cause SketchViewer to needlessly redraw.
      setPaperSize((prev) =>
        prev.width === ctx.paper.width && prev.height === ctx.paper.height
          ? prev
          : { width: ctx.paper.width, height: ctx.paper.height },
      )
      setMargin(ctx.paper.margin)
      setRenderError(null)
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Render failed')
    }
  }, [])

  const scheduleRender = useCallback(
    (paramValues: Record<string, unknown>) => {
      pendingParamsRef.current = paramValues
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(flushRender)
      }
    },
    [flushRender],
  )

  // Clean up pending rAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  // Load the first sketch on mount
  useEffect(() => {
    if (sketchList.length > 0 && !activeSketchName) {
      loadSketch(sketchList[0])
    }
  }, [sketchList, activeSketchName, loadSketch])

  // Call setup once per sketch load, then do the initial render
  const setupRanForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeSketch || !activeSketchName) return
    if (setupRanForRef.current === activeSketchName) return
    setupRanForRef.current = activeSketchName

    const paramValues = extractParamValues(activeSketch.params)

    if (activeSketch.setup) {
      const ctx = buildContext(paramValues)
      activeSketch.setup(ctx)
    }

    // Initial render with default param values
    scheduleRender(paramValues)
  }, [activeSketch, activeSketchName, scheduleRender])

  // Re-render when sketch code is hot-updated (activeSketch reference
  // changes but name stays the same). The setup guard above correctly
  // prevents setup() from re-running; we just need a fresh render().
  const prevSketchRef = useRef<SketchModule | null>(null)
  useEffect(() => {
    if (!activeSketch) return

    // Skip initial mount — the setup effect handles that render
    if (prevSketchRef.current === null) {
      prevSketchRef.current = activeSketch
      return
    }

    // Skip if reference hasn't changed
    if (prevSketchRef.current === activeSketch) return
    prevSketchRef.current = activeSketch

    // HMR: re-render with the user's current param values,
    // falling back to defaults if no prior render has occurred
    const params =
      pendingParamsRef.current ?? extractParamValues(activeSketch.params)
    scheduleRender(params)
  }, [activeSketch, scheduleRender])

  const handleRandomizeSeed = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 10000)
    controlPanelRef.current?.setValues({ seed: newSeed })
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading sketch…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen text-foreground">
      {/* Left sidebar: sketch selector + presets */}
      <aside
        data-testid="sidebar-left"
        className="flex w-60 shrink-0 flex-col border-r border-border bg-card"
      >
        <div className="p-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sketches
          </h2>
        </div>
        <ScrollArea className="flex-1">
          {/* Phase 6.2: SketchSelector component replaces this placeholder */}
          <div className="px-3 py-2">
            <p className="text-sm text-muted-foreground">
              {activeSketchName ?? 'No sketch loaded'}
            </p>
          </div>
        </ScrollArea>
        <Separator />
        <div className="p-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Presets
          </h2>
          {/* Phase 8: Preset controls replace this placeholder */}
          <p className="mt-2 text-xs text-muted-foreground">Coming soon</p>
        </div>
      </aside>

      {/* Center viewport */}
      <main className="min-w-0 flex-1">
        <ErrorBoundary>
          {renderError ? (
            <div className="flex h-full items-center justify-center bg-background">
              <p className="text-sm text-destructive">{renderError}</p>
            </div>
          ) : (
            <SketchViewer
              lines={lines}
              paperSize={paperSize}
              margin={margin}
              className="h-full"
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Right panel: controls + export */}
      {activeSketch && (
        <aside
          data-testid="sidebar-right"
          className="flex w-75 shrink-0 flex-col border-l border-border bg-card"
        >
          <div className="border-b border-border p-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={handleRandomizeSeed}
            >
              Randomize Seed
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ControlPanel
              ref={controlPanelRef}
              key={activeSketchName}
              params={activeSketch.params}
              onChange={scheduleRender}
            />
          </div>
          <Separator />
          <div className="p-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Export
            </h2>
            {/* Phase 7: ExportPanel component replaces this placeholder */}
            <p className="mt-2 text-xs text-muted-foreground">Coming soon</p>
          </div>
        </aside>
      )}
    </div>
  )
}

export default App
