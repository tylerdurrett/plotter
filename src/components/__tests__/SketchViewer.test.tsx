import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SketchViewer } from '@/components/SketchViewer'
import type { PaperSize, Polyline } from '@/lib/types'

const letterSize: PaperSize = { width: 21.59, height: 27.94 }

describe('SketchViewer', () => {
  it('renders without crashing with empty lines', () => {
    render(<SketchViewer lines={[]} paperSize={letterSize} />)
    expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
  })

  it('canvas element exists in DOM and is an HTMLCanvasElement', () => {
    render(<SketchViewer lines={[]} paperSize={letterSize} />)
    const canvas = screen.getByTestId('sketch-canvas')
    expect(canvas.tagName).toBe('CANVAS')
  })

  it('renders without crashing with valid polylines', () => {
    const triangle: Polyline[] = [
      [
        [0, 0],
        [5, 0],
        [2.5, 4],
        [0, 0],
      ],
    ]
    render(<SketchViewer lines={triangle} paperSize={letterSize} />)
    expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
  })

  it('accepts optional margin prop', () => {
    render(<SketchViewer lines={[]} paperSize={letterSize} margin={1.5} />)
    expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
  })

  it('accepts optional className prop', () => {
    const { container } = render(
      <SketchViewer
        lines={[]}
        paperSize={letterSize}
        className="custom-class"
      />,
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
