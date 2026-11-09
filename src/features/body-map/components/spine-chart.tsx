"use client"

import { X } from "lucide-react"
import { useMemo, useState } from "react"

import { spineLabel } from "../lib/regions"
import { useLocale } from "@/components/providers/locale-provider"

/**
 * The spine, flat and from behind.
 *
 * It replaced a 3D model that had to be turned before anything could be
 * found. Two rules came from using it:
 *
 *  - **A name appears where something is marked, and nowhere else.** A column
 *    of every level and every disc was fifty labels for nothing chosen. The
 *    name of what is under the pointer is shown above the drawing instead.
 *  - **The whole spine fits, and opens like an area of the body.** The first
 *    tap on a region (neck, upper back, lower back, pelvis) enlarges it; from
 *    there each tap marks. Drawn tall enough for a finger, the spine ran off
 *    the screen and nobody could see where it began or ended.
 *
 * What a tap names, once a region is open:
 *  - the body of a vertebra: that level (`L4`)
 *  - beside it: that side, the patient's (`L4 R`). From behind, so the
 *    patient's right is on our right, as on the back figure
 *  - the gap between two vertebrae: the disc (`L4/L5`). A disc drawn to size
 *    is too thin to aim at, so the whole gap is its target
 *  - sacrum, the sacroiliac joints either side of it, coccyx
 */

type Kind = "body" | "side" | "disc" | "sacrum" | "si" | "coccyx"
type Segment = "C" | "T" | "L" | "S"
type Zoom = "all" | Segment
type Box = { x: number; y: number; w: number; h: number }

interface Target {
  item: string
  kind: Kind
  segment: Segment
  shape: Box | { points: string }
  /** Where a tap counts: bigger than the drawing, never overlapping another. */
  hit: Box[]
  /** Where its name goes when it is marked. */
  name: { x: number; y: number; anchor: "start" | "end" }
}

const W = 300
const CX = 150
const GAP = 12

const LEVELS: { segment: Segment; levels: string[]; h: number; half: number }[] = [
  { segment: "C", levels: ["C1", "C2", "C3", "C4", "C5", "C6", "C7"], h: 20, half: 23 },
  { segment: "T", levels: Array.from({ length: 12 }, (_, i) => `T${i + 1}`), h: 24, half: 27 },
  { segment: "L", levels: ["L1", "L2", "L3", "L4", "L5"], h: 32, half: 34 },
]

function layout() {
  const targets: Target[] = []
  const start: Partial<Record<Segment, number>> = {}
  let y = 10
  const rows = LEVELS.flatMap((s) => s.levels.map((level) => ({ ...s, level })))

  rows.forEach(({ level, h, half, segment }, i) => {
    start[segment] ??= y
    const left = CX - half
    const right = CX + half
    const mid = y + h / 2
    const sh = h * 0.55
    const sy = y + (h - sh) / 2
    targets.push({
      item: level,
      kind: "body",
      segment,
      shape: { x: left, y, w: half * 2, h },
      hit: [{ x: left, y, w: half * 2, h }],
      name: { x: right + 40, y: mid, anchor: "start" },
    })
    // From behind, the patient's left is on our left.
    targets.push({
      item: `${level} L`,
      kind: "side",
      segment,
      shape: { x: left - 33, y: sy, w: 30, h: sh },
      hit: [{ x: 0, y, w: left, h }],
      name: { x: left - 40, y: mid, anchor: "end" },
    })
    targets.push({
      item: `${level} R`,
      kind: "side",
      segment,
      shape: { x: right + 3, y: sy, w: 30, h: sh },
      hit: [{ x: right, y, w: W - right, h }],
      name: { x: right + 40, y: mid, anchor: "start" },
    })
    y += h

    const next = rows[i + 1]?.level ?? "S1"
    const discHalf = Math.min(half, rows[i + 1]?.half ?? 40) - 3
    targets.push({
      item: `${level}/${next}`,
      kind: "disc",
      segment,
      shape: { x: CX - discHalf, y: y + 3, w: discHalf * 2, h: GAP - 6 },
      hit: [{ x: 0, y, w: W, h: GAP }],
      name: { x: CX + discHalf + 40, y: y + GAP / 2, anchor: "start" },
    })
    y += GAP
  })

  // Sacrum: wide at the top, narrowing down; a sacroiliac joint either side.
  start.S = y
  const sTop = 42
  const sBottom = 15
  const sH = 100
  targets.push({
    item: "Sacrum",
    kind: "sacrum",
    segment: "S",
    shape: { points: `${CX - sTop},${y} ${CX + sTop},${y} ${CX + sBottom},${y + sH} ${CX - sBottom},${y + sH}` },
    hit: [{ x: CX - sTop, y, w: sTop * 2, h: sH }],
    name: { x: CX + sTop + 30, y: y + 80, anchor: "start" },
  })
  targets.push({
    item: "SI L",
    kind: "si",
    segment: "S",
    shape: {
      points: `${CX - sTop - 24},${y + 4} ${CX - sTop + 2},${y + 4} ${CX - 30 + 2},${y + 64} ${CX - 30 - 24},${y + 64}`,
    },
    hit: [{ x: 0, y, w: CX - sTop, h: sH }],
    name: { x: CX - sTop - 30, y: y + 34, anchor: "end" },
  })
  targets.push({
    item: "SI R",
    kind: "si",
    segment: "S",
    shape: {
      points: `${CX + sTop - 2},${y + 4} ${CX + sTop + 24},${y + 4} ${CX + 30 + 24},${y + 64} ${CX + 30 - 2},${y + 64}`,
    },
    hit: [{ x: CX + sTop, y, w: W - (CX + sTop), h: sH }],
    name: { x: CX + sTop + 30, y: y + 34, anchor: "start" },
  })
  y += sH + 6

  targets.push({
    item: "Coccyx",
    kind: "coccyx",
    segment: "S",
    shape: { points: `${CX - 12},${y} ${CX + 12},${y} ${CX},${y + 34}` },
    hit: [{ x: 0, y, w: W, h: 34 }],
    name: { x: CX + 30, y: y + 14, anchor: "start" },
  })
  y += 44

  const height = y
  // What each region shows when it is opened: a little of its neighbours, so
  // it is plain where it sits.
  const view: Record<Zoom, [number, number]> = {
    all: [0, height],
    C: [start.C! - 6, start.T! + 10],
    T: [start.T! - 14, start.L! + 10],
    L: [start.L! - 14, start.S! + 20],
    S: [start.S! - 50, height],
  }
  return { targets, view }
}

const BASE: Record<Kind, string> = {
  body: "#e7ecf2",
  side: "#d9e1ea",
  disc: "#9fc4d8",
  sacrum: "#e2e8ef",
  si: "#d9e1ea",
  coccyx: "#e2e8ef",
}
const EDGE = "#94a3b8"
const HOVER = "#bae6fd"
const ZOOMS: Zoom[] = ["all", "C", "T", "L", "S"]

export function SpineChart({
  colors,
  selected,
  onToggle,
}: {
  /** The mark in hand: each of its items in that mark's colour. */
  colors: Map<string, string>
  /** The mark being made, top to bottom. */
  selected: string[]
  onToggle: (item: string) => void
}) {
  const { t } = useLocale()
  const { targets, view } = useMemo(layout, [])
  const [zoom, setZoom] = useState<Zoom>("all")
  const [hovered, setHovered] = useState<string | null>(null)

  const label = (item: string) => spineLabel(t, item)
  const [y0, y1] = view[zoom]
  // Names have to read at the scale the drawing is shown at.
  const nameSize = zoom === "all" ? 22 : 12

  // The sacroiliac joints sit beside the sacrum, inside its region; drawn last
  // so nothing covers them.
  const hitOrder = useMemo(
    () => [...targets].sort((a, b) => Number(a.kind === "si") - Number(b.kind === "si")),
    [targets],
  )

  // A level and its right side are named in the same place; one line says both.
  const names = useMemo(() => {
    const at = new Map<string, { key: string; x: number; y: number; anchor: "start" | "end"; text: string }>()
    for (const target of targets) {
      if (!colors.has(target.item)) continue
      const { x, y, anchor } = target.name
      const key = `${x},${y},${anchor}`
      const prev = at.get(key)
      at.set(key, prev ? { ...prev, text: `${prev.text} · ${label(target.item)}` } : { key, x, y, anchor, text: label(target.item) })
    }
    return [...at.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps -- label follows the locale, which `t` carries
  }, [targets, colors, t])

  const tap = (target: Target) => {
    // Like an area of the body: the first tap opens the region, the next marks.
    if (zoom === "all") {
      setZoom(target.segment)
      setHovered(null)
      return
    }
    onToggle(target.item)
  }

  return (
    <div className="grid gap-3">
      {/* What is chosen, in words, top to bottom — never counted off the drawing. */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {hovered ? t("bodyMap.underCursor") : t("bodyMap.spine.chosen")}
        </p>
        {hovered ? (
          <p className="mt-0.5 text-lg font-bold text-sky-800">{label(hovered)}</p>
        ) : selected.length ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {selected.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-slate-800 ring-1 ring-slate-200"
              >
                {label(item)}
                <button
                  type="button"
                  onClick={() => onToggle(item)}
                  aria-label={t("bodyMap.remove", { name: label(item) })}
                  className="-my-1 -me-1 p-1 text-slate-400 hover:text-rose-600"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-0.5 text-sm text-slate-500">{t("bodyMap.spine.none")}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ZOOMS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setZoom(value)}
            aria-pressed={zoom === value}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors pointer-coarse:px-4 pointer-coarse:py-2.5 pointer-coarse:text-sm ${
              zoom === value
                ? "border-sky-700 bg-sky-700 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {t(`bodyMap.spine.seg.${value}`)}
          </button>
        ))}
      </div>

      <div className="relative h-[560px] max-h-[65dvh] touch-manipulation rounded-xl bg-gradient-to-b from-slate-50 to-white">
        <svg
          viewBox={`0 ${y0} ${W} ${y1 - y0}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label={t("bodyMap.stage.spine")}
          onPointerLeave={() => setHovered(null)}
        >
          {/* Which side is which, at the top of whatever is shown. */}
          <text x={CX - 75} y={y0 + nameSize} textAnchor="middle" fontSize={nameSize * 0.85} fontWeight={700} fill="#94a3b8">
            {t("bodyMap.side.l")}
          </text>
          <text x={CX + 75} y={y0 + nameSize} textAnchor="middle" fontSize={nameSize * 0.85} fontWeight={700} fill="#94a3b8">
            {t("bodyMap.side.r")}
          </text>

          {targets.map((target) => {
            const color = colors.get(target.item)
            const fill = color ?? (hovered === target.item ? HOVER : BASE[target.kind])
            const common = {
              fill,
              stroke: color ? "#0f172a" : EDGE,
              strokeWidth: color ? 1.4 : 0.8,
            }
            return "points" in target.shape ? (
              <polygon key={target.item} points={target.shape.points} {...common} strokeLinejoin="round" />
            ) : (
              <rect
                key={target.item}
                x={target.shape.x}
                y={target.shape.y}
                width={target.shape.w}
                height={target.shape.h}
                rx={target.kind === "disc" ? 3 : 5}
                {...common}
              />
            )
          })}
          {/* The spinous processes: what the fingers feel, down the middle. */}
          {targets
            .filter((target) => target.kind === "body" && !("points" in target.shape))
            .map((target) => {
              const s = target.shape as Box
              return (
                <rect
                  key={`sp-${target.item}`}
                  x={CX - 5}
                  y={s.y + s.h * 0.2}
                  width={10}
                  height={s.h * 0.6}
                  rx={4}
                  fill="#cbd5e1"
                  pointerEvents="none"
                />
              )
            })}
          {/* A name beside each marked thing, and nothing else named. */}
          {names.map((n) => (
            <text
              key={n.key}
              x={n.x}
              y={n.y}
              textAnchor={n.anchor}
              dominantBaseline="central"
              fontSize={nameSize}
              fontWeight={700}
              fill="#0f172a"
              pointerEvents="none"
            >
              {n.text}
            </text>
          ))}
          {/* Where a tap counts. Last, so they sit over the drawing. */}
          {hitOrder.flatMap((target) =>
            target.hit.map((box, i) => (
              <rect
                key={`hit-${target.item}-${i}`}
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => tap(target)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setHovered(target.item)
                }}
              >
                <title>{label(target.item)}</title>
              </rect>
            )),
          )}
        </svg>
      </div>

      <ul className="grid gap-1 text-[12px] leading-snug text-slate-600 pointer-coarse:text-[13px]">
        <li>{t("bodyMap.spine.help.zoom")}</li>
        <li>{t("bodyMap.spine.help.level")}</li>
        <li>{t("bodyMap.spine.help.side")}</li>
        <li>{t("bodyMap.spine.help.disc")}</li>
      </ul>
    </div>
  )
}
