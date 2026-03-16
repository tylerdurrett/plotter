import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ControlPanel } from '@/components/ControlPanel'

const sampleParams = {
  seed: { value: 42, min: 0, max: 9999, step: 1 },
  count: { value: 5, min: 1, max: 20, step: 1 },
  maxRadius: { value: 8, min: 1, max: 15, step: 0.5 },
  paperSize: {
    value: 'letter',
    options: ['letter', 'a4', 'a3', 'a5', 'a2', 'tabloid'],
  },
}

describe('ControlPanel', () => {
  it('renders without crashing with valid params', () => {
    render(<ControlPanel params={sampleParams} onChange={() => {}} />)
    expect(screen.getByTestId('control-panel')).toBeInTheDocument()
  })

  it('renders without crashing with empty params', () => {
    render(<ControlPanel params={{}} onChange={() => {}} />)
    expect(screen.getByTestId('control-panel')).toBeInTheDocument()
  })

  it('renders without crashing with boolean param', () => {
    const params = { showGrid: { value: true } }
    render(<ControlPanel params={params} onChange={() => {}} />)
    expect(screen.getByTestId('control-panel')).toBeInTheDocument()
  })

  it('renders without crashing with raw primitive param', () => {
    const params = { opacity: 0.5 }
    render(<ControlPanel params={params} onChange={() => {}} />)
    expect(screen.getByTestId('control-panel')).toBeInTheDocument()
  })

  it('accepts onChange callback prop', () => {
    const onChange = vi.fn()
    render(<ControlPanel params={sampleParams} onChange={onChange} />)
    expect(screen.getByTestId('control-panel')).toBeInTheDocument()
  })
})
