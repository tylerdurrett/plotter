import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MapGeneratePanel } from '../MapGeneratePanel'
import type { UseMapApiResult } from '@/hooks/useMapApi'

function createMockMapApi(overrides: Partial<UseMapApiResult> = {}): UseMapApiResult {
  return {
    apiAvailable: true,
    checking: false,
    sessions: [],
    generating: false,
    error: null,
    generate: vi.fn(),
    refreshSessions: vi.fn(),
    deleteSession: vi.fn(),
    ...overrides,
  }
}

describe('MapGeneratePanel', () => {
  it('shows connected status when API is available', () => {
    render(
      <MapGeneratePanel
        mapApi={createMockMapApi()}
        onSelectBundle={vi.fn()}
      />,
    )

    expect(screen.getByText('Map API connected')).toBeDefined()
  })

  it('shows offline status when API is unavailable', () => {
    render(
      <MapGeneratePanel
        mapApi={createMockMapApi({ apiAvailable: false })}
        onSelectBundle={vi.fn()}
      />,
    )

    expect(screen.getByText('Map API offline')).toBeDefined()
  })

  it('shows checking status during health check', () => {
    render(
      <MapGeneratePanel
        mapApi={createMockMapApi({ checking: true })}
        onSelectBundle={vi.fn()}
      />,
    )

    expect(screen.getByText('Checking...')).toBeDefined()
  })

  it('hides upload UI when API is offline', () => {
    render(
      <MapGeneratePanel
        mapApi={createMockMapApi({ apiAvailable: false })}
        onSelectBundle={vi.fn()}
      />,
    )

    expect(screen.queryByText('Generate Maps')).toBeNull()
    expect(screen.queryByText('Drop image or click to select')).toBeNull()
  })

  it('shows upload UI when API is available', () => {
    render(
      <MapGeneratePanel
        mapApi={createMockMapApi()}
        onSelectBundle={vi.fn()}
      />,
    )

    expect(screen.getByText('Drop image or click to select')).toBeDefined()
    expect(screen.getByText('Generate Maps')).toBeDefined()
  })

  it('disables generate button when no file is selected', () => {
    render(
      <MapGeneratePanel
        mapApi={createMockMapApi()}
        onSelectBundle={vi.fn()}
      />,
    )

    const button = screen.getByText('Generate Maps')
    expect(button.closest('button')?.disabled).toBe(true)
  })

  it('shows "Generating..." when generation is in progress', () => {
    render(
      <MapGeneratePanel
        mapApi={createMockMapApi({ generating: true })}
        onSelectBundle={vi.fn()}
      />,
    )

    expect(screen.getByText('Generating...')).toBeDefined()
  })

  it('displays error message', () => {
    render(
      <MapGeneratePanel
        mapApi={createMockMapApi({ error: 'No face detected' })}
        onSelectBundle={vi.fn()}
      />,
    )

    expect(screen.getByText('No face detected')).toBeDefined()
  })

  it('renders session list', () => {
    const sessions = [
      {
        session_id: 'abc-123',
        source_image: 'portrait.jpg',
        created_at: '2026-03-20T14:30:00+00:00',
        map_keys: ['density_target'],
        persistent: false,
      },
      {
        session_id: 'def-456',
        source_image: 'another.png',
        created_at: '2026-03-20T15:00:00+00:00',
        map_keys: ['density_target'],
        persistent: false,
      },
    ]

    render(
      <MapGeneratePanel
        mapApi={createMockMapApi({ sessions })}
        onSelectBundle={vi.fn()}
      />,
    )

    expect(screen.getByText('Previous generations')).toBeDefined()
    expect(screen.getByText('portrait')).toBeDefined()
    expect(screen.getByText('another')).toBeDefined()
  })

  it('highlights selected session', () => {
    const sessions = [
      {
        session_id: 'abc-123',
        source_image: 'portrait.jpg',
        created_at: '2026-03-20T14:30:00+00:00',
        map_keys: ['density_target'],
        persistent: false,
      },
    ]

    const { container } = render(
      <MapGeneratePanel
        mapApi={createMockMapApi({ sessions })}
        onSelectBundle={vi.fn()}
        selectedBundle="api:abc-123"
      />,
    )

    // The selected session should have the primary highlight class
    const sessionEl = container.querySelector('.bg-primary\\/10')
    expect(sessionEl).not.toBeNull()
  })

  it('calls onSelectBundle when session is clicked', () => {
    const sessions = [
      {
        session_id: 'abc-123',
        source_image: 'portrait.jpg',
        created_at: '2026-03-20T14:30:00+00:00',
        map_keys: ['density_target'],
        persistent: false,
      },
    ]

    const onSelectBundle = vi.fn()

    render(
      <MapGeneratePanel
        mapApi={createMockMapApi({ sessions })}
        onSelectBundle={onSelectBundle}
      />,
    )

    fireEvent.click(screen.getByText('portrait'))
    expect(onSelectBundle).toHaveBeenCalledWith('api:abc-123')
  })

  it('calls generate and onSelectBundle on successful generation', async () => {
    const generateResponse = {
      session_id: 'new-123',
      manifest: {
        version: 1,
        source_image: 'test.jpg',
        width: 640,
        height: 480,
        created_at: '2026-03-20T15:00:00+00:00',
        maps: [],
      },
      base_url: '/api/maps/new-123',
    }

    const generate = vi.fn().mockResolvedValue(generateResponse)
    const onSelectBundle = vi.fn()

    render(
      <MapGeneratePanel
        mapApi={createMockMapApi({ generate })}
        onSelectBundle={onSelectBundle}
      />,
    )

    // Simulate file selection via the hidden input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['fake'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    // File name should appear
    expect(screen.getByText('test.jpg')).toBeDefined()

    // Click generate
    fireEvent.click(screen.getByText('Generate Maps'))

    await waitFor(() => {
      // Called with file and no config options (undefined)
      expect(generate).toHaveBeenCalledWith(file, undefined)
      expect(onSelectBundle).toHaveBeenCalledWith('api:new-123')
    })
  })

  it('calls deleteSession and resets to none when deleting selected session', async () => {
    const sessions = [
      {
        session_id: 'abc-123',
        source_image: 'portrait.jpg',
        created_at: '2026-03-20T14:30:00+00:00',
        map_keys: ['density_target'],
        persistent: false,
      },
    ]

    const deleteSession = vi.fn().mockResolvedValue(undefined)
    const onSelectBundle = vi.fn()

    render(
      <MapGeneratePanel
        mapApi={createMockMapApi({ sessions, deleteSession })}
        onSelectBundle={onSelectBundle}
        selectedBundle="api:abc-123"
      />,
    )

    // Click the delete button (Trash2 icon)
    const deleteButtons = document.querySelectorAll('button')
    // Find the small delete button (last button in the session row)
    const trashButton = Array.from(deleteButtons).find(
      (btn) => btn.querySelector('svg') && btn.textContent === '',
    )
    expect(trashButton).toBeDefined()
    fireEvent.click(trashButton!)

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('abc-123')
      expect(onSelectBundle).toHaveBeenCalledWith('none')
    })
  })
})
