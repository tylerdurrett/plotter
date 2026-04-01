import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PreviewInfo } from '@/lib/map-api'
import { MapPipelineConfig } from '../MapPipelineConfig'

const FAKE_BASE_URL = 'http://localhost:8100/api/maps/test-session'
const FAKE_PREVIEWS: PreviewInfo[] = [
  { category: 'density', name: 'density_target', url: 'previews/density/density_target.png' },
  { category: 'features', name: 'combined_importance', url: 'previews/features/combined_importance.png' },
  { category: 'contour', name: 'contour_influence', url: 'previews/contour/contour_influence.png' },
  { category: 'flow', name: 'flow_lic', url: 'previews/flow/flow_lic.png' },
  { category: 'complexity', name: 'complexity', url: 'previews/complexity/complexity.png' },
  // Intentionally omit flow_speed to test graceful absence
]

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

  it('does not render thumbnails when no previewBaseUrl', () => {
    const { container } = render(
      <MapPipelineConfig
        config={{}}
        onConfigChange={vi.fn()}
      />,
    )

    expect(container.querySelectorAll('img')).toHaveLength(0)
  })

  it('renders thumbnails when previewBaseUrl and previews are provided', () => {
    const { container } = render(
      <MapPipelineConfig
        config={{}}
        onConfigChange={vi.fn()}
        previewBaseUrl={FAKE_BASE_URL}
        previews={FAKE_PREVIEWS}
      />,
    )

    const images = container.querySelectorAll('img')
    // 5 previews available (flow_speed is missing from FAKE_PREVIEWS)
    expect(images).toHaveLength(5)
    expect(images[0]).toHaveAttribute(
      'src',
      `${FAKE_BASE_URL}/previews/density/density_target.png`,
    )
  })

  it('omits thumbnail for missing preview gracefully', () => {
    const { container } = render(
      <MapPipelineConfig
        config={{}}
        onConfigChange={vi.fn()}
        previewBaseUrl={FAKE_BASE_URL}
        previews={FAKE_PREVIEWS}
      />,
    )

    // flow_speed is not in FAKE_PREVIEWS, so only 5 thumbnails
    const srcs = Array.from(container.querySelectorAll('img')).map(img => img.src)
    expect(srcs.every(s => !s.includes('flow_speed'))).toBe(true)
  })

  it('hides thumbnail on image load error', () => {
    const { container } = render(
      <MapPipelineConfig
        config={{}}
        onConfigChange={vi.fn()}
        previewBaseUrl={FAKE_BASE_URL}
        previews={FAKE_PREVIEWS}
      />,
    )

    const images = container.querySelectorAll('img')
    // Simulate error on the first image
    fireEvent.error(images[0])
    // Should have one fewer image now
    expect(container.querySelectorAll('img')).toHaveLength(4)
  })
})
