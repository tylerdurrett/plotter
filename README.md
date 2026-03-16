# Plotter Sketch Studio

A browser-based creative coding environment for generating pen plotter artwork. Write parametric sketches in TypeScript, tweak them with live GUI controls, and export physically accurate SVGs ready for AxiDraw or any other pen plotter.

## Key Features

- **Real-time canvas preview** — see polylines render instantly as you code
- **Parametric controls** — Leva-powered sliders, toggles, and dropdowns with rAF-throttled updates
- **Seeded randomness** — deterministic PRNG + 2D/3D simplex noise for reproducible generative art
- **Geometry primitives** — circles, arcs, rectangles, polygons, ellipses, Bézier curves, spirals
- **Polyline clipping** — clip output to paper margins before export
- **SVG export with physical units** — correct dimensions in cm, in, or mm for plotter software
- **Preset persistence** — save/load parameter snapshots as JSON files alongside sketch code
- **CLI scaffold** — `pnpm new-sketch` generates a date-prefixed sketch from a template
- **Hot module replacement** — edit sketch code, see changes in ~1 second without losing parameter state

## Quick Start

**Prerequisites:** Node.js 18+ and [pnpm](https://pnpm.io/)

```bash
# Install dependencies
pnpm install

# Start the dev server
pnpm dev

# Create a new sketch
pnpm new-sketch -- --name "my sketch"
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The sketch selector in the left sidebar lists all sketches found in `sketches/`. Click one to load it, adjust parameters in the right panel, and export SVGs when ready.

## Project Structure

```
plotter/
├── src/
│   ├── components/       # React UI (SketchViewer, ControlPanel, ExportPanel, etc.)
│   ├── hooks/            # useSketchLoader, usePresets, useIsMobile
│   ├── lib/              # Pure utility libraries
│   │   ├── types.ts      # SketchModule, SketchContext, Vec2, Polyline, etc.
│   │   ├── math.ts       # lerp, clamp, mapRange, smoothstep, etc.
│   │   ├── vec.ts        # Vec2/Vec3 ops + 3D→2D projection
│   │   ├── random.ts     # Seeded PRNG + simplex noise
│   │   ├── geometry.ts   # Polyline primitives (circle, arc, rect, etc.)
│   │   ├── clip.ts       # Polyline clipping to rectangular bounds
│   │   ├── svg.ts        # Polylines → SVG serialization
│   │   ├── paper.ts      # Paper size constants (cm)
│   │   ├── context.ts    # SketchContext factory
│   │   └── export.ts     # Export pipeline utilities
│   ├── plugins/          # Vite plugins (preset API, sketch HMR)
│   └── template/         # Sketch template for CLI scaffolding
├── sketches/             # Sketch modules (each in a date-prefixed directory)
├── scripts/              # CLI tools (new-sketch.ts)
├── tests/e2e/            # Playwright end-to-end tests
├── docs/                 # Documentation
└── exports/              # SVG export output (gitignored)
```

## Documentation

- [Sketch Authoring Guide](docs/sketch-authoring.md) — how to create sketches: module contract, parameters, coordinate system, randomness, geometry helpers, and a worked example
- [Math & Vector Reference](docs/math-and-vectors.md) — scalar math utilities and vector operations with usage patterns and common recipes
- [HMR Behavior](docs/hmr.md) — how hot module replacement works for sketches, what persists across updates, and known caveats

## Scripts

| Script              | Description                             |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Start the Vite dev server               |
| `pnpm build`        | Type-check and build for production     |
| `pnpm preview`      | Preview the production build            |
| `pnpm test`         | Run unit tests (single run)             |
| `pnpm test:watch`   | Run unit tests in watch mode            |
| `pnpm test:e2e`     | Run Playwright end-to-end tests         |
| `pnpm new-sketch`   | Scaffold a new sketch from the template |
| `pnpm lint`         | Run ESLint                              |
| `pnpm format`       | Format code with Prettier               |
| `pnpm format:check` | Check code formatting                   |

## License

MIT
