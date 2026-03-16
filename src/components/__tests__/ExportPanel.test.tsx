import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ExportPanel } from '@/components/ExportPanel'
import type { Polyline } from '@/lib/types'

vi.mock('@/lib/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/export')>()
  return {
    ...actual,
    downloadSVG: vi.fn(),
    copySVGToClipboard: vi.fn().mockResolvedValue(true),
  }
})

import { copySVGToClipboard, downloadSVG } from '@/lib/export'

const sampleLines: Polyline[] = [
  [
    [0, 0],
    [5, 5],
  ],
  [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
]
const defaultProps = {
  lines: sampleLines,
  paperSize: { width: 21.59, height: 27.94 },
  margin: 1.5,
  sketchName: 'test-sketch',
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('ExportPanel', () => {
  it('renders without crashing', () => {
    render(<ExportPanel {...defaultProps} />)
    expect(screen.getByTestId('export-panel')).toBeInTheDocument()
  })

  it('displays path statistics', () => {
    render(<ExportPanel {...defaultProps} />)
    // 2 polylines, 5 total points
    expect(screen.getByText(/2 paths/)).toBeInTheDocument()
    expect(screen.getByText(/5 pts/)).toBeInTheDocument()
  })

  it('displays zero stats for empty lines', () => {
    render(<ExportPanel {...defaultProps} lines={[]} />)
    expect(screen.getByText(/0 paths/)).toBeInTheDocument()
    expect(screen.getByText(/0 pts/)).toBeInTheDocument()
  })

  it('renders stroke width input with default value', () => {
    render(<ExportPanel {...defaultProps} />)
    const input = screen.getByLabelText('Stroke') as HTMLInputElement
    expect(input.type).toBe('number')
    expect(input.value).toBe('0.03')
  })

  it('renders color input with default value', () => {
    render(<ExportPanel {...defaultProps} />)
    const input = screen.getByLabelText('Color') as HTMLInputElement
    expect(input.type).toBe('color')
    expect(input.value).toBe('#000000')
  })

  it('renders units select with default value', () => {
    render(<ExportPanel {...defaultProps} />)
    const select = screen.getByLabelText('Units') as HTMLSelectElement
    expect(select.value).toBe('cm')
  })

  it('renders Export SVG and Copy SVG buttons', () => {
    render(<ExportPanel {...defaultProps} />)
    expect(
      screen.getByRole('button', { name: 'Export SVG' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy SVG' })).toBeInTheDocument()
  })

  it('calls downloadSVG when Export SVG is clicked', async () => {
    const user = userEvent.setup()
    render(<ExportPanel {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Export SVG' }))
    expect(downloadSVG).toHaveBeenCalledOnce()
    expect(downloadSVG).toHaveBeenCalledWith(
      expect.stringContaining('<svg'),
      expect.stringMatching(/^test-sketch_\d{8}_\d{6}\.svg$/),
    )
  })

  it('calls copySVGToClipboard when Copy SVG is clicked', async () => {
    const user = userEvent.setup()
    render(<ExportPanel {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Copy SVG' }))
    expect(copySVGToClipboard).toHaveBeenCalledOnce()
    expect(copySVGToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('<svg'),
    )
  })

  it('shows "Copied!" feedback after successful copy', async () => {
    const user = userEvent.setup()
    render(<ExportPanel {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Copy SVG' }))
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })

  it('changes units when select is updated', async () => {
    const user = userEvent.setup()
    render(<ExportPanel {...defaultProps} />)
    const select = screen.getByLabelText('Units') as HTMLSelectElement
    await user.selectOptions(select, 'in')
    expect(select.value).toBe('in')
  })
})
