import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ScalePanel } from '@/components/ScalePanel'

describe('ScalePanel', () => {
  it('renders scale slider and label', () => {
    render(<ScalePanel scale={1} onScaleChange={() => {}} />)

    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.getByText('Scale')).toBeInTheDocument()
    // Check for the percentage display next to the Scale label (not the range indicators)
    const percentageElements = screen.getAllByText('100%')
    expect(percentageElements.length).toBeGreaterThan(0)
  })

  it('displays correct percentage for different scale values', () => {
    const { rerender } = render(<ScalePanel scale={0.5} onScaleChange={() => {}} />)
    expect(screen.getByText('50%')).toBeInTheDocument()

    rerender(<ScalePanel scale={2} onScaleChange={() => {}} />)
    expect(screen.getByText('200%')).toBeInTheDocument()

    rerender(<ScalePanel scale={4} onScaleChange={() => {}} />)
    // Check for the percentage display next to the Scale label (not the range indicators)
    const percentageElements = screen.getAllByText('400%')
    expect(percentageElements.length).toBeGreaterThan(0)
  })

  it('calls onScaleChange when slider value changes', () => {
    const onScaleChange = vi.fn()
    render(<ScalePanel scale={1} onScaleChange={onScaleChange} />)

    const slider = screen.getByRole('slider')

    // Simulate changing the slider value
    fireEvent.change(slider, { target: { value: '2' } })

    expect(onScaleChange).toHaveBeenCalledWith(2)
  })

  it('renders range indicators', () => {
    render(<ScalePanel scale={1} onScaleChange={() => {}} />)

    expect(screen.getByText('25%')).toBeInTheDocument()
    // Check for 400% and 100% (might appear multiple times)
    const fourHundredPercent = screen.getAllByText('400%')
    expect(fourHundredPercent.length).toBeGreaterThan(0)
    const oneHundredPercent = screen.getAllByText('100%')
    expect(oneHundredPercent.length).toBeGreaterThan(0)
  })

  it('slider has correct min and max attributes', () => {
    render(<ScalePanel scale={1} onScaleChange={() => {}} />)

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('min', '0.25')
    expect(slider).toHaveAttribute('max', '4')
    expect(slider).toHaveAttribute('step', '0.1')
  })

  it('slider value reflects the current scale', () => {
    const { rerender } = render(<ScalePanel scale={1.5} onScaleChange={() => {}} />)

    let slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('value', '1.5')

    rerender(<ScalePanel scale={3} onScaleChange={() => {}} />)
    slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('value', '3')
  })
})