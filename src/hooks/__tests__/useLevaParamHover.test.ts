import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useLevaParamHover } from '@/hooks/useLevaParamHover'

/** Build a minimal Leva-like DOM: row > label + input */
function createLevaRow(paramName: string) {
  const row = document.createElement('div')
  const label = document.createElement('label')
  label.setAttribute('for', paramName)
  label.textContent = paramName
  const input = document.createElement('input')
  input.id = paramName
  row.appendChild(label)
  row.appendChild(input)
  document.body.appendChild(row)
  return { row, input, label }
}

describe('useLevaParamHover', () => {
  it('returns false when no matching element exists', () => {
    const { result } = renderHook(() => useLevaParamHover('nonexistent'))
    expect(result.current).toBe(false)
  })

  it('returns true on pointerenter and false on pointerleave', async () => {
    const { row } = createLevaRow('margin')

    // Let the rAF-based attach run
    const origRaf = window.requestAnimationFrame
    window.requestAnimationFrame = (cb) => {
      cb(0)
      return 0
    }

    const { result } = renderHook(() => useLevaParamHover('margin'))

    expect(result.current).toBe(false)

    act(() => {
      row.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
    })
    expect(result.current).toBe(true)

    act(() => {
      row.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))
    })
    expect(result.current).toBe(false)

    // Cleanup
    window.requestAnimationFrame = origRaf
    document.body.removeChild(row)
  })

  it('resets hovered state on unmount', () => {
    const { row } = createLevaRow('testparam')

    const origRaf = window.requestAnimationFrame
    window.requestAnimationFrame = (cb) => {
      cb(0)
      return 0
    }

    const { result, unmount } = renderHook(() => useLevaParamHover('testparam'))

    act(() => {
      row.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
    })
    expect(result.current).toBe(true)

    unmount()
    // After unmount, the hook should have cleaned up (no errors thrown)

    window.requestAnimationFrame = origRaf
    document.body.removeChild(row)
  })
})
