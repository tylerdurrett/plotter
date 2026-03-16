import { useEffect, useState } from 'react'

/**
 * Finds the Leva control row element for a given param name.
 * Uses the input id + label[for] relationship that Leva sets,
 * then walks up from the input to find the lowest common ancestor
 * that contains both — which is the row element.
 */
function findLevaRow(paramName: string): HTMLElement | null {
  const input = document.getElementById(paramName)
  if (!input) return null

  const label = document.querySelector(`label[for="${CSS.escape(paramName)}"]`)
  if (!label) return null

  // Walk up from input to find the lowest ancestor that contains the label.
  // That ancestor is the row element wrapping both label and input.
  let el: HTMLElement | null = input.parentElement
  while (el) {
    if (el.contains(label)) return el
    el = el.parentElement
  }

  return null
}

/**
 * Detects hover on a Leva control row identified by param name.
 * Relies on Leva setting `id={path}` on inputs and `htmlFor={path}` on labels.
 * Returns true while the pointer is over the row, false otherwise.
 *
 * Pass a `reattachKey` that changes when the Leva DOM is recreated
 * (e.g. the active sketch name) so listeners re-attach to new elements.
 */
export function useLevaParamHover(
  paramName: string,
  reattachKey?: string | null,
): boolean {
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | null = null

    function attach(attempts = 0) {
      if (cancelled) return

      const row = findLevaRow(paramName)
      if (!row) {
        // Leva renders asynchronously — retry up to ~10 frames
        if (attempts < 10) {
          requestAnimationFrame(() => attach(attempts + 1))
        }
        return
      }

      const enter = () => setHovered(true)
      const leave = () => setHovered(false)
      row.addEventListener('pointerenter', enter)
      row.addEventListener('pointerleave', leave)

      cleanup = () => {
        row.removeEventListener('pointerenter', enter)
        row.removeEventListener('pointerleave', leave)
      }
    }

    requestAnimationFrame(() => attach())

    return () => {
      cancelled = true
      cleanup?.()
      setHovered(false)
    }
  }, [paramName, reattachKey])

  return hovered
}
