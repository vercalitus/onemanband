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

/**
 * Internal canvas resolution — stroke coordinates live in this space.
 *
 * The **displayed** canvas must keep this aspect ratio, and the writing surface
 * is sized from it rather than the other way round. It used to be a fixed pixel
 * height with a full-width canvas, so x and y were scaled by different amounts:
 * what was written looked right under the pen and was stretched by half again
 * horizontally in the saved image — which is also the image the transcription
 * reads.
 */
export const CANVAS_WIDTH = 1200
export const CANVAS_HEIGHT = 700

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

/**
 * A usable pressure for one sample.
 *
 * Not every digitiser reports one: a pen without a pressure sensor, and every
 * finger on Android, report exactly 0 while the contact is down. `p || 0.5`
 * looks like it handles that and does — but `p ?? 0.5` did not, and a stylus
 * that reported 0 drew a hairline that faded in and out mid-word. Anything
 * outside (0,1] is not a reading, it is a device with nothing to say.
 */
export function inkPressure(pressure: number | undefined): number {
  return pressure !== undefined && pressure > 0 && pressure <= 1 ? pressure : 0.5
}

const inkWidth = (pressure: number) => 1.5 + pressure * 2.5
const inkColor = (pressure: number) => `rgba(15,23,42,${0.72 + pressure * 0.2})`

const midpoint = (a: StrokePoint, b: StrokePoint): StrokePoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  pressure: (a.pressure + b.pressure) / 2,
})

/**
 * Draw the piece of a stroke that bends around point `i`.
 *
 * A pen samples faster than a hand moves, so joining the samples with straight
 * lines shows every one of them: handwriting came out faceted, and the faster
 * the pen the worse it looked. Each segment is a quadratic through the sample,
 * starting and ending at the midpoints of its neighbours — the standard way to
 * get a curve that passes smoothly through a sampled path.
 *
 * It is exported because the live canvas draws a stroke as it arrives and the
 * full redraw draws it again afterwards. Both go through here, so committing a
 * stroke cannot make the ink shift under the pen.
 */
export function drawStrokeSegment(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  i: number,
) {
  const curr = stroke[i]
  const from = i === 1 ? stroke[0] : midpoint(stroke[i - 1], curr)
  const to = i === stroke.length - 1 ? curr : midpoint(curr, stroke[i + 1])
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.quadraticCurveTo(curr.x, curr.y, to.x, to.y)
  ctx.lineWidth = inkWidth(curr.pressure)
  ctx.strokeStyle = inkColor(curr.pressure)
  ctx.stroke()
}

/** A stroke that never moved — a full stop, the dot of an i. */
export function drawStrokeDot(ctx: CanvasRenderingContext2D, point: StrokePoint) {
  ctx.beginPath()
  ctx.arc(point.x, point.y, inkWidth(point.pressure) / 2, 0, Math.PI * 2)
  ctx.fillStyle = inkColor(point.pressure)
  ctx.fill()
}

/** Pressure-aware ink pass shared by the live canvas and the rasterizer. */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.save()
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  for (const stroke of strokes) {
    if (stroke.length === 1) {
      drawStrokeDot(ctx, stroke[0])
      continue
    }
    for (let i = 1; i < stroke.length; i++) drawStrokeSegment(ctx, stroke, i)
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
  return renderStrokes(strokes, width, height)?.toDataURL("image/png") ?? null
}

/**
 * The same snapshot as a PNG file, for uploading to the patient's private
 * folder. A data-URL is fine to hold in a browser and wasteful to send: base64
 * costs a third more bytes, and storage wants a file either way.
 */
export function renderStrokesToBlob(
  strokes: Stroke[],
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
): Promise<Blob | null> {
  const canvas = renderStrokes(strokes, width, height)
  if (!canvas) return Promise.resolve(null)
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"))
}

function renderStrokes(
  strokes: Stroke[],
  width: number,
  height: number,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null
  if (!strokes.some((s) => s.length >= 1)) return null

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  drawStrokes(ctx, strokes)
  return canvas
}
