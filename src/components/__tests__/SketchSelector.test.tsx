import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { formatSketchName, SketchSelector } from '@/components/SketchSelector'

const sketches = [
  '2026-03-15-concentric-circles',
  '2026-03-15-grid',
  'simple-lines',
]

describe('formatSketchName', () => {
  it('strips date prefix and title-cases', () => {
    expect(formatSketchName('2026-03-15-concentric-circles')).toBe(
      'Concentric Circles',
    )
  })

  it('title-cases names without date prefix', () => {
    expect(formatSketchName('simple-lines')).toBe('Simple Lines')
  })

  it('handles single-word names', () => {
    expect(formatSketchName('spirals')).toBe('Spirals')
  })
})

describe('SketchSelector', () => {
  it('renders all sketch names', () => {
    render(
      <SketchSelector
        sketches={sketches}
        activeSketch={null}
        onSelect={() => {}}
        loading={false}
      />,
    )

    expect(screen.getByText('Concentric Circles')).toBeInTheDocument()
    expect(screen.getByText('Grid')).toBeInTheDocument()
    expect(screen.getByText('Simple Lines')).toBeInTheDocument()
  })

  it('highlights the active sketch', () => {
    render(
      <SketchSelector
        sketches={sketches}
        activeSketch="2026-03-15-concentric-circles"
        onSelect={() => {}}
        loading={false}
      />,
    )

    const activeButton = screen.getByRole('button', { current: true })
    expect(activeButton).toHaveTextContent('Concentric Circles')
  })

  it('calls onSelect when a sketch is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <SketchSelector
        sketches={sketches}
        activeSketch={null}
        onSelect={onSelect}
        loading={false}
      />,
    )

    await user.click(screen.getByText('Grid'))
    expect(onSelect).toHaveBeenCalledWith('2026-03-15-grid')
  })

  it('shows loading spinner on the active sketch when loading', () => {
    render(
      <SketchSelector
        sketches={sketches}
        activeSketch="2026-03-15-grid"
        onSelect={() => {}}
        loading={true}
      />,
    )

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('disables the active button while loading', () => {
    render(
      <SketchSelector
        sketches={sketches}
        activeSketch="2026-03-15-grid"
        onSelect={() => {}}
        loading={true}
      />,
    )

    const gridButton = screen.getByText('Grid').closest('button')
    expect(gridButton).toBeDisabled()
  })

  it('shows empty message when no sketches exist', () => {
    render(
      <SketchSelector
        sketches={[]}
        activeSketch={null}
        onSelect={() => {}}
        loading={false}
      />,
    )

    expect(screen.getByText('No sketches found')).toBeInTheDocument()
  })

  it('renders a list with buttons for each sketch', () => {
    render(
      <SketchSelector
        sketches={sketches}
        activeSketch={null}
        onSelect={() => {}}
        loading={false}
      />,
    )

    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })
})
