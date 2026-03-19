import { useCallback, useEffect, useRef, useState } from 'react'

import {
  ControlPanel,
  type ControlPanelHandle,
} from '@/components/ControlPanel'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ExportPanel } from '@/components/ExportPanel'
import { MapPreview } from '@/components/MapPreview'
import { PanelLayout } from '@/components/PanelLayout'
import { PresetPanel } from '@/components/PresetPanel'
import { SketchSelector } from '@/components/SketchSelector'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { SketchViewer } from '@/components/SketchViewer'
import { useLevaParamHover } from '@/hooks/useLevaParamHover'
import { useMaps } from '@/hooks/useMaps'
import { useSketchLoader } from '@/hooks/useSketchLoader'
import { createSketchContext } from '@/lib/context'
import { MapBundle } from '@/lib/maps'
import { extractParamValues } from '@/lib/params'
import { PAPER_SIZES } from '@/lib/paper'
import type { PaperSize, Polyline, SketchModule, MapFitMode } from '@/lib/types'
import type { MapBundleInfo } from '@/plugins/vite-plugin-maps'

/** Build a SketchContext from explicit param values */
function buildContext(
  paramValues: Record<string, unknown>,
  mapBundle?: MapBundle,
) {
  const paperSize = (paramValues.paperSize as string) ?? 'letter'
  const margin = (paramValues.margin as number) ?? 0
  return createSketchContext(paperSize, undefined, margin, mapBundle)
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
  // Re-attach when sketch changes since ControlPanel remounts (new Leva DOM)
  const highlightMargin = useLevaParamHover('margin', activeSketchName)

  // Map bundle state
  const { bundles: mapBundles } = useMaps()
  const [currentMapBundle, setCurrentMapBundle] = useState<MapBundle | undefined>()
  const [currentBundleInfo, setCurrentBundleInfo] = useState<MapBundleInfo | undefined>()
  const [loadingMapBundle, setLoadingMapBundle] = useState(false)

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
      const ctx = buildContext(params, currentMapBundle)
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
  }, [currentMapBundle])

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
      const ctx = buildContext(paramValues, currentMapBundle)
      activeSketch.setup(ctx)
    }

    // Initial render with default param values
    scheduleRender(paramValues)
  }, [activeSketch, activeSketchName, scheduleRender, currentMapBundle])

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

  // Update mapBundle dropdown options dynamically when bundles are loaded
  useEffect(() => {
    if (!activeSketch || !activeSketchName) return
    if (activeSketchName !== '2026-03-18-portrait-1') return

    // Update the dropdown options
    const bundleOptions = ['none', ...mapBundles.map(b => b.name)]

    // Check if params has mapBundle field
    if ('mapBundle' in activeSketch.params) {
      const mapBundleParam = activeSketch.params.mapBundle as any
      if (mapBundleParam && typeof mapBundleParam === 'object' && 'options' in mapBundleParam) {
        // Update the options array directly
        mapBundleParam.options.length = 0
        mapBundleParam.options.push(...bundleOptions)
      }
    }
  }, [activeSketch, activeSketchName, mapBundles])

  // Load MapBundle when mapBundle parameter changes
  useEffect(() => {
    const loadMapBundle = async () => {
      const params = pendingParamsRef.current
      if (!params || !activeSketch) return

      const mapBundleName = params.mapBundle as string
      const fitMode = (params.fitMode as MapFitMode) || 'cover'

      // Clear bundle if 'none' is selected
      if (!mapBundleName || mapBundleName === 'none') {
        setCurrentMapBundle(undefined)
        setCurrentBundleInfo(undefined)
        return
      }

      // Find the bundle info
      const bundleInfo = mapBundles.find(b => b.name === mapBundleName)
      if (!bundleInfo) {
        console.warn(`Map bundle "${mapBundleName}" not found`)
        setCurrentMapBundle(undefined)
        setCurrentBundleInfo(undefined)
        return
      }

      // Set the bundle info for preview display
      setCurrentBundleInfo(bundleInfo)

      // Load the MapBundle
      try {
        setLoadingMapBundle(true)
        const paperSize = (params.paperSize as string) ?? 'letter'
        const margin = (params.margin as number) ?? 0
        const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.letter
        const drawWidth = paper.width - margin * 2
        const drawHeight = paper.height - margin * 2

        const bundle = await MapBundle.load(
          `/maps/${mapBundleName}/export`,
          drawWidth,
          drawHeight,
          fitMode,
        )

        setCurrentMapBundle(bundle)

        // Re-run setup if the sketch has one
        if (activeSketch.setup) {
          const ctx = buildContext(params, bundle)
          await activeSketch.setup(ctx)
        }

        // Trigger a re-render with the new bundle
        scheduleRender(params)
      } catch (error) {
        console.error('Failed to load map bundle:', error)
        setCurrentMapBundle(undefined)
        setCurrentBundleInfo(undefined)
      } finally {
        setLoadingMapBundle(false)
      }
    }

    loadMapBundle()
  }, [pendingParamsRef.current?.mapBundle, pendingParamsRef.current?.fitMode, mapBundles, activeSketch, scheduleRender])

  const handleRandomizeSeed = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 10000)
    controlPanelRef.current?.setValues({ seed: newSeed })
  }, [])

  const getCurrentParams = useCallback(() => pendingParamsRef.current, [])

  const handleLoadPreset = useCallback(
    (params: Record<string, unknown>) => {
      controlPanelRef.current?.setValues(params)
      scheduleRender(params)
    },
    [scheduleRender],
  )

  const leftSidebar = (
    <aside
      data-testid="sidebar-left"
      className="flex h-full flex-col border-r border-border bg-card"
    >
      <div className="p-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Sketches
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <SketchSelector
          sketches={sketchList}
          activeSketch={activeSketchName}
          onSelect={loadSketch}
          loading={loading}
        />
      </ScrollArea>
      <Separator />
      <div className="p-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Presets
        </h2>
        <PresetPanel
          sketchName={activeSketchName}
          getParams={getCurrentParams}
          onLoad={handleLoadPreset}
        />
      </div>
    </aside>
  )

  const displayError = error ?? renderError
  const centerViewport = (
    <ErrorBoundary>
      {displayError ? (
        <div className="flex h-full items-center justify-center bg-background">
          <p className="text-sm text-destructive">{displayError}</p>
        </div>
      ) : (
        <SketchViewer
          lines={lines}
          paperSize={paperSize}
          margin={margin}
          highlightMargin={highlightMargin}
          className="h-full"
        />
      )}
    </ErrorBoundary>
  )

  const rightPanel = activeSketch ? (
    <aside
      data-testid="sidebar-right"
      className="flex h-full flex-col border-l border-border bg-card"
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
        {activeSketchName === '2026-03-18-portrait-1' && (
          <MapPreview
            bundleInfo={currentBundleInfo}
            loading={loadingMapBundle}
          />
        )}
      </div>
      <Separator />
      <ExportPanel
        lines={lines}
        paperSize={paperSize}
        margin={margin}
        sketchName={activeSketchName ?? 'sketch'}
      />
    </aside>
  ) : null

  return (
    <div className="h-screen text-foreground">
      <PanelLayout
        leftContent={leftSidebar}
        centerContent={centerViewport}
        rightContent={rightPanel}
      />
    </div>
  )
}

export default App
