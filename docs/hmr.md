# Sketch HMR (Hot Module Replacement)

Sketch files support Vite HMR — editing a sketch's source code updates the preview without a full page reload, and Leva slider values are preserved.

## How it works

A Vite plugin (`vite-plugin-sketch-hmr`) automatically injects `import.meta.hot.accept()` into sketch modules during the `transform` phase (dev mode only). Sketch source files stay clean — no HMR boilerplate needed.

The flow:

1. Sketch file is edited and saved
2. Vite recompiles the module, running the `transform` hook which appends HMR acceptance code
3. The injected code dispatches a `sketch-hmr-update` CustomEvent on `window`
4. `useSketchLoader` listens for this event and swaps in the new sketch module
5. `app.tsx` detects the reference change and re-renders with the user's current param values

## What persists across HMR

- Leva parameter values (slider positions, dropdown selections)
- Canvas/paper size state

## What does NOT persist

- State initialized in `setup()` — setup only runs once per sketch load, not on HMR. If a sketch uses `setup()` to precompute data, that data will be stale after HMR. Workaround: move stateful computation into `render()`, or manually refresh.

## Caveats

- **Param schema changes require a page refresh.** Adding, removing, or renaming params in the sketch's `params` object won't update the Leva panel because the ControlPanel component key (sketch name) hasn't changed, so the Leva store retains the old schema.
- **Only files matching `sketches/*/index.ts` get HMR.** The plugin uses this pattern to identify sketch modules. Helper files imported by sketches don't self-accept — changes to them will cause a full page reload unless the sketch itself is also edited.
