"use client"

import { ChevronDown, CircleHelp, Undo2, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Rich } from "./rich"
import { SpineChart } from "./spine-chart"
import { BODY_MAP_FLUSH_EVENT } from "../lib/flush-event"
import {
  AREAS,
  FIGURES,
  LEVEL_Y,
  MIDLINE,
  areaById,
  groupBySide,
  itemName,
  levelOf,
  partAt,
  partLabel,
  regionLabel,
  sideOf,
  sortSpine,
  spineLabel,
} from "../lib/regions"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { markTones } from "@/types/domain"
import type {
  BodyMapView,
  BodyMark,
  BodyMark3d,
  BodyMarkTone,
  FigureStroke,
} from "@/types/domain"

/**
 * The body map: two figures, front and back, with the soles beside the back
 * figure's feet, and the spine on its own, flat.
 *
 * **Only what is in hand is coloured:** the mark being made, or the saved one
 * opened from the list. Every saved finding used to be coloured at once, and a
 * practitioner making a new mark could not tell it from yesterday's.
 *
 * **The figures never change.** An area opens where it is:
 *
 *  1. A tap on an area opens it: its parts are outlined inside it and listed
 *     beside the map. Nothing is marked.
 *  2. Another tap marks: on a part, that part; from the list, the whole area
 *     or any of its parts. Martin marks both, so both are one tap away.
 *  3. A tap outside closes it. What was marked stays marked.
 *
 * **The pen draws a path.** A line is usually pain travelling (low back down
 * the leg), so it is recorded as where it starts and where it ends, with the
 * drawing. It used to name every area it crossed, and one line became eleven
 * findings that nobody had meant.
 *
 * **A mark reads by side.** Right, left, midline, spine, path: each name once,
 * the side said once per row, instead of the same long list twice with "Right"
 * and "Left" in front of every item.
 */

type Mode = "pen" | "point"
type Stage = "figures" | "spine"

const TONE_COLOR: Record<BodyMarkTone, string> = {
  pain: "#dc2626",
  nerve: "#eab308",
  dysfunction: "#64748b",
}
/** Older marks that were both pain and nerve. Nothing is marked both any more. */
const BOTH_COLOR = "#ea580c"
/** Marks made before a finding had a kind. Paler than dysfunction's grey, so the two never read alike. */
const UNCLASSIFIED_COLOR = "#cbd5e1"
const HOVER_COLOR = "#0ea5e9"
const OPEN_COLOR = "#0369a1"
const INK = "#111827"

const toneColor = (tones: BodyMarkTone[]) => {
  if (tones.length > 1) return BOTH_COLOR
  if (tones.length === 1) return TONE_COLOR[tones[0]]
  return UNCLASSIFIED_COLOR
}

const TONES: BodyMarkTone[] = ["pain", "nerve", "dysfunction"]
const VIEWS: BodyMapView[] = ["front", "back"]
const STAGES: Stage[] = ["figures", "spine"]
/** The help, in the order a first mark is made. */
const HELP = ["open", "whole", "sides", "soles", "pen", "spine", "disc", "kind", "where", "saved"] as const

/** What Undo restores: a snapshot, so "put it back exactly" cannot drift. */
interface Draft {
  regions: string[]
  vertebrae: string[]
  /** The kind each place was marked with: the kind chosen when it was tapped. */
  kinds: Record<string, BodyMarkTone>
  strokes: FigureStroke[]
  note: string
}
const EMPTY: Draft = { regions: [], vertebrae: [], kinds: {}, strokes: [], note: "" }

/** The colour of one place in a saved mark: its own kind, or the whole mark's on older marks. */
const placeColor = (m: BodyMark, id: string) => {
  const own = m.kinds?.[id]
  return own ? TONE_COLOR[own] : toneColor(markTones(m))
}

/**
 * A tap with the kind in hand. On something not marked, marks it in that
 * kind; on something marked in another kind, changes it; on something marked
 * in this kind, unmarks it — the gesture that chose it undoes it.
 */
function tapPlace(list: string[], kinds: Record<string, BodyMarkTone>, id: string, kind: BodyMarkTone) {
  if (!list.includes(id)) return { list: [...list, id], kinds: { ...kinds, [id]: kind } }
  if (kinds[id] && kinds[id] !== kind) return { list, kinds: { ...kinds, [id]: kind } }
  const rest = { ...kinds }
  delete rest[id]
  return { list: list.filter((x) => x !== id), kinds: rest }
}

type Pending = { kind: "clear" } | { kind: "delete"; id: string } | null


export function BodyMapViewer({
  marks,
  legacyMarks,
  onSave,
  onDelete,
  onUpdateNote,
  onUpdateTones,
}: {
  marks: BodyMark[]
  /** The skeleton's marks. Listed so they are not lost; never edited. */
  legacyMarks: BodyMark3d[]
  onSave: (mark: Omit<BodyMark, "id" | "createdAt">) => void
  onDelete: (id: string) => void
  onUpdateNote: (id: string, note: string) => void
  onUpdateTones: (id: string, tones: BodyMarkTone[]) => void
}) {
  const { t, localeTag } = useLocale()
  const [stage, setStage] = useState<Stage>("figures")
  const [mode, setMode] = useState<Mode>("point")
  /** The kind in hand: every tap marks with it, like a brush. */
  const [kind, setKind] = useState<BodyMarkTone>("pain")
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [history, setHistory] = useState<Draft[]>([])
  const [liveStroke, setLiveStroke] = useState<FigureStroke | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  /** The area broken down into its parts, if any. Opening marks nothing. */
  const [openArea, setOpenArea] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState("")
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [pending, setPending] = useState<Pending>(null)

  const figureRefs = useRef<Record<BodyMapView, SVGSVGElement | null>>({ front: null, back: null })
  const [helpOpen, setHelpOpen] = useState(false)
  const drawing = useRef<{ pointer: number; stroke: FigureStroke } | null>(null)
  const pressAt = useRef<{ x: number; y: number } | null>(null)
  const penSeen = useRef(false)

  const openMark = marks.find((m) => m.id === openId) ?? null
  const open = openArea ? areaById(openArea) : null

  // On a tablet held upright the parts list sits under the figures, past the
  // fold. An area opened there brings its list just into view — never further,
  // so the figure being tapped stays where the finger is.
  const partsRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!openArea || !partsRef.current) return
    if (!window.matchMedia("(pointer: coarse)").matches) return
    partsRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [openArea])


  const remember = () => setHistory((h) => [...h.slice(-49), draft])
  const undo = () => {
    if (!history.length) return
    setDraft(history[history.length - 1])
    setHistory(history.slice(0, -1))
  }

  /** The mark in hand: the saved one opened from the list, or the one being made. */
  const focusRegions = openMark ? openMark.regions : draft.regions
  const focusSpine = openMark ? openMark.vertebrae : draft.vertebrae
  const colorOf = (id: string) =>
    openMark ? placeColor(openMark, id) : TONE_COLOR[draft.kinds[id] ?? kind]
  const regionColors = new Map(focusRegions.map((id) => [id, colorOf(id)] as const))
  const spineColors = new Map(focusSpine.map((id) => [id, colorOf(id)] as const))
  const emphasis = useMemo(() => new Set([...focusRegions, ...focusSpine]), [focusRegions, focusSpine])

  /* ── Pointer: open, mark, draw ────────────────────────────────────────── */

  /** A screen point as the figure's own pixels. */
  const toFigure = (view: BodyMapView, clientX: number, clientY: number) => {
    const el = figureRefs.current[view]
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const { width, height } = FIGURES[view]
    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height,
    }
  }

  /** What a point names: a part inside the open area, otherwise the area. */
  const hitAt = (view: BodyMapView, x: number, y: number) => {
    const part = partAt(view, x, y)
    if (!part) return undefined
    return part.areaId === openArea ? part.id : part.areaId
  }

  const toggleRegion = (id: string) => {
    // A tap on something chosen unchooses it: the gesture that chose it is the
    // obvious one for changing your mind.
    remember()
    setDraft((d) => {
      const next = tapPlace(d.regions, d.kinds, id, kind)
      return { ...d, regions: next.list, kinds: next.kinds }
    })
  }

  const isDrawPress = (e: React.PointerEvent) => {
    if (mode !== "pen") return false
    if (e.button !== 0 && e.pointerType === "mouse") return false
    // Once a stylus has been used, a finger is the hand steadying the tablet.
    if (e.pointerType === "touch" && penSeen.current) return false
    return true
  }

  const onPointerDown = (view: BodyMapView) => (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "pen") penSeen.current = true
    if (!isDrawPress(e)) {
      pressAt.current = { x: e.clientX, y: e.clientY }
      return
    }
    if (drawing.current) return
    const p = toFigure(view, e.clientX, e.clientY)
    if (!p) return
    // Once per stroke: the whole line comes back as one.
    remember()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* keep drawing without capture */
    }
    const stroke: FigureStroke = { view, points: [[p.x, p.y]] }
    drawing.current = { pointer: e.pointerId, stroke }
    setLiveStroke(stroke)
  }

  const onPointerMove = (view: BodyMapView) => (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toFigure(view, e.clientX, e.clientY)
    if (!p) return
    const current = drawing.current
    if (current && current.pointer === e.pointerId) {
      current.stroke = { view, points: [...current.stroke.points, [p.x, p.y]] }
      setLiveStroke(current.stroke)
      return
    }
    const id = hitAt(view, p.x, p.y) ?? null
    // Only when it changes: a state write per move re-renders the figures.
    setHovered((prev) => (prev === id ? prev : id))
  }

  const onPointerUp = (view: BodyMapView) => (e: React.PointerEvent<SVGSVGElement>) => {
    const current = drawing.current
    if (current && current.pointer === e.pointerId) {
      drawing.current = null
      setLiveStroke(null)
      const pts = current.stroke.points
      if (pts.length > 1) {
        const { width, height } = FIGURES[view]
        // The path's two ends, as the most precise thing under each.
        const first = partAt(view, pts[0][0], pts[0][1])
        const last = partAt(view, pts[pts.length - 1][0], pts[pts.length - 1][1])
        const finished: FigureStroke = {
          view,
          // Fractions of the figure, so a line survives any size.
          points: pts.map(([x, y]) => [
            Math.round((x / width) * 10000) / 10000,
            Math.round((y / height) * 10000) / 10000,
          ]),
          from: first?.id,
          to: last?.id,
          kind,
        }
        setDraft((d) => ({ ...d, strokes: [...d.strokes, finished] }))
      }
      return
    }

    if (!pressAt.current || e.type !== "pointerup" || mode !== "point") {
      pressAt.current = null
      return
    }
    const moved = Math.hypot(e.clientX - pressAt.current.x, e.clientY - pressAt.current.y)
    pressAt.current = null
    if (moved > 8) return
    const p = toFigure(view, e.clientX, e.clientY)
    const part = p ? partAt(view, p.x, p.y) : null
    // Outside the body: close whatever is open. Nothing marked is lost.
    if (!part) {
      setOpenArea(null)
      return
    }
    // The first tap on an area opens it, and only opens it.
    if (part.areaId !== openArea) {
      setOpenArea(part.areaId)
      return
    }
    // Inside the open area, a tap marks the part under it.
    toggleRegion(part.id)
  }

  const toggleSpine = (item: string) => {
    remember()
    setDraft((d) => {
      const next = tapPlace(d.vertebrae, d.kinds, item, kind)
      return { ...d, vertebrae: sortSpine(next.list), kinds: next.kinds }
    })
  }

  const removeItem = (item: string) => {
    remember()
    setDraft((d) => {
      const kinds = { ...d.kinds }
      delete kinds[item]
      return {
        ...d,
        regions: d.regions.filter((r) => r !== item),
        vertebrae: d.vertebrae.filter((v) => v !== item),
        kinds,
      }
    })
  }

  const removeStroke = (index: number) => {
    remember()
    setDraft((d) => ({ ...d, strokes: d.strokes.filter((_, i) => i !== index) }))
  }

  /* ── Saving ───────────────────────────────────────────────────────────── */

  const hasDraft = draft.regions.length > 0 || draft.vertebrae.length > 0 || draft.strokes.length > 0

  const save = () => {
    if (!hasDraft) return
    const used = [...Object.values(draft.kinds), ...draft.strokes.flatMap((s) => (s.kind ? [s.kind] : []))]
    onSave({
      regions: draft.regions,
      vertebrae: draft.vertebrae,
      strokes: draft.strokes,
      kinds: draft.kinds,
      tones: TONES.filter((v) => used.includes(v)),
      note: draft.note.trim() || undefined,
    })
    setDraft(EMPTY)
    setHistory([])
    setOpenArea(null)
  }

  /*
   * A mark nobody pressed "save" on is still a finding. It is kept when the
   * session closes, when the page is left and when the tablet switches away —
   * the three ways a chart is put down.
   */
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const flush = () => saveRef.current()
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener(BODY_MAP_FLUSH_EVENT, flush)
    document.addEventListener("visibilitychange", onHidden)
    return () => {
      window.removeEventListener(BODY_MAP_FLUSH_EVENT, flush)
      document.removeEventListener("visibilitychange", onHidden)
      flush()
    }
  }, [])

  /* ── Words ────────────────────────────────────────────────────────────── */

  const pathText = (s: FigureStroke) => {
    if (!s.from && !s.to) return null
    if (!s.from || !s.to || s.from === s.to) {
      return t("bodyMap.pathSingle", { where: regionLabel(t, (s.from ?? s.to)!) })
    }
    return t("bodyMap.path", { from: regionLabel(t, s.from), to: regionLabel(t, s.to) })
  }

  /**
   * One line for a saved mark: grouped, each name once, and — on marks whose
   * places have their own kind — a dot of that kind before each name.
   */
  const summary = (m: BodyMark) => {
    const g = groupBySide(m.regions)
    const dot = (id: string) => (m.kinds ? placeColor(m, id) : undefined)
    const groups: { key: string; label: string; items: { key: string; text: string; color?: string }[] }[] = []
    for (const side of ["r", "l", "mid"] as const) {
      if (g[side].length) {
        groups.push({
          key: side,
          label: t(`bodyMap.group.${side}`),
          items: g[side].map((id) => ({ key: id, text: itemName(t, id), color: dot(id) })),
        })
      }
    }
    if (m.vertebrae.length) {
      groups.push({
        key: "spine",
        label: t("bodyMap.group.spine"),
        items: m.vertebrae.map((v) => ({ key: v, text: spineLabel(t, v), color: dot(v) })),
      })
    }
    m.strokes.forEach((s, i) => {
      const text = pathText(s)
      if (text) {
        groups.push({
          key: `path-${i}`,
          label: t("bodyMap.group.path"),
          items: [{ key: "line", text, color: s.kind ? TONE_COLOR[s.kind] : undefined }],
        })
      }
    })
    if (!groups.length) return t("bodyMap.drawingOnly")
    return groups.map((group, gi) => (
      <span key={group.key}>
        {gi > 0 && " · "}
        {group.label}:{" "}
        {group.items.map((item, i) => (
          <span key={item.key}>
            {i > 0 && ", "}
            {item.color && (
              <span
                className="me-1 inline-block size-2 rounded-full align-middle"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
            )}
            {item.text}
          </span>
        ))}
      </span>
    ))
  }

  /** A part's own name, with its side when the area itself has none (T4 ימין). */
  const partButtonLabel = (id: string) => {
    const side = sideOf(id)
    const areaSided = id.split("/")[0].includes(":")
    const name = partLabel(t, id)
    return side && !areaSided ? `${name} ${t(`bodyMap.side.${side}`)}` : name
  }

  const itemCount = draft.regions.length + draft.vertebrae.length + draft.strokes.length
  const headline = hovered
    ? regionLabel(t, hovered)
    : open
      ? regionLabel(t, open.id)
      : hasDraft
        ? t("bodyMap.count", { n: itemCount })
        : "—"

  const confirmPending = () => {
    if (!pending) return
    if (pending.kind === "clear") {
      remember()
      setDraft(EMPTY)
    } else {
      onDelete(pending.id)
      setOpenId(null)
    }
    setPending(null)
  }

  const toggleOpen = (m: BodyMark) => {
    if (openId === m.id) {
      setOpenId(null)
      return
    }
    setOpenId(m.id)
    setEditNote(m.note ?? "")
  }

  /* ── Drawing a figure ─────────────────────────────────────────────────── */

  const strokesFor = (view: BodyMapView) => {
    const { width, height } = FIGURES[view]
    const scale = (s: FigureStroke) => s.points.map(([x, y]) => `${x * width},${y * height}`).join(" ")
    const out: { key: string; points: string; color: string }[] = []
    // Like the colour: the opened saved mark, otherwise the one being made. A
    // line takes its kind's colour; one drawn before lines had a kind is ink.
    const ink = (s: FigureStroke) => (s.kind ? TONE_COLOR[s.kind] : INK)
    openMark?.strokes.forEach((s, i) => {
      if (s.view === view) out.push({ key: `${openMark.id}-${i}`, points: scale(s), color: ink(s) })
    })
    if (!openMark) draft.strokes.forEach((s, i) => {
      if (s.view === view) out.push({ key: `draft-${i}`, points: scale(s), color: ink(s) })
    })
    if (liveStroke?.view === view) {
      out.push({
        key: "live",
        points: liveStroke.points.map(([x, y]) => `${x},${y}`).join(" "),
        color: TONE_COLOR[kind],
      })
    }
    return out
  }

  /** The spine's marked items, shown on the back figure's midline. */
  const spineMarkers = () =>
    [...spineColors.entries()].flatMap(([item, color]) => {
      const band = LEVEL_Y[levelOf(item)]
      if (!band) return []
      const [y0, y1] = band
      const side = item.endsWith(" R") ? "R" : item.endsWith(" L") ? "L" : null
      const isDisc = item.includes("/")
      // From behind, the patient's right is on our right.
      const x = side === "R" ? MIDLINE + 3 : side === "L" ? MIDLINE - 15 : MIDLINE - 7
      const w = side ? 12 : 14
      const y = isDisc ? y1 - 2 : y0 + 1
      const h = isDisc ? 4 : Math.max(3, y1 - y0 - 2)
      return [{ item, color, x, y, w, h }]
    })

  const figure = (view: BodyMapView) => {
    const fig = FIGURES[view]
    const viewBox = `0 0 ${fig.width} ${fig.height}`
    // Two layers are added together: the colour shows on either drawing.
    const masks = [fig.src, fig.overlay].filter(Boolean).map((src) => `url(${src})`).join(", ")
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed local figure, drawn over at its own pixel size */}
        <img
          src={fig.src}
          width={fig.width}
          height={fig.height}
          alt={t(`bodyMap.figureAlt.${view}`)}
          draggable={false}
          className="pointer-events-none block h-auto w-full"
        />
        {fig.overlay && (
          // eslint-disable-next-line @next/next/no-img-element -- drawn over the figure at the same size
          <img
            src={fig.overlay}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        )}
        {/* The colour, clipped to the figure's own outline (and its overlay's). */}
        <svg
          viewBox={viewBox}
          className="pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply"
          style={{
            WebkitMaskImage: masks,
            maskImage: masks,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
          aria-hidden
        >
          {AREAS[view].map((area) => {
            const areaColor = regionColors.get(area.id)
            const isOpen = area.id === openArea
            const areaHover = area.id === hovered && !areaColor && !isOpen
            return area.parts.map((part) => {
              // A part marked on its own wins over the area's colour.
              const partColor = part.id !== area.id ? regionColors.get(part.id) : undefined
              const color = partColor ?? areaColor
              const partHover = isOpen && part.id === hovered && !color
              if (!color && !areaHover && !partHover && !isOpen) return null
              const strong = emphasis.has(part.id) || emphasis.has(area.id)
              return (
                <polygon
                  key={part.id}
                  points={part.points}
                  fill={color ?? (partHover || areaHover ? HOVER_COLOR : OPEN_COLOR)}
                  fillOpacity={color ? (strong ? 0.6 : 0.4) : partHover || areaHover ? 0.28 : 0.08}
                  // The open area's parts are outlined, so a tap's target is
                  // visible before it is made.
                  stroke={isOpen && area.breaksDown ? "#0f172a" : "none"}
                  strokeOpacity={0.45}
                  strokeWidth={0.7}
                />
              )
            })
          })}
        </svg>
        <svg
          ref={(el) => {
            figureRefs.current[view] = el
          }}
          viewBox={viewBox}
          // A finger may scroll the page past the figures; only the pen needs
          // every movement for itself.
          className={`absolute inset-0 h-full w-full ${mode === "pen" ? "touch-none" : "touch-manipulation"}`}
          style={{ cursor: mode === "pen" ? "crosshair" : "pointer" }}
          onPointerDown={onPointerDown(view)}
          onPointerMove={onPointerMove(view)}
          onPointerUp={onPointerUp(view)}
          onPointerCancel={onPointerUp(view)}
          onPointerLeave={() => setHovered(null)}
          role="img"
          aria-label={t(`bodyMap.figureAlt.${view}`)}
        >
          {view === "back" &&
            spineMarkers().map((m) => (
              <rect
                key={m.item}
                x={m.x}
                y={m.y}
                width={m.w}
                height={m.h}
                rx={2}
                fill={m.color}
                fillOpacity={emphasis.has(m.item) ? 0.9 : 0.7}
                stroke="#ffffff"
                strokeWidth={0.75}
              />
            ))}
          {strokesFor(view).map((s) => (
            <polyline
              key={s.key}
              points={s.points}
              fill="none"
              stroke={s.color}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </>
    )
  }

  const draftGroups = groupBySide(draft.regions)

  const chip = (key: string, label: string, onRemove: () => void, onOpen?: () => void, color?: string) => (
    <span
      key={key}
      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 pointer-coarse:py-1.5 pointer-coarse:text-sm"
    >
      {color && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
      {onOpen ? (
        <button type="button" onClick={onOpen} className="hover:text-sky-700">
          {label}
        </button>
      ) : (
        label
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("bodyMap.remove", { name: label })}
        className="text-slate-400 transition-colors hover:text-rose-600 pointer-coarse:-my-1.5 pointer-coarse:-me-1.5 pointer-coarse:p-1.5"
      >
        <X className="size-3 pointer-coarse:size-4" aria-hidden />
      </button>
    </span>
  )

  const row = (label: string, children: React.ReactNode) => (
    <div key={label} className="flex items-start gap-2">
      <span className="mt-1 w-16 shrink-0 text-[11px] font-bold text-slate-500">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{children}</div>
    </div>
  )

  return (
    /*
     * Side by side only on a wide screen. The chart's column is narrow enough
     * that beside the panel the figures came out 160px wide, so below 2xl the
     * panel goes underneath and the figures take the width.
     */
    /*
     * A tablet on its side is too short for the figures and the panel one
     * above the other: an area opened there listed its parts off the screen.
     * There the figures fit the height and the panel stands beside them.
     */
    <div
      className={`grid gap-4 2xl:grid-cols-[3fr_2fr] ${
        stage === "figures" ? "pointer-coarse:landscape:grid-cols-[auto_minmax(0,1fr)]" : ""
      }`}
    >
      {/* ── The figures ───────────────────────────────────────────────────── */}
      <div className="relative min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
            {STAGES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStage(value)
                  setHovered(null)
                }}
                aria-pressed={stage === value}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors pointer-coarse:px-4 pointer-coarse:py-2.5 pointer-coarse:text-sm ${
                  stage === value ? "bg-sky-700 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t(`bodyMap.stage.${value}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {/* What a touch does. The spine model has one tool: a tap. */}
            {stage === "figures" && (
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
                {(
                  [
                    ["point", "bodyMap.mode.point"],
                    ["pen", "bodyMap.mode.pen"],
                  ] as const
                ).map(([value, labelKey]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    aria-pressed={mode === value}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors pointer-coarse:px-4 pointer-coarse:py-2.5 pointer-coarse:text-sm ${
                      mode === value ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            )}
            {history.length > 0 && (
              <button
                type="button"
                onClick={undo}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 pointer-coarse:px-4 pointer-coarse:py-2.5 pointer-coarse:text-sm"
              >
                <Undo2 className="size-3.5 rtl:-scale-x-100" aria-hidden />
                {t("bodyMap.undo")}
              </button>
            )}
          </div>
        </div>

        {stage === "figures" ? (
          <div className="grid grid-cols-2 gap-3">
            {VIEWS.map((view) => (
              <figure key={view} className="m-0 flex min-w-0 flex-col items-center gap-1">
                <figcaption className="text-xs font-semibold text-slate-500">
                  {t(`bodyMap.view.${view}`)}
                </figcaption>
                {/* 0.38 is the figure's width over its height. */}
                <div className="relative w-full max-w-[300px] select-none pointer-coarse:landscape:w-[max(180px,calc((100dvh-280px)*0.38))]">
                  {figure(view)}
                </div>
              </figure>
            ))}
          </div>
        ) : (
          <SpineChart colors={spineColors} selected={draft.vertebrae} onToggle={toggleSpine} />
        )}

        {stage === "figures" && (
          <p className="mt-2 text-center text-[11px] font-medium text-slate-500">
            {t(mode === "pen" ? "bodyMap.hint.pen" : "bodyMap.hint.point")}
          </p>
        )}
        {/* For the practitioner who cannot find something: where each thing is. */}
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            aria-expanded={helpOpen}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50 pointer-coarse:py-2.5 pointer-coarse:text-sm"
          >
            <CircleHelp className="size-4" aria-hidden />
            {t("bodyMap.help.title")}
          </button>
        </div>
        {helpOpen && (
          <ul className="mt-1 grid list-disc gap-1.5 rounded-xl bg-slate-50 py-3 pe-3 ps-7 text-[13px] leading-snug text-slate-700">
            {HELP.map((key) => (
              <li key={key}>
                <Rich text={t(`bodyMap.help.${key}`)} />
              </li>
            ))}
          </ul>
        )}
        {/* CC BY 4.0 requires the credit wherever the figures are shown. */}
        <p className="mt-1 text-center text-[10px] text-slate-400">
          {t("bodyMap.credit")}{" "}
          <a href="https://smart.servier.com/" target="_blank" rel="noopener noreferrer" className="underline">
            Servier Medical Art
          </a>{" "}
          · CC BY 4.0
        </p>
      </div>

      {/* ── What is being marked, and what it says ────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-3">
        {/* What the pointer is on, or the area open, or how much is marked —
            never the whole list again: that is in the card below. */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {hovered || open ? t("bodyMap.underCursor") : t("bodyMap.marked")}
          </p>
          <p className="mt-0.5 break-words text-lg font-bold leading-snug text-sky-800">{headline}</p>
        </div>

        {/* The open area: the whole of it, or any part, one tap each. */}
        {open && stage === "figures" && (
          <div ref={partsRef} className="scroll-mb-28 rounded-2xl border-2 border-sky-200 bg-sky-50/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 text-sm font-bold text-sky-900">{regionLabel(t, open.id)}</p>
              <button
                type="button"
                onClick={() => setOpenArea(null)}
                aria-label={t("bodyMap.parts.close")}
                className="flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-700 pointer-coarse:size-10"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[open.id, ...open.parts.filter((p) => p.id !== open.id).map((p) => p.id)].map((id) => {
                const on = draft.regions.includes(id)
                const whole = id === open.id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleRegion(id)}
                    aria-pressed={on}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors pointer-coarse:px-3.5 pointer-coarse:py-2.5 pointer-coarse:text-sm ${
                      on
                        ? "border-transparent text-white"
                        : whole
                          ? "border-sky-300 bg-white text-sky-900 hover:bg-sky-50"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    style={on ? { backgroundColor: TONE_COLOR[draft.kinds[id] ?? kind] } : undefined}
                  >
                    {whole ? t("bodyMap.parts.whole") : partButtonLabel(id)}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* The kind in hand. Each tap marks with it, so one mark can hold a
            painful spot, a nerve path and a stiff level, each in its colour. */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {t("bodyMap.kind.title")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {TONES.map((value) => {
              const on = kind === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  aria-pressed={on}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-2 py-2 text-sm font-medium leading-tight transition-colors pointer-coarse:py-3 ${
                    on ? "bg-white text-slate-900" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                  style={on ? { borderColor: TONE_COLOR[value] } : undefined}
                >
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: TONE_COLOR[value] }} aria-hidden />
                  {t(`bodyMap.tone.${value}`)}
                </button>
              )
            })}
          </div>
        </div>

        {hasDraft && (
          <div className="rounded-2xl border-2 border-slate-300 bg-slate-50/60 p-4">
            <div className="mb-3 grid gap-2">
              {(["r", "l", "mid"] as const).map((side) =>
                draftGroups[side].length
                  ? row(
                      t(`bodyMap.group.${side}`),
                      draftGroups[side].map((id) =>
                        chip(
                          id,
                          itemName(t, id),
                          () => removeItem(id),
                          () => {
                            setStage("figures")
                            setOpenArea(id.split("/")[0])
                          },
                          TONE_COLOR[draft.kinds[id] ?? kind],
                        ),
                      ),
                    )
                  : null,
              )}
              {draft.vertebrae.length > 0 &&
                row(
                  t("bodyMap.group.spine"),
                  draft.vertebrae.map((v) =>
                    chip(v, spineLabel(t, v), () => removeItem(v), () => setStage("spine"), TONE_COLOR[draft.kinds[v] ?? kind]),
                  ),
                )}
              {draft.strokes.some((s) => pathText(s)) &&
                row(
                  t("bodyMap.group.path"),
                  draft.strokes.map((s, i) => {
                    const text = pathText(s)
                    return text
                      ? chip(`path-${i}`, text, () => removeStroke(i), undefined, s.kind ? TONE_COLOR[s.kind] : INK)
                      : null
                  }),
                )}
            </div>
            <label
              htmlFor="body-mark-note"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
            >
              {t("bodyMap.noteOnMark")}
            </label>
            <textarea
              id="body-mark-note"
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              rows={2}
              placeholder={t("bodyMap.notePlaceholder")}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {t("bodyMap.saveMark")}
              </button>
              <button
                type="button"
                onClick={() => setPending({ kind: "clear" })}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
              >
                {t("bodyMap.clear")}
              </button>
            </div>
          </div>
        )}

        {marks.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {t("bodyMap.saved")}
            </p>
            <ul className="space-y-2">
              {marks.map((m) => {
                const isOpen = openId === m.id
                const kinds = markTones(m)
                return (
                  <li
                    key={m.id}
                    className={`overflow-hidden rounded-xl border ${isOpen ? "border-slate-300 bg-slate-50/60" : "border-slate-100"}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleOpen(m)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-start"
                    >
                      <span className="mt-1.5 flex shrink-0 gap-0.5" aria-hidden>
                        {(m.kinds && kinds.length ? kinds.map((v) => TONE_COLOR[v]) : [toneColor(kinds)]).map((c) => (
                          <span key={c} className="size-2.5 rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug text-slate-800">{summary(m)}</span>
                        {!isOpen && m.note && (
                          <span className="mt-0.5 block truncate text-xs text-slate-600">{m.note}</span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          {kinds.length
                            ? kinds.map((v) => t(`bodyMap.tone.${v}`)).join(" + ")
                            : t("bodyMap.tone.unclassified")}
                          {" · "}
                          {new Date(m.createdAt).toLocaleString(localeTag)}
                        </span>
                      </span>
                      <ChevronDown
                        className={`mt-0.5 size-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-200 px-3 py-3">
                        {/* Older marks have one kind for all of it, and it can be
                            changed here. Newer ones carry a kind per place. */}
                        {!m.kinds && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {TONES.map((value) => {
                            const on = kinds.includes(value)
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() =>
                                  onUpdateTones(m.id, on ? kinds.filter((v) => v !== value) : [...kinds, value])
                                }
                                aria-pressed={on}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                                  on ? "border-slate-900 text-slate-900" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                                }`}
                              >
                                <span className="size-2.5 rounded-full" style={{ backgroundColor: TONE_COLOR[value] }} aria-hidden />
                                {t(`bodyMap.tone.${value}`)}
                              </button>
                            )
                          })}
                        </div>
                        )}
                        <label
                          htmlFor={`body-note-${m.id}`}
                          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400"
                        >
                          {t("bodyMap.note")}
                        </label>
                        <textarea
                          id={`body-note-${m.id}`}
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          rows={2}
                          placeholder={t("bodyMap.notePlaceholder")}
                          className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onUpdateNote(m.id, editNote.trim())}
                            disabled={editNote.trim() === (m.note ?? "")}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                          >
                            {t("bodyMap.saveNote")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPending({ kind: "delete", id: m.id })}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                          >
                            {t("bodyMap.deleteMark")}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* The skeleton's findings. Bone names are the anatomy they were
            written as, so they are shown as written, and nothing here edits
            them: the tool that made them is gone. */}
        {legacyMarks.length > 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-3">
            <button
              type="button"
              onClick={() => setLegacyOpen((v) => !v)}
              aria-expanded={legacyOpen}
              className="flex w-full items-center gap-2 text-start text-xs font-semibold text-slate-600"
            >
              {t("bodyMap.legacyTitle", { n: legacyMarks.length })}
              <ChevronDown
                className={`ms-auto size-4 text-slate-400 transition-transform ${legacyOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {legacyOpen && (
              <ul className="mt-2 space-y-1.5">
                {legacyMarks.map((m) => (
                  <li key={m.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                    <span dir="ltr" className="block font-mono text-xs font-semibold text-slate-700">
                      {m.bones.join(" · ") || "—"}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {markTones(m).length
                        ? markTones(m)
                            .map((v) => t(`bodyMap.tone.${v}`))
                            .join(" + ")
                        : t("bodyMap.tone.unclassified")}
                      {" · "}
                      {new Date(m.createdAt).toLocaleString(localeTag)}
                    </span>
                    {m.note && <span className="mt-0.5 block text-xs text-slate-600">{m.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Anything that loses work asks first: deleting a saved mark, and Clear,
          which takes the areas, the spine, the drawing and the note at once. */}
      <Dialog open={pending !== null} onOpenChange={(isOpen) => !isOpen && setPending(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t(pending?.kind === "delete" ? "bodyMap.confirm.deleteTitle" : "bodyMap.confirm.clearTitle")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {t(pending?.kind === "delete" ? "bodyMap.confirm.deleteBody" : "bodyMap.confirm.clearBody")}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmPending}>
              {t(pending?.kind === "delete" ? "bodyMap.deleteMark" : "bodyMap.clear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
