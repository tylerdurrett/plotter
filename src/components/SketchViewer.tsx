import { useEffect, useRef, useState } from 'react'

import { computeMapTransform } from '@/lib/maps'
import type { MapFitMode, PaperSize, Polyline } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SketchViewerProps {
  lines: Polyline[]
  paperSize: PaperSize
  /** Margin in cm — draws dashed guide lines when > 0 */
  margin?: number
  /** When true, draws margin guide on top of sketch lines in highlight color */
  highlightMargin?: boolean
  /** Optional overlay image to render behind the lines */
  overlayImage?: HTMLImageElement | null
  /** Whether the overlay is visible */
  overlayVisible?: boolean
  /** Opacity of the overlay (0-1) */
  overlayOpacity?: number
  /** Fit mode for the overlay image */
  overlayFitMode?: MapFitMode
  /** View scale factor (1.0 = 100%, 2.0 = 200%, etc.) */
  scale?: number
  className?: string
}

/** Padding in CSS pixels between paper edge and container edge */
const CONTAINER_PADDING = 16

/** Canvas drawing colors — white paper with black ink, simulating pen plotter output */
const COLORS = {
  paper: '#ffffff',
  paperBorder: 'rgba(0, 0, 0, 0.1)',
  marginGuide: 'rgba(0, 0, 0, 0.15)',
  marginGuideHighlight: '#ff1493',
  ink: '#000000',
} as const

function computeLayout(
  paper: PaperSize,
  containerW: number,
  containerH: number,
  viewScale: number = 1.0,
) {
  const availW = containerW - CONTAINER_PADDING * 2
  const availH = containerH - CONTAINER_PADDING * 2
  if (availW <= 0 || availH <= 0) return null

  const paperAspect = paper.width / paper.height
  const availAspect = availW / availH

  let baseDisplayW: number
  let baseDisplayH: number

  if (paperAspect > availAspect) {
    // Paper is wider relative to container — constrained by width
    baseDisplayW = availW
    baseDisplayH = availW / paperAspect
  } else {
    // Paper is taller relative to container — constrained by height
    baseDisplayH = availH
    baseDisplayW = availH * paperAspect
  }

  // Apply view scale to display dimensions
  const displayW = baseDisplayW * viewScale
  const displayH = baseDisplayH * viewScale

  const scale = displayW / paper.width // cm → CSS pixels (includes viewScale)
  const offsetX = (containerW - displayW) / 2
  const offsetY = (containerH - displayH) / 2

  return { displayW, displayH, scale, offsetX, offsetY }
}

function drawMarginGuide(
  ctx: CanvasRenderingContext2D,
  mPx: number,
  displayW: number,
  displayH: number,
  color: string,
) {
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.strokeRect(mPx, mPx, displayW - mPx * 2, displayH - mPx * 2)
  ctx.setLineDash([])
}

function SketchViewer({
  lines,
  paperSize,
  margin = 0,
  highlightMargin = false,
  overlayImage,
  overlayVisible = false,
  overlayOpacity = 0.3,
  overlayFitMode = 'cover',
  scale = 1.0,
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
      scale,
    )
    if (!layout) return

    const { displayW, displayH, scale: pixelScale, offsetX, offsetY } = layout
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

    const mPx = margin * pixelScale

    // Margin guides behind lines (default — faint gray)
    if (margin > 0 && !highlightMargin) {
      drawMarginGuide(ctx, mPx, displayW, displayH, COLORS.marginGuide)
    }

    // Draw overlay image if provided and visible
    if (overlayImage && overlayVisible) {
      ctx.save()
      ctx.translate(mPx, mPx)

      // Calculate drawing area dimensions (paper size minus margins)
      const drawWidth = paperSize.width - margin * 2
      const drawHeight = paperSize.height - margin * 2

      // Use the same transform calculation as MapBundle for perfect alignment
      const overlayTransform = computeMapTransform(
        overlayImage.width,
        overlayImage.height,
        drawWidth,
        drawHeight,
        overlayFitMode,
      )

      // Apply opacity
      ctx.globalAlpha = overlayOpacity

      // Draw the overlay image with the calculated transform
      ctx.drawImage(
        overlayImage,
        overlayTransform.offsetX * pixelScale,
        overlayTransform.offsetY * pixelScale,
        overlayImage.width * overlayTransform.scale * pixelScale,
        overlayImage.height * overlayTransform.scale * pixelScale,
      )

      // Reset opacity
      ctx.globalAlpha = 1
      ctx.restore()
    }

    // Draw polylines — translate by margin since sketches work in drawing-area coordinates
    ctx.save()
    ctx.translate(mPx, mPx)
    ctx.strokeStyle = COLORS.ink
    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const polyline of lines) {
      if (polyline.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(polyline[0][0] * pixelScale, polyline[0][1] * pixelScale)
      for (let i = 1; i < polyline.length; i++) {
        ctx.lineTo(polyline[i][0] * pixelScale, polyline[i][1] * pixelScale)
      }
      ctx.stroke()
    }
    ctx.restore()

    // Margin guides on top of lines (highlighted — bright pink)
    if (margin > 0 && highlightMargin) {
      drawMarginGuide(ctx, mPx, displayW, displayH, COLORS.marginGuideHighlight)
    }

    ctx.restore()
  }, [lines, paperSize, margin, highlightMargin, containerSize, overlayImage, overlayVisible, overlayOpacity, overlayFitMode, scale])

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden bg-background', className)}
    >
      <canvas ref={canvasRef} className="block" data-testid="sketch-canvas" />
    </div>
  )
}

export { SketchViewer }
export type { SketchViewerProps }
