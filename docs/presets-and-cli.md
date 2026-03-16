# Presets & CLI Reference

This guide covers the preset persistence system for saving and loading sketch parameter snapshots, the Vite plugin API that powers it, and the CLI tool for scaffolding new sketches.

## Presets

Presets let you save a snapshot of a sketch's parameter values as a JSON file. Presets live alongside the sketch code and can be committed to version control.

### Storage format

Presets are stored as JSON files in a `presets/` directory inside each sketch folder:

```
sketches/
  2026-03-15-concentric-circles/
    index.ts
    presets/
      default.json
      tight-spirals.json
      wide-spacing.json
```

Each preset file contains a flat JSON object mapping parameter names to values:

```json
{
  "seed": 42,
  "count": 12,
  "maxRadius": 6.5,
  "margin": 1.5,
  "paperSize": "a4"
}
```

Files are pretty-printed with 2-space indentation for readability in version control diffs.

### Using the Preset Panel

The Preset Panel appears in the left sidebar below the sketch selector.

**Saving a preset:**

1. Adjust parameters to the desired values using the Leva controls.
2. Type a name in the preset input field (e.g., "tight spirals").
3. Click **Save** or press **Enter**.

The name is automatically sanitized: lowercased, spaces replaced with hyphens, and non-alphanumeric characters (except hyphens and underscores) removed. For example, "My Cool Preset!" becomes `my-cool-preset`.

**Loading a preset:**

Click a preset name in the list. The Leva controls update to the saved values and the sketch re-renders immediately.

**Deleting a preset:**

Hover over a preset to reveal the trash icon, then click it. A confirmation dialog appears before deletion.

### Committing presets

Preset JSON files are regular files inside `sketches/` — they are tracked by Git. This means you can:

- Commit presets alongside your sketch code so good parameter combinations are preserved.
- Share presets with collaborators via the repository.
- Revert to previous presets using Git history.

The `presets/` directory is created automatically the first time you save a preset (or by the CLI scaffold script, which creates it with a `.gitkeep`).

## Vite Plugin API

The preset system is powered by a dev-only Vite plugin (`vite-plugin-presets`) that exposes REST endpoints on the dev server. The UI uses these endpoints via `fetch`, but you can also call them directly for scripting or debugging.

### Endpoints

All endpoints are under `/__api/presets/`.

| Method   | Path                           | Description               | Response                  |
| -------- | ------------------------------ | ------------------------- | ------------------------- |
| `GET`    | `/__api/presets/:sketch`       | List presets for a sketch | `200` JSON array of names |
| `GET`    | `/__api/presets/:sketch/:name` | Read a preset             | `200` JSON object         |
| `POST`   | `/__api/presets/:sketch/:name` | Save/update a preset      | `204` No Content          |
| `DELETE` | `/__api/presets/:sketch/:name` | Delete a preset           | `204` No Content          |

### Examples

```bash
# List presets
curl http://localhost:5173/__api/presets/2026-03-15-concentric-circles
# → ["default", "tight-spirals"]

# Read a preset
curl http://localhost:5173/__api/presets/2026-03-15-concentric-circles/default
# → {"seed": 42, "count": 5, ...}

# Save a preset
curl -X POST http://localhost:5173/__api/presets/2026-03-15-concentric-circles/my-preset \
  -H "Content-Type: application/json" \
  -d '{"seed": 99, "count": 10}'

# Delete a preset
curl -X DELETE http://localhost:5173/__api/presets/2026-03-15-concentric-circles/my-preset
```

### Name validation

Both sketch names and preset names must match the pattern `/^[a-z0-9][a-z0-9_-]*$/` with a maximum length of 100 characters. This prevents path traversal attacks and ensures safe filesystem paths. Invalid names return a `400` error.

### Error responses

Errors are returned as JSON with an `error` field:

```json
{ "error": "Preset \"missing\" not found" }
```

| Status | Condition                  |
| ------ | -------------------------- |
| `400`  | Invalid sketch/preset name |
| `400`  | Invalid JSON body on POST  |
| `404`  | Preset file not found      |
| `405`  | Unsupported HTTP method    |
| `413`  | Request body exceeds 1 MB  |
| `500`  | Unexpected server error    |

### Production note

The preset plugin is dev-only (`apply: 'serve'`). It is not included in production builds. Presets are a development-time workflow tool — the JSON files are static once committed.

## CLI Sketch Scaffold

The `new-sketch` script generates a new sketch directory from the built-in template.

### Usage

```bash
pnpm new-sketch -- --name "my sketch"
```

This creates:

```
sketches/2026-03-16-my-sketch/
  index.ts        # Copied from src/template/index.ts
  presets/
    .gitkeep
```

The directory name is a date-prefixed slug: today's date (`YYYY-MM-DD`) followed by the slugified name. The date prefix keeps sketches sorted chronologically in the sidebar.

### Naming rules

The `--name` argument is converted to a URL-safe slug:

- Lowercased
- Non-alphanumeric characters replaced with hyphens
- Leading/trailing hyphens removed

| Input             | Slug           | Directory                 |
| ----------------- | -------------- | ------------------------- |
| `"flow field"`    | `flow-field`   | `2026-03-16-flow-field`   |
| `"My Cool Idea!"` | `my-cool-idea` | `2026-03-16-my-cool-idea` |
| `"test_v2"`       | `test-v2`      | `2026-03-16-test-v2`      |

### Error cases

- **Missing `--name` flag** — prints usage and exits with code 1.
- **Name with no alphanumeric characters** (e.g., `"!!!"`) — prints error and exits.
- **Directory already exists** — prints error and exits (does not overwrite).

### Template contents

The generated `index.ts` is a complete, working sketch that draws a grid of randomly rotated lines. It demonstrates the key framework features:

- `params` object with number sliders (`seed`, `rows`, `cols`, `lineLength`) and a paper size select dropdown
- Seeded randomness via `ctx.createRandom(seed)`
- Geometry helpers (`line()` from `@/lib/geometry`)
- Proper type annotations (`SketchModule`, `SketchContext`, `Polyline`)

The sketch is immediately usable — it appears in the sidebar on the next page load and renders without modification.

## Development Workflow

A typical session with the Plotter Sketch Studio looks like this:

### 1. Create a new sketch

```bash
pnpm new-sketch -- --name "wave pattern"
```

### 2. Edit and preview

Open `sketches/2026-03-16-wave-pattern/index.ts` in your editor and modify the `render()` function. Thanks to [HMR](hmr.md), changes appear in the browser within ~1 second without losing your current parameter values.

### 3. Explore with parameters

Use the Leva sliders in the right panel to tweak values in real time. The **Randomize Seed** button is useful for quickly exploring variations.

### 4. Save good parameter combinations

When you find a combination you like, save it as a preset in the left sidebar. Give it a descriptive name — you can always load it later to return to that exact state.

Presets are especially useful for:

- Bookmarking interesting seeds before continuing to explore.
- Saving a "final" version while you keep experimenting.
- Storing different configurations for different paper sizes.

### 5. Export for plotting

When ready to plot, use the Export Panel in the right sidebar:

1. Set stroke width to match your pen size.
2. Choose output units matching your plotter software.
3. Click **Export SVG** to download, or **Copy SVG** to paste into browser-based tools.

See [SVG Export & Clipping](svg-export.md) for detailed export options and plotter tips.

### 6. Commit your work

Commit the sketch code and presets together:

```bash
git add sketches/2026-03-16-wave-pattern/
git commit -m "Add wave pattern sketch with presets"
```

This preserves both the code and your parameter snapshots in version control.
