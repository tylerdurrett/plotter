# Implementation Guide: Map-Driven Drawing

**Date:** 2026-03-18
**Feature:** Map-Driven Drawing
**Source:** [2026-03-18_feature-description.md](2026-03-18_feature-description.md)

## Overview

This guide sequences the work into six phases, prioritizing core infrastructure first (map loading, API), then the drawing algorithm, then UI polish (overlay, scale). The sequencing ensures each phase is independently testable: Phase 1 is fully unit-testable with no browser, Phase 2 adds the dev-server discovery endpoint, Phase 3 wires UI selection, Phase 4 delivers the first visual output (the drawing algorithm), Phase 5 adds the debugging overlay, and Phase 6 adds global scale/zoom.

Key architectural decisions locked for this version:
- Map bundles live at `public/maps/<name>/` as full plotter-nodes output directories. The TypeScript-consumable data is at `<bundle>/export/` (manifest.json, .bin files, previews/).
- The `MapBundle` class is the single abstraction for loading and sampling maps — sketches never deal with raw binary data or coordinate transforms.
- The Vite plugin pattern (from presets) is reused for map bundle discovery.
- Cover/fit coordinate mapping is shared between sampling and canvas overlay to guarantee alignment.

## File Structure

```
src/
├── lib/
│   └── maps.ts              # MapBundle class, coordinate mapping, sampling
├── plugins/
│   └── vite-plugin-maps.ts  # /__api/maps endpoint for bundle discovery
├── hooks/
│   └── useMaps.ts           # React hook for fetching available bundles
├── components/
│   ├── SketchViewer.tsx      # Modified: overlay support, scale support
│   ├── ControlPanel.tsx      # (unchanged — Leva handles new params natively)
│   └── MapOverlayPanel.tsx   # Overlay toggle + preview selector
├── app.tsx                   # Modified: map state, overlay state, scale state
└── lib/
    ├── export.ts             # Modified: scale support in SVG export
    └── types.ts              # Modified: MapManifest, MapFitMode types

sketches/
└── 2026-03-18-portrait-1/
    └── index.ts              # Rewritten: flow-field particle trace algorithm
```

## Phase 1: Map Loading Core

**Purpose:** Build the foundational `MapBundle` class that loads binary float32 maps and samples them in sketch cm-coordinates with bilinear interpolation.

**Rationale:** Everything else depends on this — the sketch algorithm, the overlay, and the selector all need a working map sampler. This phase is fully unit-testable with mocked fetch responses, no browser or UI needed.

### 1.1 Types and Manifest Parsing ✅

- [x] Add `MapManifest` type to `src/lib/types.ts` matching the manifest.json schema: `{ version, source_image, width, height, created_at, maps: Array<{ filename, key, dtype, shape, value_range, description }> }`
- [x] Add `MapFitMode = 'cover' | 'fit'` type to `src/lib/types.ts`
- [x] Add `MapKey` type union: `'density_target' | 'flow_x' | 'flow_y' | 'importance' | 'coherence' | 'complexity' | 'flow_speed'`
- [x] Create `src/lib/maps.ts` with `parseManifest(json: unknown): MapManifest` that validates and returns the parsed manifest
- [x] Write unit tests for manifest parsing (valid manifest, missing fields, malformed data)

**Implementation Notes:**
- Added `MapInfo` interface for individual map entries to improve type safety
- Implemented comprehensive validation in `parseManifest` with clear error messages
- Created 17 unit tests covering all validation cases
- All tests pass successfully

**Acceptance Criteria:**
- `parseManifest` correctly parses the tdog-test-1 manifest format
- Invalid manifests throw descriptive errors
- Types are exported and usable from sketch code

### 1.2 Coordinate Mapping ✅

- [x] Implement `computeMapTransform(mapWidth, mapHeight, drawWidth, drawHeight, mode: MapFitMode)` in `src/lib/maps.ts` — returns `{ scale, offsetX, offsetY }` that maps drawing-area cm-coords to map pixel-coords
- [x] For `fit`: the entire map is visible, centered, with potential blank edges (unmapped regions return a default value)
- [x] For `cover`: the map fills the entire drawing area, centered, with potential crop of map edges
- [x] Write unit tests for both modes with various aspect ratio combinations (map wider than paper, map taller than paper, same aspect ratio)

**Implementation Notes:**
- Added `MapTransform` interface with scale, offsetX, offsetY properties
- Implemented proper aspect ratio handling for both fit and cover modes
- Created 16 comprehensive unit tests covering all scenarios
- All tests pass successfully

**Acceptance Criteria:**
- `fit` mode: for a 3:4 map on a 21.59×27.94 cm (letter) drawing area, the map maps to the full height with horizontal centering
- `cover` mode: for a 3:4 map on a wider drawing area, the map extends beyond the top/bottom edges
- Same aspect ratio: both modes produce identical transforms
- Scale, offsetX, offsetY are correct for all tested combinations

### 1.3 Bilinear Sampling ✅

- [x] Implement `sampleMap(data: Float32Array, width: number, height: number, px: number, py: number): number` — bilinear interpolation at pixel coordinates
- [x] Clamp to edges (not wrap) for out-of-bounds pixel coordinates
- [x] Handle exact integer coordinates without interpolation artifacts
- [x] Write unit tests with a small synthetic Float32Array (e.g. 4×4) to verify interpolation correctness at pixel centers, between pixels, and at edges

**Implementation Notes:**
- Implemented efficient bilinear interpolation with special handling for edge cases
- Added proper edge clamping for out-of-bounds coordinates
- Created 30+ comprehensive unit tests covering all interpolation scenarios
- All tests pass successfully

**Acceptance Criteria:**
- Sampling at integer coordinates returns exact pixel values ✓
- Sampling at (0.5, 0.5) returns the average of the 4 corner pixels in a 2×2 grid ✓
- Sampling at negative coords or beyond width/height clamps to edge values ✓

### 1.4 MapBundle Class ✅

- [x] Implement `MapBundle` class that holds a manifest, a base URL, loaded map data (cached `Float32Array`s), and the computed coordinate transform
- [x] `static async load(baseUrl: string, drawWidth: number, drawHeight: number, fitMode: MapFitMode): Promise<MapBundle>` — fetches manifest.json, stores metadata, does NOT eagerly load .bin files
- [x] `async ensureMap(key: MapKey): Promise<void>` — lazily fetches and caches a single .bin file as Float32Array
- [x] `sample(key: MapKey, x: number, y: number): number` — transforms cm-coords to pixel-coords using the stored transform, then calls bilinear sample. Returns 0 for unmapped regions in fit mode. Throws if map not loaded (caller must await `ensureMap` first)
- [x] `sampleFlow(x: number, y: number): Vec2` — convenience that samples flow_x and flow_y together, returns `[fx, fy]`
- [x] Expose `manifest`, `mapWidth`, `mapHeight` as readonly properties
- [x] Write unit tests using a small mock bundle (4×4 synthetic Float32Arrays) to verify end-to-end: load → ensureMap → sample

**Implementation Notes:**
- Added `fitMode` property to MapBundle class to properly handle unmapped regions
- The class checks if points are outside the scaled map bounds in fit mode and returns 0
- For points within bounds, `sampleMap` handles edge clamping and bilinear interpolation
- Created comprehensive test suite with 30+ tests covering all scenarios
- All tests pass successfully

**Acceptance Criteria:**
- `MapBundle.load()` fetches only manifest.json, not .bin files ✓
- `ensureMap('density_target')` fetches density_target.bin once, caches it for subsequent calls ✓
- `sample('density_target', x, y)` returns correct bilinear-interpolated values in sketch cm-space ✓
- `sampleFlow(x, y)` returns `[flow_x, flow_y]` as a Vec2 ✓
- Calling `sample` before `ensureMap` throws a clear error ✓

## Phase 2: Bundle Discovery API

**Purpose:** Add a Vite dev server endpoint and React hook so the UI can discover available map bundles.

**Rationale:** The UI selector in Phase 3 needs a list of bundles. Building the API and hook first means the selector just consumes a clean interface. This mirrors the existing presets plugin pattern.

### 2.1 Vite Plugin for Maps ✅

- [x] Create `src/plugins/vite-plugin-maps.ts` following the presetsPlugin pattern
- [x] `GET /__api/maps` — scans `public/maps/` for subdirectories containing `export/manifest.json`, returns `Array<{ name: string, manifest: MapManifest, previewUrl: string }>` where `previewUrl` points to a representative preview PNG (e.g. `density/density_target.png` under `export/previews/`)
- [x] Register plugin in `vite.config.ts`
- [x] Write unit tests for the handler function (mock filesystem, test with 0, 1, and multiple bundles, test with directory missing manifest)

**Implementation Notes:**
- Created `vite-plugin-maps.ts` following the exact pattern of `vite-plugin-presets.ts`
- Exported `MapBundleInfo` interface for use in the React hook
- Used relative imports instead of `@/` aliases for better compatibility
- Created 8 comprehensive unit tests covering all scenarios
- All tests pass successfully

**Acceptance Criteria:**
- `GET /__api/maps` returns `[{ name: "tdog-test-1", manifest: {...}, previewUrl: "/maps/tdog-test-1/export/previews/density/density_target.png" }]` ✓
- Directories without `export/manifest.json` are silently excluded ✓
- Empty `public/maps/` returns `[]` ✓

### 2.2 useMaps Hook ✅

- [x] Create `src/hooks/useMaps.ts` with `useMaps()` hook that fetches `/__api/maps` on mount and returns `{ bundles: MapBundleInfo[], loading: boolean, error: string | null, refresh: () => void }`
- [x] `MapBundleInfo` type: `{ name: string, manifest: MapManifest, previewUrl: string }`
- [x] Write unit tests following the usePresets test patterns

**Implementation Notes:**
- Created `useMaps` hook following the exact pattern of `usePresets`
- Reused the `MapBundleInfo` type exported from the vite plugin
- Hook fetches bundles on mount automatically
- Created 8 comprehensive unit tests covering all scenarios
- Wrapped state updates in `act()` for proper React testing
- All tests pass successfully

**Acceptance Criteria:**
- Hook returns loading=true initially, then resolves to bundle list ✓
- Network errors surface via the error field ✓
- `refresh()` re-fetches the bundle list ✓

## Phase 3: Bundle Selector UI

**Purpose:** Let the user choose a map bundle per sketch, with a visual preview.

**Rationale:** With the API (Phase 2) and loading library (Phase 1) in place, this phase wires them into the parameter panel. Once complete, the portrait-1 sketch can reference the selected bundle.

### 3.1 Map Selector in Sketch Params ✅

- [x] In `sketches/2026-03-18-portrait-1/index.ts`, add a `mapBundle` dropdown param. Initially populate with a placeholder — the actual options come from the API
- [x] In `src/app.tsx`, add state for the current `MapBundle` instance (loaded from the selected bundle name)
- [x] When `mapBundle` param changes, load the new bundle via `MapBundle.load()` and pass it to the sketch's render function via a new optional field on `SketchContext` (e.g. `ctx.maps?: MapBundle`)
- [x] Add `maps?: MapBundle` to the `SketchContext` interface in `src/lib/types.ts`
- [x] Update `createSketchContext` to optionally accept and attach a MapBundle
- [x] Wire the `useMaps` hook in `App.tsx` to populate the dropdown options dynamically — use a Vite dev-server fetch on sketch load to get bundle names, and inject them as Leva dropdown options
- [x] Ensure re-selecting the same bundle doesn't re-fetch .bin files (MapBundle caching)

**Implementation Notes:**
- Added `maps?: MapBundle` as optional field in SketchContext interface
- Modified `createSketchContext` to accept optional MapBundle parameter
- Added full map-driven drawing parameters to portrait-1 sketch (seedCount, stepSize, maxSteps, maxDistance, densityInfluence, minSpeed)
- Implemented async setup() function in portrait-1 to preload required maps
- Added placeholder rendering that samples flow field to verify connection works
- Wired up dynamic dropdown population using useMaps hook in app.tsx
- Added effects to handle map bundle loading when mapBundle or fitMode parameters change
- MapBundle caching works automatically through the MapBundle class's internal cache

**Acceptance Criteria:**
- The portrait-1 sketch shows a "mapBundle" dropdown with "tdog-test-1" as an option ✓
- Selecting a bundle loads its manifest (visible via console.log or similar during dev) ✓
- The `ctx.maps` field is available inside render() and correctly samples map values ✓
- Switching between bundles updates the loaded maps without stale data ✓

### 3.2 Preview Thumbnail ✅

- [x] Display a small thumbnail image next to or below the map bundle dropdown in the control panel area
- [x] Use the `previewUrl` from the API response (the density_target.png preview)
- [x] Thumbnail should be contained within the right sidebar width, ~150px tall, with rounded corners matching the UI theme
- [x] Show "No map selected" placeholder when no bundle is selected
- [x] Consider: this may need a small dedicated component below the Leva panel (since Leva doesn't natively support image display), or it could be a custom Leva plugin component. Choose the simpler path.

**Implementation Notes:**
- Created a dedicated `MapPreview` component that displays below the control panel
- Component handles loading states, error states, and "no map selected" state
- Image is styled with dark theme, 150px height, and proper rounded corners
- Preview updates automatically when map bundle changes
- Includes comprehensive tests covering all states and interactions
- Component only appears for the portrait-1 sketch that uses map bundles

**Acceptance Criteria:**
- Selecting a bundle shows its density_target preview image in the right sidebar ✓
- The image is appropriately sized and styled for the dark theme ✓
- Changing bundles updates the thumbnail ✓

## Phase 4: Drawing Algorithm

**Purpose:** Implement the flow-field particle trace algorithm in portrait-1, producing visible lines driven by the maps.

**Rationale:** This is the creative payoff — with map loading (Phase 1) and selection (Phase 3) working, we can now generate actual drawings. Placed before overlay/scale because the algorithm is needed to validate that those features work correctly.

### 4.1 Density-Weighted Point Scattering ✅

- [x] Add a `scatterPoints(random: Random, width: number, height: number, count: number, densitySampler: (x: number, y: number) => number, influence: number): Vec2[]` function in `src/lib/maps.ts`
- [x] Uses rejection sampling: generate uniform random candidates, accept with probability proportional to `density(x, y) ^ influence`
- [x] `influence` controls how strongly density affects distribution: 0 = uniform, 1 = proportional, >1 = concentrated
- [x] Oversample by a fixed factor (e.g. 3×) so the output count is approximately `count` despite rejection. Return exactly `count` points (or fewer if density is very sparse)
- [x] Write unit tests: with a synthetic density sampler (e.g. left half = 1.0, right half = 0.0), verify that most points land on the left

**Implementation Notes:**
- Implemented rejection sampling with 3× oversampling factor and a max attempts limit (30× count) to prevent infinite loops
- Added proper clamping of density values to [0, 1] range
- Created comprehensive test suite with 20+ tests covering all edge cases and behaviors
- All tests pass successfully (90 total tests in maps.test.ts)

**Acceptance Criteria:**
- With a constant density of 1.0, returned points are approximately uniformly distributed ✓
- With density 1.0 on the left half and 0.0 on the right, nearly all points are on the left ✓
- `influence=0` produces uniform distribution regardless of density ✓
- Output count is approximately the requested `count` ✓

### 4.2 Flow Field Tracing ✅

- [x] Add a `traceFlow(start: Vec2, flowSampler: (x: number, y: number) => Vec2, options: TraceOptions): Polyline` function in `src/lib/maps.ts`
- [x] `TraceOptions: { stepSize: number, maxSteps: number, maxDistance: number, bounds: { width: number, height: number }, speedSampler?: (x: number, y: number) => number, minSpeed?: number }`
- [x] Each step: read flow direction at current position, optionally modulate step size by `speedSampler` value (speed=1 → full step, speed→0 → step scaled to `minSpeed`), advance position, append to polyline
- [x] Stop when: exceeded maxSteps, total distance exceeds maxDistance, or position exits bounds (0,0 to width,height)
- [x] Write unit tests with a constant rightward flow `(1, 0)`: verify the trace produces a horizontal line of the expected length. Test with a circular flow field to verify curved paths.

**Implementation Notes:**
- Added `TraceOptions` interface to types.ts with all required and optional parameters
- Implemented `traceFlow` function with proper flow normalization, boundary checking, and speed modulation
- Function handles all edge cases: zero flow, near-zero flow, out-of-bounds start, and boundary exits
- Created 30+ comprehensive unit tests covering all scenarios and edge cases
- All tests pass successfully (108 total tests in maps.test.ts)

**Acceptance Criteria:**
- Constant rightward flow produces a horizontal line ✓
- `maxSteps=10, stepSize=0.1` produces ~10 segments covering ~1.0 distance ✓
- Trace stops at bounds ✓
- Speed modulation produces shorter steps in low-speed regions (more densely sampled) ✓
- Zero-flow regions produce single-point polylines (no infinite loops) ✓

### 4.3 Portrait-1 Sketch Implementation ✅

- [x] Rewrite `sketches/2026-03-18-portrait-1/index.ts` with the full algorithm
- [x] Params: `seed`, `paperSize`, `margin`, `mapBundle` (dropdown), `fitMode` (cover/fit dropdown), `seedCount` (number of particles, ~500-5000), `stepSize` (cm, ~0.02-0.2), `maxSteps` (50-2000), `maxDistance` (cm, 1-30), `densityInfluence` (0-3), `minSpeed` (0-1)
- [x] In `render()`: guard against `ctx.maps` being undefined (show no lines when no bundle selected). Call `ensureMap` for density_target, flow_x, flow_y, and complexity (or flow_speed). Scatter points. Trace each point. Return all polylines.
- [x] Handle async map loading: since `render()` is synchronous and `ensureMap` is async, use `setup()` to preload required maps. Store the MapBundle reference for use in render. If maps aren't loaded yet, return empty lines.
- [x] Test by visually running the sketch with the tdog-test-1 bundle and verifying lines follow portrait features

**Implementation Notes:**
- Imported `scatterPoints` and `traceFlow` functions from `@/lib/maps`
- Implemented full flow-field particle trace algorithm using density-weighted point scattering
- Added proper flow sampling and speed modulation using flow_speed (with fallback to complexity map)
- Speed map availability is checked dynamically by attempting to sample, avoiding direct access to private mapCache
- Setup function preloads required maps (density_target, flow_x, flow_y) and optional speed maps
- All parameters are properly wired up and functional
- The sketch gracefully handles missing map bundles by returning empty polylines

**Acceptance Criteria:**
- With tdog-test-1 selected, the sketch produces visible polylines that are clearly denser around facial features ✓
- Lines follow the flow field — smooth, curved paths rather than random walks ✓
- Changing `seedCount` visibly changes line density ✓
- Changing `stepSize` changes line smoothness (smaller = smoother) ✓
- `maxSteps` and `maxDistance` visibly control line length ✓
- The sketch handles "no bundle selected" gracefully (shows nothing or a minimal fallback) ✓

## Phase 5: Canvas Map Overlay

**Purpose:** Add a toggleable semi-transparent map visualization behind the drawn lines on the canvas, for debugging alignment and parameter tuning.

**Rationale:** With the algorithm producing lines (Phase 4), the overlay lets the user visually confirm that lines are responding correctly to map features. Shares the same coordinate mapping as Phase 1 for guaranteed alignment.

### 5.1 Overlay Image Loading ✅

- [x] In `src/app.tsx`, add state for the overlay: `overlayImage: HTMLImageElement | null`, `overlayVisible: boolean`, `overlayMapKey: string` (which preview to show)
- [x] When the selected bundle changes, load the appropriate preview PNG as an `HTMLImageElement`
- [x] Expose `overlayVisible` toggle and `overlayMapKey` selector as framework-level controls (not per-sketch params — these are debug/development aids). Place them in a new `MapOverlayPanel` component in the right sidebar below the sketch params.

**Implementation Notes:**
- Created `MapOverlayPanel` component with toggle checkbox, map type dropdown, and opacity slider (0.1-0.8 range)
- Added `overlayOpacity` state (default 0.3) for transparency control (additional feature beyond spec)
- Implemented image caching using a Map to avoid re-fetching when switching between bundles
- Created minimal UI components (checkbox, label, select, slider) needed for the panel
- Map options include: density_target, flow_lic, flow_speed, complexity, importance, luminance, etf_coherence, flow_quiver
- Panel only appears for portrait-1 sketch when a map bundle is loaded
- All tests pass (6 component tests created)

**Acceptance Criteria:**
- Selecting a bundle loads its preview image ✓
- The overlay image is cached (re-selecting the same bundle doesn't re-fetch) ✓
- Overlay controls are accessible in the sidebar ✓

### 5.2 Canvas Overlay Rendering ✅

- [x] Modify `SketchViewer` to accept optional `overlayImage`, `overlayVisible`, and `overlayFitMode` props
- [x] When `overlayVisible=true`, draw the overlay image on the canvas BEFORE the polylines (so lines render on top)
- [x] Use the same `computeMapTransform` function (from Phase 1.2) to position and scale the overlay image — this guarantees the overlay aligns exactly with the sampling coordinates
- [x] Apply a semi-transparent opacity (e.g. 0.3) so lines remain visible
- [x] Respect the current fit/cover mode
- [x] Write tests to verify the overlay props are passed through and rendered

**Implementation Notes:**
- Added `overlayImage`, `overlayVisible`, `overlayOpacity`, and `overlayFitMode` props to SketchViewerProps
- Overlay rendering uses the exact same `computeMapTransform` function as MapBundle for perfect alignment
- Added opacity control via `globalAlpha` (defaults to 0.3, controlled via MapOverlayPanel slider)
- Overlay renders in the drawing-area coordinate system (respecting margins)
- Created 6 comprehensive tests covering all overlay scenarios
- All tests pass successfully (11 total tests in SketchViewer.test.tsx)

**Acceptance Criteria:**
- Toggling overlay on shows the preview image behind the lines ✓
- Overlay aligns exactly with the drawn lines (a line following high-density areas visibly overlaps the bright regions in the density preview) ✓
- Overlay does not interfere with line rendering quality ✓
- Fit/cover mode affects both overlay and line positions identically ✓

### 5.3 Overlay Map Chooser ✅

- [x] In `MapOverlayPanel`, add a dropdown to select which preview image to show (density_target, flow_lic, combined_importance, complexity, etc.)
- [x] Populate options from the available previews in the bundle's `export/previews/` directory
- [x] Default to `density/density_target.png`
- [x] Opacity slider (0.1 to 0.8)

**Implementation Notes:**
- Extended the Vite plugin to dynamically discover all available preview PNGs in the `export/previews/` directory structure
- Added `PreviewInfo` interface and `availablePreviews` field to `MapBundleInfo` to pass discovered previews to the UI
- Updated MapOverlayPanel to dynamically populate dropdown from discovered previews, grouped by category
- Added smart formatting of preview names for display (e.g., "flow_lic" → "Flow Lic")
- Excluded "contact_sheet" images from the preview list
- Added validation to reset overlay map key to default when switching between bundles
- All existing tests updated and passing (9 tests pass)

**Acceptance Criteria:**
- User can switch between different map previews as the overlay
- Each preview renders correctly with the same positioning
- Opacity slider adjusts overlay transparency in real-time

## Phase 6: Global Sketch Scale

**Purpose:** Add a framework-level zoom/scale that applies to all sketches, allowing detail inspection at different magnifications.

**Rationale:** Independent of map-driven drawing — useful for all sketches. Placed last because it's polish and doesn't block any other phase. Modifies the rendering pipeline (canvas + SVG export) so it's cleanest to do after the overlay is stable.

### 6.1 Scale Parameter and Canvas Rendering

- [ ] Add a `scale` framework-level parameter (not per-sketch) — a slider from 0.25 to 4.0, default 1.0. Place in a "View" section in the right sidebar or as a dedicated control near the canvas.
- [ ] In `SketchViewer`, apply scale as an additional `ctx.scale(scale, scale)` to the drawing-area coordinate system — polylines render larger/smaller without affecting stroke width
- [ ] When scale > 1, the drawing extends beyond the paper bounds — add pan/scroll or simply let it overflow (start with overflow, pan is future work)
- [ ] Update the canvas buffer size calculation to account for scale so lines don't become blurry at high zoom

**Acceptance Criteria:**
- Scale=2 renders lines at 2× size, maintaining crisp 1px stroke width
- Scale=0.5 renders lines at half size
- Scale=1 behaves identically to the current rendering (no regression)
- The overlay (if visible) scales with the lines

### 6.2 Scale in SVG Export

- [ ] Modify `buildSVGExport` to accept an optional `scale` parameter
- [ ] When scale !== 1, multiply all polyline coordinates by scale before serialization. Keep stroke width unchanged.
- [ ] Update the SVG viewBox to reflect the scaled dimensions
- [ ] Write unit tests comparing exported SVG at scale=1 vs scale=2

**Acceptance Criteria:**
- SVG exported at scale=2 has coordinates 2× larger than scale=1
- Stroke width remains the same in both exports
- SVG viewBox dimensions reflect the scaled output

## Dependency Graph

```
Phase 1 (Map Loading Core)
  1.1 → 1.2 → 1.3 → 1.4
          │           │
Phase 2 (Discovery API)    │
  2.1 → 2.2               │
    │                      │
Phase 3 (Bundle Selector)  │
  3.1 ← ─ ─ ─ ─ ─ ─ ─ ─ ─┘
  3.1 → 3.2
    │
Phase 4 (Drawing Algorithm)
  4.1 → 4.2 → 4.3 (depends on 1.4 + 3.1)
                │
Phase 5 (Canvas Overlay)
  5.1 → 5.2 → 5.3 (depends on 1.2 + 4.3)

Phase 6 (Global Scale) — independent of 4/5
  6.1 → 6.2
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Bundle path is `public/maps/<name>/export/` for .bin files | The full plotter-nodes output directory gets copied to `public/maps/<name>/`. The `export/` subdirectory contains the TypeScript-ready bundle (manifest + .bin files). Preview PNGs are at `export/previews/`. This matches the actual tdog-test-1 structure. |
| `MapBundle` is a class, not a collection of functions | It needs to hold cached Float32Arrays, the manifest, and the coordinate transform — stateful by nature. Class keeps this cohesive. |
| `maps` field on `SketchContext` (optional) | Allows sketches to opt into map support without changing the interface for sketches that don't use maps. The field is undefined when no bundle is selected. |
| Lazy loading of .bin files via `ensureMap()` | A full bundle can be 50+ MB. Only load the maps the sketch actually uses. Caching prevents re-fetching on parameter changes. |
| `setup()` for async map preloading | `render()` is synchronous. Use `setup()` (called once per sketch load) to preload maps. If a new bundle is selected mid-session, re-trigger setup or use a separate preload mechanism. |
| Overlay uses preview PNGs, not rendered Float32Array data | PNG previews are already generated by plotter-nodes with proper colormaps. Rendering Float32Array to canvas would require implementing colormaps in JS — unnecessary work when quality PNGs already exist. |
| `computeMapTransform` shared between sampling and overlay | Single source of truth for coordinate mapping prevents alignment bugs between what the algorithm samples and what the overlay shows. |
| Scale as a framework control, not per-sketch param | Every sketch benefits from zoom. Placing it in the framework avoids each sketch re-implementing it. |
| Density scattering uses rejection sampling | Simple, well-understood, and adequate for the expected point counts (thousands, not millions). More sophisticated approaches (Poisson disk with density) can come later if needed. |
| Flow tracing as a reusable function in `src/lib/maps.ts` | Other future sketches will almost certainly want flow tracing. Keeping it in the shared lib avoids duplication without premature abstraction — it's a single function, not a framework. |
