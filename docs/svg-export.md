# SVG Export & Clipping

This guide covers the output pipeline: serializing polylines to physically accurate SVG files, clipping polylines to paper margins, and using the Export Panel UI. It also includes practical tips for sending SVGs to pen plotters.

## SVG Serialization (`svg.ts`)

Import the serializer:

```ts
import { polylinesToSVG } from '@/lib/svg'
```

### `polylinesToSVG(lines, options)`

Converts an array of polylines to a valid SVG string with physically accurate dimensions.

```ts
const svg = polylinesToSVG(lines, {
  width: 21.59, // paper width in cm (required)
  height: 27.94, // paper height in cm (required)
  units: 'cm', // output units: 'cm' | 'in' | 'mm' (default: 'cm')
  strokeWidth: 0.03, // in cm (default: 0.03 ≈ fine pen)
  strokeColor: 'black', // CSS color string (default: 'black')
})
```

**Options:**

| Option        | Type                   | Required | Default   | Description                             |
| ------------- | ---------------------- | -------- | --------- | --------------------------------------- |
| `width`       | `number`               | Yes      | —         | Paper width in cm                       |
| `height`      | `number`               | Yes      | —         | Paper height in cm                      |
| `units`       | `'cm' \| 'in' \| 'mm'` | No       | `'cm'`    | Units for SVG `width`/`height` attrs    |
| `strokeWidth` | `number`               | No       | `0.03`    | Stroke width in cm (converted to units) |
| `strokeColor` | `string`               | No       | `'black'` | CSS color string                        |

### Output format

The generated SVG has this structure:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="21.59cm" height="27.94cm" viewBox="0 0 21.59 27.94">
<g fill="none" stroke="black" stroke-width="0.03" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="1,2 3,4 5,6" />
  <polyline points="7,8 9,10" />
</g>
</svg>
```

Key details:

- **`viewBox`** always uses cm — polyline coordinates map 1:1 to the viewBox regardless of the output `units` setting.
- **`width`/`height`** attributes are converted to the target units (e.g., `width="8.5in"` for letter paper in inches).
- **Stroke width** is also converted to the target units so it renders at the same physical size.
- **Stroke attributes** are grouped in a `<g>` element rather than repeated on each polyline.
- Polylines with fewer than 2 points are filtered out.
- Point coordinates are rounded to 4 decimal places for compact output.
- XML special characters (`&`, `"`, `<`) in color strings are escaped.

### Unit conversion

The SVG `width`, `height`, and `stroke-width` attributes are converted from cm to the target units:

| Target Unit | Conversion Factor |
| ----------- | ----------------- |
| `cm`        | 1                 |
| `in`        | 1 / 2.54          |
| `mm`        | 10                |

The `viewBox` always stays in cm. This means polyline coordinates are always in cm regardless of what output units you choose — only the physical dimension attributes change.

## Polyline Clipping (`clip.ts`)

Import the clipper:

```ts
import { clipPolylinesToBox, type BBox } from '@/lib/clip'
```

### `clipPolylinesToBox(lines, bounds)`

Clips an array of polylines to a rectangular bounding box using the Cohen-Sutherland algorithm (via the `lineclip` package).

```ts
const bounds: BBox = [minX, minY, maxX, maxY]
const clipped = clipPolylinesToBox(lines, bounds)
```

**Parameters:**

| Parameter | Type                       | Description               |
| --------- | -------------------------- | ------------------------- |
| `lines`   | `Polyline[]`               | Input polylines           |
| `bounds`  | `[minX, minY, maxX, maxY]` | Axis-aligned bounding box |

**Returns:** `Polyline[]` — a new array of polylines clipped to the box.

### How clipping works

Each input polyline can produce zero, one, or multiple output segments depending on how it intersects the bounding box:

- **Fully inside** — returned unchanged
- **Fully outside** — removed from the output
- **Crosses the boundary** — clipped at intersection points. A single polyline that enters and exits the box multiple times is split into separate segments.

### When to clip

Clipping is typically applied before SVG export to enforce margin boundaries. Sketches work in drawing-area coordinates where `(0, 0)` is the top-left of the margin box, but polylines may extend beyond `ctx.width` / `ctx.height`. Clipping ensures nothing renders outside the intended print area.

The export pipeline handles clipping automatically — you don't need to call `clipPolylinesToBox` manually unless you need custom clip regions within your sketch.

## Export Pipeline (`export.ts`)

The export module orchestrates the full pipeline from drawing-area polylines to downloadable SVG. Import individual functions:

```ts
import {
  translateToPage,
  buildSVGExport,
  makeExportFilename,
  downloadSVG,
  copySVGToClipboard,
} from '@/lib/export'
```

### Functions

| Function             | Signature                                      | Description                                            |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| `translateToPage`    | `(lines, margin) → Polyline[]`                 | Offset polylines by `(margin, margin)` to paper coords |
| `buildSVGExport`     | `(lines, paperSize, margin, options) → string` | Full pipeline: translate → clip → serialize            |
| `makeExportFilename` | `(sketchName) → string`                        | Generate timestamped filename                          |
| `downloadSVG`        | `(svgString, filename) → void`                 | Trigger browser file download                          |
| `copySVGToClipboard` | `(svgString) → Promise<boolean>`               | Copy SVG to clipboard, returns success                 |

### `buildSVGExport` — the main entry point

This is the function the Export Panel calls. It handles the complete pipeline:

1. **Translate** — offsets all polyline points by `(margin, margin)` to convert from drawing-area coordinates to full-page paper coordinates.
2. **Clip** — clips polylines to the margin bounding box `[margin, margin, width - margin, height - margin]` in paper coordinates.
3. **Serialize** — passes the clipped polylines to `polylinesToSVG` with the paper dimensions and export options.

```ts
import { buildSVGExport } from '@/lib/export'
import type { PaperSize } from '@/lib/types'

const paperSize: PaperSize = { width: 21.59, height: 27.94 }
const margin = 1.5

const svg = buildSVGExport(lines, paperSize, margin, {
  units: 'cm',
  strokeWidth: 0.03,
  strokeColor: 'black',
})
```

### Filename format

`makeExportFilename` generates filenames in the format `{sketchName}_{YYYYMMDD_HHmmss}.svg`:

```ts
makeExportFilename('concentric-circles')
// → "concentric-circles_20260315_143022.svg"
```

## Export Panel UI

The Export Panel appears in the right sidebar below the parameter controls. It provides three settings and two action buttons.

### Controls

| Control | Type         | Default   | Description                    |
| ------- | ------------ | --------- | ------------------------------ |
| Stroke  | Number input | `0.03`    | Stroke width in paper units    |
| Color   | Color picker | `#000000` | Stroke color for all polylines |
| Units   | Select       | `cm`      | Output units: cm, in, or mm    |

### Path statistics

A summary line shows `{N} paths · {M} pts` — the total number of polylines and points in the current render output.

### Export vs Copy

- **Export SVG** — runs the full pipeline (translate → clip → serialize) and triggers a browser file download. The filename is auto-generated with a timestamp.
- **Copy SVG** — same pipeline, but copies the SVG markup to the clipboard instead of downloading. Shows brief "Copied!" feedback for 1.5 seconds.

Both buttons use the same underlying pipeline, so the exported SVG is identical whether you download or copy.

## Plotter Workflow Tips

### Recommended stroke widths

The default stroke width of `0.03 cm` (0.3 mm) works well for most fine-tip pens. Here are recommendations for common pen sizes:

| Pen Type           | Tip Size | Recommended `strokeWidth` (cm) |
| ------------------ | -------- | ------------------------------ |
| Ultra-fine (0.1mm) | 0.1 mm   | `0.01`                         |
| Fine (0.3mm)       | 0.3 mm   | `0.03`                         |
| Medium (0.5mm)     | 0.5 mm   | `0.05`                         |
| Broad (0.7mm)      | 0.7 mm   | `0.07`                         |
| Marker (1.0mm+)    | 1.0+ mm  | `0.1`+                         |

The stroke width in the SVG controls how thick lines appear when viewing the file on screen, but the actual line width on paper is determined by your pen. Match the stroke width to your pen size so the on-screen preview approximates the physical result.

### Importing into plotter software

**Inkscape:**

- Open the exported SVG directly — dimensions will be correct because the SVG uses physical units (`cm`, `in`, or `mm`) in the `width`/`height` attributes.
- The `viewBox` is in cm, so coordinates scale correctly at any output unit.
- Use "Document Properties" to verify the page size matches your paper.

**AxiDraw / saxi:**

- Import the SVG and verify the bounding box matches your expected paper dimensions.
- If using `in` units, the SVG `width`/`height` will be in inches (e.g., `width="8.5in"` for letter paper).

**General tips:**

- Export in the same units your plotter software expects to avoid manual scaling.
- Verify the first export by checking physical dimensions in your plotter software before running a full plot.
- Use "Copy SVG" to quickly paste into browser-based plotter tools without saving a file.

### Paper size accuracy

All paper sizes in the system are defined in centimeters to match ISO and ANSI standards:

- **Letter:** 21.59 × 27.94 cm (8.5 × 11 in)
- **A4:** 21.0 × 29.7 cm
- **A3:** 29.7 × 42.0 cm

The SVG output preserves these exact dimensions. When you export with `units: 'in'`, the cm dimensions are converted using the factor `1 / 2.54`, which gives exact inch values for ANSI sizes and precise metric conversions for ISO sizes.

### Margin clipping

Polylines are automatically clipped to the margin boundary on export. This means you can freely draw beyond the margin in your sketch — lines will be cleanly trimmed at the margin edge in the exported SVG. A single polyline that crosses the margin boundary will be split into separate segments at the intersection points.

If your sketch intentionally stays within bounds, clipping is a no-op — the output is identical to the input.
