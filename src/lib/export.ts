import { clipPolylinesToBox, type BBox } from '@/lib/clip'
import { polylinesToSVG } from '@/lib/svg'
import type { ExportOptions, PaperSize, Polyline } from '@/lib/types'

/**
 * Translate polylines from drawing-area coordinates (origin at margin box)
 * to full-page paper coordinates by offsetting every point by (margin, margin).
 */
export function translateToPage(lines: Polyline[], margin: number): Polyline[] {
  if (margin === 0) return lines
  return lines.map((line) => line.map(([x, y]) => [x + margin, y + margin]))
}

/** Export options without paper dimensions (supplied separately) */
export type SVGExportOptions = Omit<ExportOptions, 'width' | 'height'>

/**
 * Apply scale to polylines by multiplying all coordinates.
 */
export function scalePolylines(lines: Polyline[], scale: number): Polyline[] {
  if (scale === 1) return lines
  return lines.map((line) => line.map(([x, y]) => [x * scale, y * scale]))
}

/**
 * Full export pipeline: scale → translate to paper coords → clip to margin bounds → serialize SVG.
 */
export function buildSVGExport(
  lines: Polyline[],
  paperSize: PaperSize,
  margin: number,
  options: SVGExportOptions & { scale?: number },
): string {
  const { width, height } = paperSize
  const scale = options.scale ?? 1

  // Apply scale to polylines if needed
  const scaledLines = scale !== 1 ? scalePolylines(lines, scale) : lines

  // Scale the margin for translation
  const scaledMargin = margin * scale

  // Move polylines from drawing-area coords to paper coords
  const pageLines = translateToPage(scaledLines, scaledMargin)

  // Scale paper dimensions for clipping bounds
  const scaledWidth = width * scale
  const scaledHeight = height * scale

  // Clip to the margin box in scaled paper coordinates
  const clipBounds: BBox = [scaledMargin, scaledMargin, scaledWidth - scaledMargin, scaledHeight - scaledMargin]
  const clipped = clipPolylinesToBox(pageLines, clipBounds)

  return polylinesToSVG(clipped, {
    width: scaledWidth,
    height: scaledHeight,
    units: options.units,
    strokeWidth: options.strokeWidth,
    strokeColor: options.strokeColor,
  })
}

/**
 * Generate a timestamped export filename.
 * Format: {sketchName}_{YYYYMMDD_HHmmss}.svg
 */
export function makeExportFilename(sketchName: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `${sketchName}_${timestamp}.svg`
}

/** Trigger a browser file download from an SVG string */
export function downloadSVG(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Copy SVG string to clipboard. Returns true on success, false on failure. */
export async function copySVGToClipboard(svgString: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(svgString)
    return true
  } catch {
    return false
  }
}
