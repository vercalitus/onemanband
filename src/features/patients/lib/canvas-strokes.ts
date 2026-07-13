/**
 * Shared vector-stroke model for the session handwriting canvas.
 *
 * Strokes are stored as plain point arrays (JSON) — tiny compared to a PNG
 * data-URL, and fully re-editable (undo works across reloads). A PNG is only
 * rasterized on demand when a session is completed, for an immutable timeline
 * snapshot.
 */

export interface StrokePoint {
  x: number
  y: number
  pressure: number
}

export type Stroke = StrokePoint[]

/** Internal canvas resolution — stroke coordinates live in this space. */
export const CANVAS_WIDTH = 1200
export const CANVAS_HEIGHT = 480

const GRID_GAP = 24

/** Barely-there dot grid used as the live-canvas background. */
export function drawDotGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.fillStyle = "rgba(100,116,139,0.04)"
  for (let y = GRID_GAP; y < height; y += GRID_GAP) {
    for (let x = GRID_GAP; x < width; x += GRID_GAP) {
      ctx.beginPath()
      ctx.arc(x, y, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/** Pressure-aware ink pass shared by the live canvas and the rasterizer. */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.save()
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  for (const stroke of strokes) {
    if (stroke.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(stroke[0].x, stroke[0].y)
    for (let i = 1; i < stroke.length; i++) {
      const pressure = stroke[i].pressure || 0.5
      ctx.lineWidth = 1.5 + pressure * 2.5
      ctx.strokeStyle = `rgba(15,23,42,${0.72 + pressure * 0.2})`
      ctx.lineTo(stroke[i].x, stroke[i].y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(stroke[i].x, stroke[i].y)
    }
  }
  ctx.restore()
}

/**
 * Flatten strokes to a clean white-background PNG data-URL for the immutable
 * timeline snapshot. Returns null when there is nothing drawn or when run
 * outside the browser.
 */
export function renderStrokesToDataUrl(
  strokes: Stroke[],
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
): string | null {
  if (typeof document === "undefined") return null
  if (!strokes.some((s) => s.length >= 2)) return null

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  drawStrokes(ctx, strokes)
  return canvas.toDataURL("image/png")
}
