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

/**
 * The spine, named one segment at a time.
 *
 * An area says "lower back"; a chiropractor's finding says L4. The picture
 * cannot show a vertebra at a size anyone could tap, so the levels are a row
 * of their own, chosen alongside the areas and stored beside them.
 */
export const VERTEBRAE: { group: string; levels: string[] }[] = [
  { group: "C", levels: ["C1", "C2", "C3", "C4", "C5", "C6", "C7"] },
  {
    group: "T",
    levels: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"],
  },
  { group: "L", levels: ["L1", "L2", "L3", "L4", "L5"] },
  { group: "S", levels: ["Sacrum", "Coccyx"] },
]

const SPINE_ORDER = VERTEBRAE.flatMap((g) => g.levels)

/** Levels in the order they sit on the spine, not the order they were tapped. */
export const sortVertebrae = (levels: string[]) =>
  [...levels].sort((a, b) => SPINE_ORDER.indexOf(a) - SPINE_ORDER.indexOf(b))

/** "ישבן ימין", "Right buttock" — the order is the language's, so it is a string. */
export function regionLabel(
  t: (key: string, params?: Record<string, string | number>) => string,
  id: string,
) {
  const [key, side] = id.split(":")
  const name = t(`bodyMap.region.${key}`)
  return side ? t("bodyMap.sided", { name, side: t(`bodyMap.side.${side}`) }) : name
}
