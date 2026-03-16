import { useEffect, useRef, useState } from 'react'

import type { PaperSize, Polyline } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SketchViewerProps {
  lines: Polyline[]
  paperSize: PaperSize
  /** Margin in cm — draws dashed guide lines when > 0 */
  margin?: number
  className?: string
}

/** Padding in CSS pixels between paper edge and container edge */
const CONTAINER_PADDING = 16

/** Canvas drawing colors — white paper with black ink, simulating pen plotter output */
const COLORS = {
  paper: '#ffffff',
  paperBorder: 'rgba(0, 0, 0, 0.1)',
  marginGuide: 'rgba(0, 0, 0, 0.15)',
  ink: '#000000',
} as const

function computeLayout(
  paper: PaperSize,
  containerW: number,
  containerH: number,
) {
  const availW = containerW - CONTAINER_PADDING * 2
  const availH = containerH - CONTAINER_PADDING * 2
  if (availW <= 0 || availH <= 0) return null

  const paperAspect = paper.width / paper.height
  const availAspect = availW / availH

  let displayW: number
  let displayH: number

  if (paperAspect > availAspect) {
    // Paper is wider relative to container — constrained by width
    displayW = availW
    displayH = availW / paperAspect
  } else {
    // Paper is taller relative to container — constrained by height
    displayH = availH
    displayW = availH * paperAspect
  }

  const scale = displayW / paper.width // cm → CSS pixels
  const offsetX = (containerW - displayW) / 2
  const offsetY = (containerH - displayH) / 2

  return { displayW, displayH, scale, offsetX, offsetY }
}

function SketchViewer({
  lines,
  paperSize,
  margin = 0,
  className,
}: SketchViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // Measure container via ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const w = Math.round(entry.contentRect.width)
      const h = Math.round(entry.contentRect.height)
      // Guard against same-size updates to avoid unnecessary re-renders
      setContainerSize((prev) => {
        if (prev.width === w && prev.height === h) return prev
        return { width: w, height: h }
      })
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Draw to canvas when inputs change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (containerSize.width === 0 || containerSize.height === 0) return
    if (paperSize.width <= 0 || paperSize.height <= 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const layout = computeLayout(
      paperSize,
      containerSize.width,
      containerSize.height,
    )
    if (!layout) return

    const { displayW, displayH, scale, offsetX, offsetY } = layout
    const dpr = window.devicePixelRatio || 1

    // Set canvas buffer size for HiDPI, CSS size for layout
    canvas.width = containerSize.width * dpr
    canvas.height = containerSize.height * dpr
    canvas.style.width = `${containerSize.width}px`
    canvas.style.height = `${containerSize.height}px`

    ctx.scale(dpr, dpr)
    ctx.save()
    ctx.translate(offsetX, offsetY)

    // Paper fill
    ctx.fillStyle = COLORS.paper
    ctx.fillRect(0, 0, displayW, displayH)

    // Paper border
    ctx.strokeStyle = COLORS.paperBorder
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, displayW, displayH)

    // Margin guides (dashed)
    if (margin > 0) {
      const mPx = margin * scale
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = COLORS.marginGuide
      ctx.lineWidth = 1
      ctx.strokeRect(mPx, mPx, displayW - mPx * 2, displayH - mPx * 2)
      ctx.setLineDash([])
    }

    // Draw polylines — translate by margin since sketches work in drawing-area coordinates
    ctx.strokeStyle = COLORS.ink
    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.translate(margin * scale, margin * scale)

    for (const polyline of lines) {
      if (polyline.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(polyline[0][0] * scale, polyline[0][1] * scale)
      for (let i = 1; i < polyline.length; i++) {
        ctx.lineTo(polyline[i][0] * scale, polyline[i][1] * scale)
      }
      ctx.stroke()
    }

    ctx.restore()
  }, [lines, paperSize, margin, containerSize])

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full bg-background', className)}
    >
      <canvas ref={canvasRef} className="block" data-testid="sketch-canvas" />
    </div>
  )
}

export { SketchViewer }
export type { SketchViewerProps }
