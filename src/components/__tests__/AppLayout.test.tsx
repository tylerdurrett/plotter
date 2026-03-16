import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UseSketchLoaderResult } from '@/hooks/useSketchLoader'
import type { SketchModule } from '@/lib/types'

// Mock sketch module that satisfies the SketchModule contract
const mockSketch: SketchModule = {
  params: {
    seed: { value: 42, min: 0, max: 9999, step: 1 },
    count: { value: 5, min: 1, max: 20, step: 1 },
    paperSize: {
      value: 'letter',
      options: ['letter', 'a4'],
    },
  },
  render: () => [
    [
      [0, 0],
      [1, 1],
    ],
  ],
}

const defaultLoaderResult: UseSketchLoaderResult = {
  sketchList: ['test-sketch'],
  activeSketch: mockSketch,
  activeSketchName: 'test-sketch',
  loading: false,
  error: null,
  loadSketch: vi.fn(),
}

let loaderResult = { ...defaultLoaderResult }

vi.mock('@/hooks/useSketchLoader', () => ({
  useSketchLoader: () => loaderResult,
}))

beforeEach(() => {
  loaderResult = { ...defaultLoaderResult, loadSketch: vi.fn() }
})

// Dynamic import so the mock is registered before the module loads
const { default: App } = await import('@/app')

describe('AppLayout — three-zone layout', () => {
  it('renders left sidebar, center viewport, and right panel', () => {
    render(<App />)
    expect(screen.getByTestId('sidebar-left')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-right')).toBeInTheDocument()
    expect(document.querySelector('main')).toBeInTheDocument()
  })

  it('left sidebar contains "Sketches" heading', () => {
    render(<App />)
    const left = screen.getByTestId('sidebar-left')
    expect(within(left).getByText('Sketches')).toBeInTheDocument()
  })

  it('left sidebar contains "Presets" section', () => {
    render(<App />)
    const left = screen.getByTestId('sidebar-left')
    expect(within(left).getByText('Presets')).toBeInTheDocument()
  })

  it('left sidebar shows active sketch name', () => {
    render(<App />)
    const left = screen.getByTestId('sidebar-left')
    expect(within(left).getByText('test-sketch')).toBeInTheDocument()
  })

  it('right panel contains ControlPanel', () => {
    render(<App />)
    const right = screen.getByTestId('sidebar-right')
    expect(within(right).getByTestId('control-panel')).toBeInTheDocument()
  })

  it('right panel contains "Export" section', () => {
    render(<App />)
    const right = screen.getByTestId('sidebar-right')
    expect(within(right).getByText('Export')).toBeInTheDocument()
  })

  it('right panel contains "Randomize Seed" button', () => {
    render(<App />)
    expect(
      screen.getByRole('button', { name: /randomize seed/i }),
    ).toBeInTheDocument()
  })

  it('center viewport contains canvas', () => {
    render(<App />)
    expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
  })

  it('right panel is hidden when no sketch is loaded', () => {
    loaderResult = {
      ...defaultLoaderResult,
      activeSketch: null,
      activeSketchName: null,
      loadSketch: vi.fn(),
    }
    render(<App />)
    expect(screen.getByTestId('sidebar-left')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-right')).not.toBeInTheDocument()
  })

  it('left sidebar is always visible even without active sketch', () => {
    loaderResult = {
      ...defaultLoaderResult,
      activeSketch: null,
      activeSketchName: null,
      loadSketch: vi.fn(),
    }
    render(<App />)
    const left = screen.getByTestId('sidebar-left')
    expect(within(left).getByText('Sketches')).toBeInTheDocument()
  })
})
