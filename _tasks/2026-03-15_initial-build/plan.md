# Plotter Sketch Studio — Architecture & Decisions

## Project Overview

A browser-based development environment for creating generative art intended for export as SVG for pen plotters (primarily AxiDraw). Inspired by [canvas-sketch](https://github.com/mattdesl/canvas-sketch) but rebuilt on a modern React + Vite stack with an integrated parameter control UI and a workflow optimized for iterative sketching and physical output.

### Core Workflow

1. Run a CLI command to scaffold a new sketch from a template
2. Open the browser to see the sketch rendered with a live control panel
3. Tweak parameters via GUI controls; see results update in real time
4. Save parameter presets as named JSON snapshots
5. Export the final artwork as SVG, sized for a specific paper format
6. Code changes trigger hot module replacement (Vite HMR) — no manual refresh

---

## Key Architectural Decisions

### 1. Polyline Arrays as the Primary Data Primitive

All sketch output is represented as arrays of polylines: `number[][][]` where the structure is `lines[line[point[x, y]]]`. This is the same convention used by canvas-sketch/penplot and the broader plotter art community.

**Rationale:**
- Pen plotters fundamentally execute sequences of "move to / draw to / pen up" commands. Every geometric form — circles, arcs, beziers, fills-as-hatching — ultimately reduces to polylines.
- Pure numeric arrays are trivial to transform (affine math on raw numbers), clip (e.g., Sutherland-Hodgman on arrays), optimize (path sorting to minimize pen-up travel), and serialize to SVG.
- This approach avoids coupling sketches to any particular rendering backend or DOM API. A sketch is a pure function that computes geometry; rendering and export are separate concerns handled by the framework.
- Performance is excellent — tens of thousands of polylines can be processed without DOM interaction.

There is **no SVG DOM authoring mode**. Sketches do not construct SVG elements directly. The framework handles conversion from polylines to SVG at export time, and conversion from polylines to canvas draw calls for the live preview.

### 2. Canvas Preview, SVG Export

The live preview in the browser renders polylines to an HTML `<canvas>` element using `beginPath()` / `lineTo()` / `stroke()` calls. This is significantly faster than building and reconciling an SVG DOM for high line counts.

SVG is generated only at export time by serializing polylines into `<polyline>` or `<path>` elements. A "preview as SVG" toggle may be offered for pixel-perfect verification before plotting, but the default preview is canvas-based.

### 3. Vite + React (Not Next.js)

The application is built with **Vite + React**. Next.js was considered but rejected for this project.

**Rationale:**
- Vite's HMR is measurably faster, which matters for the tight feedback loop of creative coding. Even 100–200ms of extra latency per code change is felt when iterating on parameters.
- Dynamic imports of sketch modules from a `sketches/` directory are natural with Vite's `import.meta.glob`.
- Next.js's server component / client component boundary adds cognitive overhead with zero benefit — every sketch component is inherently client-side.
- SSR, file-system routing, API routes, and image optimization are not relevant to a creative coding dev tool.
- If a portfolio/gallery site is wanted later, it can be built separately or the studio can be wrapped in an Astro or Next site at that point. The sketch engine should be framework-agnostic enough to allow this.

### 4. Leva for Parameter Controls

The GUI control panel uses **[leva](https://github.com/pmndrs/leva)** from the Poimandres collective (~223k weekly npm downloads, actively maintained).

**Rationale:**
- Leva is React-first — its `useControls` hook is idiomatic React and integrates naturally into the component tree.
- It supports 12+ input types out of the box (sliders, color pickers, vectors, selects, booleans, etc.) with smart type inference.
- Transient updates (via `onChange` handlers) avoid React re-renders on every frame, which is important for performance-sensitive parameter tweaking.
- The plugin system allows custom input types — useful for domain-specific controls like paper size selectors, seed pickers, or pen color choosers.
- Folders / grouping, conditional rendering of inputs, and programmatic value setting are all supported.

Tweakpane was the other strong contender. It's standalone (no React dependency) and has a good plugin ecosystem, but its React bindings are community-maintained and thinner. Since this project is React-native, leva's tighter integration wins.

### 5. Sketch Module Contract

Each sketch is a self-contained ES module in the `sketches/` directory. The framework dynamically imports these modules and wires them into the UI. The contract is:

```typescript
// sketches/my-sketch/index.ts

import type { SketchModule, SketchContext } from '@studio/types';

const sketch: SketchModule = {
  // Parameter schema — drives leva controls
  params: {
    seed: { value: 42, min: 0, max: 99999, step: 1 },
    lineCount: { value: 100, min: 1, max: 1000, step: 1 },
    noiseScale: { value: 0.01, min: 0.001, max: 0.1, step: 0.001 },
    margin: { value: 1.5, min: 0, max: 5, step: 0.1 },
    paperSize: { value: 'letter', options: ['letter', 'a4', 'a3'] },
  },

  // Optional setup — runs once when the sketch loads
  setup(ctx) {
    // Pre-compute expensive things, load assets, etc.
  },

  // Render — called on every parameter change
  // Returns an array of polylines: number[][][]
  render(ctx, params) {
    const { width, height } = ctx;     // Paper dimensions in cm
    const { seed, lineCount } = params; // Current parameter values
    const random = ctx.createRandom(seed);
    const lines: number[][][] = [];

    // ... generate geometry ...

    return lines;
  },
};

export default sketch;
```

**Key properties of this contract:**
- `render` is a **pure function** of `(ctx, params) → polylines`. No side effects, no DOM access, no retained state between calls. This makes sketches easy to reason about, test, and reproduce.
- `params` is a declarative schema that maps directly to leva control definitions. The framework reads this schema to generate the GUI.
- `ctx` provides paper dimensions (in centimeters), a seeded random number generator factory, and potentially other framework services (noise functions, geometry helpers).
- The sketch has no knowledge of how its output will be rendered or exported.

### 6. Seeded Randomness as a First-Class Concern

Deterministic, reproducible randomness is essential for generative art destined for physical output. You need to be able to regenerate the exact same artwork after tweaking a different parameter, and you need to be able to share a seed with someone and have them get the same result.

The framework provides a seeded random utility built on `alea` (PRNG) and `simplex-noise` (coherent noise). The seed is a visible, editable parameter in every sketch's control panel. The `ctx.createRandom(seed)` factory returns an isolated random instance so that adding/removing random calls in one part of a sketch doesn't shift the sequence elsewhere.

API surface of the random utility (modeled on `canvas-sketch-util/random`):
- `value()` — uniform [0, 1)
- `range(min, max)` — uniform in range
- `rangeFloor(min, max)` — integer in range
- `gaussian(mean, std)` — normal distribution
- `boolean()` — 50/50
- `pick(array)` — random element
- `shuffle(array)` — Fisher-Yates (returns copy)
- `onCircle(radius)` — random point on circle perimeter
- `insideCircle(radius)` — random point inside circle
- `noise2D(x, y)` — simplex noise seeded to this instance
- `noise3D(x, y, z)` — simplex noise seeded to this instance

---

## Project Structure

```
plotter-studio/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── scripts/
│   └── new-sketch.ts          # CLI: scaffold a new sketch from template
├── src/
│   ├── main.tsx                # App entry point
│   ├── app.tsx                 # Root component: sketch selector + viewer + controls
│   ├── components/
│   │   ├── SketchViewer.tsx    # Canvas preview renderer
│   │   ├── ControlPanel.tsx    # Leva integration, preset management
│   │   ├── ExportPanel.tsx     # SVG export, paper size config
│   │   └── SketchSelector.tsx  # Browse/select sketches
│   ├── lib/                    # Shared utility library
│   │   ├── random.ts           # Seeded PRNG + noise (alea + simplex-noise)
│   │   ├── math.ts             # lerp, clamp, mapRange, fract, degToRad, etc.
│   │   ├── geometry.ts         # Polyline primitives: circle, arc, rect, bezier, etc.
│   │   ├── clip.ts             # Polyline clipping to rectangular bounds
│   │   ├── svg.ts              # Polylines → SVG serialization
│   │   ├── paper.ts            # Paper size constants (letter, a4, a3, etc.) in cm
│   │   └── types.ts            # SketchModule, SketchContext, Polyline, etc.
│   └── template/               # Sketch template files (copied by new-sketch script)
│       └── index.ts
├── sketches/                   # User sketches live here (gitignored or not, user's choice)
│   ├── 2026-03-15-flow-field/
│   │   ├── index.ts
│   │   └── presets/            # Saved parameter presets as JSON
│   │       └── v1.json
│   └── 2026-03-15-delaunay/
│       └── index.ts
└── exports/                    # Exported SVGs land here (gitignored)
```

### Sketch Discovery

Vite's `import.meta.glob('./sketches/*/index.ts', { eager: false })` is used to discover sketches at build time. The sketch selector UI lists all discovered sketches. Selecting a sketch triggers a dynamic import, reads its `params` schema, and initializes the control panel and preview.

Adding a new sketch is: run `npm run new-sketch -- --name "flow field"`, which creates `sketches/2026-03-15-flow-field/index.ts` from the template. Vite's HMR picks it up automatically.

---

## Utility Library (`src/lib/`)

### `random.ts` — Seeded Random & Noise

Wraps `alea` for PRNG and `simplex-noise` for coherent noise. Provides a `createRandom(seed)` factory that returns an isolated instance. All randomness in a sketch should flow through this instance to guarantee reproducibility.

Dependencies: `alea`, `simplex-noise`

### `math.ts` — Math Utilities

Standard creative coding math helpers. No external dependencies.

Functions: `lerp`, `inverseLerp`, `clamp`, `mapRange`, `fract`, `mod`, `degToRad`, `radToDeg`, `smoothstep`, `lerpArray` (vector interpolation), `dist`, `distSq`, `angleBetween`

### `geometry.ts` — Polyline Primitives

Functions that return polylines (`number[][]`) from higher-level geometric descriptions. These are the building blocks sketches compose.

Functions: `circle(cx, cy, r, segments?)`, `arc(cx, cy, r, startAngle, endAngle, segments?)`, `rect(x, y, w, h)`, `line(x1, y1, x2, y2)`, `polygon(cx, cy, r, sides)`, `ellipse(cx, cy, rx, ry, segments?)`, `bezier(points, segments?)`, `quadratic(p0, p1, p2, segments?)`, `cubic(p0, p1, p2, p3, segments?)`, `spiral(cx, cy, rStart, rEnd, turns, segments?)`

All functions work in centimeters to match the paper coordinate system.

### `clip.ts` — Polyline Clipping

Clips polylines to rectangular bounds (typically paper margins). Uses the Cohen-Sutherland or Sutherland-Hodgman algorithm.

Functions: `clipPolylinesToBox(lines, [minX, minY, maxX, maxY])` — returns new array of clipped polylines

Potential dependency: `lineclip` (Mapbox's fast polyline/polygon clipper)

### `svg.ts` — SVG Serialization

Converts polylines to SVG markup for export. Handles paper sizing, viewBox, stroke settings, and multi-layer support (e.g., different pen colors as separate SVG groups/layers).

Functions: `polylinesToSVG(lines, options)` where options include `width`, `height`, `units` ('cm'|'in'|'mm'), `strokeWidth`, `strokeColor`, `layers?`, `optimize?`

The output SVG uses absolute units matching the physical paper size so it imports into Inkscape / AxiDraw plugin at the correct dimensions without scaling.

### `paper.ts` — Paper Size Constants

Named paper sizes with dimensions in centimeters, both portrait and landscape.

```typescript
export const PAPER_SIZES = {
  letter:    { width: 21.59, height: 27.94 },
  a4:        { width: 21.0,  height: 29.7  },
  a3:        { width: 29.7,  height: 42.0  },
  a5:        { width: 14.8,  height: 21.0  },
  // ... etc
} as const;
```

---

## Component Architecture

### `SketchViewer.tsx`

Renders the current sketch's polyline output to an HTML `<canvas>` element.

Responsibilities:
- Maintain a canvas element sized to fit the viewport while preserving the paper's aspect ratio
- Transform from paper coordinates (cm) to pixel coordinates, with appropriate scaling
- Render polylines via `CanvasRenderingContext2D` path operations
- Show a paper boundary outline and margin guides
- Optionally display a background color representing the paper
- Re-render when params change (driven by leva's `onChange` or React state)

Performance considerations:
- For sketches with many polylines, rendering should happen outside React's render cycle via `requestAnimationFrame` or an effect that draws directly to the canvas
- The sketch's `render()` function may be computationally expensive — consider debouncing parameter changes or running `render()` in a Web Worker for heavy sketches (future optimization)

### `ControlPanel.tsx`

Integrates leva to provide the parameter GUI.

Responsibilities:
- Read the active sketch's `params` schema and translate it into leva control definitions
- Expose current parameter values to the sketch viewer
- Provide preset management: save current params as a named JSON file, load presets, list available presets
- Include always-present controls: seed (with randomize button), paper size, orientation, margin

Presets are stored as JSON files in each sketch's `presets/` subdirectory. The save/load mechanism writes to and reads from the filesystem (in dev, via Vite's server; could also use localStorage as a fallback).

### `ExportPanel.tsx`

Handles SVG export and related settings.

Responsibilities:
- Trigger SVG generation from the current polyline output using `svg.ts`
- Configure export options: stroke width, stroke color, whether to optimize paths, units
- Download the SVG file (named after the sketch + preset + timestamp)
- Optionally copy SVG to clipboard
- Show estimated plot time / path statistics (total path length, number of pen lifts) as a future feature

### `SketchSelector.tsx`

Lists available sketches and allows switching between them.

Responsibilities:
- Use `import.meta.glob` results to enumerate available sketches
- Display sketch names (derived from directory names)
- Handle dynamic import of the selected sketch module
- Manage loading states during sketch import

---

## Dependency Summary

### Runtime Dependencies

| Package | Purpose | Weekly Downloads |
|---------|---------|-----------------|
| `react`, `react-dom` | UI framework | — |
| `leva` | Parameter control GUI | ~223k |
| `simplex-noise` | Coherent noise generation | — |
| `alea` | Seedable PRNG | — |
| `lineclip` | Fast polyline/polygon clipping | — |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| `vite` | Build tool + dev server + HMR |
| `@vitejs/plugin-react` | React Fast Refresh for Vite |
| `typescript` | Type safety |

### Intentionally Not Included

| Package | Reason |
|---------|--------|
| `p5.js` | Global-mode API conflicts with React; SVG export is bolted-on; adds weight without proportional benefit for this use case |
| `paper.js` | Heavyweight scene graph model is awkward to integrate with React; canvas-backed rendering is redundant. Could be added later as an optional geometry computation library for path booleans if needed |
| `canvas-sketch` | The CLI/dev-server tooling is built on budo/browserify (outdated). However, `canvas-sketch-util` is a valid standalone dependency for its `random`, `math`, and `geometry` modules — consider using it directly rather than reimplementing |
| `gl-matrix` | Overkill for 2D work; simple inline math functions are sufficient. Reconsider if 3D projection features are added |
| `tweakpane` | Strong library, but leva's React-native integration is a better fit since the app is already React |

---

## Future Considerations

These are not in scope for the initial build but should be kept in mind during architecture:

- **Web Worker rendering:** Move the sketch `render()` call to a worker thread so heavy computations don't block the UI. The polyline array output is transferable.
- **Animation / frame sequences:** Some plotter art involves animated sequences exported as frame-by-frame SVGs. The sketch contract could be extended with a `frame` parameter in the context.
- **Multi-layer / multi-pen support:** Sketches that use multiple pen colors need to return labeled groups of polylines. The export step would generate separate SVG layers or files per color.
- **Path optimization:** Integrate a TSP-solver-based path optimizer to minimize pen-up travel time before export. This is a post-processing step on the polyline array.
- **vpype integration:** Shell out to `vpype` (Python) for advanced SVG post-processing — line simplification, deduplication, pen-up optimization, G-code generation. This would be an optional export pipeline step.
- **Gallery / portfolio mode:** A separate build target or wrapper site (Astro, Next.js) that displays exported SVGs in a browsable gallery. The sketch engine should remain decoupled enough to support this.
- **Collaborative presets:** Share presets via URL query params (serialize params to base64 in the URL hash).