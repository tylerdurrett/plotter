// Skip browser-specific setup when running in node environment (e.g., plugin tests)
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')

  // jsdom does not provide matchMedia — stub it for useIsMobile and similar hooks
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }

  // jsdom does not provide ResizeObserver — stub it globally for all tests
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
}
