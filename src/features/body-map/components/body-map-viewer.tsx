"use client"

import dynamic from "next/dynamic"
import { ChevronDown, Maximize2, Minus, Plus, Scan, Undo2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { BODY_MAP_FLUSH_EVENT } from "../lib/flush-event"
import {
  FIGURES,
  LEVEL_Y,
  MIDLINE,
  REGIONS,
  SUBREGIONS,
  levelOf,
  regionAt,
  regionLabel,
  sortSpine,
  spineLabel,
  subRegionAt,
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

/** three.js arrives when the spine is opened, not with every chart. */
const SpineViewer = dynamic(() => import("./spine-viewer").then((m) => m.SpineViewer), {
  ssr: false,
  loading: () => <div className="h-[620px] rounded-xl bg-slate-50" aria-hidden />,
})

/**
 * The body map: two figures, front and back, marked by area, and the spine.
 *
 * It replaced a rotatable skeleton that was precise and slow: a finding meant
 * turning the model to the angle that showed it. A practitioner thinks in
 * areas ("right buttock, down the back of the thigh") and in spinal levels,
 * so those are what a mark is made of.
 *
 * Three ways to look, one record:
 *
 *  - **Both figures** side by side, marked by area: the quick way.
 *  - **One figure, opened up**: zoom and pan, and every area splits into
 *    smaller parts (L4 on the right, the upper outer thigh). For when the
 *    finding is more precise than an area.
 *  - **The spine** as a model: a level, its side, the disc below it. What is
 *    chosen there shows on the back figure's midline too.
 *
 * Two tools throughout: a tap names, the pen outlines. A pen line also names
 * every area or part it crosses, so a drawing is never only a picture.
 */

type Mode = "pen" | "point"
type Stage = "both" | BodyMapView | "spine"

const TONE_COLOR: Record<BodyMarkTone, string> = {
  pain: "#dc2626",
  nerve: "#eab308",
}
/** A spot that is both gets its own colour rather than one of the two. */
const BOTH_COLOR = "#ea580c"
/** Marks made before a finding had a kind. Shown as itself, never guessed at. */
const UNCLASSIFIED_COLOR = "#94a3b8"
const HOVER_COLOR = "#0ea5e9"
const INK = "#111827"

const toneColor = (tones: BodyMarkTone[]) => {
  if (tones.length > 1) return BOTH_COLOR
  if (tones.length === 1) return TONE_COLOR[tones[0]]
  return UNCLASSIFIED_COLOR
}

const TONES: BodyMarkTone[] = ["pain", "nerve"]
const VIEWS: BodyMapView[] = ["front", "back"]
const STAGES: Stage[] = ["both", "front", "back", "spine"]

/** How tall the opened-up figure's window is, and how far it zooms. */
const FOCUS_HEIGHT = 640
const MIN_ZOOM = 1
const MAX_ZOOM = 6

/** What Undo restores: a snapshot, so "put it back exactly" cannot drift. */
interface Draft {
  regions: string[]
  vertebrae: string[]
  strokes: FigureStroke[]
  note: string
}
const EMPTY: Draft = { regions: [], vertebrae: [], strokes: [], note: "" }

type Pending = { kind: "clear" } | { kind: "delete"; id: string } | null

interface Zoom {
  s: number
  tx: number
  ty: number
}

/** The colour every named thing takes: saved findings, then the one in focus on top. */
function colourMap(
  marks: BodyMark[],
  pick: (m: BodyMark) => string[],
  focus: string[],
  focusColor: string,
) {
  const tonesBy = new Map<string, Set<BodyMarkTone>>()
  for (const m of marks) {
    for (const id of pick(m)) {
      const set = tonesBy.get(id) ?? new Set<BodyMarkTone>()
      for (const v of markTones(m)) set.add(v)
      tonesBy.set(id, set)
    }
  }
  const map = new Map<string, string>()
  for (const [id, set] of tonesBy) map.set(id, toneColor([...set]))
  for (const id of focus) map.set(id, focusColor)
  return map
}

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
  const [stage, setStage] = useState<Stage>("both")
  const [mode, setMode] = useState<Mode>("point")
  const [tones, setTones] = useState<BodyMarkTone[]>(["pain"])
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [history, setHistory] = useState<Draft[]>([])
  const [liveStroke, setLiveStroke] = useState<FigureStroke | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState("")
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  const [zoom, setZoom] = useState<Zoom>({ s: 1, tx: 0, ty: 0 })
  const [viewportWidth, setViewportWidth] = useState(0)

  const figureRefs = useRef<Record<BodyMapView, SVGSVGElement | null>>({ front: null, back: null })
  const viewportRef = useRef<HTMLDivElement>(null)
  const drawing = useRef<{ pointer: number; stroke: FigureStroke } | null>(null)
  const pressAt = useRef<{ x: number; y: number } | null>(null)
  const penSeen = useRef(false)
  /** Fingers on the opened-up figure, for pinching. */
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; from: Zoom } | null>(null)
  const pan = useRef<{ x: number; y: number; from: Zoom; moved: boolean } | null>(null)

  const focusView: BodyMapView | null = stage === "front" || stage === "back" ? stage : null
  const fine = focusView !== null

  const openMark = marks.find((m) => m.id === openId) ?? null
  const highlight = openMark ? toneColor(markTones(openMark)) : toneColor(tones)

  const toggleTone = (value: BodyMarkTone) =>
    setTones((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))

  const remember = () => setHistory((h) => [...h.slice(-49), draft])
  const undo = () => {
    if (!history.length) return
    setDraft(history[history.length - 1])
    setHistory(history.slice(0, -1))
  }

  /**
   * Every saved finding coloured the moment the chart opens, and the one being
   * made or read on top. Something marked pain in one finding and nerve in
   * another takes the colour of both.
   */
  const focusRegions = openMark ? openMark.regions : draft.regions
  const focusSpine = openMark ? openMark.vertebrae : draft.vertebrae
  const regionColors = useMemo(
    () => colourMap(marks, (m) => m.regions, focusRegions, highlight),
    [marks, focusRegions, highlight],
  )
  const spineColors = useMemo(
    () => colourMap(marks, (m) => m.vertebrae, focusSpine, highlight),
    [marks, focusSpine, highlight],
  )
  const emphasis = useMemo(() => new Set([...focusRegions, ...focusSpine]), [focusRegions, focusSpine])

  /* ── Opening a figure up ──────────────────────────────────────────────── */

  // The window's width decides where "fit" puts the figure.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setViewportWidth(el.clientWidth))
    observer.observe(el)
    setViewportWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [focusView])

  const baseWidth = focusView
    ? (FOCUS_HEIGHT * FIGURES[focusView].width) / FIGURES[focusView].height
    : 0
  const fit = useCallback(
    (): Zoom => ({ s: 1, tx: Math.max(0, (viewportWidth - baseWidth) / 2), ty: 0 }),
    [viewportWidth, baseWidth],
  )
  useEffect(() => {
    if (focusView) setZoom(fit())
  }, [focusView, fit])

  /** Zoom around a point in the window, keeping what is under it where it is. */
  const zoomAt = useCallback((px: number, py: number, nextScale: number) => {
    setZoom((z) => {
      const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextScale))
      const cx = (px - z.tx) / z.s
      const cy = (py - z.ty) / z.s
      return { s, tx: px - cx * s, ty: py - cy * s }
    })
  }, [])

  // A wheel listener React would register as passive, which cannot stop the
  // page scrolling under the figure. So it is attached by hand.
  useEffect(() => {
    const el = viewportRef.current
    if (!el || !focusView) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      setZoom((z) => {
        const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z.s * Math.exp(-e.deltaY * 0.0015)))
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        const cx = (px - z.tx) / z.s
        const cy = (py - z.ty) / z.s
        return { s, tx: px - cx * s, ty: py - cy * s }
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [focusView])

  const zoomButton = (factor: number) => {
    const el = viewportRef.current
    if (!el) return
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, zoom.s * factor)
  }

  const goTo = (next: Stage) => {
    setStage(next)
    setHovered(null)
  }

  /* ── Pointer: tap, pen, pan and pinch ─────────────────────────────────── */

  /** A screen point as the figure's own pixels. Right at any zoom. */
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

  const hitAt = (view: BodyMapView, x: number, y: number) =>
    (fine ? subRegionAt(view, x, y) : null)?.id ?? regionAt(view, x, y)?.id

  const addRegion = useCallback((id: string | undefined) => {
    if (!id) return
    setDraft((d) => (d.regions.includes(id) ? d : { ...d, regions: [...d.regions, id] }))
  }, [])

  const abandonStroke = () => {
    drawing.current = null
    setLiveStroke(null)
  }

  const isDrawPress = (e: React.PointerEvent) => {
    if (mode !== "pen") return false
    if (e.button !== 0 && e.pointerType === "mouse") return false
    // Once a stylus has been used, a finger is the hand steadying the tablet,
    // or moving the figure.
    if (e.pointerType === "touch" && penSeen.current) return false
    return true
  }

  const onPointerDown = (view: BodyMapView) => (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "pen") penSeen.current = true
    const viewport = viewportRef.current?.getBoundingClientRect()

    if (fine && e.pointerType === "touch") {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.current.size === 2 && viewport) {
        // A second finger: this is a pinch, and whatever the first one started
        // is not a tap or a line.
        abandonStroke()
        pressAt.current = null
        pan.current = null
        const [a, b] = [...touches.current.values()]
        pinch.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          mid: { x: (a.x + b.x) / 2 - viewport.left, y: (a.y + b.y) / 2 - viewport.top },
          from: zoom,
        }
        return
      }
    }

    if (isDrawPress(e)) {
      if (drawing.current) return
      const p = toFigure(view, e.clientX, e.clientY)
      if (!p) return
      // Once per stroke: the line and everything it crosses come back together.
      remember()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* keep drawing without capture */
      }
      const stroke: FigureStroke = { view, points: [[p.x, p.y]] }
      drawing.current = { pointer: e.pointerId, stroke }
      setLiveStroke(stroke)
      addRegion(hitAt(view, p.x, p.y))
      return
    }

    pressAt.current = { x: e.clientX, y: e.clientY }
    if (fine) {
      pan.current = { x: e.clientX, y: e.clientY, from: zoom, moved: false }
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* pan without capture */
      }
    }
  }

  const onPointerMove = (view: BodyMapView) => (e: React.PointerEvent<SVGSVGElement>) => {
    if (touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    const pinching = pinch.current
    const viewport = viewportRef.current?.getBoundingClientRect()
    if (pinching && touches.current.size >= 2 && viewport) {
      const [a, b] = [...touches.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2 - viewport.left, y: (a.y + b.y) / 2 - viewport.top }
      const from = pinching.from
      const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (from.s * dist) / pinching.dist))
      const cx = (pinching.mid.x - from.tx) / from.s
      const cy = (pinching.mid.y - from.ty) / from.s
      setZoom({ s, tx: mid.x - cx * s, ty: mid.y - cy * s })
      return
    }

    const current = drawing.current
    if (current && current.pointer === e.pointerId) {
      const p = toFigure(view, e.clientX, e.clientY)
      if (!p) return
      current.stroke = { view, points: [...current.stroke.points, [p.x, p.y]] }
      setLiveStroke(current.stroke)
      addRegion(hitAt(view, p.x, p.y))
      return
    }

    const panning = pan.current
    if (panning && e.buttons) {
      const dx = e.clientX - panning.x
      const dy = e.clientY - panning.y
      if (!panning.moved && Math.hypot(dx, dy) > 8) {
        panning.moved = true
        pressAt.current = null
      }
      if (panning.moved) {
        setZoom({ ...panning.from, tx: panning.from.tx + dx, ty: panning.from.ty + dy })
      }
      return
    }

    const p = toFigure(view, e.clientX, e.clientY)
    if (!p) return
    const id = hitAt(view, p.x, p.y) ?? null
    // Only when it changes: a state write per move re-renders the figure.
    setHovered((prev) => (prev === id ? prev : id))
  }

  const onPointerUp = (view: BodyMapView) => (e: React.PointerEvent<SVGSVGElement>) => {
    touches.current.delete(e.pointerId)
    if (pinch.current) {
      if (touches.current.size < 2) pinch.current = null
      return
    }

    const current = drawing.current
    if (current && current.pointer === e.pointerId) {
      drawing.current = null
      // Kept as fractions of the figure, so a line survives any zoom or size.
      const { width, height } = FIGURES[view]
      const finished: FigureStroke = {
        view,
        points: current.stroke.points.map(([x, y]) => [
          Math.round((x / width) * 10000) / 10000,
          Math.round((y / height) * 10000) / 10000,
        ]),
      }
      if (finished.points.length > 1) setDraft((d) => ({ ...d, strokes: [...d.strokes, finished] }))
      setLiveStroke(null)
      return
    }

    const panned = pan.current?.moved
    pan.current = null
    if (panned || !pressAt.current || e.type !== "pointerup" || mode !== "point") {
      pressAt.current = null
      return
    }
    const moved = Math.hypot(e.clientX - pressAt.current.x, e.clientY - pressAt.current.y)
    pressAt.current = null
    if (moved > 8) return
    const p = toFigure(view, e.clientX, e.clientY)
    const id = p ? hitAt(view, p.x, p.y) : undefined
    if (!id) return
    // A tap on something chosen unchooses it: the gesture that chose it is the
    // obvious one for changing your mind.
    remember()
    setDraft((d) => ({
      ...d,
      regions: d.regions.includes(id) ? d.regions.filter((r) => r !== id) : [...d.regions, id],
    }))
  }

  const toggleSpine = (item: string) => {
    remember()
    setDraft((d) => ({
      ...d,
      vertebrae: d.vertebrae.includes(item)
        ? d.vertebrae.filter((v) => v !== item)
        : sortSpine([...d.vertebrae, item]),
    }))
  }

  const removeItem = (item: string) => {
    remember()
    setDraft((d) => ({
      ...d,
      regions: d.regions.filter((r) => r !== item),
      vertebrae: d.vertebrae.filter((v) => v !== item),
    }))
  }

  /* ── Saving ───────────────────────────────────────────────────────────── */

  const hasDraft = draft.regions.length > 0 || draft.vertebrae.length > 0 || draft.strokes.length > 0

  const save = () => {
    if (!hasDraft) return
    onSave({
      regions: draft.regions,
      vertebrae: draft.vertebrae,
      strokes: draft.strokes,
      tones: tones.length ? tones : undefined,
      note: draft.note.trim() || undefined,
    })
    setDraft(EMPTY)
    setHistory([])
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

  const describe = (regions: string[], spine: string[]) =>
    [...regions.map((id) => regionLabel(t, id)), ...spine.map((v) => spineLabel(t, v))].join(" · ")

  const headline = hasDraft
    ? describe(draft.regions, draft.vertebrae) || t("bodyMap.drawingOnly")
    : openMark
      ? describe(openMark.regions, openMark.vertebrae) || t("bodyMap.drawingOnly")
      : hovered
        ? regionLabel(t, hovered)
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
    const out: { key: string; points: string; strong: boolean }[] = []
    for (const m of marks) {
      m.strokes.forEach((s, i) => {
        if (s.view === view) out.push({ key: `${m.id}-${i}`, points: scale(s), strong: m.id === openId })
      })
    }
    draft.strokes.forEach((s, i) => {
      if (s.view === view) out.push({ key: `draft-${i}`, points: scale(s), strong: true })
    })
    if (liveStroke?.view === view) {
      out.push({ key: "live", points: liveStroke.points.map(([x, y]) => `${x},${y}`).join(" "), strong: true })
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
        {/* The colour, clipped to the figure's own outline: the areas only
            partition the body, the picture traces it. */}
        <svg
          viewBox={viewBox}
          className="pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply"
          style={{
            WebkitMaskImage: `url(${fig.src})`,
            maskImage: `url(${fig.src})`,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
          }}
          aria-hidden
        >
          {REGIONS[view].map((r) => {
            const color = regionColors.get(r.id)
            const isHover = !fine && r.id === hovered && !color
            if (!color && !isHover) return null
            return (
              <polygon
                key={r.id}
                points={r.points}
                fill={color ?? HOVER_COLOR}
                fillOpacity={color ? (emphasis.has(r.id) ? 0.62 : 0.42) : 0.28}
              />
            )
          })}
          {SUBREGIONS[view].map((s) => {
            const color = regionColors.get(s.id)
            const isHover = fine && s.id === hovered && !color
            if (!color && !isHover && !fine) return null
            return (
              <polygon
                key={s.id}
                points={s.points}
                fill={color ?? (isHover ? HOVER_COLOR : "none")}
                fillOpacity={color ? (emphasis.has(s.id) ? 0.66 : 0.46) : 0.3}
                // Opened up, the parts are outlined so you can see what a tap
                // will choose before you make it.
                stroke={fine ? "#334155" : "none"}
                strokeOpacity={0.22}
                strokeWidth={0.75}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>
        <svg
          ref={(el) => {
            figureRefs.current[view] = el
          }}
          viewBox={viewBox}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ cursor: mode === "pen" ? "crosshair" : fine ? "grab" : "pointer" }}
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
                vectorEffect="non-scaling-stroke"
              />
            ))}
          {strokesFor(view).map((s) => (
            <polyline
              key={s.key}
              points={s.points}
              fill="none"
              stroke={INK}
              strokeWidth={s.strong ? 3 : 2.25}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </>
    )
  }

  return (
    /*
     * Side by side only on a wide screen. The chart's column is narrow enough
     * that beside the panel the figures came out 160px wide, so below 2xl the
     * panel goes underneath and the figures take the width.
     */
    <div className="grid gap-4 2xl:grid-cols-[3fr_2fr]">
      {/* ── The figures ───────────────────────────────────────────────────── */}
      <div className="relative min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {/* Where you are looking. */}
          <div className="inline-flex flex-wrap rounded-full border border-slate-200 bg-slate-50 p-0.5">
            {STAGES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => goTo(value)}
                aria-pressed={stage === value}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  stage === value ? "bg-sky-700 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t(`bodyMap.stage.${value}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {/* What a touch does. The spine model has one tool: a tap. */}
            {stage !== "spine" && (
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
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
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
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400"
              >
                <Undo2 className="size-3.5 rtl:-scale-x-100" aria-hidden />
                {t("bodyMap.undo")}
              </button>
            )}
          </div>
        </div>

        {stage === "both" && (
          <div className="grid grid-cols-2 gap-3">
            {VIEWS.map((view) => (
              <figure key={view} className="m-0 flex min-w-0 flex-col items-center gap-1">
                <figcaption className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  {t(`bodyMap.view.${view}`)}
                  <button
                    type="button"
                    onClick={() => goTo(view)}
                    aria-label={t("bodyMap.openUp", { view: t(`bodyMap.view.${view}`) })}
                    className="flex size-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-700"
                  >
                    <Maximize2 className="size-3.5" aria-hidden />
                  </button>
                </figcaption>
                <div className="relative w-full max-w-[280px] select-none">{figure(view)}</div>
              </figure>
            ))}
          </div>
        )}

        {focusView && (
          <div
            ref={viewportRef}
            className="relative w-full touch-none overflow-hidden rounded-xl bg-slate-50/60 select-none"
            style={{ height: FOCUS_HEIGHT }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: baseWidth,
                transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.s})`,
              }}
            >
              {figure(focusView)}
            </div>
            <div className="absolute end-3 top-3 flex flex-col gap-1.5">
              {(
                [
                  [Plus, "bodyMap.zoomIn", () => zoomButton(1.5)],
                  [Minus, "bodyMap.zoomOut", () => zoomButton(1 / 1.5)],
                  [Scan, "bodyMap.fit", () => setZoom(fit())],
                ] as const
              ).map(([Icon, key, action]) => (
                <button
                  key={key}
                  type="button"
                  onClick={action}
                  aria-label={t(key)}
                  title={t(key)}
                  className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition-colors hover:border-slate-400"
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === "spine" && (
          <SpineViewer colors={spineColors} emphasis={emphasis} onToggle={toggleSpine} />
        )}

        {stage !== "spine" && (
          <p className="mt-2 text-center text-[11px] font-medium text-slate-500">
            {t(
              fine
                ? mode === "pen"
                  ? "bodyMap.hint.focusPen"
                  : "bodyMap.hint.focus"
                : mode === "pen"
                  ? "bodyMap.hint.pen"
                  : "bodyMap.hint.point",
            )}
          </p>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {hasDraft ? t("bodyMap.marked") : t("bodyMap.underCursor")}
          </p>
          <p
            className="mt-1 break-words text-xl font-bold leading-snug"
            style={{ color: hasDraft || openMark ? highlight : "#0369a1" }}
          >
            {headline}
          </p>
        </div>

        {/* Either, both or neither: two things that can be true of one spot. */}
        <div className="grid grid-cols-2 gap-2">
          {TONES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleTone(value)}
              aria-pressed={tones.includes(value)}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                tones.includes(value)
                  ? "border-slate-900 bg-white text-slate-900"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: TONE_COLOR[value] }} aria-hidden />
              {t(`bodyMap.tone.${value}`)}
            </button>
          ))}
        </div>

        {hasDraft && (
          <div className="rounded-2xl border-2 border-slate-300 bg-slate-50/60 p-4">
            {(draft.regions.length > 0 || draft.vertebrae.length > 0) && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {[...draft.regions, ...draft.vertebrae].map((item) => {
                  const name = draft.regions.includes(item) ? regionLabel(t, item) : spineLabel(t, item)
                  return (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        aria-label={t("bodyMap.remove", { name })}
                        className="text-slate-400 transition-colors hover:text-rose-600"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
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
                const open = openId === m.id
                const kinds = markTones(m)
                return (
                  <li
                    key={m.id}
                    className={`overflow-hidden rounded-xl border ${open ? "border-slate-300 bg-slate-50/60" : "border-slate-100"}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleOpen(m)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-start"
                    >
                      <span
                        className="mt-1.5 size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: toneColor(kinds) }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-800">
                          {describe(m.regions, m.vertebrae) || t("bodyMap.drawingOnly")}
                        </span>
                        {!open && m.note && (
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
                        className={`mt-0.5 size-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>

                    {open && (
                      <div className="border-t border-slate-200 px-3 py-3">
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
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
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
