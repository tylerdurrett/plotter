# Implementation Guide: Plotter Sketch Studio — Full Build

**Date:** 2026-03-15
**Feature:** Plotter Sketch Studio
**Source:** [2026-03-15_feature-description.md](2026-03-15_feature-description.md)

## Overview

This guide breaks the full Plotter Sketch Studio build into 9 sequential phases. The guiding principle is **usability at every phase boundary**: after completing each phase, the system is in a working, testable state. A developer can stop at any phase boundary and have something functional.

The sequencing follows a bottom-up strategy: foundational tooling first (Phase 1), then pure utility libraries that can be tested in isolation (Phases 2–3), then the core rendering pipeline (Phase 4), then interactivity layers (Phases 5–6), then output and persistence features (Phases 7–8), and finally developer tooling and end-to-end verification (Phase 9).

Vitest is introduced in Phase 1 and used immediately in Phase 2. Every phase that produces testable code includes test-writing tasks within that phase. The Playwright E2E test comes last because it exercises the full pipeline and depends on all prior phases.

Remember: YOU are responsible for verifying that the system works after each implementation step.

## File Structure

```
plotter/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── components.json                 # shadcn/ui config
├── index.html
├── scripts/
│   └── new-sketch.ts               # CLI: scaffold new sketch
├── src/
│   ├── main.tsx                     # App entry point
│   ├── app.tsx                      # Root component
│   ├── index.css                    # Tailwind directives + Leva overrides
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives (auto-generated)
│   │   ├── ErrorBoundary.tsx        # Catches sketch render errors
│   │   ├── SketchViewer.tsx         # Canvas preview renderer
│   │   ├── ControlPanel.tsx         # Leva integration
│   │   ├── ExportPanel.tsx          # SVG export controls
│   │   └── SketchSelector.tsx       # Sidebar sketch list
│   ├── lib/
│   │   ├── types.ts                 # SketchModule, SketchContext, etc.
│   │   ├── paper.ts                 # Paper size constants (cm)
│   │   ├── math.ts                  # lerp, clamp, mapRange, etc. (scalar)
│   │   ├── vec.ts                   # Vec2/Vec3 ops + 3D→2D projection
│   │   ├── alea.d.ts                # Type declaration for `alea` package
│   │   ├── random.ts                # Seeded PRNG + simplex noise
│   │   ├── geometry.ts              # Polyline primitives
│   │   ├── clip.ts                  # Polyline clipping
│   │   ├── svg.ts                   # Polylines → SVG serialization
│   │   └── utils.ts                 # cn() helper (shadcn)
│   ├── hooks/
│   │   ├── useSketchLoader.ts       # Dynamic sketch import + glob
│   │   └── usePresets.ts            # Preset CRUD via Vite plugin API
│   ├── plugins/
│   │   └── vite-plugin-presets.ts   # Dev-only preset filesystem API
│   └── template/
│       └── index.ts                 # Sketch template for scaffolding
├── sketches/
│   └── 2026-03-15-concentric-circles/
│       └── index.ts                 # Example sketch
├── exports/                         # SVG exports (gitignored)
└── tests/
    └── e2e/
        └── smoke.spec.ts            # Playwright E2E smoke test
```

---

## Phase 1: Project Bootstrap

**Purpose:** Get a bare Vite + React + TypeScript + Tailwind + shadcn/ui project running in the browser with a test runner configured.

**Rationale:** Everything else depends on the build toolchain. By completing this phase first, every subsequent phase has a working dev server and test runner available. shadcn/ui is initialized here (not later) because its CLI generates config files and a `utils.ts` that other phases will depend on.

### 1.1 Initialize Vite + React + TypeScript

- [x] Run `pnpm create vite@latest` with React + TypeScript template (or manually create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`)
  - **Note:** Manually created files using scaffolded template as reference (to avoid conflicts with existing repo files). Used Vite 8, React 19.2, TypeScript 5.9.
- [x] Verify `pnpm dev` serves a page in the browser
- [x] Configure `tsconfig.json` with path alias `@/` → `src/` for clean imports
  - **Note:** Alias configured in both `tsconfig.app.json` (`paths`) and `vite.config.ts` (`resolve.alias`). Validated via `@/app` import in `main.tsx`.

**Acceptance Criteria:**

- `pnpm dev` starts the Vite dev server and renders a page in the browser
- TypeScript compilation succeeds with no errors
- Path alias `@/` resolves correctly in imports

### 1.2 Install Tailwind CSS

- [x] Install `tailwindcss` and `@tailwindcss/vite`
  - **Note:** Installed tailwindcss 4.2.1 and @tailwindcss/vite 4.2.1. Peer dependency warning for Vite 8 (plugin lists ^5.2.0 || ^6 || ^7) but works correctly in practice.
- [x] Add the Vite plugin to `vite.config.ts`
  - **Note:** Added `tailwindcss()` before `react()` in the plugins array so CSS transforms run first.
- [x] Create `src/index.css` with Tailwind directives (`@import "tailwindcss"`)
- [x] Import `index.css` in `main.tsx`
- [x] Verify a Tailwind utility class (e.g., `bg-red-500`) renders correctly
  - **Note:** Verified with `min-h-screen`, `flex`, `items-center`, `justify-center`, `text-4xl`, `font-bold`, `text-neutral-900`. Used `text-neutral-900` instead of `text-white` since dark theme is not yet configured (Phase 1.3). Tailwind preflight/reset also confirmed active.

**Note:** Tailwind v4 uses CSS-first configuration via `@theme` directives — there is no `tailwind.config.ts` file. All theme customization goes in `src/index.css`.

**Acceptance Criteria:**

- Tailwind utility classes apply correctly in rendered output
- No CSS build errors
- No `tailwind.config.ts` file (Tailwind v4 CSS-first config)

### 1.2.5 Configure Prettier

- [x] Install `prettier` and `eslint-config-prettier` (disables ESLint rules that conflict with Prettier)
  - **Note:** Installed prettier 3.8.1 and eslint-config-prettier 10.1.8.
- [x] Create `.prettierrc` with project preferences: `semi: false`, `singleQuote: true`, `trailingComma: "all"`, `printWidth: 80`
- [x] Add `"prettier"` to the end of the ESLint `extends` array in `eslint.config.js` (via `eslint-config-prettier`) so formatting rules don't clash
  - **Note:** Imported `eslint-config-prettier` and added it as the last config entry in `tseslint.config()` so it disables any formatting rules from earlier configs.
- [x] Add `"format"` and `"format:check"` scripts to `package.json`:
  - `"format": "prettier --write ."`
  - `"format:check": "prettier --check ."`
- [x] Create `.prettierignore` to skip `dist/`, `node_modules/`, `exports/`, and `.claude/`
- [x] Run `pnpm format` to format all existing files
- [x] Verify `pnpm lint` and `pnpm format:check` both pass with no conflicts

**Acceptance Criteria:**

- `pnpm format:check` passes with no unformatted files
- `pnpm lint` passes with no conflicts between ESLint and Prettier
- `.prettierrc` exists with chosen style preferences

### 1.3 Initialize shadcn/ui

- [x] Run `pnpm dlx shadcn@latest init` to generate `components.json` and `src/lib/utils.ts` (the `cn()` helper). Use the Vite-specific variant if prompted (shadcn supports Tailwind v4 natively).
  - **Note:** Used `-d` flag for defaults. Required adding `baseUrl`/`paths` to root `tsconfig.json` for shadcn to detect the import alias. Init used "base-nova" style with neutral base color, installed `clsx`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css`, `@base-ui/react`, `@fontsource-variable/geist`, and `shadcn` as dependencies. Also added `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, and `@import "@fontsource-variable/geist"` to index.css and generated full light/dark CSS variable set.
- [x] Configure **dark theme as default**: set `class="dark"` on `<html>` in `index.html`, and ensure shadcn's CSS variables include dark mode colors. The project convention is **dark-theme-first** (see AGENTS.md).
  - **Note:** Added `class="dark"` to `<html>` tag. shadcn init generated `.dark { ... }` CSS variable block with all dark mode colors. Dark variant configured via `@custom-variant dark (&:is(.dark *))`.
- [x] Install one test component (e.g., Button) to verify the pipeline: `pnpm dlx shadcn@latest add button`
  - **Note:** Button was auto-installed by `shadcn init -d` as part of the default initialization. Uses `@base-ui/react/button` as the primitive.
- [x] Render the Button component in `app.tsx` to confirm it works in dark mode
  - **Note:** Verified via screenshot — dark background with light text and properly styled Button component.
- [x] Remove the test Button usage from `app.tsx` (keep the component file for later use)

**Acceptance Criteria:**

- `components.json` exists with correct paths
- `src/components/ui/button.tsx` exists and exports a working Button component
- `cn()` utility is available at `@/lib/utils`
- App renders with dark theme by default

### 1.4 Configure Vitest

- [x] Install `vitest` and `@testing-library/react@^16.1.0` (v16.1.0+ required for React 19), `@testing-library/jest-dom`, `jsdom`
  - **Note:** Installed vitest 4.1.0, @testing-library/react 16.3.2, @testing-library/jest-dom 6.9.1, @testing-library/dom 10.4.1, jsdom 29.0.0.
- [x] Add Vitest config (inline in `vite.config.ts` or separate `vitest.config.ts`)
  - **Note:** Used inline config in `vite.config.ts` with `/// <reference types="vitest/config" />`. Added explicit `include` pattern scoped to `src/` and `tests/` directories to prevent Vitest from picking up unrelated test files in `.claude/skills/`.
- [x] Create a trivial test file (`src/lib/__tests__/setup.test.ts`) that asserts `1 + 1 === 2`
- [x] Add `"test"` script to `package.json`
  - **Note:** Added both `"test": "vitest run"` (single run) and `"test:watch": "vitest"` (watch mode).

**Acceptance Criteria:**

- `pnpm test` executes Vitest and the trivial test passes
- Test environment is configured with jsdom for future component tests

### 1.5 Project Scaffolding

- [x] Create empty directory structure: `src/components/`, `src/lib/`, `src/hooks/`, `src/plugins/`, `src/template/`, `sketches/`, `exports/`, `scripts/`, `tests/e2e/`
  - **Note:** `src/components/` and `src/lib/` already existed from Phase 1.3/1.4. Created remaining directories with `.gitkeep` files so Git tracks them.
- [x] Add `exports/` to `.gitignore`
- [x] Create a minimal `app.tsx` with placeholder text ("Plotter Sketch Studio") styled with Tailwind
  - **Note:** Updated existing `app.tsx` to use `bg-background text-foreground` (shadcn CSS variables) for proper dark theme support, and added `tracking-tight` for polish. Verified via screenshot — dark background, centered white text.

**Acceptance Criteria:**

- All directories exist
- `exports/` is gitignored
- `pnpm dev` shows the placeholder app

---

## Phase 2: Core Type System, Paper Constants & Math Utilities

**Purpose:** Establish the foundational type definitions, paper size data, and math/vector utilities that all subsequent code depends on.

**Rationale:** Types must exist before any module can implement the sketch contract. Paper sizes are pure data with no dependencies — they are the simplest module to build and test first, and they are needed by the canvas viewer, SVG exporter, and sketch context. Scalar math and vector utilities are pure functions with no dependencies beyond the types — completing them here means the full math toolkit is available when geometry and random modules are built in Phase 3.

### 2.1 Type Definitions (`src/lib/types.ts`)

- [x] Define `Vec2` as `[number, number]`
- [x] Define `Vec3` as `[number, number, number]`
- [x] Define `Point` as `Vec2` (alias — compatible everywhere `Vec2` is used)
- [x] Define `Polyline` as `Point[]`
- [x] Define `PaperSize` as `{ width: number; height: number }` (cm)
- [x] Define `SketchContext` with `width`, `height` (cm), `createRandom(seed)` factory, and paper metadata
- [x] Define `SketchModule` interface: `params`, optional `setup(ctx)`, `render(ctx, params) → number[][][]`
  - **Note:** `render` return type is `Polyline[]` (which is `Point[][]` = `[number, number][][]`) for type safety. Also added `Random` interface to fully type the `createRandom` factory return value, based on Phase 3.1 spec. `SketchContext.paper` includes `name`, `width`, `height`, and `margin` fields.
- [x] Define `ExportOptions` interface: `width`, `height`, `units`, `strokeWidth`, `strokeColor`

**Acceptance Criteria:**

- All types compile without errors
- Types are importable via `@/lib/types`

### 2.2 Paper Size Constants (`src/lib/paper.ts`)

- [x] Define `PAPER_SIZES` record with `letter`, `a4`, `a3`, `a5`, `a2`, `tabloid` — all in cm, portrait orientation
- [x] Export a helper function `getPaperSize(name, orientation)` that returns dimensions, swapping width/height for landscape
  - **Note:** Also exports `Orientation` type. Returns a defensive copy (`{ ...size }`) to prevent mutation of the source record. Throws with a helpful error listing available sizes for unknown names.
- [x] Write unit tests: verify known dimensions (e.g., letter = 21.59 × 27.94 cm), verify landscape swaps width/height, verify unknown paper name throws or returns undefined
  - **Note:** 14 tests total: 7 for `PAPER_SIZES` constants (including a portrait invariant check across all sizes) and 7 for `getPaperSize` (portrait default, explicit portrait, landscape swap for a4 and letter, unknown name error, and reference identity check).

**Acceptance Criteria:**

- `PAPER_SIZES.letter` returns `{ width: 21.59, height: 27.94 }`
- `getPaperSize('a4', 'landscape')` returns `{ width: 29.7, height: 21.0 }`
- All paper size tests pass

### 2.2.5 Custom Paper Size Support (`src/lib/paper.ts`)

- [x] Extend `getPaperSize` to accept `string | PaperSize` — when a `{ width, height }` object is passed, validate and return it directly (with orientation swap if landscape)
- [x] Add `validatePaperSize` helper that throws if dimensions are not positive
- [x] Write unit tests: custom object passthrough, landscape swap on custom sizes, rejection of zero/negative dimensions
  - **Note:** 4 new tests added (custom passthrough, custom landscape swap, zero width rejection, negative height rejection), bringing the paper test total to 17.

**Acceptance Criteria:**

- `getPaperSize({ width: 15, height: 20 })` returns `{ width: 15, height: 20 }`
- `getPaperSize({ width: 15, height: 20 }, 'landscape')` returns `{ width: 20, height: 15 }`
- Zero or negative dimensions throw
- All existing preset paper size tests still pass
- All paper size tests pass

### 2.3 Scalar Math Utilities (`src/lib/math.ts`)

- [ ] Implement: `lerp`, `inverseLerp`, `clamp`, `mapRange`, `fract`, `mod` (true modulo, not JS `%`), `degToRad`, `radToDeg`, `smoothstep`
- [ ] Write unit tests for each function with edge cases (e.g., `clamp` at boundaries, `lerp` at 0 and 1, `mod` with negative numbers)

**Acceptance Criteria:**

- All math functions are pure, dependency-free, and exported
- All math tests pass with correct floating-point handling (use `toBeCloseTo` where appropriate)
- `math.ts` contains only scalar (single-number) operations — vector ops live in `vec.ts`

### 2.4 Vector Utilities (`src/lib/vec.ts`)

- [ ] Implement dimension-generic functions (work on both `Vec2` and `Vec3` via `number[]` iteration internally):
  - `vec.add(a, b)` — component-wise addition
  - `vec.sub(a, b)` — component-wise subtraction
  - `vec.scale(a, s)` — scalar multiply
  - `vec.negate(a)` — flip sign
  - `vec.dot(a, b)` — dot product
  - `vec.len(a)` — length / magnitude
  - `vec.lenSq(a)` — squared length (avoids sqrt)
  - `vec.normalize(a)` — unit vector
  - `vec.dist(a, b)` — distance between two points
  - `vec.distSq(a, b)` — squared distance
  - `vec.lerp(a, b, t)` — linear interpolation
  - `vec.angleBetween(a, b)` — angle between two vectors
- [ ] Implement 2D-specific functions:
  - `vec.perpendicular(a)` — 90° rotation (`[-y, x]`)
- [ ] Implement 3D-specific functions:
  - `vec.cross(a, b)` — cross product (returns `Vec3`)
- [ ] Implement 3D→2D projection functions:
  - `vec.projectOrthographic(p, axis)` — drop one axis (e.g., drop Z for top-down)
  - `vec.projectPerspective(p, focalLength)` — simple perspective divide
- [ ] Export as a `vec` namespace object to avoid name collisions with `math.ts` scalar functions
- [ ] All functions return new arrays (no mutation)
- [ ] Write unit tests:
  - `vec.add([1, 2], [3, 4])` returns `[4, 6]`
  - `vec.add([1, 2, 3], [4, 5, 6])` returns `[5, 7, 9]` (works for 3D)
  - `vec.dot([1, 0], [0, 1])` returns `0` (perpendicular)
  - `vec.normalize([3, 4])` returns `[0.6, 0.8]`
  - `vec.cross([1,0,0], [0,1,0])` returns `[0,0,1]`
  - `vec.perpendicular([1, 0])` returns `[0, 1]`
  - `vec.projectPerspective([x, y, z], f)` returns correct `[x*f/z, y*f/z]`
  - `vec.dist` matches manual calculation for known triangles

**Acceptance Criteria:**

- All vector functions are pure and return new arrays (no mutation)
- Dimension-generic functions work on both `Vec2` and `Vec3` inputs
- `vec.*` namespace avoids collisions with `math.ts` scalar functions like `lerp`
- All vector tests pass with correct floating-point handling

---

## Phase 3: Random & Geometry Libraries

**Purpose:** Complete the utility library with seeded randomness and geometry primitives — the two modules sketch authors interact with most.

**Rationale:** These depend on Phase 2 types and math utilities. They are still pure functions testable in isolation. Completing them before building the UI means the full sketch authoring toolkit is available when we wire up the first sketch.

### 3.1 Seeded Random (`src/lib/random.ts`)

- [ ] Install `alea` and `simplex-noise` packages
- [ ] Create `src/lib/alea.d.ts` type declaration — `alea` ships no TypeScript types and `@types/alea` does not exist. Declare the module with `declare module 'alea' { ... }` exporting the PRNG factory function.
- [ ] Implement `createRandom(seed)` factory returning an object with:
  - `value()` — uniform [0, 1)
  - `range(min, max)` — uniform float in range
  - `rangeFloor(min, max)` — integer in range
  - `gaussian(mean, std)` — Box-Muller normal distribution
  - `boolean()` — 50/50
  - `pick(array)` — random element
  - `shuffle(array)` — Fisher-Yates (returns new array, does not mutate)
  - `onCircle(radius)` — random point on circle perimeter
  - `insideCircle(radius)` — random point inside circle
  - `noise2D(x, y)` — simplex noise seeded to this instance
  - `noise3D(x, y, z)` — simplex noise seeded to this instance
- [ ] Write unit tests:
  - Same seed produces identical sequences (call `value()` 100 times, compare arrays)
  - Different seeds produce different sequences
  - `range(5, 10)` always returns values in [5, 10)
  - `rangeFloor(0, 3)` returns only 0, 1, or 2 over many calls
  - `shuffle` returns a new array (not the same reference) with the same elements
  - `noise2D` returns consistent values for same seed + coordinates
  - `gaussian` mean and std approximate expected values over many samples

**Acceptance Criteria:**

- `createRandom(42)` produces deterministic, reproducible results
- All random tests pass
- No global state — two `createRandom` instances with different seeds do not interfere

### 3.2 Geometry Primitives (`src/lib/geometry.ts`)

- [ ] Implement polyline-returning functions (all coordinates in cm):
  - `circle(cx, cy, r, segments?)` — closed polyline approximating a circle
  - `arc(cx, cy, r, startAngle, endAngle, segments?)` — open polyline
  - `rect(x, y, w, h)` — closed polyline (5 points, last = first)
  - `line(x1, y1, x2, y2)` — 2-point polyline
  - `polygon(cx, cy, r, sides)` — regular polygon as closed polyline
  - `ellipse(cx, cy, rx, ry, segments?)` — closed polyline
  - `quadratic(p0, p1, p2, segments?)` — quadratic Bezier as polyline
  - `cubic(p0, p1, p2, p3, segments?)` — cubic Bezier as polyline
  - `spiral(cx, cy, rStart, rEnd, turns, segments?)` — Archimedean spiral
- [ ] Write unit tests:
  - `circle(0, 0, 1, 4)` returns 5 points forming a square-ish shape (first = last)
  - `rect(0, 0, 2, 3)` returns 5 points with correct corners
  - `line(0, 0, 1, 1)` returns exactly `[[0,0], [1,1]]`
  - `polygon(0, 0, 1, 6)` returns 7 points (hexagon, closed)
  - All functions return `number[][]` (array of [x,y] pairs)
  - Segment count parameter controls point density

**Acceptance Criteria:**

- All geometry functions return `number[][]` polylines
- Closed shapes have first point === last point
- Default segment counts produce visually smooth curves (≥ 64 for circles)
- All geometry tests pass

---

## Phase 4: Canvas Preview & Sketch System

**Purpose:** Get a sketch rendering visually in the browser — the first time polylines appear on screen.

**Rationale:** This is the minimum viable "see something" moment. After this phase, the developer can write a sketch, save the file, and see it render. This requires the sketch module contract, dynamic loading, the canvas renderer, and one example sketch. The UI layout is intentionally minimal here — a full-screen canvas is sufficient. The proper app shell comes in Phase 6.

### 4.1 Sketch Context Factory

- [ ] Create a `createSketchContext(paperSize, orientation, margin)` function (can live in `src/lib/types.ts` or a new `src/lib/context.ts`) that builds a `SketchContext` object:
  - `width` and `height` from paper size (minus margins if applicable)
  - `createRandom(seed)` from `random.ts`
  - Paper metadata (name, full dimensions, margin)
- [ ] Write unit tests: context for letter portrait has correct dimensions, margin reduces effective width/height

**Acceptance Criteria:**

- `createSketchContext` returns a well-formed `SketchContext`
- Dimensions are in cm and account for margins
- `createRandom` on the context returns a working seeded random instance

### 4.2 SketchViewer Component (`src/components/SketchViewer.tsx`)

- [ ] Create a React component that accepts `lines: number[][][]` and `paperSize: PaperSize` as props
- [ ] Render an HTML `<canvas>` element that:
  - Sizes itself to fill available space while preserving the paper's aspect ratio
  - **Handles `window.devicePixelRatio`** for crisp rendering on retina/HiDPI displays: set canvas `width`/`height` attributes to `containerSize * dpr`, CSS `width`/`height` to `containerSize`, and scale the 2D context by `dpr`
  - Transforms from paper coordinates (cm) to pixel coordinates (scale + translate)
  - Iterates over polylines and draws each with `beginPath()` / `moveTo()` / `lineTo()` / `stroke()`
  - Draws a paper boundary outline (light rectangle)
  - Draws margin guides (dashed inner rectangle) if margin is provided
- [ ] Use `useRef` for the canvas and draw via `useEffect` or `useLayoutEffect` — not in the React render cycle
- [ ] Handle window resize (re-measure container, redraw)
- [ ] **Wrap the viewer in a React error boundary** (create `src/components/ErrorBoundary.tsx`) that catches `render()` errors and displays the error message inline instead of white-screening the entire app. This is critical for the edit-save-preview loop where sketch code frequently throws during development.
- [ ] Write a component test: renders without crashing, canvas element exists in DOM

**Acceptance Criteria:**

- Passing an array of polylines renders visible lines on the canvas
- Paper aspect ratio is preserved (no stretching)
- Paper boundary and margin guides are visible
- Resizing the window re-scales the canvas appropriately
- Canvas renders crisply on retina/HiDPI displays (not blurry)
- A sketch `render()` that throws shows the error in the viewer area, not a white screen

### 4.3 Sketch Dynamic Loading (`src/hooks/useSketchLoader.ts`)

- [ ] Use `import.meta.glob('../../sketches/*/index.ts', { eager: false })` to discover sketch modules (two levels up from `src/hooks/` to reach the project root `sketches/` directory)
- [ ] Create a `useSketchLoader()` hook that returns:
  - `sketchList: string[]` — available sketch names (derived from directory names)
  - `activeSketch: SketchModule | null` — the currently loaded sketch
  - `loadSketch(name: string): Promise<void>` — triggers dynamic import
  - `loading: boolean`
- [ ] Handle errors during import (invalid module, missing export)

**Acceptance Criteria:**

- Hook discovers all sketch directories under `sketches/`
- `loadSketch` dynamically imports and returns a valid `SketchModule`
- Loading state is tracked correctly

### 4.4 Concentric Circles Example Sketch

- [ ] Create `sketches/2026-03-15-concentric-circles/index.ts` implementing the `SketchModule` contract
- [ ] Params: `count` (number of circles, default 5), `maxRadius` (default 8 cm), `margin` (default 1.5 cm), `paperSize` (default 'letter')
- [ ] `render()` uses `geometry.circle()` to generate `count` concentric circles centered on the paper, with radii evenly spaced from `maxRadius / count` to `maxRadius`
- [ ] Verify the sketch satisfies the `SketchModule` type (TypeScript compiles)

**Acceptance Criteria:**

- The sketch module exports a valid `SketchModule`
- `render()` returns `number[][][]` with the expected number of polylines
- Each polyline is a valid circle centered on the paper

### 4.5 Wire It Together — Minimal App

- [ ] Update `app.tsx` to:
  - Use `useSketchLoader` to load the concentric circles sketch on mount
  - **Call the sketch's `setup(ctx)` if defined** — once after initial load (not on every param change)
  - Build a `SketchContext` from the sketch's paper size params
  - Call the sketch's `render(ctx, defaultParams)` to get polylines
  - Pass polylines to `SketchViewer`, **wrapped in `ErrorBoundary`** from Phase 4.2
- [ ] Verify in the browser: five concentric circles appear on a paper-shaped canvas

**Acceptance Criteria:**

- `pnpm dev` shows the concentric circles sketch rendering in the canvas
- Circles are centered and properly scaled to the paper dimensions
- No console errors
- Error boundary catches and displays errors from broken sketch code

---

## Phase 5: Parameter Controls

**Purpose:** Make sketches interactive — parameters change in the GUI and the preview updates in real time.

**Rationale:** This is the core creative coding feedback loop. Once parameters are interactive, the tool is genuinely usable for iterative sketching. Leva is introduced here rather than earlier because it depends on having a working sketch + viewer to wire into.

### 5.1 Leva Integration (`src/components/ControlPanel.tsx`)

- [ ] Install `leva` package
- [ ] Create `ControlPanel` component that accepts a sketch's `params` schema and renders Leva controls
- [ ] Use Leva's `useControls` hook with the sketch's param definitions
- [ ] **Use `<LevaPanel>` with `fill` mode** to embed the panel inside the right sidebar container — Leva's default is a floating panel (top-right corner), which won't work with the three-zone layout. Import `LevaPanel` from `leva` and render it inside a container div rather than relying on the auto-positioned default.
- [ ] Support core Leva input types: number (slider), boolean, select/options, color
- [ ] Expose current parameter values via a callback prop or return value
- [ ] Use Leva's transient `onChange` mode to avoid full React re-renders on every slider drag

**Acceptance Criteria:**

- Leva panel renders controls matching the sketch's `params` schema
- Leva panel is embedded inside its container, not floating
- Slider for `count` appears with correct min/max/step
- Select for `paperSize` shows available options
- Parameter values are accessible to the parent component

### 5.2 Wire Parameters → Render → Preview

- [ ] Update `app.tsx` to:
  - Pass the active sketch's `params` to `ControlPanel`
  - On parameter change, re-run the sketch's `render(ctx, newParams)` to get new polylines
  - **Throttle the render loop with `requestAnimationFrame`** — coalesce rapid parameter changes (e.g., dragging a slider) so `render()` runs at most once per frame. Without this, expensive sketches will stutter during slider drags.
  - Pass updated polylines to `SketchViewer`
  - Rebuild `SketchContext` when paper size or margin changes
- [ ] Ensure the canvas redraws on every parameter change (within the rAF throttle)
- [ ] Add a "Randomize Seed" button that picks a random seed value and updates the control

**Acceptance Criteria:**

- Changing the `count` slider updates the number of circles in real time
- Changing `maxRadius` visually changes circle sizes
- Changing `paperSize` changes the canvas aspect ratio and circle positioning
- "Randomize Seed" button works (even though the example sketch doesn't use randomness heavily, the parameter updates)
- No perceptible lag for the simple example sketch

### 5.3 HMR Verification

- [ ] Verify that editing the concentric circles sketch code (e.g., changing default param values or render logic) triggers Vite HMR and the preview updates without manual browser refresh
- [ ] Verify that Leva parameter state persists across HMR updates (values the user set don't reset)
- [ ] Document any HMR caveats or workarounds needed

**Acceptance Criteria:**

- Code changes to a sketch file update the preview within ~1 second
- Parameter values persist across HMR (user doesn't lose their tweaks)

---

## Phase 6: App Shell & Sketch Selector

**Purpose:** Build the full application layout and enable switching between multiple sketches.

**Rationale:** With parameters working, the single-sketch experience is complete. Now we add the chrome: sidebar layout, sketch selector, and proper visual structure. This phase is sequenced after controls (not before) because the controls need to be working to validate that sketch switching correctly re-initializes them.

### 6.1 Three-Zone Layout

- [ ] Install shadcn/ui components needed for layout: `scroll-area`, `separator`, `button` (if not already installed)
- [ ] Build the app shell layout in `app.tsx`:
  - **Left sidebar** (~240px): sketch selector area (top), preset controls area (bottom, placeholder for Phase 8)
  - **Center viewport** (flex-grow): `SketchViewer` filling available space
  - **Right panel** (~300px): `ControlPanel` (Leva) at top, export controls area (bottom, placeholder for Phase 7)
- [ ] Use Tailwind for the grid/flex layout
- [ ] Ensure the layout is responsive to window resize (center viewport scales, sidebars are fixed-width)
- [ ] Ensure Leva's `<LevaPanel>` (from Phase 5.1) is properly positioned within the right panel container using `fill` mode
- [ ] Ensure Leva's panel styling is not broken by Tailwind's CSS reset — add scoping CSS in `index.css` if needed
- [ ] Verify dark theme applies to all shadcn/ui components and the overall layout (configured in Phase 1.3)

**Acceptance Criteria:**

- Three-zone layout renders with correct proportions
- Center viewport correctly contains the canvas with paper aspect ratio
- Leva panel renders correctly within the right sidebar, not floating
- Layout handles window resize gracefully
- App uses dark theme throughout

### 6.2 Sketch Selector (`src/components/SketchSelector.tsx`)

- [ ] Create a component that displays the list of available sketches from `useSketchLoader`
- [ ] Each sketch is a clickable list item showing the sketch name (derived from directory name, e.g., "concentric-circles")
- [ ] Clicking a sketch triggers `loadSketch(name)`, which:
  - Dynamically imports the new sketch module
  - **Calls the new sketch's `setup(ctx)` if defined** (one-time initialization)
  - Resets the `ControlPanel` with the new sketch's params
  - Runs the new sketch's `render()` and updates the viewer
- [ ] Highlight the currently active sketch in the list
- [ ] Show a loading indicator during sketch import

**Acceptance Criteria:**

- Sidebar lists all discovered sketches
- Clicking a sketch loads it and updates the controls and preview
- Active sketch is visually highlighted
- Adding a new sketch directory and refreshing shows it in the list

### 6.3 Create a Second Simple Sketch

- [ ] Create a second sketch (e.g., `sketches/2026-03-15-grid/index.ts`) that draws a simple grid of lines
- [ ] Params: `rows`, `cols`, `margin`, `paperSize`
- [ ] Purpose: verify sketch switching works with different param schemas

**Acceptance Criteria:**

- Two sketches appear in the selector
- Switching between them loads different params and renders different output
- No state bleed between sketches (switching back shows correct default params)

---

## Phase 7: SVG Export & Clipping

**Purpose:** Enable physically accurate SVG export and polyline clipping — the output pipeline that makes the tool production-useful for plotters.

**Rationale:** SVG export and clipping are grouped because they both operate on the polyline output and are typically used together (clip to margins, then export). Completing this phase means the tool can produce files ready to send to a plotter. This is the last major feature needed for a complete creative coding workflow.

### 7.1 SVG Serialization (`src/lib/svg.ts`)

- [ ] Implement `polylinesToSVG(lines, options)` where options include:
  - `width`, `height` — paper dimensions in cm
  - `units` — `'cm'` | `'in'` | `'mm'` (default `'cm'`)
  - `strokeWidth` — in paper units (default 0.03 cm ≈ fine pen)
  - `strokeColor` — CSS color string (default `'black'`)
- [ ] Generate SVG with:
  - `<svg>` element with `width` and `height` in specified units (e.g., `width="21.59cm"`)
  - `viewBox="0 0 {width} {height}"` matching paper dimensions in cm
  - `xmlns` attribute for valid SVG
  - Each polyline as a `<polyline points="x1,y1 x2,y2 ..." />` element
  - Global stroke attributes: `fill="none"`, `stroke`, `stroke-width`, `stroke-linecap="round"`, `stroke-linejoin="round"`
- [ ] Handle unit conversion: if output units are `'in'`, convert cm dimensions to inches for `width`/`height` attributes (viewBox stays in cm)
- [ ] Write unit tests:
  - Output is valid XML/SVG (starts with `<svg`, has xmlns)
  - `width` and `height` attributes contain correct values and units
  - `viewBox` matches paper dimensions
  - Correct number of `<polyline>` elements
  - A single line `[[0,0], [1,1]]` produces `points="0,0 1,1"`
  - Unit conversion: letter paper in inches = `width="8.5in"`

**Acceptance Criteria:**

- `polylinesToSVG` produces valid SVG with physically accurate dimensions
- SVG imports into Inkscape at the correct physical size without manual scaling
- All SVG tests pass

### 7.2 Polyline Clipping (`src/lib/clip.ts`)

- [ ] Install `lineclip` package and `@types/lineclip` (dev dependency for TypeScript types)
- [ ] Implement `clipPolylinesToBox(lines, [minX, minY, maxX, maxY])`:
  - Takes an array of polylines and a rectangular bounding box
  - Returns a new array of polylines clipped to the box
  - A single polyline may be split into multiple segments if it crosses the box boundary
- [ ] Write unit tests:
  - A line fully inside the box is returned unchanged
  - A line fully outside the box is removed
  - A line crossing the box boundary is clipped at the intersection point
  - A polyline that enters and exits the box is split into segments
  - Empty input returns empty output

**Acceptance Criteria:**

- Clipping correctly trims polylines to rectangular bounds
- No artifacts at clip boundaries (points lie exactly on the boundary edge)
- All clip tests pass

### 7.3 Export Panel (`src/components/ExportPanel.tsx`)

- [ ] Create `ExportPanel` component with controls for:
  - Stroke width (number input, default 0.03)
  - Stroke color (color input, default black)
  - Output units (select: cm, in, mm)
  - "Export SVG" button
  - "Copy SVG" button (copies SVG markup to clipboard via `navigator.clipboard.writeText`)
- [ ] On export:
  - Clip polylines to paper bounds (with margin) using `clip.ts`
  - Serialize to SVG using `svg.ts` with current export settings
  - Trigger browser download of the SVG file
  - Filename format: `{sketch-name}_{timestamp}.svg`
- [ ] On copy: same clip + serialize pipeline, then write to clipboard instead of downloading
- [ ] Optionally show path statistics: total polyline count, total point count
- [ ] Place the export panel in the right sidebar below Leva controls

**Acceptance Criteria:**

- Clicking "Export SVG" downloads an SVG file
- The downloaded SVG has correct physical dimensions and viewBox
- Changing stroke width/color/units affects the exported SVG
- Polylines extending beyond margins are clipped in the export
- Export works for both example sketches

---

## Phase 8: Preset Persistence

**Purpose:** Enable saving and loading parameter presets to the filesystem, committable with the sketch code.

**Rationale:** Presets depend on having working parameter controls (Phase 5) and a functioning sketch system (Phase 4). This phase is sequenced late because it requires a Vite plugin for filesystem access — the most "plumbing-heavy" piece of the build. The core creative workflow (edit → preview → export) works without presets; presets add convenience for iteration.

### 8.1 Vite Preset Plugin (`src/plugins/vite-plugin-presets.ts`)

- [ ] Create a Vite plugin that adds dev-server middleware for preset CRUD:
  - `GET /__api/presets/:sketch` — list preset files in `sketches/:sketch/presets/`, return JSON array of names
  - `GET /__api/presets/:sketch/:name` — read and return the preset JSON file
  - `POST /__api/presets/:sketch/:name` — write request body as JSON to `sketches/:sketch/presets/:name.json`
  - `DELETE /__api/presets/:sketch/:name` — delete the preset file
- [ ] Validate inputs: sanitize sketch/preset names to prevent path traversal
- [ ] Create the `presets/` directory automatically if it doesn't exist on write
- [ ] Register the plugin in `vite.config.ts`
- [ ] Write integration tests: start a test server, verify CRUD operations round-trip correctly (or test the middleware handler functions in isolation)

**Acceptance Criteria:**

- Plugin registers without errors in Vite dev server
- `GET /__api/presets/2026-03-15-concentric-circles` returns `[]` initially
- `POST` a preset, then `GET` it back — round-trip matches
- `DELETE` removes the file
- Path traversal attempts (e.g., `../../etc/passwd`) are rejected
- Preset files appear on disk at `sketches/:sketch/presets/:name.json`

### 8.2 Preset Hook (`src/hooks/usePresets.ts`)

- [ ] Create `usePresets(sketchName)` hook that provides:
  - `presets: string[]` — list of available preset names
  - `loadPreset(name): Promise<Record<string, any>>` — fetch preset params
  - `savePreset(name, params): Promise<void>` — save current params
  - `deletePreset(name): Promise<void>` — delete a preset
  - `refreshPresets(): Promise<void>` — re-fetch the list
- [ ] Use `fetch` to call the Vite plugin API endpoints
- [ ] Handle errors (network, 404, 500) gracefully

**Acceptance Criteria:**

- Hook correctly calls the Vite plugin API
- `savePreset` followed by `loadPreset` round-trips parameter values
- Preset list updates after save/delete

### 8.3 Preset UI in Sidebar

- [ ] Add preset management controls to the left sidebar (below the sketch selector):
  - Dropdown or list showing available presets for the active sketch
  - "Save" button — prompts for a name (or uses a text input), saves current params
  - "Load" button / clicking a preset name — loads the preset and updates Leva controls
  - "Delete" button — deletes the selected preset (with confirmation)
- [ ] When switching sketches, refresh the preset list for the new sketch
- [ ] Install any additional shadcn/ui components needed (e.g., `dialog`, `input`, `dropdown-menu`)

**Acceptance Criteria:**

- Saving a preset creates a JSON file on disk in the sketch's `presets/` directory
- Loading a preset updates all Leva controls and re-renders the preview
- Deleting a preset removes the file and updates the list
- Preset files are valid JSON containing the parameter key-value pairs
- Switching sketches shows the correct preset list

---

## Phase 9: CLI Scaffold & End-to-End Testing

**Purpose:** Add the developer convenience script for creating new sketches and verify the entire system with an automated end-to-end test.

**Rationale:** The scaffold script is sequenced last because it depends on the sketch template being finalized (which is informed by all prior phases). The E2E test is last because it exercises the complete pipeline and depends on every other phase being in place.

### 9.1 Sketch Template (`src/template/index.ts`)

- [ ] Create a template sketch module that serves as the starting point for new sketches
- [ ] Template should demonstrate:
  - A `params` schema with a seed, one or two numeric sliders, and a paper size select
  - A `render` function that uses `createRandom`, a geometry helper, and returns polylines
  - Imports from `@/lib/` (random, geometry, math)
- [ ] Keep it simple but more interesting than concentric circles — e.g., a grid of randomly rotated lines

**Acceptance Criteria:**

- Template is a valid `SketchModule` that renders something visible
- Template compiles without errors
- Template demonstrates the key framework features (seeded random, geometry helpers, params)

### 9.2 CLI Scaffold Script (`scripts/new-sketch.ts`)

- [ ] Create a Node.js script (runnable via `tsx` or `ts-node`) that:
  - Accepts a `--name` argument (e.g., `--name "flow field"`)
  - Generates a date-prefixed slug (e.g., `2026-03-15-flow-field`)
  - Creates `sketches/{slug}/index.ts` by copying the template
  - Creates `sketches/{slug}/presets/` directory
  - Prints the created path to stdout
- [ ] Add `"new-sketch"` script to `package.json`: `"new-sketch": "tsx scripts/new-sketch.ts"`
- [ ] Install `tsx` as a dev dependency if not already present
- [ ] Handle edge cases: name with special characters, sketch already exists

**Acceptance Criteria:**

- `pnpm new-sketch -- --name "test sketch"` creates `sketches/2026-03-15-test-sketch/index.ts`
- The created sketch is immediately discoverable by the app (appears in sketch selector on next load)
- Running the command twice with the same name fails gracefully (doesn't overwrite)
- The created sketch renders correctly in the viewer

### 9.3 Playwright E2E Smoke Test

- [ ] Install Playwright and configure for the project
- [ ] Create `tests/e2e/smoke.spec.ts` that:
  1. Starts the Vite dev server
  2. Navigates to the app
  3. Verifies the sketch selector lists at least one sketch
  4. Verifies the canvas element exists and has non-zero dimensions
  5. Changes a parameter (e.g., adjust the `count` slider)
  6. Clicks "Export SVG" and verifies a download is triggered
  7. Verifies the downloaded SVG contains `<polyline` elements and has correct `width`/`height` attributes
- [ ] Add `"test:e2e"` script to `package.json`

**Acceptance Criteria:**

- `pnpm test:e2e` runs the Playwright test and it passes
- The test exercises the full pipeline: load → interact → export
- Test completes in under 30 seconds

---

## Dependency Graph

```
Phase 1 (Bootstrap)
  1.1 → 1.2 → 1.3 → 1.4 → 1.5
                                \
Phase 2 (Types, Paper & Utilities)|
  2.1 → 2.2                     |
  2.1 → 2.3                     |
  2.1 → 2.4                     |
         |                       |
Phase 3 (Random & Geometry)      |
  3.1 (depends on 2.1, 2.3)     |
  3.2 (depends on 2.1, 2.3, 2.4)|
         |                       |
Phase 4 (Canvas & Sketches)      |
  4.1 → 4.2 → 4.5              |
  4.3 → 4.5                     |
  4.4 → 4.5                     |
         |                       |
Phase 5 (Parameter Controls)     |
  5.1 → 5.2 → 5.3               |
         |                       |
Phase 6 (App Shell)              |
  6.1 → 6.2 → 6.3               |
         |                       |
Phase 7 (SVG Export & Clipping)  |
  7.1 (depends on 2.1, 2.2)     |
  7.2 (no phase deps)           |
  7.3 (depends on 7.1, 7.2, 5) |
         |                       |
Phase 8 (Preset Persistence)     |
  8.1 → 8.2 → 8.3               |
         |                       |
Phase 9 (CLI & E2E)             |
  9.1 → 9.2                     |
  9.3 (depends on all phases)   /
```

Note: Phases 7.1 and 7.2 (SVG serialization and clipping) are pure library code with no UI dependencies. They could be implemented as early as Phase 2/3 alongside the other utility modules. They are sequenced in Phase 7 to keep the export pipeline cohesive, but a developer could pull them forward if desired.

---

## Key Design Decisions

| Decision                                                  | Rationale                                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 1 includes Vitest setup                             | Tests are needed immediately in Phase 2; avoids a "set up testing later" debt                                                        |
| Types are a separate phase (2) before random/geometry (3) | Every module depends on `types.ts`; establishing the type contract first prevents rework                                             |
| `math.ts` (scalar) and `vec.ts` (vector) are separate     | Avoids name collisions (`lerp` vs `vec.lerp`); keeps scalar math simple; `vec.*` namespace signals "operates on arrays"              |
| Vector functions are dimension-generic                     | 2D and 3D ops share one implementation via `number[]` iteration; avoids duplicating a `vec2` and `vec3` module                       |
| `Vec2` aliases `Point`                                     | No conversion needed between vector math results and polyline/geometry functions; everything is `[number, number]`                    |
| Canvas preview before Leva controls                       | Seeing something render is the highest-value early milestone; controls without a viewer aren't testable                              |
| Leva in its own phase (5), not bundled with viewer (4)    | Leva integration has its own complexity (transient updates, schema mapping); isolating it makes debugging easier                     |
| App shell (6) after controls (5)                          | Sketch switching must re-initialize Leva — testing this requires controls to be working first                                        |
| SVG + clipping grouped (7)                                | Both operate on polyline output and are tested together; clipping is most meaningful in the context of export                        |
| Presets late (8)                                          | Requires the most infrastructure (Vite plugin, API routes, filesystem writes); the core workflow works without them                  |
| CLI scaffold last-but-one (9)                             | Template design is informed by all prior phases; doing it last means the template reflects the final API                             |
| E2E test last (9)                                         | Exercises the full pipeline — meaningless until all phases are complete                                                              |
| shadcn/ui initialized in Phase 1, used in Phase 6         | Config files and utils are needed early; actual components are added as needed per phase                                             |
| Second sketch in Phase 6 (not Phase 4)                    | Phase 4 only needs one sketch to prove the pipeline; the second sketch exists to test sketch _switching_, which is a Phase 6 concern |
