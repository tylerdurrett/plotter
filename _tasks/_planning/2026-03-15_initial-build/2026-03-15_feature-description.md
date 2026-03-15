# Feature: Plotter Sketch Studio — Full Build

**Date:** 2026-03-15
**Status:** Scoped

## Overview

A browser-based development environment for creating generative art intended for pen plotter output (primarily AxiDraw). Users write sketch modules as pure TypeScript functions that return polyline arrays, tweak parameters via a live GUI, save presets to disk, and export physically accurate SVGs sized for real paper. The system is built on Vite + React with Leva for parameter controls, Tailwind CSS + shadcn/ui for the application shell, and a utility library providing seeded randomness, geometry primitives, clipping, and SVG serialization.

The full build is designed to be implemented in phases so that each phase delivers a usable, self-contained increment of functionality.

## End-User Capabilities

1. **Scaffold a new sketch** by running a CLI command (`npm run new-sketch -- --name "my sketch"`), which creates a dated directory with a template sketch module ready to edit.
2. **See the sketch render in real time** in the browser, with the canvas preview updating on every parameter change and on every code save (via Vite HMR).
3. **Control sketch parameters** through a GUI panel (sliders, color pickers, selects, booleans, etc.) generated automatically from the sketch's declared parameter schema.
4. **Save and load parameter presets** as named JSON files stored in the sketch's directory, committable to version control alongside the sketch code.
5. **Select between sketches** from a sidebar list, with dynamic import loading the selected sketch module.
6. **Export artwork as SVG** with physically accurate dimensions — correct `viewBox`, absolute units (cm/in/mm), paper size, margins — ready to send to Inkscape / AxiDraw plugin without manual scaling.
7. **Configure export settings** including stroke width, stroke color, paper size, orientation, margin, and output units.
8. **Use a seeded random number generator** with a visible, editable seed parameter so that artwork is fully reproducible and shareable.
9. **Use geometry helper functions** (circle, arc, rect, bezier, spiral, etc.) and math utilities (lerp, clamp, noise, etc.) to compose polyline-based artwork without manual trigonometry.
10. **Clip polylines to paper bounds** so geometry that extends beyond margins is cleanly trimmed before export.

## Architecture / Scope

### Data Model

All sketch output is represented as `number[][][]` — an array of polylines, where each polyline is an array of `[x, y]` points in centimeter coordinates. This is the universal interchange format: sketches produce it, the canvas preview consumes it, the SVG exporter serializes it, and the clipper operates on it.

There is no SVG DOM authoring mode. Sketches are pure functions; rendering and export are separate framework concerns.

### Application Shell

The browser UI is a single-page Vite + React application styled with Tailwind CSS and shadcn/ui components. The layout has three zones:

- **Sidebar** (left): Sketch selector list, preset management controls.
- **Canvas viewport** (center): The sketch preview, rendered to an HTML `<canvas>` element scaled to fit while preserving the paper's aspect ratio. Shows paper boundary and margin guides.
- **Control panel** (right): Leva-powered parameter GUI, plus export controls.

shadcn/ui provides the structural UI components (buttons, dropdowns, dialogs, sidebar layout, etc.). Leva handles the parameter controls exclusively — these two systems do not overlap. shadcn primitives live in `src/components/ui/`, domain components live in `src/components/`.

### Sketch Module Contract

Each sketch is an ES module at `sketches/<name>/index.ts` exporting a `SketchModule`:

```typescript
interface SketchModule {
  params: Record<string, LevaInputSchema>;
  setup?(ctx: SketchContext): void;
  render(ctx: SketchContext, params: Record<string, any>): number[][][];
}
```

- `params` — Declarative schema driving Leva controls. Supports all Leva input types.
- `setup` — Optional one-time initialization (pre-computation, asset loading).
- `render` — Pure function: `(ctx, params) → polylines`. No side effects, no DOM access.
- `ctx` — Provides paper dimensions (cm), `createRandom(seed)` factory, and framework utilities.

Sketches are discovered via `import.meta.glob('./sketches/*/index.ts', { eager: false })` and dynamically imported on selection.

### Utility Library (`src/lib/`)

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `types.ts` | Type definitions | `SketchModule`, `SketchContext`, `Polyline`, `Point`, `PaperSize` |
| `random.ts` | Seeded PRNG + coherent noise | `createRandom(seed)` → `{ value, range, rangeFloor, gaussian, boolean, pick, shuffle, onCircle, insideCircle, noise2D, noise3D }` |
| `math.ts` | Math helpers | `lerp`, `inverseLerp`, `clamp`, `mapRange`, `fract`, `mod`, `degToRad`, `radToDeg`, `smoothstep`, `dist`, `distSq`, `angleBetween` |
| `geometry.ts` | Polyline primitives | `circle`, `arc`, `rect`, `line`, `polygon`, `ellipse`, `bezier`, `quadratic`, `cubic`, `spiral` — all return `number[][]` in cm |
| `clip.ts` | Polyline clipping | `clipPolylinesToBox(lines, bounds)` — Cohen-Sutherland / Sutherland-Hodgman |
| `svg.ts` | SVG serialization | `polylinesToSVG(lines, options)` — absolute units, correct viewBox, paper dimensions |
| `paper.ts` | Paper size constants | `PAPER_SIZES` — letter, A4, A3, A5, etc. in cm, portrait and landscape |

### Preset Persistence

Presets are JSON files stored at `sketches/<name>/presets/<preset-name>.json`. They serialize the full parameter state. Since they live in the sketch directory, they are committable to version control.

Filesystem access is provided by a lightweight Vite plugin that exposes dev-only API routes:

- `GET /__api/presets/:sketch` — list available presets
- `GET /__api/presets/:sketch/:name` — read a preset
- `POST /__api/presets/:sketch/:name` — write a preset
- `DELETE /__api/presets/:sketch/:name` — delete a preset

These routes only exist in the dev server. They are not included in production builds (though a production build is not a primary concern — this is a dev tool).

### Canvas Preview

The `SketchViewer` component renders polylines to `<canvas>` using `CanvasRenderingContext2D` path operations. It:

- Sizes the canvas to fit the viewport while preserving the paper's aspect ratio.
- Transforms from paper coordinates (cm) to pixel coordinates.
- Draws paper boundary outline and margin guides.
- Re-renders when parameters change, driven by Leva's transient `onChange` callbacks to avoid full React re-renders per frame.

### SVG Export

The `svg.ts` module serializes polylines to SVG with:

- Absolute physical units (`cm`, `in`, or `mm`) matching the target paper size.
- Correct `viewBox` and `width`/`height` attributes so the SVG imports at the right physical dimensions in Inkscape or other vector editors.
- Configurable stroke width and color.
- Polylines rendered as `<polyline>` elements (or `<path>` elements with `M`/`L` commands).

### CLI Scaffold Script

`scripts/new-sketch.ts` creates a new sketch directory from a template:

```
npm run new-sketch -- --name "flow field"
→ creates sketches/2026-03-15-flow-field/index.ts
```

The template is a minimal working sketch that renders a few shapes, demonstrating the module contract.

### Initial Example Sketch

A single proof-of-concept sketch ships with the initial build: **concentric circles**. Five circles centered on the page at increasing radii. This sketch is intentionally trivial — its purpose is to prove the full pipeline works end-to-end: parameter controls → render → canvas preview → SVG export.

## Technical Details

### Dependencies

**Runtime:**
- `react`, `react-dom` — UI framework
- `leva` — Parameter control GUI
- `simplex-noise` — Coherent noise generation
- `alea` — Seedable PRNG
- `lineclip` — Fast polyline/polygon clipping
- `tailwindcss`, `@tailwindcss/vite` — Utility-first CSS
- `shadcn/ui` ecosystem (`tailwind-merge`, `clsx`, `class-variance-authority`, `lucide-react`) — UI component primitives

**Dev:**
- `vite` — Build tool, dev server, HMR
- `@vitejs/plugin-react` — React Fast Refresh
- `typescript` — Type safety

### Styling Architecture

Tailwind CSS handles all styling. shadcn/ui components (installed via `npx shadcn@latest`) provide the application shell: sidebar, buttons, dropdowns, dialogs, scroll areas, etc. These components are source-owned (copied into `src/components/ui/`) and can be customized freely.

Leva's default styling is used for the parameter panel. It renders in its own panel and does not need Tailwind integration.

### Coordinate System

All geometry operates in **centimeters** with origin at top-left of the paper. The paper size constants define width and height in cm. The canvas preview transforms cm → pixels for display. The SVG export writes cm (or converted in/mm) directly into the SVG attributes.

### Seeded Randomness

Built on `alea` (PRNG) and `simplex-noise` (coherent noise). The `createRandom(seed)` factory returns an isolated instance so that adding/removing random calls in one part of a sketch doesn't shift the sequence elsewhere. The seed is always a visible, editable parameter in the control panel.

## Risks and Considerations

- **Leva maintenance**: Leva is actively maintained but is a community library. If it stalls, the parameter schema format is generic enough to swap in Tweakpane or a custom implementation. The sketch contract's `params` object is the stable interface — the GUI library is an implementation detail of `ControlPanel.tsx`.
- **Large polyline counts**: Sketches with 50k+ polylines may cause noticeable lag in the canvas preview. For the initial build, this is acceptable. Web Worker offloading of `render()` is a documented future optimization path — the polyline array output is `Transferable`.
- **Vite plugin for presets**: The dev-only API routes mean preset persistence only works when the Vite dev server is running. This is acceptable since the tool is a dev environment. Presets are plain JSON files on disk, so they can also be edited manually.
- **HMR and sketch state**: When a sketch's code changes, Vite HMR will trigger a re-import. The sketch's `render` function is pure, so re-running it with the same params produces the same output — no state to preserve beyond current parameter values. Leva's state persists across HMR updates naturally.
- **shadcn/ui + Leva coexistence**: These two UI systems serve different purposes and should not conflict. shadcn handles app chrome; Leva handles parameter inputs. Care should be taken to ensure Tailwind's reset styles don't interfere with Leva's panel styling — a scoped CSS containment or Tailwind's `important` selector strategy may be needed.

## Non-Goals / Future Iterations

These are explicitly out of scope for the initial build but are anticipated future work:

- **Web Worker rendering** — Offload `render()` to a worker thread for heavy sketches.
- **Animation / frame sequences** — Extend the sketch contract with a `frame` parameter for animated sequences exported as frame-by-frame SVGs.
- **Multi-layer / multi-pen support** — Return labeled groups of polylines for multiple pen colors, exported as separate SVG layers.
- **Path optimization** — TSP-solver-based path optimizer to minimize pen-up travel time before export.
- **vpype integration** — Shell out to vpype (Python) for advanced SVG post-processing (line simplification, deduplication, G-code generation).
- **Gallery / portfolio mode** — A separate build target displaying exported SVGs in a browsable gallery.
- **Collaborative presets** — Share presets via URL query params (serialize params to base64 in the URL hash).
- **Visual sketch selector** — Thumbnail previews or canvas snapshots in the sketch list.

## Testing Strategy

- **Unit tests** for `src/lib/` utilities (`random.ts`, `math.ts`, `geometry.ts`, `clip.ts`, `svg.ts`, `paper.ts`) using **Vitest**. These are pure functions with deterministic output — ideal for unit testing. Seeded random tests verify reproducibility. SVG output tests verify correct dimensions, viewBox, and units.
- **Component tests** for React components using **Vitest** + **React Testing Library**. Focus on integration behavior: does selecting a sketch load its params? Does changing a param trigger a re-render? Does export produce a downloadable SVG?
- **End-to-end smoke test**: A single Playwright test that loads the app, selects the example sketch, changes a parameter, and triggers an SVG export — verifying the full pipeline works.
- **No visual regression testing** in the initial build. The canvas output is generative and parameter-dependent; pixel-comparison tests would be brittle. Correctness is verified through the unit-tested utility layer and the E2E smoke test.

## Success Criteria

1. Running `npm run dev` opens the browser with the sketch studio UI: sidebar, canvas viewport, and control panel.
2. The concentric circles example sketch renders in the canvas preview.
3. Changing a parameter (e.g., circle count, radius, margin) updates the preview in real time.
4. Saving a preset writes a JSON file to the sketch's `presets/` directory on disk.
5. Loading a preset restores the parameter state and updates the preview.
6. Exporting SVG produces a file with correct physical dimensions (e.g., letter size = `width="21.59cm" height="27.94cm"`), correct `viewBox`, and polylines matching the canvas preview.
7. Running `npm run new-sketch -- --name "test"` creates a new sketch directory with a working template.
8. Editing a sketch file triggers Vite HMR and the preview updates without manual refresh.
9. All `src/lib/` utility functions have passing unit tests.
10. The Playwright smoke test passes.
