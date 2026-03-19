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

  it('renders without crashing with highlightMargin enabled', () => {
    render(
      <SketchViewer
        lines={[]}
        paperSize={letterSize}
        margin={1.5}
        highlightMargin
      />,
    )
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

  describe('overlay functionality', () => {
    it('accepts overlay-related props without crashing', () => {
      const mockImage = new Image()
      mockImage.width = 100
      mockImage.height = 100

      render(
        <SketchViewer
          lines={[]}
          paperSize={letterSize}
          overlayImage={mockImage}
          overlayVisible={true}
          overlayOpacity={0.5}
          overlayFitMode="cover"
        />,
      )
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    })

    it('renders without overlay when overlayVisible is false', () => {
      const mockImage = new Image()
      mockImage.width = 100
      mockImage.height = 100

      render(
        <SketchViewer
          lines={[]}
          paperSize={letterSize}
          overlayImage={mockImage}
          overlayVisible={false}
        />,
      )
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    })

    it('renders without overlay when overlayImage is null', () => {
      render(
        <SketchViewer
          lines={[]}
          paperSize={letterSize}
          overlayImage={null}
          overlayVisible={true}
        />,
      )
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    })

    it('respects different fit modes', () => {
      const mockImage = new Image()
      mockImage.width = 100
      mockImage.height = 100

      // Test with fit mode
      const { rerender } = render(
        <SketchViewer
          lines={[]}
          paperSize={letterSize}
          overlayImage={mockImage}
          overlayVisible={true}
          overlayFitMode="fit"
        />,
      )
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()

      // Test with cover mode
      rerender(
        <SketchViewer
          lines={[]}
          paperSize={letterSize}
          overlayImage={mockImage}
          overlayVisible={true}
          overlayFitMode="cover"
        />,
      )
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    })

    it('overlay does not interfere with line rendering', () => {
      const mockImage = new Image()
      mockImage.width = 100
      mockImage.height = 100

      const triangle: Polyline[] = [
        [
          [0, 0],
          [5, 0],
          [2.5, 4],
          [0, 0],
        ],
      ]

      render(
        <SketchViewer
          lines={triangle}
          paperSize={letterSize}
          overlayImage={mockImage}
          overlayVisible={true}
          overlayOpacity={0.3}
        />,
      )
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    })
  })

  describe('scale functionality', () => {
    it('accepts optional scale prop', () => {
      render(<SketchViewer lines={[]} paperSize={letterSize} scale={2} />)
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    })

    it('renders without crashing with different scale values', () => {
      const { rerender } = render(<SketchViewer lines={[]} paperSize={letterSize} scale={0.5} />)
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()

      rerender(<SketchViewer lines={[]} paperSize={letterSize} scale={1} />)
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()

      rerender(<SketchViewer lines={[]} paperSize={letterSize} scale={4} />)
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    })

    it('defaults to scale=1 when not provided', () => {
      render(<SketchViewer lines={[]} paperSize={letterSize} />)
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    })

    it('scale works with margins', () => {
      render(
        <SketchViewer
          lines={[]}
          paperSize={letterSize}
          margin={2}
          scale={2}
        />
      )
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    })

    it('scale works with polylines', () => {
      const triangle: Polyline[] = [
        [
          [0, 0],
          [5, 0],
          [2.5, 4],
          [0, 0],
        ],
      ]
      render(
        <SketchViewer
          lines={triangle}
          paperSize={letterSize}
          scale={1.5}
        />
      )
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    })

    it('scale works with overlay', () => {
      const mockImage = new Image()
      mockImage.width = 100
      mockImage.height = 100

      render(
        <SketchViewer
          lines={[]}
          paperSize={letterSize}
          overlayImage={mockImage}
          overlayVisible={true}
          scale={2}
        />
      )
      expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    })
  })
})
