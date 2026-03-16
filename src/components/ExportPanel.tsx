import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  buildSVGExport,
  copySVGToClipboard,
  downloadSVG,
  makeExportFilename,
} from '@/lib/export'
import type { LengthUnit, PaperSize, Polyline } from '@/lib/types'

interface ExportPanelProps {
  lines: Polyline[]
  paperSize: PaperSize
  margin: number
  sketchName: string
}

function ExportPanel({
  lines,
  paperSize,
  margin,
  sketchName,
}: ExportPanelProps) {
  const [strokeWidth, setStrokeWidth] = useState(0.03)
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [units, setUnits] = useState<LengthUnit>('cm')
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Clean up "Copied!" timeout on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const stats = useMemo(
    () => ({
      polylines: lines.length,
      points: lines.reduce((sum, line) => sum + line.length, 0),
    }),
    [lines],
  )

  const buildSVG = useCallback(
    () =>
      buildSVGExport(lines, paperSize, margin, {
        strokeWidth,
        strokeColor,
        units,
      }),
    [lines, paperSize, margin, strokeWidth, strokeColor, units],
  )

  const handleExport = useCallback(() => {
    const svg = buildSVG()
    const filename = makeExportFilename(sketchName)
    downloadSVG(svg, filename)
  }, [buildSVG, sketchName])

  const handleCopy = useCallback(async () => {
    const svg = buildSVG()
    const success = await copySVGToClipboard(svg)
    if (success) {
      setCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500)
    }
  }, [buildSVG])

  const inputClasses =
    'h-7 w-full rounded-md border border-border bg-secondary px-2 text-sm text-foreground'

  return (
    <div data-testid="export-panel" className="p-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Export
      </h2>

      <p className="mt-2 text-xs text-muted-foreground">
        {stats.polylines} paths &middot; {stats.points} pts
      </p>

      <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <label
          htmlFor="export-stroke-width"
          className="text-xs text-muted-foreground"
        >
          Stroke
        </label>
        <input
          id="export-stroke-width"
          type="number"
          step="0.01"
          min="0.001"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className={inputClasses}
        />

        <label
          htmlFor="export-stroke-color"
          className="text-xs text-muted-foreground"
        >
          Color
        </label>
        <input
          id="export-stroke-color"
          type="color"
          value={strokeColor}
          onChange={(e) => setStrokeColor(e.target.value)}
          className="h-7 w-full cursor-pointer rounded-md border border-border bg-secondary p-0.5"
        />

        <label htmlFor="export-units" className="text-xs text-muted-foreground">
          Units
        </label>
        <select
          id="export-units"
          value={units}
          onChange={(e) => setUnits(e.target.value as LengthUnit)}
          className={inputClasses}
        >
          <option value="cm">cm</option>
          <option value="in">in</option>
          <option value="mm">mm</option>
        </select>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={handleExport}
        >
          Export SVG
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy SVG'}
        </Button>
      </div>
    </div>
  )
}

export { ExportPanel }
export type { ExportPanelProps }
