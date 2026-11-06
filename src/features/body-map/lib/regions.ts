import type { BodyMapView } from "@/types/domain"

/**
 * Where each named area of the body sits on the two figures.
 *
 * The figures are Servier Medical Art's musculature, front and back (CC BY
 * 4.0 — the credit is shown under them, and the licence requires it). They
 * are pictures, so the areas are drawn over them by hand, in the picture's
 * own pixels.
 *
 * **The polygons only partition the body; they do not trace it.** The fill
 * is clipped to the figure's silhouette when it is drawn, so a rectangle
 * across a forearm colours the forearm and nothing beside it. That keeps
 * these shapes simple enough to read and correct by eye — which is the point,
 * since Martin may well want an area split or moved.
 *
 * **Right and left are the patient's.** From the front the patient faces us,
 * so their right is on our left; from behind it is the other way round. Every
 * bilateral area is stored as `key:r` / `key:l`, so a mark reads "buttock,
 * right" whichever figure it was made on, and an area seen from both sides —
 * a shoulder, an elbow — lights up on both.
 *
 * The record is the area's id, never a position in a picture: a mark made
 * here still says what it means if the figures are ever redrawn.
 */

export const FIGURES: Record<BodyMapView, { src: string; width: number; height: number }> = {
  front: { src: "/body-map/front.webp", width: 516, height: 1356 },
  back: { src: "/body-map/back.webp", width: 516, height: 1329 },
}

export type RegionSide = "r" | "l"

export interface RegionShape {
  key: string
  side: RegionSide | null
  /** SVG `points`, in the figure's pixels. */
  points: string
}

const SHAPES: Record<BodyMapView, RegionShape[]> = {
  front: [
    { key: "forehead", side: null, points: "195,15 320,15 320,98 195,98" },
    { key: "temple", side: "r", points: "180,60 215,60 215,128 180,128" },
    { key: "temple", side: "l", points: "335,128 300,128 300,60 335,60" },
    { key: "jaw", side: "r", points: "215,98 257.5,98 257.5,205 195,210 185,128 215,128" },
    { key: "jaw", side: "l", points: "300,128 330,128 320,210 257.5,205 257.5,98 300,98" },
    { key: "neckFront", side: null, points: "195,200 320,200 330,245 185,245" },
    { key: "chest", side: "r", points: "150,240 257.5,240 257.5,412 140,412 140,365 150,365" },
    { key: "chest", side: "l", points: "365,365 375,365 375,412 257.5,412 257.5,240 365,240" },
    { key: "upperAbdomen", side: null, points: "140,412 375,412 375,560 140,560" },
    { key: "lowerAbdomen", side: "r", points: "140,560 257.5,560 257.5,690 165,650 140,610" },
    { key: "lowerAbdomen", side: "l", points: "375,610 350,650 257.5,690 257.5,560 375,560" },
    { key: "groin", side: "r", points: "165,650 257.5,690 257.5,790 215,775 160,715" },
    { key: "groin", side: "l", points: "355,715 300,775 257.5,790 257.5,690 350,650" },
    { key: "hipLateral", side: "r", points: "120,610 165,650 160,715 150,790 120,790" },
    { key: "hipLateral", side: "l", points: "395,790 365,790 355,715 350,650 395,610" },
    { key: "thighFront", side: "r", points: "120,715 160,715 215,775 257.5,790 257.5,925 120,925" },
    { key: "thighFront", side: "l", points: "395,925 257.5,925 257.5,790 300,775 355,715 395,715" },
    { key: "knee", side: "r", points: "120,925 257.5,925 257.5,1035 120,1035" },
    { key: "knee", side: "l", points: "395,1035 257.5,1035 257.5,925 395,925" },
    { key: "shin", side: "r", points: "120,1035 257.5,1035 257.5,1215 120,1215" },
    { key: "shin", side: "l", points: "395,1215 257.5,1215 257.5,1035 395,1035" },
    { key: "ankle", side: "r", points: "120,1215 257.5,1215 257.5,1285 120,1285" },
    { key: "ankle", side: "l", points: "395,1285 257.5,1285 257.5,1215 395,1215" },
    { key: "foot", side: "r", points: "120,1285 257.5,1285 257.5,1360 120,1360" },
    { key: "foot", side: "l", points: "395,1360 257.5,1360 257.5,1285 395,1285" },
    { key: "shoulder", side: "r", points: "60,240 150,240 150,365 60,365" },
    { key: "shoulder", side: "l", points: "455,365 365,365 365,240 455,240" },
    { key: "upperArm", side: "r", points: "30,365 140,365 140,480 30,480" },
    { key: "upperArm", side: "l", points: "485,480 375,480 375,365 485,365" },
    { key: "elbow", side: "r", points: "30,480 140,480 140,560 30,560" },
    { key: "elbow", side: "l", points: "485,560 375,560 375,480 485,480" },
    { key: "forearm", side: "r", points: "20,560 140,560 140,668 20,668" },
    { key: "forearm", side: "l", points: "495,668 375,668 375,560 495,560" },
    { key: "wrist", side: "r", points: "20,668 112,668 112,718 20,718" },
    { key: "wrist", side: "l", points: "495,718 403,718 403,668 495,668" },
    { key: "hand", side: "r", points: "0,718 112,718 112,820 0,820" },
    { key: "hand", side: "l", points: "515,820 403,820 403,718 515,718" },
  ],
  back: [
    { key: "occiput", side: "l", points: "180,40 257.5,40 257.5,178 195,178 180,140" },
    { key: "occiput", side: "r", points: "335,140 320,178 257.5,178 257.5,40 335,40" },
    { key: "neckBack", side: "l", points: "195,178 257.5,178 257.5,232 195,232" },
    { key: "neckBack", side: "r", points: "320,232 257.5,232 257.5,178 320,178" },
    { key: "upperTrapezius", side: "l", points: "150,232 257.5,232 257.5,252 238,252 238,290 150,290" },
    { key: "upperTrapezius", side: "r", points: "365,290 277,290 277,252 257.5,252 257.5,232 365,232" },
    { key: "shoulderBlade", side: "l", points: "150,290 238,290 238,432 140,432 140,365 150,365" },
    { key: "shoulderBlade", side: "r", points: "365,365 375,365 375,432 277,432 277,290 365,290" },
    { key: "betweenShoulderBlades", side: null, points: "238,252 277,252 277,432 238,432" },
    { key: "midBack", side: "l", points: "140,432 257.5,432 257.5,540 140,540" },
    { key: "midBack", side: "r", points: "375,540 257.5,540 257.5,432 375,432" },
    { key: "lowerBack", side: "l", points: "140,540 257.5,540 257.5,612 140,612" },
    { key: "lowerBack", side: "r", points: "375,612 257.5,612 257.5,540 375,540" },
    { key: "sacrum", side: null, points: "232,612 283,612 272,700 257.5,768 243,700" },
    { key: "siJoint", side: "l", points: "200,612 232,612 243,700 205,690" },
    { key: "siJoint", side: "r", points: "310,690 272,700 283,612 315,612" },
    { key: "hipLateral", side: "l", points: "120,612 160,612 160,800 120,800" },
    { key: "hipLateral", side: "r", points: "395,800 355,800 355,612 395,612" },
    { key: "buttock", side: "l", points: "160,612 200,612 205,690 243,700 257.5,768 257.5,805 160,805" },
    { key: "buttock", side: "r", points: "355,805 257.5,805 257.5,768 272,700 310,690 315,612 355,612" },
    { key: "thighBack", side: "l", points: "120,800 257.5,800 257.5,975 120,975" },
    { key: "thighBack", side: "r", points: "395,975 257.5,975 257.5,800 395,800" },
    { key: "kneeBack", side: "l", points: "120,975 257.5,975 257.5,1055 120,1055" },
    { key: "kneeBack", side: "r", points: "395,1055 257.5,1055 257.5,975 395,975" },
    { key: "calf", side: "l", points: "120,1055 257.5,1055 257.5,1232 120,1232" },
    { key: "calf", side: "r", points: "395,1232 257.5,1232 257.5,1055 395,1055" },
    { key: "ankle", side: "l", points: "120,1232 257.5,1232 257.5,1278 120,1278" },
    { key: "ankle", side: "r", points: "395,1278 257.5,1278 257.5,1232 395,1232" },
    { key: "heel", side: "l", points: "120,1278 257.5,1278 257.5,1335 120,1335" },
    { key: "heel", side: "r", points: "395,1335 257.5,1335 257.5,1278 395,1278" },
    { key: "shoulder", side: "l", points: "60,240 150,240 150,365 60,365" },
    { key: "shoulder", side: "r", points: "455,365 365,365 365,240 455,240" },
    { key: "upperArm", side: "l", points: "30,365 140,365 140,480 30,480" },
    { key: "upperArm", side: "r", points: "485,480 375,480 375,365 485,365" },
    { key: "elbow", side: "l", points: "30,480 140,480 140,560 30,560" },
    { key: "elbow", side: "r", points: "485,560 375,560 375,480 485,480" },
    { key: "forearm", side: "l", points: "20,560 140,560 140,668 20,668" },
    { key: "forearm", side: "r", points: "495,668 375,668 375,560 495,560" },
    { key: "wrist", side: "l", points: "20,668 112,668 112,718 20,718" },
    { key: "wrist", side: "r", points: "495,718 403,718 403,668 495,668" },
    { key: "hand", side: "l", points: "0,718 112,718 112,820 0,820" },
    { key: "hand", side: "r", points: "515,820 403,820 403,718 515,718" },
  ],
}

export interface Region extends RegionShape {
  /** What a mark stores: `sacrum`, `buttock:r`. */
  id: string
  polygon: [number, number][]
}

const parse = (points: string): [number, number][] =>
  points.split(" ").map((pair) => pair.split(",").map(Number) as [number, number])

export const regionId = (key: string, side: RegionSide | null) => (side ? `${key}:${side}` : key)

export const REGIONS: Record<BodyMapView, Region[]> = {
  front: SHAPES.front.map((s) => ({ ...s, id: regionId(s.key, s.side), polygon: parse(s.points) })),
  back: SHAPES.back.map((s) => ({ ...s, id: regionId(s.key, s.side), polygon: parse(s.points) })),
}

/** Ray casting. The shapes are small and few, so nothing cleverer is needed. */
function contains(polygon: [number, number][], x: number, y: number) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** The area under a point given in the figure's pixels, or null between them. */
export function regionAt(view: BodyMapView, x: number, y: number): Region | null {
  return REGIONS[view].find((r) => contains(r.polygon, x, y)) ?? null
}


/* -------------------------------------------------------------------------- */
/* The finer level: parts inside each area                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every area splits into smaller parts when a figure is opened up close.
 *
 * Nobody can say in advance where a practitioner will need to be precise, so
 * every area has parts, not only the back. They are made rather than drawn:
 *
 *  - **Beside the spine, by level.** The back of the neck splits into C1–C7,
 *    the middle and lower back into the thoracic and lumbar levels, each side
 *    on its own. That is how a chiropractor names a spot there, and the level
 *    is what lines it up with the spine model.
 *  - **Everywhere else, by position.** Upper, middle and lower down the length
 *    of an area; inner and outer across it, inner being the side nearer the
 *    body's midline in the standing position the figures show. An area that
 *    straddles the midline splits into the patient's right and left instead.
 *
 * A part is stored as `parent/part` (`lowerBack:r/L4`, `thighFront:l/upper-outer`),
 * so the area it belongs to is always readable from it.
 */

/** Heights of the spinal levels on the back figure, in its pixels. */
const SPINE_BANDS: { group: string; levels: string[]; y0: number; y1: number }[] = [
  { group: "C", levels: ["C1", "C2", "C3", "C4", "C5", "C6", "C7"], y0: 178, y1: 232 },
  { group: "T-upper", levels: ["T1", "T2", "T3", "T4", "T5", "T6"], y0: 232, y1: 432 },
  { group: "T-lower", levels: ["T7", "T8", "T9", "T10", "T11", "T12"], y0: 432, y1: 540 },
  { group: "L", levels: ["L1", "L2", "L3", "L4", "L5"], y0: 540, y1: 612 },
]

/** Where each level sits on the back figure's midline. Sacrum and coccyx below. */
export const LEVEL_Y: Record<string, [number, number]> = (() => {
  const out: Record<string, [number, number]> = {}
  for (const band of SPINE_BANDS) {
    const step = (band.y1 - band.y0) / band.levels.length
    band.levels.forEach((level, i) => {
      out[level] = [band.y0 + i * step, band.y0 + (i + 1) * step]
    })
  }
  out.Sacrum = [612, 740]
  out.Coccyx = [740, 770]
  return out
})()

/** The areas beside the spine, and which run of levels each one covers. */
const BY_LEVEL: Record<string, string> = {
  neckBack: "C",
  betweenShoulderBlades: "T-upper",
  midBack: "T-lower",
  lowerBack: "L",
}

export const MIDLINE = 257.5

type Pt = [number, number]

/** One side of an axis-aligned cut, Sutherland–Hodgman. */
function clipEdge(poly: Pt[], inside: (p: Pt) => boolean, cross: (a: Pt, b: Pt) => Pt) {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]
    const prev = poly[(i + poly.length - 1) % poly.length]
    if (inside(cur)) {
      if (!inside(prev)) out.push(cross(prev, cur))
      out.push(cur)
    } else if (inside(prev)) {
      out.push(cross(prev, cur))
    }
  }
  return out
}

/** A polygon cut down to a rectangle. Empty when they do not meet. */
function clipToRect(poly: Pt[], x0: number, y0: number, x1: number, y1: number): Pt[] {
  const atX =
    (x: number) =>
    (a: Pt, b: Pt): Pt => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])]
  const atY =
    (y: number) =>
    (a: Pt, b: Pt): Pt => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y]
  let out = poly
  out = clipEdge(out, (p) => p[0] >= x0, atX(x0))
  if (out.length) out = clipEdge(out, (p) => p[0] <= x1, atX(x1))
  if (out.length) out = clipEdge(out, (p) => p[1] >= y0, atY(y0))
  if (out.length) out = clipEdge(out, (p) => p[1] <= y1, atY(y1))
  return out
}

const polygonArea = (poly: Pt[]) => {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1])
  }
  return Math.abs(a / 2)
}

export interface SubRegion {
  /** `lowerBack:r/L4` */
  id: string
  parentId: string
  polygon: Pt[]
  points: string
}

function partsOf(view: BodyMapView, region: Region): SubRegion[] {
  const xs = region.polygon.map((p) => p[0])
  const ys = region.polygon.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const cells: { part: string; rect: [number, number, number, number] }[] = []

  const band =
    view === "back" ? SPINE_BANDS.find((b) => b.group === BY_LEVEL[region.key]) : undefined
  if (band) {
    const step = (band.y1 - band.y0) / band.levels.length
    band.levels.forEach((level, i) => {
      cells.push({ part: level, rect: [minX, band.y0 + i * step, maxX, band.y0 + (i + 1) * step] })
    })
  } else {
    const height = maxY - minY
    const width = maxX - minX
    const rows: (string | null)[] =
      height > 150 ? ["upper", "middle", "lower"] : height > 60 ? ["upper", "lower"] : [null]
    const straddles = minX < MIDLINE - 5 && maxX > MIDLINE + 5
    // Which half is the patient's right depends on the figure: from the front
    // their right is on our left.
    const leftHalf = view === "front" ? "r" : "l"
    const rightHalf = view === "front" ? "l" : "r"
    const onLeft = (minX + maxX) / 2 < MIDLINE
    const midX = (minX + maxX) / 2
    const cols: { name: string | null; x0: number; x1: number }[] = straddles
      ? [
          { name: leftHalf, x0: minX, x1: MIDLINE },
          { name: rightHalf, x0: MIDLINE, x1: maxX },
        ]
      : width > 60
        ? [
            { name: onLeft ? "outer" : "inner", x0: minX, x1: midX },
            { name: onLeft ? "inner" : "outer", x0: midX, x1: maxX },
          ]
        : [{ name: null, x0: minX, x1: maxX }]
    rows.forEach((row, i) => {
      const y0 = minY + (height * i) / rows.length
      const y1 = minY + (height * (i + 1)) / rows.length
      for (const col of cols) {
        const part = [row, col.name].filter(Boolean).join("-")
        if (part) cells.push({ part, rect: [col.x0, y0, col.x1, y1] })
      }
    })
  }

  const out: SubRegion[] = []
  for (const cell of cells) {
    const polygon = clipToRect(region.polygon, ...cell.rect)
    if (polygon.length < 3 || polygonArea(polygon) < 40) continue
    out.push({
      id: `${region.id}/${cell.part}`,
      parentId: region.id,
      polygon,
      points: polygon
        .map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`)
        .join(" "),
    })
  }
  return out
}

export const SUBREGIONS: Record<BodyMapView, SubRegion[]> = {
  front: REGIONS.front.flatMap((r) => partsOf("front", r)),
  back: REGIONS.back.flatMap((r) => partsOf("back", r)),
}

/** The part under a point, when the figure is open close enough to show parts. */
export function subRegionAt(view: BodyMapView, x: number, y: number): SubRegion | null {
  const parent = regionAt(view, x, y)
  if (!parent) return null
  return (
    SUBREGIONS[view].find((s) => s.parentId === parent.id && contains(s.polygon, x, y)) ?? null
  )
}

/* -------------------------------------------------------------------------- */
/* The spine                                                                   */
/* -------------------------------------------------------------------------- */

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

/** "ישבן ימין", "Right buttock": the order is the language's, so it is a string. */
function areaLabel(t: Translate, id: string) {
  const [key, side] = id.split(":")
  const name = t(`bodyMap.region.${key}`)
  return side ? t("bodyMap.sided", { name, side: t(`bodyMap.side.${side}`) }) : name
}

/** An area or a part of one: "גב תחתון ימין › L4", "ירך קדמית שמאל › עליון חיצוני". */
export function regionLabel(t: Translate, id: string) {
  const [parent, part] = id.split("/")
  const name = areaLabel(t, parent)
  if (!part) return name
  const words = part.split("-").map((w) => {
    if (/^[CTL]\d+$/.test(w)) return w
    if (w === "r" || w === "l") return t(`bodyMap.side.${w}`)
    return t(`bodyMap.part.${w}`)
  })
  return `${name} › ${words.join(" ")}`
}

/** The spine model's items, with the side in the app's language: "L4 ימין", "L4/L5". */
export function spineLabel(t: Translate, item: string) {
  const [level, side] = item.split(" ")
  if (side === "R" || side === "L") return `${level} ${t(`bodyMap.side.${side.toLowerCase()}`)}`
  return item
}
