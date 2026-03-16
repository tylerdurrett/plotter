# Sketch Authoring Guide

This guide covers everything you need to create sketches for Plotter Sketch Studio. A sketch is a TypeScript module that defines parameters and a render function that produces polylines — arrays of 2D points that map directly to pen plotter paths.

## Sketch Module Contract

Every sketch must satisfy the `SketchModule` interface and use a default export:

```ts
import type { SketchModule, SketchContext, Polyline } from '@/lib/types'

const sketch: SketchModule = {
  params: { /* ... */ },
  // setup(ctx) { /* optional one-time init */ },
  render(ctx: SketchContext, params: Record<string, unknown>): Polyline[] {
    // Return an array of polylines
    return []
  },
}

export default sketch
```

### `params`

A `Record<string, unknown>` defining the sketch's tweakable parameters. The framework passes this directly to Leva, which auto-detects the input type. See [Parameters](#parameters) below.

### `setup(ctx)` (optional)

Called once after the sketch is loaded — not on every parameter change. Use it for expensive one-time initialization (e.g., precomputing lookup tables). State created here will **not** update on HMR; see [docs/hmr.md](hmr.md) for details.

### `render(ctx, params)`

Called on every parameter change. Must return `Polyline[]` — an array of polylines, where each polyline is an array of `[x, y]` points in centimeters.

Keep `render()` pure: given the same context and params, it should always return the same output. This makes sketches deterministic and reproducible via the seed parameter.

## Parameters

Parameters use Leva's schema format. The framework reads the param definitions and renders matching UI controls.

### Number slider

```ts
params: {
  count: { value: 5, min: 1, max: 20, step: 1 },
  radius: { value: 3.0, min: 0.5, max: 10, step: 0.1 },
}
```

Fields: `value` (default), `min`, `max`, `step`.

### Boolean toggle

```ts
params: {
  showGrid: true,
  // or with an object:
  filled: { value: false },
}
```

### Select dropdown

```ts
import { PAPER_SIZES } from '@/lib/paper'

params: {
  paperSize: {
    value: 'letter',
    options: Object.keys(PAPER_SIZES),
  },
  style: {
    value: 'solid',
    options: ['solid', 'dashed', 'dotted'],
  },
}
```

### Color picker

```ts
params: {
  color: '#ff0000',
}
```

### Accessing params in render

Parameters arrive as `Record<string, unknown>`, so cast them to the expected type:

```ts
render(ctx, params) {
  const count = params.count as number
  const showGrid = params.showGrid as boolean
  const style = params.style as string
  // ...
}
```

### Special params

- **`seed`** — Convention: include a `seed` number param so users can explore random variations. Pass it to `ctx.createRandom(seed)`.
- **`paperSize`** — Convention: include a `paperSize` select param. The framework reads this to build the `SketchContext` (paper dimensions, margins). It is not used directly inside `render()`.
- **`margin`** — Convention: include a `margin` number param. The framework reads this to set the drawable area and display margin guides on the canvas.

## SketchContext

The `ctx` object passed to `setup()` and `render()` provides:

| Property | Type | Description |
| --- | --- | --- |
| `ctx.width` | `number` | Effective drawing width in cm (paper width minus margins on both sides) |
| `ctx.height` | `number` | Effective drawing height in cm (paper height minus margins on both sides) |
| `ctx.createRandom(seed)` | `(seed: string \| number) => Random` | Factory for creating seeded random instances |
| `ctx.paper.name` | `string` | Paper preset name (e.g., `'letter'`) or `'custom'` |
| `ctx.paper.width` | `number` | Full paper width in cm (before margin subtraction) |
| `ctx.paper.height` | `number` | Full paper height in cm |
| `ctx.paper.margin` | `number` | Margin in cm per side |

## Coordinate System

- **Origin** `(0, 0)` is the **top-left corner of the drawing area** (inside margins).
- **Units** are centimeters.
- **X** increases to the right.
- **Y** increases downward.
- The drawable area spans from `(0, 0)` to `(ctx.width, ctx.height)`.

Polylines that extend beyond the drawing area will be clipped to the margin boundary on export.

## Using Randomness

Create a seeded random instance from the context:

```ts
const random = ctx.createRandom(params.seed as number)
```

Each instance is fully independent — no shared global state. Same seed always produces the same sequence.

### Random API

| Method | Return | Description |
| --- | --- | --- |
| `random.value()` | `number` | Uniform random in [0, 1) |
| `random.range(min, max)` | `number` | Uniform float in [min, max) |
| `random.rangeFloor(min, max)` | `number` | Random integer in [min, max) |
| `random.gaussian(mean?, std?)` | `number` | Normal distribution (defaults: mean=0, std=1) |
| `random.boolean()` | `boolean` | 50/50 coin flip |
| `random.pick(array)` | `T` | Random element from array |
| `random.shuffle(array)` | `T[]` | Fisher-Yates shuffle (returns new array, no mutation) |
| `random.onCircle(radius?)` | `Vec2` | Random point on circle perimeter (default radius=1) |
| `random.insideCircle(radius?)` | `Vec2` | Random point uniformly inside circle (default radius=1) |
| `random.noise2D(x, y)` | `number` | 2D simplex noise in [-1, 1] |
| `random.noise3D(x, y, z)` | `number` | 3D simplex noise in [-1, 1] |

Noise functions use separate internal seeds, so calling `noise2D` does not advance the main PRNG sequence (and vice versa).

## Geometry Helpers

Import individual functions from `@/lib/geometry`. All return `Polyline` (array of `[x, y]` points) with coordinates in cm.

| Function | Signature | Closed? | Default Segments |
| --- | --- | --- | --- |
| `line` | `(x1, y1, x2, y2)` | No | — (2 points) |
| `rect` | `(x, y, w, h)` | Yes | — (5 points) |
| `circle` | `(cx, cy, r, segments?)` | Yes | 64 |
| `arc` | `(cx, cy, r, startAngle, endAngle, segments?)` | No | 64 |
| `ellipse` | `(cx, cy, rx, ry, segments?)` | Yes | 64 |
| `polygon` | `(cx, cy, r, sides)` | Yes | — (sides + 1 points) |
| `quadratic` | `(p0, p1, p2, segments?)` | No | 32 |
| `cubic` | `(p0, p1, p2, p3, segments?)` | No | 64 |
| `spiral` | `(cx, cy, rStart, rEnd, turns, segments?)` | No | turns × 64 |

Notes:

- **Closed shapes** have their last point equal to their first point.
- **Angles** are in radians (use `degToRad` from `@/lib/math` to convert).
- **Bezier points** (`p0`, `p1`, etc.) are `Point` tuples: `[x, y]`.
- **`polygon`** places the first vertex at the top (angle = −π/2).
- **`circle`** delegates to `ellipse` internally.

## Worked Example

Here's a complete sketch that draws a grid of randomly rotated line segments:

```ts
import type { SketchModule, SketchContext, Polyline } from '@/lib/types'
import { line } from '@/lib/geometry'
import { PAPER_SIZES } from '@/lib/paper'

const sketch: SketchModule = {
  params: {
    seed: { value: 42, min: 0, max: 9999, step: 1 },
    rows: { value: 8, min: 2, max: 30, step: 1 },
    cols: { value: 6, min: 2, max: 30, step: 1 },
    lineLength: { value: 0.8, min: 0.1, max: 3, step: 0.1 },
    paperSize: {
      value: 'letter',
      options: Object.keys(PAPER_SIZES),
    },
  },

  render(ctx: SketchContext, params: Record<string, unknown>): Polyline[] {
    // Extract params with type casts
    const seed = params.seed as number
    const rows = params.rows as number
    const cols = params.cols as number
    const lineLength = params.lineLength as number

    // Create a seeded random instance
    const random = ctx.createRandom(seed)
    const lines: Polyline[] = []
    const half = lineLength / 2

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Center of each grid cell
        const cx = ((c + 0.5) / cols) * ctx.width
        const cy = ((r + 0.5) / rows) * ctx.height

        // Random rotation — onCircle gives a point on the unit circle,
        // scaled to half the line length for the offset
        const [dx, dy] = random.onCircle(half)

        lines.push(line(cx - dx, cy - dy, cx + dx, cy + dy))
      }
    }

    return lines
  },
}

export default sketch
```

**Walkthrough:**

1. **Params** define a seed for randomness, grid dimensions, line length, and paper size.
2. **`ctx.createRandom(seed)`** gives a deterministic PRNG — same seed, same output every time.
3. **Grid loop** calculates the center of each cell using fractional positioning across `ctx.width` and `ctx.height`.
4. **`random.onCircle(half)`** returns a random direction vector scaled to half the line length, creating a randomly rotated line centered on each grid cell.
5. **`line()`** from `@/lib/geometry` creates a 2-point polyline for each segment.
6. The function returns all polylines. The framework handles rendering, clipping, and export.

## Tips

- **Keep `render()` pure.** No side effects, no global state. Given the same context and params, always return the same output.
- **Use the seed parameter.** It makes your sketch reproducible. Users can explore variations with the "Randomize Seed" button.
- **Default segment counts produce smooth curves.** 64 segments is fine for most circles and Bezier curves. Only reduce segments for intentionally faceted shapes or performance-critical sketches with thousands of shapes.
- **Combine primitives.** Build complex shapes by pushing multiple polylines. A tree might be a `line` for the trunk plus several `arc` segments for branches.
- **Use `@/lib/math` for scalar operations.** `lerp`, `mapRange`, `clamp`, `smoothstep`, and other utilities are available for mapping values between ranges.
- **Use `@/lib/vec` for vector operations.** `vec.add`, `vec.scale`, `vec.normalize`, `vec.dist`, etc. are useful for point manipulation.
- **Scaffold new sketches with the CLI.** Run `pnpm new-sketch -- --name "my sketch"` to create a new sketch directory with the template pre-filled.
