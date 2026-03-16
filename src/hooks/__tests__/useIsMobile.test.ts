import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useIsMobile } from '@/hooks/useIsMobile'

describe('useIsMobile', () => {
  it('returns false for desktop viewport (default matchMedia stub)', () => {
    const { result } = renderHook(() => useIsMobile())
    // The test-setup matchMedia stub always returns matches: false
    expect(result.current).toBe(false)
  })

  it('returns true when innerWidth is below 768px', () => {
    const listeners: Array<() => void> = []
    const origMatchMedia = window.matchMedia
    const origInnerWidth = window.innerWidth

    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: '(max-width: 767px)',
      onchange: null,
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)

    // Restore
    window.matchMedia = origMatchMedia
    Object.defineProperty(window, 'innerWidth', {
      value: origInnerWidth,
      writable: true,
    })
  })
})
