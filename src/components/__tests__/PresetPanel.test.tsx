import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UsePresetsResult } from '@/hooks/usePresets'

const defaultHookResult: UsePresetsResult = {
  presets: [],
  loading: false,
  error: null,
  loadPreset: vi.fn().mockResolvedValue({ seed: 99, count: 10 }),
  savePreset: vi.fn().mockResolvedValue(undefined),
  deletePreset: vi.fn().mockResolvedValue(undefined),
  refreshPresets: vi.fn().mockResolvedValue(undefined),
}

let hookResult = { ...defaultHookResult }

vi.mock('@/hooks/usePresets', () => ({
  usePresets: () => hookResult,
}))

// Dynamic import so mock is registered before module loads
const { PresetPanel } = await import('@/components/PresetPanel')

const defaultProps = {
  sketchName: 'test-sketch',
  getParams: vi.fn().mockReturnValue({ seed: 42, count: 5 }),
  onLoad: vi.fn(),
}

beforeEach(() => {
  hookResult = {
    ...defaultHookResult,
    loadPreset: vi.fn().mockResolvedValue({ seed: 99, count: 10 }),
    savePreset: vi.fn().mockResolvedValue(undefined),
    deletePreset: vi.fn().mockResolvedValue(undefined),
    refreshPresets: vi.fn().mockResolvedValue(undefined),
  }
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PresetPanel', () => {
  it('renders with data-testid', () => {
    render(<PresetPanel {...defaultProps} />)
    expect(screen.getByTestId('preset-panel')).toBeInTheDocument()
  })

  it('shows empty state when no presets exist', () => {
    render(<PresetPanel {...defaultProps} />)
    expect(screen.getByText('No presets')).toBeInTheDocument()
  })

  it('renders preset list when presets exist', () => {
    hookResult = { ...hookResult, presets: ['warm', 'cool'] }
    render(<PresetPanel {...defaultProps} />)
    expect(screen.getByText('warm')).toBeInTheDocument()
    expect(screen.getByText('cool')).toBeInTheDocument()
    expect(screen.queryByText('No presets')).not.toBeInTheDocument()
  })

  it('shows loading state', () => {
    hookResult = { ...hookResult, loading: true }
    render(<PresetPanel {...defaultProps} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows error message', () => {
    hookResult = { ...hookResult, error: 'Network error' }
    render(<PresetPanel {...defaultProps} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Network error')
  })

  it('renders save input and button', () => {
    render(<PresetPanel {...defaultProps} />)
    expect(screen.getByLabelText('Preset name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('save button is disabled when input is empty', () => {
    render(<PresetPanel {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('save button is enabled when input has text', async () => {
    const user = userEvent.setup()
    render(<PresetPanel {...defaultProps} />)
    await user.type(screen.getByLabelText('Preset name'), 'my-preset')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('calls savePreset with lowercased name and current params on save', async () => {
    const user = userEvent.setup()
    render(<PresetPanel {...defaultProps} />)
    await user.type(screen.getByLabelText('Preset name'), 'My Preset')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(hookResult.savePreset).toHaveBeenCalledWith('my-preset', {
      seed: 42,
      count: 5,
    })
  })

  it('strips invalid characters from preset name before saving', async () => {
    const user = userEvent.setup()
    render(<PresetPanel {...defaultProps} />)
    await user.type(screen.getByLabelText('Preset name'), '!!My Cool Preset!!')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(hookResult.savePreset).toHaveBeenCalledWith('my-cool-preset', {
      seed: 42,
      count: 5,
    })
  })

  it('clears input after successful save', async () => {
    const user = userEvent.setup()
    render(<PresetPanel {...defaultProps} />)
    const input = screen.getByLabelText('Preset name') as HTMLInputElement
    await user.type(input, 'warm')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(input.value).toBe('')
  })

  it('saves on Enter key press', async () => {
    const user = userEvent.setup()
    render(<PresetPanel {...defaultProps} />)
    await user.type(screen.getByLabelText('Preset name'), 'warm{Enter}')
    expect(hookResult.savePreset).toHaveBeenCalledWith('warm', {
      seed: 42,
      count: 5,
    })
  })

  it('does not save when getParams returns null', async () => {
    const user = userEvent.setup()
    render(
      <PresetPanel
        {...defaultProps}
        getParams={vi.fn().mockReturnValue(null)}
      />,
    )
    await user.type(screen.getByLabelText('Preset name'), 'warm')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(hookResult.savePreset).not.toHaveBeenCalled()
  })

  it('calls loadPreset and onLoad when clicking a preset', async () => {
    const user = userEvent.setup()
    hookResult = { ...hookResult, presets: ['warm'] }
    const onLoad = vi.fn()
    render(<PresetPanel {...defaultProps} onLoad={onLoad} />)
    await user.click(screen.getByText('warm'))
    expect(hookResult.loadPreset).toHaveBeenCalledWith('warm')
    expect(onLoad).toHaveBeenCalledWith({ seed: 99, count: 10 })
  })

  it('calls deletePreset after window.confirm', async () => {
    const user = userEvent.setup()
    hookResult = { ...hookResult, presets: ['warm'] }
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<PresetPanel {...defaultProps} />)
    await user.click(screen.getByLabelText('Delete preset warm'))
    expect(window.confirm).toHaveBeenCalledWith('Delete preset "warm"?')
    expect(hookResult.deletePreset).toHaveBeenCalledWith('warm')
  })

  it('does not delete when confirm is cancelled', async () => {
    const user = userEvent.setup()
    hookResult = { ...hookResult, presets: ['warm'] }
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<PresetPanel {...defaultProps} />)
    await user.click(screen.getByLabelText('Delete preset warm'))
    expect(hookResult.deletePreset).not.toHaveBeenCalled()
  })

  it('handles null sketchName gracefully', () => {
    render(<PresetPanel {...defaultProps} sketchName={null} />)
    expect(screen.getByTestId('preset-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
