import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  ControlPanel,
  type ControlPanelHandle,
} from '@/components/ControlPanel'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ExportPanel } from '@/components/ExportPanel'
import { MapGeneratePanel } from '@/components/MapGeneratePanel'
import { MapOverlayPanel } from '@/components/MapOverlayPanel'
import { MapPipelineConfig } from '@/components/MapPipelineConfig'
import { MapPreview } from '@/components/MapPreview'
import { PanelLayout } from '@/components/PanelLayout'
import { PresetPanel } from '@/components/PresetPanel'
import { ScalePanel } from '@/components/ScalePanel'
import { SketchSelector } from '@/components/SketchSelector'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs'
import { SketchViewer } from '@/components/SketchViewer'
import { useLevaParamHover } from '@/hooks/useLevaParamHover'
import { useMapApi } from '@/hooks/useMapApi'
import { API_PREFIX, getFullBaseUrl } from '@/lib/map-api'
import type { PipelineConfig, PreviewInfo, SessionInfo } from '@/lib/map-api'
import { useMaps } from '@/hooks/useMaps'
import {
  getInitialSketch,
  useSketchLoader,
} from '@/hooks/useSketchLoader'
import { createSketchContext } from '@/lib/context'
import { MapBundle } from '@/lib/maps'
import { extractParamValues } from '@/lib/params'
import { PAPER_SIZES } from '@/lib/paper'
import type { PaperSize, Polyline, SketchModule, MapFitMode } from '@/lib/types'
import type { MapBundleInfo } from '@/plugins/vite-plugin-maps'

/** Format an API session as a display label for the dropdown */
function sessionLabel(session: SessionInfo): string {
  const name = session.source_image.replace(/\.[^.]+$/, '')
  const truncated = name.length > 20 ? name.slice(0, 20) + '…' : name
  return `${truncated} (API)`
}

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
  const hasMapBundleParam = activeSketch != null && 'mapBundle' in activeSketch.params
  const mapApi = useMapApi(hasMapBundleParam)
  const [currentMapBundle, setCurrentMapBundle] = useState<MapBundle | undefined>()
  const [currentBundleInfo, setCurrentBundleInfo] = useState<MapBundleInfo | undefined>()
  const [loadingMapBundle, setLoadingMapBundle] = useState(false)

  // Overlay state
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(null)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [overlayMapKey, setOverlayMapKey] = useState('density/density_target')
  const [overlayOpacity, setOverlayOpacity] = useState(0.3)
  const overlayImageCache = useRef<Map<string, HTMLImageElement>>(new Map())

  // Pipeline config state for map generation
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>({})

  // View scale state (framework-level zoom)
  const [viewScale, setViewScale] = useState(1.0)

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
      loadSketch(getInitialSketch(sketchList))
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

  // Build resolved params with dynamic mapBundle options injected.
  // Leva captures options at mount time and ignores source mutations,
  // so we compute a new params object and change the ControlPanel key
  // to force a remount when bundles become available.
  const resolvedParams = (() => {
    if (!activeSketch) return {}
    const params = activeSketch.params
    if (!('mapBundle' in params)) return params

    const mapBundleParam = params.mapBundle
    if (!mapBundleParam || typeof mapBundleParam !== 'object' || !('options' in mapBundleParam)) {
      return params
    }

    // Build options as { label: value } so API sessions show readable names
    const bundleOptions: Record<string, string> = { none: 'none' }
    for (const b of mapBundles) {
      bundleOptions[b.name] = b.name
    }
    for (const s of mapApi.sessions) {
      bundleOptions[sessionLabel(s)] = `${API_PREFIX}${s.session_id}`
    }
    return {
      ...params,
      mapBundle: { ...(mapBundleParam as object), options: bundleOptions },
    }
  })()

  // Stable key for ControlPanel remount — only changes when the set of
  // available bundle options actually changes, not on every poll cycle.
  const bundleOptionValues = Object.values(
    (resolvedParams.mapBundle as { options?: Record<string, string> })?.options ?? {},
  )
  const controlPanelKey = `${activeSketchName}-${bundleOptionValues.join(',')}`

  // Track which bundle+fitMode combo we've already loaded to avoid re-triggering.
  const loadedBundleRef = useRef<string | null>(null)

  // Load MapBundle when mapBundle parameter changes.
  // Uses a tracked key to prevent re-fire loops — scheduleRender and
  // overlayMapKey are accessed via refs, not as effect dependencies.
  const selectedMapBundle = pendingParamsRef.current?.mapBundle as string | undefined
  const selectedFitMode = pendingParamsRef.current?.fitMode as MapFitMode | undefined
  useEffect(() => {
    const mapBundleName = selectedMapBundle
    const fitMode = selectedFitMode || 'cover'

    // Build a key so we only load once per bundle+fitMode combo
    const loadKey = `${mapBundleName ?? 'none'}:${fitMode}`
    if (loadedBundleRef.current === loadKey) return
    loadedBundleRef.current = loadKey

    if (!activeSketch) return

    // Clear bundle if 'none' is selected
    if (!mapBundleName || mapBundleName === 'none') {
      setCurrentMapBundle(undefined)
      setCurrentBundleInfo(undefined)
      return
    }

    const isApiSession = mapBundleName.startsWith(API_PREFIX)

    if (isApiSession) {
      // API-generated map — no local bundle info
      setCurrentBundleInfo(undefined)
    } else {
      // Local bundle — find metadata for preview display
      const bundleInfo = mapBundles.find(b => b.name === mapBundleName)
      if (!bundleInfo) {
        console.warn(`Map bundle "${mapBundleName}" not found`)
        setCurrentMapBundle(undefined)
        setCurrentBundleInfo(undefined)
        return
      }

      setCurrentBundleInfo(bundleInfo)

      // Validate overlay map key - reset to default if not available in new bundle
      if (bundleInfo.availablePreviews && bundleInfo.availablePreviews.length > 0) {
        const isValidKey = bundleInfo.availablePreviews.some(p => p.path === overlayMapKey)
        if (!isValidKey) {
          const defaultPreview = bundleInfo.availablePreviews.find(p => p.path === 'density/density_target')
            || bundleInfo.availablePreviews[0]
          if (defaultPreview) {
            setOverlayMapKey(defaultPreview.path)
          }
        }
      }
    }

    // Load the MapBundle
    let cancelled = false
    const loadMapBundle = async () => {
      try {
        setLoadingMapBundle(true)
        const params = pendingParamsRef.current ?? {}
        const paperSize = (params.paperSize as string) ?? 'letter'
        const paperMargin = (params.margin as number) ?? 0
        const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.letter
        const drawWidth = paper.width - paperMargin * 2
        const drawHeight = paper.height - paperMargin * 2

        // API sessions load from the API server; local bundles from /maps/
        const baseUrl = isApiSession
          ? getFullBaseUrl(mapBundleName.slice(API_PREFIX.length))
          : `/maps/${mapBundleName}/export`

        const bundle = await MapBundle.load(
          baseUrl,
          drawWidth,
          drawHeight,
          fitMode,
        )

        if (cancelled) return

        setCurrentMapBundle(bundle)

        // Re-run setup if the sketch has one
        if (activeSketch.setup) {
          const ctx = buildContext(params, bundle)
          await activeSketch.setup(ctx)
        }

        // Trigger a re-render with the new bundle.
        // Read scheduleRender from the ref to avoid depending on it.
        if (pendingParamsRef.current) {
          const latestParams = pendingParamsRef.current
          // Inline a single rAF render instead of calling scheduleRender
          // to break the dependency chain that caused the blink loop.
          requestAnimationFrame(() => {
            if (cancelled) return
            try {
              const ctx = buildContext(latestParams, bundle)
              const result = sketchRef.current?.render(ctx, latestParams)
              if (result) {
                setLines(result)
                setPaperSize((prev) =>
                  prev.width === ctx.paper.width && prev.height === ctx.paper.height
                    ? prev
                    : { width: ctx.paper.width, height: ctx.paper.height },
                )
                setMargin(ctx.paper.margin)
                setRenderError(null)
              }
            } catch (err) {
              setRenderError(err instanceof Error ? err.message : 'Render failed')
            }
          })
        }
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load map bundle:', error)
        setCurrentMapBundle(undefined)
        setCurrentBundleInfo(undefined)
      } finally {
        if (!cancelled) setLoadingMapBundle(false)
      }
    }

    loadMapBundle()

    return () => { cancelled = true }
  }, [selectedMapBundle, selectedFitMode, mapBundles, activeSketch])

  const isApiSession = selectedMapBundle?.startsWith(API_PREFIX) ?? false
  const apiSessionId = isApiSession ? selectedMapBundle!.slice(API_PREFIX.length) : null

  const apiSessionPreviews = useMemo<PreviewInfo[]>(() => {
    if (!isApiSession || !apiSessionId) return []
    return mapApi.sessions.find(s => s.session_id === apiSessionId)?.previews ?? []
  }, [isApiSession, apiSessionId, mapApi.sessions])

  const apiPreviewUrl = useMemo(() => {
    if (!isApiSession || !apiSessionId || apiSessionPreviews.length === 0) return undefined
    const preview = apiSessionPreviews.find(p => p.name === 'density_target') ?? apiSessionPreviews[0]
    return `${getFullBaseUrl(apiSessionId)}/${preview.url}`
  }, [isApiSession, apiSessionId, apiSessionPreviews])

  // Load overlay image when bundle or map key changes
  useEffect(() => {
    const loadOverlayImage = async () => {
      if (!overlayMapKey) {
        setOverlayImage(null)
        return
      }

      // Construct the preview URL based on bundle source
      let previewUrl: string | undefined
      let cacheKey: string

      if (currentBundleInfo) {
        // Local bundle
        cacheKey = `${currentBundleInfo.name}-${overlayMapKey}`
        previewUrl = `/maps/${currentBundleInfo.name}/export/previews/${overlayMapKey}.png`
      } else if (apiSessionId) {
        // API session
        cacheKey = `api:${apiSessionId}-${overlayMapKey}`
        previewUrl = `${getFullBaseUrl(apiSessionId)}/previews/${overlayMapKey}.png`
      } else {
        setOverlayImage(null)
        return
      }

      // Check cache first
      const cached = overlayImageCache.current.get(cacheKey)
      if (cached) {
        setOverlayImage(cached)
        return
      }

      // Load the image
      const img = new Image()
      img.onload = () => {
        overlayImageCache.current.set(cacheKey, img)
        setOverlayImage(img)
      }
      img.onerror = () => {
        console.error(`Failed to load overlay image: ${previewUrl}`)
        setOverlayImage(null)
      }
      img.src = previewUrl
    }

    loadOverlayImage()
  }, [currentBundleInfo, overlayMapKey, apiSessionId])

  const handleRandomizeSeed = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 10000)
    controlPanelRef.current?.setValues({ seed: newSeed })
  }, [])

  const handleSelectMapBundle = useCallback((value: string) => {
    controlPanelRef.current?.setValues({ mapBundle: value })
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
          overlayImage={overlayImage}
          overlayVisible={overlayVisible}
          overlayOpacity={overlayOpacity}
          overlayFitMode={(pendingParamsRef.current?.fitMode as MapFitMode) || 'cover'}
          scale={viewScale}
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
      {hasMapBundleParam ? (
        <Tabs defaultValue="controls" className="flex-1 min-h-0">
          <TabList>
            <Tab value="controls">Controls</Tab>
            <Tab value="pipeline">Map Pipeline</Tab>
          </TabList>
          <TabPanel value="controls">
            <ControlPanel
              ref={controlPanelRef}
              key={controlPanelKey}
              params={resolvedParams}
              onChange={scheduleRender}
            />
            <ScalePanel
              scale={viewScale}
              onScaleChange={setViewScale}
            />
            <MapOverlayPanel
              visible={overlayVisible}
              onVisibilityChange={setOverlayVisible}
              mapKey={overlayMapKey}
              onMapKeyChange={setOverlayMapKey}
              opacity={overlayOpacity}
              onOpacityChange={setOverlayOpacity}
              bundleInfo={currentBundleInfo}
              apiPreviews={apiSessionPreviews}
            />
          </TabPanel>
          <TabPanel value="pipeline">
            <MapGeneratePanel
              mapApi={mapApi}
              onSelectBundle={handleSelectMapBundle}
              selectedBundle={selectedMapBundle}
              config={pipelineConfig}
            />
            <MapPreview
              bundleInfo={currentBundleInfo}
              loading={loadingMapBundle}
              previewUrl={apiPreviewUrl}
            />
            <MapPipelineConfig
              config={pipelineConfig}
              onConfigChange={setPipelineConfig}
              disabled={mapApi.generating}
            />
          </TabPanel>
        </Tabs>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ControlPanel
            ref={controlPanelRef}
            key={controlPanelKey}
            params={resolvedParams}
            onChange={scheduleRender}
          />
          <ScalePanel
            scale={viewScale}
            onScaleChange={setViewScale}
          />
        </div>
      )}
      <Separator />
      <ExportPanel
        lines={lines}
        paperSize={paperSize}
        margin={margin}
        scale={viewScale}
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
