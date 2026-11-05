"use client"

import { ChevronDown, Undo2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { BODY_MAP_FLUSH_EVENT } from "../lib/flush-event"
import { FIGURES, REGIONS, VERTEBRAE, regionAt, regionLabel, sortVertebrae } from "../lib/regions"
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
 * The body map: two figures, front and back, marked by area.
 *
 * It replaced a rotatable skeleton. That one was precise and slow to use — a
 * finding meant turning the model to the angle that showed it, and what it
 * recorded was a list of bones. A practitioner thinks in areas ("right
 * buttock, radiating down the back of the thigh") and in spinal levels (L4,
 * L5), so those are the two things a mark is made of here, each one tap.
 *
 * Two tools, as before: a tap names an area, the pen outlines one. A pen line
 * also names every area it crosses, so a drawing is never only a picture.
 */

type Mode = "pen" | "point"

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

/** What Undo restores: a snapshot, so "put it back exactly" cannot drift. */
interface Draft {
  regions: string[]
  vertebrae: string[]
  strokes: FigureStroke[]
  note: string
}
const EMPTY: Draft = { regions: [], vertebrae: [], strokes: [], note: "" }

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

  const figureRefs = useRef<Record<BodyMapView, SVGSVGElement | null>>({ front: null, back: null })
  const drawing = useRef<{ pointer: number; stroke: FigureStroke } | null>(null)
  const pressAt = useRef<{ x: number; y: number } | null>(null)
  const penSeen = useRef(false)

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
   * Every saved finding coloured on the body the moment the chart opens, and
   * the one being made or read on top. An area marked pain in one finding and
   * nerve in another takes the colour of both.
   */
  const { colors, emphasis } = useMemo(() => {
    const byRegion = new Map<string, Set<BodyMarkTone>>()
    for (const m of marks) {
      for (const id of m.regions) {
        const set = byRegion.get(id) ?? new Set<BodyMarkTone>()
        for (const v of markTones(m)) set.add(v)
        byRegion.set(id, set)
      }
    }
    const map = new Map<string, string>()
    for (const [id, set] of byRegion) map.set(id, toneColor([...set]))
    const focus = openMark ? openMark.regions : draft.regions
    for (const id of focus) map.set(id, highlight)
    return { colors: map, emphasis: new Set(focus) }
  }, [marks, openMark, draft.regions, highlight])

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

  const addRegion = useCallback((id: string | undefined) => {
    if (!id) return
    setDraft((d) => (d.regions.includes(id) ? d : { ...d, regions: [...d.regions, id] }))
  }, [])

  const isDrawPress = (e: React.PointerEvent) => {
    if (mode !== "pen") return false
    if (e.button !== 0 && e.pointerType === "mouse") return false
    // Once a stylus has been used, a finger is the hand steadying the tablet.
    if (e.pointerType === "touch" && penSeen.current) return false
    return true
  }

  const onPointerDown = (view: BodyMapView) => (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "pen") penSeen.current = true
    if (mode === "point") {
      pressAt.current = { x: e.clientX, y: e.clientY }
      return
    }
    if (!isDrawPress(e) || drawing.current) return
    const p = toFigure(view, e.clientX, e.clientY)
    if (!p) return
    // Once per stroke: the line and every area it crosses come back together.
    remember()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* keep drawing without capture */
    }
    const stroke: FigureStroke = { view, points: [[p.x, p.y]] }
    drawing.current = { pointer: e.pointerId, stroke }
    setLiveStroke(stroke)
    addRegion(regionAt(view, p.x, p.y)?.id)
  }

  const onPointerMove = (view: BodyMapView) => (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toFigure(view, e.clientX, e.clientY)
    if (!p) return
    const current = drawing.current
    if (current && current.pointer === e.pointerId) {
      current.stroke = { view, points: [...current.stroke.points, [p.x, p.y]] }
      setLiveStroke(current.stroke)
      addRegion(regionAt(view, p.x, p.y)?.id)
      return
    }
    const id = regionAt(view, p.x, p.y)?.id ?? null
    // Only when it changes: a state write per move re-renders both figures.
    setHovered((prev) => (prev === id ? prev : id))
  }

  const onPointerUp = (view: BodyMapView) => (e: React.PointerEvent<SVGSVGElement>) => {
    const current = drawing.current
    if (current && current.pointer === e.pointerId) {
      drawing.current = null
      // Kept as fractions of the figure, so the line survives a resized panel.
      const { width, height } = FIGURES[view]
      const finished: FigureStroke = {
        view,
        points: current.stroke.points.map(([x, y]) => [
          Math.round((x / width) * 10000) / 10000,
          Math.round((y / height) * 10000) / 10000,
        ]),
      }
      if (finished.points.length > 1) {
        setDraft((d) => ({ ...d, strokes: [...d.strokes, finished] }))
      }
      setLiveStroke(null)
      return
    }
    if (mode !== "point" || !pressAt.current || e.type !== "pointerup") return
    const moved = Math.hypot(e.clientX - pressAt.current.x, e.clientY - pressAt.current.y)
    pressAt.current = null
    if (moved > 8) return
    const p = toFigure(view, e.clientX, e.clientY)
    const id = p ? regionAt(view, p.x, p.y)?.id : undefined
    if (!id) return
    // A tap on a chosen area unchooses it: the gesture that chose it is the
    // obvious one for changing your mind, and a double tap is unreliable on a
    // tablet held in one hand.
    remember()
    setDraft((d) => ({
      ...d,
      regions: d.regions.includes(id) ? d.regions.filter((r) => r !== id) : [...d.regions, id],
    }))
  }

  const toggleVertebra = (level: string) => {
    remember()
    setDraft((d) => ({
      ...d,
      vertebrae: d.vertebrae.includes(level)
        ? d.vertebrae.filter((v) => v !== level)
        : sortVertebrae([...d.vertebrae, level]),
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

  const describe = (regions: string[], vertebrae: string[]) =>
    [...regions.map((id) => regionLabel(t, id)), ...vertebrae].join(" · ")

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

  const strokesFor = (view: BodyMapView) => {
    const { width, height } = FIGURES[view]
    const scale = (s: FigureStroke) =>
      s.points.map(([x, y]) => `${x * width},${y * height}`).join(" ")
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
      out.push({
        key: "live",
        points: liveStroke.points.map(([x, y]) => `${x},${y}`).join(" "),
        strong: true,
      })
    }
    return out
  }

  return (
    /*
     * Side by side only on a wide screen. The chart's column is narrow enough
     * that beside the panel the figures came out 160px wide — too small to
     * tell a shoulder blade from a shoulder — so below 2xl the panel goes
     * underneath and the figures take the width.
     */
    <div className="grid gap-4 2xl:grid-cols-[3fr_2fr]">
      {/* ── The figures ───────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
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
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  mode === value ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
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

        <div className="grid grid-cols-2 gap-3">
          {VIEWS.map((view) => {
            const fig = FIGURES[view]
            const viewBox = `0 0 ${fig.width} ${fig.height}`
            return (
              <figure key={view} className="m-0 flex min-w-0 flex-col items-center gap-1">
                <figcaption className="text-xs font-semibold text-slate-500">
                  {t(`bodyMap.view.${view}`)}
                </figcaption>
                <div className="relative w-full max-w-[280px] select-none">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a fixed local figure, drawn over at its own pixel size */}
                  <img
                    src={fig.src}
                    width={fig.width}
                    height={fig.height}
                    alt={t(`bodyMap.figureAlt.${view}`)}
                    draggable={false}
                    className="pointer-events-none block h-auto w-full"
                  />
                  {/* The colour, clipped to the figure's own outline: the
                      areas only partition the body, the picture traces it. */}
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
                      const color = colors.get(r.id)
                      const isHover = r.id === hovered && !color
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
                  </svg>
                  <svg
                    ref={(el) => {
                      figureRefs.current[view] = el
                    }}
                    viewBox={viewBox}
                    className="absolute inset-0 h-full w-full touch-none"
                    style={{ cursor: mode === "pen" ? "crosshair" : "pointer" }}
                    onPointerDown={onPointerDown(view)}
                    onPointerMove={onPointerMove(view)}
                    onPointerUp={onPointerUp(view)}
                    onPointerCancel={onPointerUp(view)}
                    onPointerLeave={() => setHovered(null)}
                    role="img"
                    aria-label={t(`bodyMap.figureAlt.${view}`)}
                  >
                    {strokesFor(view).map((s) => (
                      <polyline
                        key={s.key}
                        points={s.points}
                        fill="none"
                        stroke={INK}
                        strokeWidth={s.strong ? 5 : 3.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </svg>
                </div>
              </figure>
            )
          })}
        </div>

        <p className="mt-2 text-center text-[11px] font-medium text-slate-500">
          {t(mode === "pen" ? "bodyMap.hint.pen" : "bodyMap.hint.point")}
        </p>
        {/* CC BY 4.0 requires the credit wherever the figures are shown. */}
        <p className="mt-1 text-center text-[10px] text-slate-400">
          {t("bodyMap.credit")}{" "}
          <a
            href="https://smart.servier.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
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
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: TONE_COLOR[value] }}
                aria-hidden
              />
              {t(`bodyMap.tone.${value}`)}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {t("bodyMap.vertebrae")}
          </p>
          <div className="grid gap-1.5" dir="ltr">
            {VERTEBRAE.map((group) => (
              <div key={group.group} className="flex flex-wrap gap-1">
                {group.levels.map((level) => {
                  const on = draft.vertebrae.includes(level)
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => toggleVertebra(level)}
                      aria-pressed={on}
                      className={`min-w-10 rounded-md border px-1.5 py-1 font-mono text-xs font-semibold transition-colors ${
                        on
                          ? "border-sky-700 bg-sky-700 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {level}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {hasDraft && (
          <div className="rounded-2xl border-2 border-slate-300 bg-slate-50/60 p-4">
            {(draft.regions.length > 0 || draft.vertebrae.length > 0) && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {[...draft.regions, ...draft.vertebrae].map((item) => {
                  const name = draft.regions.includes(item) ? regionLabel(t, item) : item
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
                    className={`overflow-hidden rounded-xl border ${
                      open ? "border-slate-300 bg-slate-50/60" : "border-slate-100"
                    }`}
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
                        className={`mt-0.5 size-4 shrink-0 text-slate-400 transition-transform ${
                          open ? "rotate-180" : ""
                        }`}
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
                                  onUpdateTones(
                                    m.id,
                                    on ? kinds.filter((v) => v !== value) : [...kinds, value],
                                  )
                                }
                                aria-pressed={on}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                                  on
                                    ? "border-slate-900 text-slate-900"
                                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                                }`}
                              >
                                <span
                                  className="size-2.5 rounded-full"
                                  style={{ backgroundColor: TONE_COLOR[value] }}
                                  aria-hidden
                                />
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

        {/* The skeleton's findings. Bone names are still the anatomy they were
            written as, so they are shown as written — and nothing here edits
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
          which takes the areas, the levels, the drawing and the note at once. */}
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
