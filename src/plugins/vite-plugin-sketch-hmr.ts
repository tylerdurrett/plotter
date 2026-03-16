import type { Plugin } from 'vite'

const SKETCH_RE = /sketches\/[^/]+\/index\.ts$/

/**
 * Vite plugin that injects HMR self-acceptance into sketch modules at
 * compile time. Sketch source files stay clean — the HMR boilerplate
 * is appended automatically during the transform phase (dev mode only).
 *
 * When a sketch file is edited, the injected code dispatches a
 * 'sketch-hmr-update' CustomEvent which useSketchLoader listens for
 * to hot-swap the active sketch without a full page reload.
 */
export function sketchHmrPlugin(): Plugin {
  return {
    name: 'sketch-hmr',
    apply: 'serve',
    transform(code, id) {
      if (!SKETCH_RE.test(id)) return null

      const hmr = `
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    if (newModule) {
      window.dispatchEvent(
        new CustomEvent('sketch-hmr-update', {
          detail: { path: import.meta.url, module: newModule },
        }),
      )
    }
  })
}
`
      return { code: code + hmr, map: null }
    },
  }
}
