import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildSVGExport,
  copySVGToClipboard,
  downloadSVG,
  makeExportFilename,
  translateToPage,
} from '../export'
import type { Polyline } from '../types'

const letterCm = { width: 21.59, height: 27.94 }
const defaultOpts = {
  strokeWidth: 0.03,
  strokeColor: 'black',
  units: 'cm' as const,
}

describe('translateToPage', () => {
  it('offsets every point by (margin, margin)', () => {
    const lines: Polyline[] = [
      [
        [0, 0],
        [5, 5],
      ],
    ]
    const result = translateToPage(lines, 1.5)
    expect(result).toEqual([
      [
        [1.5, 1.5],
        [6.5, 6.5],
      ],
    ])
  })

  it('returns lines unchanged when margin is 0', () => {
    const lines: Polyline[] = [
      [
        [1, 2],
        [3, 4],
      ],
    ]
    const result = translateToPage(lines, 0)
    expect(result).toBe(lines) // same reference — no copy
  })

  it('handles multiple polylines', () => {
    const lines: Polyline[] = [
      [
        [0, 0],
        [1, 1],
      ],
      [
        [2, 2],
        [3, 3],
      ],
    ]
    const result = translateToPage(lines, 2)
    expect(result).toEqual([
      [
        [2, 2],
        [3, 3],
      ],
      [
        [4, 4],
        [5, 5],
      ],
    ])
  })

  it('handles empty input', () => {
    expect(translateToPage([], 5)).toEqual([])
  })
})

describe('buildSVGExport', () => {
  it('produces valid SVG with correct dimensions', () => {
    const lines: Polyline[] = [
      [
        [0, 0],
        [5, 5],
      ],
    ]
    const svg = buildSVGExport(lines, letterCm, 1.5, defaultOpts)
    expect(svg).toMatch(/^<svg /)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain(`width="21.59cm"`)
    expect(svg).toContain(`height="27.94cm"`)
  })

  it('clips lines that extend beyond the drawing area', () => {
    // A line from (0,0) to (100,100) in drawing-area coords with margin=1.5
    // After translate: (1.5,1.5) to (101.5,101.5)
    // Clip bounds: [1.5, 1.5, 20.09, 26.44]
    // Should be clipped to the paper bounds
    const lines: Polyline[] = [
      [
        [0, 0],
        [100, 100],
      ],
    ]
    const svg = buildSVGExport(lines, letterCm, 1.5, defaultOpts)
    // The clipped line should exist but not contain the original far endpoint
    expect(svg).toContain('<polyline')
    expect(svg).not.toContain('101.5')
  })

  it('preserves lines fully within the drawing area', () => {
    const lines: Polyline[] = [
      [
        [2, 2],
        [5, 5],
      ],
    ]
    const svg = buildSVGExport(lines, letterCm, 1.5, defaultOpts)
    // After translate by 1.5: points become (3.5,3.5) to (6.5,6.5)
    expect(svg).toContain('points="3.5,3.5 6.5,6.5"')
  })

  it('applies export options (units, stroke)', () => {
    const svg = buildSVGExport([], letterCm, 0, {
      strokeWidth: 0.05,
      strokeColor: 'red',
      units: 'in',
    })
    expect(svg).toContain('width="8.5in"')
    expect(svg).toContain('stroke="red"')
  })

  it('handles empty lines array', () => {
    const svg = buildSVGExport([], letterCm, 1.5, defaultOpts)
    expect(svg).toMatch(/^<svg /)
    expect(svg).not.toContain('<polyline')
  })

  it('handles zero margin (no translation needed)', () => {
    const lines: Polyline[] = [
      [
        [1, 1],
        [3, 3],
      ],
    ]
    const svg = buildSVGExport(lines, letterCm, 0, defaultOpts)
    expect(svg).toContain('points="1,1 3,3"')
  })
})

describe('makeExportFilename', () => {
  it('produces {sketchName}_{timestamp}.svg format', () => {
    const filename = makeExportFilename('concentric-circles')
    expect(filename).toMatch(/^concentric-circles_\d{8}_\d{6}\.svg$/)
  })

  it('uses current date and time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 14, 30, 5)) // 2026-03-15 14:30:05
    const filename = makeExportFilename('test')
    expect(filename).toBe('test_20260315_143005.svg')
    vi.useRealTimers()
  })
})

describe('downloadSVG', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a blob URL, clicks an anchor, then revokes', () => {
    const mockClick = vi.fn()
    const mockCreateElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({
        set href(val: string) {
          this._href = val
        },
        get href() {
          return this._href
        },
        _href: '',
        download: '',
        click: mockClick,
      } as unknown as HTMLAnchorElement)

    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const mockRevokeObjectURL = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    })

    downloadSVG('<svg></svg>', 'test.svg')

    expect(mockCreateElement).toHaveBeenCalledWith('a')
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(mockClick).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})

describe('copySVGToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true on success', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } })

    const result = await copySVGToClipboard('<svg></svg>')
    expect(result).toBe(true)
    expect(mockWriteText).toHaveBeenCalledWith('<svg></svg>')
  })

  it('returns false on failure', async () => {
    const mockWriteText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } })

    const result = await copySVGToClipboard('<svg></svg>')
    expect(result).toBe(false)
  })
})
