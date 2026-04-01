import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MapPreview } from '../MapPreview'
import type { MapBundleInfo } from '@/plugins/vite-plugin-maps'

describe('MapPreview', () => {
  const mockBundleInfo: MapBundleInfo = {
    name: 'test-bundle',
    manifest: {
      version: 1.0,
      source_image: 'test.jpg',
      width: 100,
      height: 100,
      created_at: '2024-01-01',
      maps: [],
    },
    previewUrl: '/maps/test-bundle/export/previews/density/density_target.png',
  }

  it('shows "No map selected" when no bundle is provided', () => {
    render(<MapPreview />)
    expect(screen.getByText('No map selected')).toBeInTheDocument()
    expect(screen.getByText('Map Preview')).toBeInTheDocument()
  })

  it('shows loading state when loading prop is true', () => {
    render(<MapPreview loading={true} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('displays the preview image when bundle info is provided', () => {
    render(<MapPreview bundleInfo={mockBundleInfo} />)

    const img = screen.getByRole('img', { name: /Preview of test-bundle map bundle/i })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', mockBundleInfo.previewUrl)
  })

  it('shows bundle name below the preview', () => {
    render(<MapPreview bundleInfo={mockBundleInfo} />)
    expect(screen.getByText('test-bundle')).toBeInTheDocument()
  })

  it('handles image load events', async () => {
    render(<MapPreview bundleInfo={mockBundleInfo} />)

    const img = screen.getByRole('img') as HTMLImageElement

    // Initially should show loading text
    expect(screen.getByText('Loading preview...')).toBeInTheDocument()

    // Simulate image load
    fireEvent.load(img)

    // Loading text should disappear
    await waitFor(() => {
      expect(screen.queryByText('Loading preview...')).not.toBeInTheDocument()
    })
  })

  it('handles image error events', async () => {
    render(<MapPreview bundleInfo={mockBundleInfo} />)

    const img = screen.getByRole('img') as HTMLImageElement

    // Simulate image error
    fireEvent.error(img)

    // Should show error message and hide the image
    await waitFor(() => {
      expect(screen.getByText('Failed to load preview')).toBeInTheDocument()
      expect(img).toHaveStyle({ display: 'none' })
    })
  })

  it('resets loading state when bundle changes', async () => {
    const { rerender } = render(<MapPreview bundleInfo={mockBundleInfo} />)

    const img = screen.getByRole('img') as HTMLImageElement
    fireEvent.load(img)

    // Change to a different bundle
    const newBundleInfo = {
      ...mockBundleInfo,
      name: 'new-bundle',
      previewUrl: '/maps/new-bundle/export/previews/density/density_target.png',
    }

    rerender(<MapPreview bundleInfo={newBundleInfo} />)

    // Should show loading state again for new image (reset happens via microtask)
    await waitFor(() => {
      expect(screen.getByText('Loading preview...')).toBeInTheDocument()
    })
  })

  it('applies correct styling classes', () => {
    render(<MapPreview bundleInfo={mockBundleInfo} />)

    const container = screen.getByText('Map Preview').parentElement
    expect(container).toHaveClass('p-3', 'border-t', 'border-border')

    const img = screen.getByRole('img')
    expect(img).toHaveClass('w-full', 'h-[150px]', 'object-contain')
  })
})