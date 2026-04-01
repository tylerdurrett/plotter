import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MapPipelineConfig } from '../MapPipelineConfig'

describe('MapPipelineConfig', () => {
  it('renders all pipeline sections', () => {
    render(
      <MapPipelineConfig
        config={{}}
        onConfigChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Density')).toBeInTheDocument()
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('Contour')).toBeInTheDocument()
    expect(screen.getByText('Flow')).toBeInTheDocument()
    expect(screen.getByText('Complexity')).toBeInTheDocument()
    expect(screen.getByText('Flow Speed')).toBeInTheDocument()
  })

  it('has Density section open by default', () => {
    render(
      <MapPipelineConfig
        config={{}}
        onConfigChange={vi.fn()}
      />,
    )

    // Density section should show its controls (Gamma is inside Density)
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('other sections are collapsed by default', () => {
    render(
      <MapPipelineConfig
        config={{}}
        onConfigChange={vi.fn()}
      />,
    )

    // Features controls should not be visible
    expect(screen.queryByText('Eyes Weight')).not.toBeInTheDocument()
  })

  it('opens collapsed sections on click', async () => {
    render(
      <MapPipelineConfig
        config={{}}
        onConfigChange={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByText('Features'))
    expect(screen.getByText('Eyes Weight')).toBeInTheDocument()
  })

  it('calls onConfigChange when reset is clicked', async () => {
    const onConfigChange = vi.fn()
    render(
      <MapPipelineConfig
        config={{ density: { gamma: 2.0 } }}
        onConfigChange={onConfigChange}
      />,
    )

    await userEvent.click(screen.getByText('Reset to Defaults'))
    expect(onConfigChange).toHaveBeenCalledWith({})
  })

  it('renders with the pipeline-config testid', () => {
    render(
      <MapPipelineConfig
        config={{}}
        onConfigChange={vi.fn()}
      />,
    )

    expect(screen.getByTestId('map-pipeline-config')).toBeInTheDocument()
  })
})
