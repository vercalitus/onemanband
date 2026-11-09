"use client"

import { X } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { spineLabel } from "../lib/regions"
import { useLocale } from "@/components/providers/locale-provider"

/**
 * The spine, flat and from behind, every level named beside it.
 *
 * It replaced a 3D model that had to be turned before anything could be
 * found, and named nothing until the pointer was on it — so a practitioner
 * counted vertebrae from the top to know which one was red.
 *
 * What a tap names, row by row:
 *  - the body of a vertebra, or its name on the left: that level (`L4`)
 *  - beside the body: that side of it, the patient's (`L4 R`). From behind,
 *    so the patient's right is on our right, as on the back figure
 *  - the gap between two vertebrae, or the small name between two labels:
 *    the disc (`L4/L5`). A disc is too thin to aim at, so the whole gap is
 *    its target, from the label to the far edge
 *  - sacrum, the sacroiliac joints either side of it, coccyx
 *
 * The drawing is taller than the screen on purpose, so every target is big
 * enough for a finger; it scrolls up and down, and the region buttons jump.
 */

type Kind = "body" | "side" | "disc" | "sacrum" | "si" | "coccyx"

interface Target {
  item: string
  kind: Kind
  /** What is drawn. */
  shape: { x: number; y: number; w: number; h: number } | { points: string }
  /** Where a tap counts: bigger than the drawing, never overlapping another. */
  hit: { x: number; y: number; w: number; h: number }[]
}

const W = 300
const LABEL_X = 30
const CX = 185
const GAP = 12
const SIDE_REACH = 46

const SEGMENTS: { key: string; levels: string[]; h: number; half: number }[] = [
  { key: "C", levels: ["C1", "C2", "C3", "C4", "C5", "C6", "C7"], h: 20, half: 23 },
  { key: "T", levels: Array.from({ length: 12 }, (_, i) => `T${i + 1}`), h: 24, half: 27 },
  { key: "L", levels: ["L1", "L2", "L3", "L4", "L5"], h: 32, half: 34 },
]

function layout() {
  const targets: Target[] = []
  const labels: { text: string; y: number; small: boolean }[] = []
  const anchors: Record<string, number> = {}
  let y = 10
  const levels = SEGMENTS.flatMap((s) => s.levels.map((level) => ({ level, h: s.h, half: s.half, seg: s.key })))

  levels.forEach(({ level, h, half, seg }, i) => {
    if (anchors[seg] === undefined) anchors[seg] = y
    const left = CX - half
    const right = CX + half
    targets.push({
      item: level,
      kind: "body",
      shape: { x: left, y, w: half * 2, h },
      // The body itself, and the level's name on the left.
      hit: [
        { x: left, y, w: half * 2, h },
        { x: 0, y, w: left - SIDE_REACH, h },
      ],
    })
    const sh = h * 0.55
    const sy = y + (h - sh) / 2
    // From behind, the patient's left is on our left.
    targets.push({
      item: `${level} L`,
      kind: "side",
      shape: { x: left - 33, y: sy, w: 30, h: sh },
      hit: [{ x: left - SIDE_REACH, y, w: SIDE_REACH, h }],
    })
    targets.push({
      item: `${level} R`,
      kind: "side",
      shape: { x: right + 3, y: sy, w: 30, h: sh },
      hit: [{ x: right, y, w: W - right, h }],
    })
    labels.push({ text: level, y: y + h / 2, small: false })
    y += h

    const next = levels[i + 1]?.level ?? "S1"
    const nextHalf = levels[i + 1]?.half ?? 40
    const discHalf = Math.min(half, nextHalf) - 3
    targets.push({
      item: `${level}/${next}`,
      kind: "disc",
      shape: { x: CX - discHalf, y: y + 3, w: discHalf * 2, h: GAP - 6 },
      hit: [{ x: 0, y, w: W, h: GAP }],
    })
    labels.push({ text: `${level}/${next}`, y: y + GAP / 2, small: true })
    y += GAP
  })

  // Sacrum: wide at the top, narrowing down; a sacroiliac joint either side.
  anchors.S = y
  const sTop = 42
  const sBottom = 15
  const sH = 100
  targets.push({
    item: "Sacrum",
    kind: "sacrum",
    shape: {
      points: `${CX - sTop},${y} ${CX + sTop},${y} ${CX + sBottom},${y + sH} ${CX - sBottom},${y + sH}`,
    },
    hit: [{ x: 0, y, w: W, h: sH }],
  })
  targets.push({
    item: "SI L",
    kind: "si",
    shape: {
      points: `${CX - sTop - 24},${y + 4} ${CX - sTop + 2},${y + 4} ${CX - 30 + 2},${y + 64} ${CX - 30 - 24},${y + 64}`,
    },
    hit: [{ x: CX - sTop - SIDE_REACH, y, w: SIDE_REACH - 2, h: 70 }],
  })
  targets.push({
    item: "SI R",
    kind: "si",
    shape: {
      points: `${CX + sTop - 2},${y + 4} ${CX + sTop + 24},${y + 4} ${CX + 30 + 24},${y + 64} ${CX + 30 - 2},${y + 64}`,
    },
    hit: [{ x: CX + sTop + 2, y, w: W - (CX + sTop + 2), h: 70 }],
  })
  labels.push({ text: "Sacrum", y: y + sH / 2, small: false })
  y += sH + 6

  targets.push({
    item: "Coccyx",
    kind: "coccyx",
    shape: { points: `${CX - 12},${y} ${CX + 12},${y} ${CX},${y + 34}` },
    hit: [{ x: 0, y, w: W, h: 34 }],
  })
  labels.push({ text: "Coccyx", y: y + 17, small: false })
  y += 44

  return { targets, labels, anchors, height: y }
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
/** How much bigger than its own units the drawing is shown. */
const SCALE = 1.4

export function SpineChart({
  colors,
  emphasis,
  selected,
  onToggle,
}: {
  colors: Map<string, string>
  emphasis: Set<string>
  /** The mark being made, top to bottom. */
  selected: string[]
  onToggle: (item: string) => void
}) {
  const { t } = useLocale()
  const { targets, labels, anchors, height } = useMemo(layout, [])
  const [hovered, setHovered] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)

  const jump = (seg: string) => {
    const box = scroller.current
    if (!box) return
    box.scrollTo({ top: Math.max(0, (anchors[seg] - 6) * SCALE), behavior: "smooth" })
  }

  // The sacroiliac joints sit inside the sacrum's row, so they go on top.
  const hitOrder = useMemo(
    () => [...targets].sort((a, b) => Number(a.kind === "si") - Number(b.kind === "si")),
    [targets],
  )

  const label = (item: string) => spineLabel(t, item)

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
        {(["C", "T", "L", "S"] as const).map((seg) => (
          <button
            key={seg}
            type="button"
            onClick={() => jump(seg)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 pointer-coarse:px-4 pointer-coarse:py-2.5 pointer-coarse:text-sm"
          >
            {t(`bodyMap.spine.seg.${seg}`)}
          </button>
        ))}
      </div>

      {/* Which side is which, kept in view while the column scrolls. */}
      <div className="mx-auto w-full" style={{ maxWidth: W * SCALE }}>
        <svg viewBox={`0 0 ${W} 16`} className="block w-full" aria-hidden>
          <text x={CX - 52} y={12} textAnchor="middle" fontSize={11} fontWeight={700} fill="#64748b">
            {t("bodyMap.side.l")}
          </text>
          <text x={CX + 52} y={12} textAnchor="middle" fontSize={11} fontWeight={700} fill="#64748b">
            {t("bodyMap.side.r")}
          </text>
        </svg>
      </div>

      <div
        ref={scroller}
        className="h-[620px] max-h-[70dvh] touch-manipulation overflow-y-auto overscroll-contain rounded-xl bg-gradient-to-b from-slate-50 to-white"
      >
        <svg
          viewBox={`0 0 ${W} ${height}`}
          className="mx-auto block w-full"
          style={{ maxWidth: W * SCALE }}
          role="img"
          aria-label={t("bodyMap.stage.spine")}
          onPointerLeave={() => setHovered(null)}
        >
          {/* The drawing. */}
          {targets.map((target) => {
            const color = colors.get(target.item)
            const fill = color ?? (hovered === target.item ? HOVER : BASE[target.kind])
            const strong = emphasis.has(target.item)
            const common = {
              fill,
              fillOpacity: color ? (strong ? 0.95 : 0.7) : 1,
              stroke: strong ? "#0f172a" : EDGE,
              strokeWidth: strong ? 1.6 : 0.8,
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
            .filter((target) => target.kind === "body" && "w" in target.shape)
            .map((target) => {
              const s = target.shape as { y: number; h: number }
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
          {labels.map((l) => (
            <text
              key={l.text}
              x={LABEL_X}
              y={l.y}
              dominantBaseline="central"
              textAnchor="middle"
              fontSize={l.small ? 8.5 : 12}
              fontWeight={l.small ? 500 : 700}
              fill={l.small ? "#94a3b8" : "#334155"}
              pointerEvents="none"
            >
              {l.text === "Sacrum" || l.text === "Coccyx" ? label(l.text) : l.text}
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
              onClick={() => onToggle(target.item)}
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
        <li>{t("bodyMap.spine.help.level")}</li>
        <li>{t("bodyMap.spine.help.side")}</li>
        <li>{t("bodyMap.spine.help.disc")}</li>
        <li>{t("bodyMap.spine.help.scroll")}</li>
      </ul>
    </div>
  )
}
