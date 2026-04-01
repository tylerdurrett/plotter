import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MapOverlayPanel } from './MapOverlayPanel'
import type { MapBundleInfo } from '@/plugins/vite-plugin-maps'

describe('MapOverlayPanel', () => {
  const mockBundleInfo: MapBundleInfo = {
    name: 'test-bundle',
    manifest: {
      version: 1,
      source_image: 'test.jpg',
      width: 100,
      height: 100,
      created_at: '2024-01-01',
      maps: [],
    },
    previewUrl: '/maps/test-bundle/preview.png',
    availablePreviews: [
      { category: 'density', name: 'density_target', path: 'density/density_target' },
    ],
  }

  const defaultProps = {
    visible: false,
    onVisibilityChange: vi.fn(),
    mapKey: 'density_target',
    onMapKeyChange: vi.fn(),
    opacity: 0.3,
    onOpacityChange: vi.fn(),
    bundleInfo: mockBundleInfo,
  }

  it('renders nothing when bundleInfo is undefined', () => {
    const { container } = render(
      <MapOverlayPanel {...defaultProps} bundleInfo={undefined} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders overlay controls when bundleInfo is provided', () => {
    render(<MapOverlayPanel {...defaultProps} />)

    expect(screen.getByText('Map Overlay')).toBeInTheDocument()
    expect(screen.getByLabelText('Show overlay')).toBeInTheDocument()
    expect(screen.getByText('Preview Map')).toBeInTheDocument()
    expect(screen.getByText('Opacity')).toBeInTheDocument()
  })

  it('toggles visibility when checkbox is clicked', async () => {
    const onVisibilityChange = vi.fn()
    render(
      <MapOverlayPanel {...defaultProps} onVisibilityChange={onVisibilityChange} />
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Show overlay' })
    await userEvent.click(checkbox)

    expect(onVisibilityChange).toHaveBeenCalledWith(true)
  })

  it('displays correct opacity percentage', () => {
    render(<MapOverlayPanel {...defaultProps} opacity={0.5} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('disables controls when overlay is not visible', () => {
    render(<MapOverlayPanel {...defaultProps} visible={false} />)

    const mapSelector = screen.getByRole('combobox')
    expect(mapSelector).toHaveAttribute('aria-disabled', 'true')

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-disabled', 'true')
  })

  it('enables controls when overlay is visible', () => {
    render(<MapOverlayPanel {...defaultProps} visible={true} />)

    const mapSelector = screen.getByRole('combobox')
    expect(mapSelector).toHaveAttribute('aria-disabled', 'false')

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-disabled', 'false')
  })
})