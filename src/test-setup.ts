import '@testing-library/jest-dom/vitest'

// jsdom does not provide ResizeObserver — stub it globally for all tests
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
