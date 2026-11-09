import { ANATOMY } from "./anatomy-data"
import type { BodyMapView } from "@/types/domain"

/**
 * The named places on the two figures, and how they are spoken of.
 *
 * The figures are Servier Medical Art's musculature, front and back (CC BY
 * 4.0 — the credit is shown under them, and the licence requires it). The
 * shapes over them are drawn by hand in `scripts/body-map-anatomy.py`,
 * following the muscles and bones in the pictures, and generated into
 * `anatomy-data.ts`.
 *
 * **An area is made of parts.** A part is what a chiropractor names: a
 * muscle (infraspinatus, piriformis, QL), a joint or landmark (AC joint,
 * lateral epicondyle, patella) or a spinal level beside the spine (C1–C7,
 * T1–T12, L1–L5, each side). An area with nothing finer is a single part.
 * Colouring an area colours all of its parts, so the colour follows the
 * anatomy rather than a rectangle.
 *
 * **Every area belongs to one figure.** The front of the shoulder and the
 * back of it are different areas, and so are the crease of the elbow and the
 * olecranon. A mark made from behind never colours the front.
 *
 * **Right and left are the patient's.** From the front the patient faces us,
 * so their right is on our left; from behind it is the other way round, and
 * the soles are seen as from behind.
 *
 * What a mark stores is the id, never a position: `buttock:r`,
 * `buttock:r/piriformis`, `betweenShoulderBlades/T4-l`.
 */

export const FIGURES: Record<BodyMapView, { src: string; width: number; height: number }> = {
  front: { src: "/body-map/front.webp", width: 516, height: 1356 },
  back: { src: "/body-map/back.webp", width: 516, height: 1329 },
  // Drawn here, not Servier: neither figure shows the underside of the foot.
  soles: { src: "/body-map/soles.svg", width: 516, height: 330 },
}

type Pt = [number, number]

export interface Part {
  /** `buttock:r/piriformis`, or the area's own id when it does not break down. */
  id: string
  areaId: string
  polygon: Pt[]
  points: string
}

export interface Area {
  /** `buttock:r`, `sacrum` */
  id: string
  key: string
  view: BodyMapView
  /** True when the area has named parts to open into. */
  breaksDown: boolean
  parts: Part[]
}

const parse = (points: string): Pt[] =>
  points.split(" ").map((pair) => pair.split(",").map(Number) as Pt)

export const AREAS: Record<BodyMapView, Area[]> = {
  front: build("front"),
  back: build("back"),
  soles: build("soles"),
}

function build(view: BodyMapView): Area[] {
  return ANATOMY[view].map((shape) => {
    const id = shape.side ? `${shape.key}:${shape.side}` : shape.key
    return {
      id,
      key: shape.key,
      view,
      breaksDown: shape.parts.some((p) => p.part !== null),
      parts: shape.parts.map((p) => ({
        id: p.part ? `${id}/${p.part}` : id,
        areaId: id,
        polygon: parse(p.points),
        points: p.points,
      })),
    }
  })
}

const AREA_BY_ID = new Map<string, Area>(
  [...AREAS.front, ...AREAS.back, ...AREAS.soles].map((a) => [a.id, a] as const),
)

export const areaById = (id: string) => AREA_BY_ID.get(id.split("/")[0]) ?? null

/** Ray casting. The shapes are small and few, so nothing cleverer is needed. */
function contains(polygon: Pt[], x: number, y: number) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** What is under a point given in the figure's pixels: the part, and its area. */
export function partAt(view: BodyMapView, x: number, y: number): Part | null {
  for (const area of AREAS[view]) {
    for (const part of area.parts) if (contains(part.polygon, x, y)) return part
  }
  return null
}

/* -------------------------------------------------------------------------- */
/* The spine                                                                   */
/* -------------------------------------------------------------------------- */

const SPINE_BANDS: { levels: string[]; y0: number; y1: number }[] = [
  { levels: ["C1", "C2", "C3", "C4", "C5", "C6", "C7"], y0: 160, y1: 232 },
  { levels: ["T1", "T2", "T3", "T4", "T5", "T6"], y0: 232, y1: 432 },
  { levels: ["T7", "T8", "T9", "T10", "T11", "T12"], y0: 432, y1: 540 },
  { levels: ["L1", "L2", "L3", "L4", "L5"], y0: 540, y1: 612 },
]

export const MIDLINE = 257.5

/** Where each level sits on the back figure's midline. Sacrum and coccyx below. */
export const LEVEL_Y: Record<string, [number, number]> = (() => {
  const out: Record<string, [number, number]> = {}
  for (const band of SPINE_BANDS) {
    const step = (band.y1 - band.y0) / band.levels.length
    band.levels.forEach((level, i) => {
      out[level] = [band.y0 + i * step, band.y0 + (i + 1) * step]
    })
  }
  out.Sacrum = [612, 735]
  out.Coccyx = [735, 778]
  return out
})()

const LEVELS = [...SPINE_BANDS.flatMap((b) => b.levels), "Sacrum"]

/**
 * Everything the spine model can name, top to bottom: each level, its right
 * and left side, the disc below it, then sacrum, the sacroiliac joints and
 * coccyx. Keeps a mark's spinal items in the order they sit on the body.
 */
export const SPINE_ORDER: string[] = [
  ...LEVELS.flatMap((level, i) => {
    if (level === "Sacrum") return ["Sacrum", "SI R", "SI L"]
    const next = LEVELS[i + 1] === "Sacrum" ? "S1" : LEVELS[i + 1]
    return [level, `${level} R`, `${level} L`, `${level}/${next}`]
  }),
  "Coccyx",
]

export const sortSpine = (items: string[]) =>
  [...items].sort((a, b) => SPINE_ORDER.indexOf(a) - SPINE_ORDER.indexOf(b))

/** The level an item belongs to, for placing it on the back figure: `L4 R` is `L4`. */
export const levelOf = (item: string) => {
  const head = item.split(/[ /]/)[0]
  return head === "SI" ? "Sacrum" : head
}

/* -------------------------------------------------------------------------- */
/* Names                                                                       */
/* -------------------------------------------------------------------------- */

type Translate = (key: string, params?: Record<string, string | number>) => string
export type Side = "r" | "l" | null

const LEVEL = /^[CTL]\d+$/

/** The patient's side something is on, or null for the midline. */
export function sideOf(id: string): Side {
  const [area, part] = id.split("/")
  const areaSide = area.split(":")[1]
  if (areaSide === "r" || areaSide === "l") return areaSide
  const suffix = part?.match(/-(r|l)$/)?.[1]
  return suffix === "r" || suffix === "l" ? suffix : null
}

/** Just the part, no side: "L4", "אינפרספינטוס". Empty for an area. */
export function partLabel(t: Translate, id: string) {
  const part = id.split("/")[1]
  if (!part) return ""
  const base = part.replace(/-(r|l)$/, "")
  return LEVEL.test(base) ? base : t(`bodyMap.part.${base}`)
}

/** The area, no side: "שכמה". */
export const areaName = (t: Translate, id: string) =>
  t(`bodyMap.region.${id.split("/")[0].split(":")[0]}`)

/** Without the side, for lists already grouped by side: "שכמה › אינפרספינטוס". */
export function itemName(t: Translate, id: string) {
  const part = partLabel(t, id)
  return part ? `${areaName(t, id)} › ${part}` : areaName(t, id)
}

/** With the side, for a name standing alone: "שכמה ימין › אינפרספינטוס". */
export function regionLabel(t: Translate, id: string) {
  const side = sideOf(id)
  const name = side
    ? t("bodyMap.sided", { name: areaName(t, id), side: t(`bodyMap.side.${side}`) })
    : areaName(t, id)
  const part = partLabel(t, id)
  return part ? `${name} › ${part}` : name
}

/** The spine model's items, with the side in the app's language: "L4 ימין", "L4/L5". */
export function spineLabel(t: Translate, item: string) {
  if (item === "Sacrum" || item === "Coccyx") return t(`bodyMap.region.${item.toLowerCase()}`)
  const [level, side] = item.split(" ")
  if (side === "R" || side === "L") return `${level} ${t(`bodyMap.side.${side.toLowerCase()}`)}`
  return item
}

/**
 * A mark's places, grouped the way a practitioner reads them: right, left,
 * midline. Each name once, the side said once per group.
 */
export function groupBySide(ids: string[]) {
  const groups: Record<"r" | "l" | "mid", string[]> = { r: [], l: [], mid: [] }
  for (const id of ids) groups[sideOf(id) ?? "mid"].push(id)
  return groups
}
