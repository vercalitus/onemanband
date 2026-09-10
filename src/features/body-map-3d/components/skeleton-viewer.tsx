"use client"

import { Canvas, useThree } from "@react-three/fiber"
import { Line, OrbitControls } from "@react-three/drei"
import { ChevronDown } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

import { buildSkeleton, type SkeletonPart } from "../lib/skeleton-parts"
import { useLocale } from "@/components/providers/locale-provider"

/**
 * One skeleton, turned to any angle, marked on the bone itself.
 *
 * **The ink is on the model, not on the screen.** The first version drew into
 * a canvas laid over the viewport and froze the view while drawing, which
 * looked right until the model moved: the stroke stayed where it was and the
 * body went somewhere else, leaving a mark floating in space that meant
 * nothing. Every point of a stroke is now raycast onto the skeleton and kept
 * as a position in the scene, lifted a fraction along the surface normal so it
 * does not fight the bone for the same pixel. It turns when the body turns
 * because it is on the body.
 *
 * That also removes the reason a separate "rotate" mode existed. There is no
 * view to freeze, so there are two tools and both leave the model free to be
 * turned, zoomed and jumped around: the pen outlines an area, a point names
 * one bone. Which is what marking a body actually consists of.
 *
 * The consequence worth knowing: you cannot draw in mid-air. A stroke exists
 * only where there is bone under the cursor, and the pen lifts when it leaves
 * the skeleton. For marking anatomy that is the right constraint.
 */

/** A stroke, in scene coordinates, sitting on the surface it was drawn on. */
export type SurfaceStroke = [number, number, number][]

export interface Annotation {
  id: string
  /** Bones the mark covers. What makes this a record and not a picture. */
  bones: string[]
  strokes: SurfaceStroke[]
  note?: string
  /** Where the camera stood, so the mark can be looked at from its own angle. */
  camera: [number, number, number]
  target: [number, number, number]
  createdAt: string
}

type Mode = "pen" | "point"

const GROUP_COLOR: Record<SkeletonPart["group"], string> = {
  spine: "#dfe6ee",
  skull: "#eef2f7",
  ribs: "#e6ecf3",
  arms: "#e4eaf1",
  legs: "#e4eaf1",
  pelvis: "#e6ecf3",
}

/** Lift off the surface, in centimetres. Enough to clear the bone, small
 *  enough that the line still reads as being on it. */
const INK_LIFT = 0.45

/**
 * The bones, and the object the raycaster is aimed at.
 *
 * Picking is done by this component's own raycaster against this group rather
 * than through react-three-fiber's per-mesh pointer events: those compete with
 * OrbitControls over the same drag, and hanging handlers off each of ~250
 * meshes is a lot of bookkeeping for a raycast we can do directly.
 */
function SkeletonMeshes({
  parts,
  highlighted,
  groupRef,
}: {
  parts: SkeletonPart[]
  highlighted: Set<string>
  groupRef: React.RefObject<THREE.Group | null>
}) {
  return (
    <group ref={groupRef}>
      {parts.map((part, i) => (
        <mesh
          key={`${part.name}-${i}`}
          name={part.name}
          geometry={part.geometry}
          position={part.position}
          quaternion={part.quaternion}
        >
          <meshStandardMaterial
            color={highlighted.has(part.name) ? "#0284c7" : GROUP_COLOR[part.group]}
            roughness={0.72}
            metalness={0.04}
            emissive={highlighted.has(part.name) ? "#0369a1" : "#000000"}
            emissiveIntensity={highlighted.has(part.name) ? 0.4 : 0}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Hands the live camera and controls out, so a mark can remember its angle. */
function CameraProbe({
  onReady,
}: {
  onReady: (camera: THREE.Camera, controls: unknown) => void
}) {
  const { camera, controls } = useThree()
  useEffect(() => {
    onReady(camera, controls)
  }, [camera, controls, onReady])
  return null
}

/**
 * Where the camera goes when a region is chosen.
 *
 * Heights match the vertebra levels the skeleton is built from, and each
 * region also carries the side it is looked at from. Keeping the current
 * angle and changing only the height was wrong: pressing "lower back" while
 * facing the front showed the lower back from the front, which is the chest.
 * A button that names the back has to show the back — so it turns the model
 * too. In the model's own axes +Z is anterior, so a posterior view sits at
 * negative Z, with a little offset to one side so the column reads as three
 * dimensional rather than flat.
 */
const REGIONS: { key: string; y: number; distance: number; from: [number, number, number] }[] = [
  { key: "bodyMap3d.region.all", y: 86, distance: 340, from: [0.4, 0.14, -1] },
  { key: "bodyMap3d.region.neck", y: 145, distance: 95, from: [0.28, 0.16, -1] },
  { key: "bodyMap3d.region.upperBack", y: 123, distance: 140, from: [0.24, 0.1, -1] },
  { key: "bodyMap3d.region.lowerBack", y: 99, distance: 105, from: [0.24, 0.08, -1] },
  { key: "bodyMap3d.region.pelvis", y: 83, distance: 115, from: [0.24, 0.24, -1] },
]

/**
 * The four named sides, so turning to one is a press rather than a drag —
 * this is the "arrows on the side" a trackpad user asked for, in the form
 * that actually says where it will take you.
 */
const VIEWS: { key: string; from: [number, number, number] }[] = [
  { key: "bodyMap3d.view.back", from: [0, 0.08, -1] },
  { key: "bodyMap3d.view.front", from: [0, 0.08, 1] },
  { key: "bodyMap3d.view.left", from: [-1, 0.08, 0] },
  { key: "bodyMap3d.view.right", from: [1, 0.08, 0] },
]

export function SkeletonViewer({
  annotations,
  onSave,
  onDelete,
  onUpdateNote,
}: {
  annotations: Annotation[]
  onSave: (annotation: Omit<Annotation, "id" | "createdAt">) => void
  onDelete: (id: string) => void
  onUpdateNote: (id: string, note: string) => void
}) {
  const { t, localeTag } = useLocale()
  const parts = useMemo(() => buildSkeleton(), [])
  const [mode, setMode] = useState<Mode>("point")
  const [hovered, setHovered] = useState<string | null>(null)
  const [strokes, setStrokes] = useState<SurfaceStroke[]>([])
  const [liveStroke, setLiveStroke] = useState<SurfaceStroke>([])
  const [bones, setBones] = useState<string[]>([])
  const [note, setNote] = useState("")
  /** The saved mark whose details are open, expanded in place in the list. */
  const [openId, setOpenId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState("")

  const cameraRef = useRef<THREE.Camera | null>(null)
  const controlsRef = useRef<{
    target: THREE.Vector3
    update: () => void
    enabled: boolean
  } | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const raycaster = useRef(new THREE.Raycaster())
  /** Where a press started, so a drag that turns the model is not a choice. */
  const pressAt = useRef<{ x: number; y: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const activePointer = useRef<number | null>(null)
  const penSeen = useRef(false)
  const current = useRef<SurfaceStroke>([])

  const highlighted = useMemo(() => {
    const open = annotations.find((a) => a.id === openId)
    return new Set(open ? open.bones : bones)
  }, [annotations, openId, bones])

  const onCamera = useCallback((camera: THREE.Camera, controls: unknown) => {
    cameraRef.current = camera
    controlsRef.current = controls as typeof controlsRef.current
  }, [])

  /**
   * Where on the skeleton a screen point lands: the bone, and a position just
   * off its surface. Against the live scene graph, so it costs one raycast and
   * stays honest about what is actually on screen.
   */
  const surfaceAt = useCallback(
    (clientX: number, clientY: number): { bone: string; point: THREE.Vector3 } | null => {
      const el = wrapRef.current
      const camera = cameraRef.current
      const group = groupRef.current
      if (!el || !camera || !group) return null
      const rect = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.current.setFromCamera(ndc, camera)
      const hit = raycaster.current.intersectObjects(group.children, false)[0]
      if (!hit) return null
      // Lift along the face normal, taken into world space, so the ink clears
      // the bone from whatever side it was drawn on.
      const normal = hit.face
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : new THREE.Vector3(0, 0, 1)
      return {
        bone: hit.object.name,
        point: hit.point.clone().add(normal.multiplyScalar(INK_LIFT)),
      }
    },
    [],
  )

  const addBone = useCallback((name: string | null | undefined) => {
    if (!name) return
    setBones((prev) => (prev.includes(name) ? prev : [...prev, name]))
  }, [])

  /** True when this press should draw rather than turn the model. */
  const isDrawPress = (e: React.PointerEvent) => {
    if (mode !== "pen") return false
    if (e.button !== 0 && e.pointerType === "mouse") return false
    // Once a stylus has been used, a finger is the hand steadying the tablet
    // or turning the model — never ink.
    if (e.pointerType === "touch" && penSeen.current) return false
    return true
  }

  /*
   * Capture phase, and this matters: OrbitControls listens on the canvas
   * inside this element, so by the time an event bubbles up to here it has
   * already begun a rotation. Capturing runs first and lets the tool decide.
   */
  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (e.pointerType === "pen") penSeen.current = true
    if (mode === "point") pressAt.current = { x: e.clientX, y: e.clientY }
    if (!isDrawPress(e) || activePointer.current !== null) return

    const hit = surfaceAt(e.clientX, e.clientY)
    if (!hit) return // nothing to draw on — let the model turn instead

    if (controlsRef.current) controlsRef.current.enabled = false
    activePointer.current = e.pointerId
    wrapRef.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    current.current = [hit.point.toArray() as [number, number, number]]
    setLiveStroke(current.current)
    addBone(hit.bone)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) {
      if (mode !== "pen" || activePointer.current === null) {
        const hit = surfaceAt(e.clientX, e.clientY)
        // Only when it actually changes: a state write per pointer move
        // re-renders every bone in the scene, which a tablet feels.
        setHovered((prev) => (prev === (hit?.bone ?? null) ? prev : (hit?.bone ?? null)))
      }
      return
    }
    if (e.pointerId !== activePointer.current) return
    const hit = surfaceAt(e.clientX, e.clientY)
    // Off the skeleton: the pen lifts. Ink cannot hang in mid-air.
    if (!hit) return
    current.current = [...current.current, hit.point.toArray() as [number, number, number]]
    setLiveStroke(current.current)
    addBone(hit.bone)
  }

  const endStroke = (e: React.PointerEvent) => {
    if (!drawing.current || e.pointerId !== activePointer.current) return
    drawing.current = false
    activePointer.current = null
    if (controlsRef.current) controlsRef.current.enabled = true
    if (current.current.length > 1) setStrokes((prev) => [...prev, current.current])
    current.current = []
    setLiveStroke([])
  }

  const onPointerUp = (e: React.PointerEvent) => {
    endStroke(e)
    if (mode !== "point" || !pressAt.current) return
    const moved = Math.hypot(e.clientX - pressAt.current.x, e.clientY - pressAt.current.y)
    pressAt.current = null
    if (moved > 6) return
    addBone(surfaceAt(e.clientX, e.clientY)?.bone)
  }

  const clear = () => {
    setStrokes([])
    setLiveStroke([])
    setBones([])
    setNote("")
  }

  const save = () => {
    const camera = cameraRef.current
    if (!camera || (!strokes.length && !bones.length)) return
    const target = controlsRef.current?.target ?? new THREE.Vector3(0, 86, 0)
    onSave({
      bones,
      strokes,
      note: note.trim() || undefined,
      camera: [camera.position.x, camera.position.y, camera.position.z],
      target: [target.x, target.y, target.z],
    })
    clear()
  }

  /** Open a saved mark: its own angle back, its note in place, in one tap. */
  const toggleOpen = (a: Annotation) => {
    if (openId === a.id) {
      setOpenId(null)
      return
    }
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (camera && controls) {
      camera.position.set(...a.camera)
      controls.target.set(...a.target)
      controls.update()
    }
    setOpenId(a.id)
    setEditNote(a.note ?? "")
  }

  /**
   * Look at a height from a given side. A region supplies both; a side button
   * supplies only the direction and keeps whatever height and distance the
   * practitioner is already at, so turning to the front does not also throw
   * away the zoom they set up on L4.
   */
  const lookFrom = (from: [number, number, number], y?: number, distance?: number) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    const target = new THREE.Vector3(0, y ?? controls.target.y, 0)
    const radius = distance ?? camera.position.distanceTo(controls.target)
    controls.target.copy(target)
    camera.position.copy(target.clone().add(new THREE.Vector3(...from).normalize().multiplyScalar(radius)))
    controls.update()
  }

  const headline = bones.length
    ? bones.join(" · ")
    : (annotations.find((a) => a.id === openId)?.bones.join(" · ") ?? hovered ?? "—")

  const hasDraft = strokes.length > 0 || bones.length > 0

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      {/* ── The model ─────────────────────────────────────────────────────── */}
      <div
        ref={wrapRef}
        className="relative h-[560px] touch-none overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white"
        style={{ cursor: mode === "pen" ? "crosshair" : "pointer" }}
        onPointerDownCapture={onPointerDownCapture}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={endStroke}
        onPointerLeave={() => setHovered(null)}
      >
        <Canvas
          camera={{ position: [150, 112, -300], fov: 35 }}
          dpr={[1, 2]}
          /*
           * Aim before the first frame. OrbitControls applies its `target` in
           * an effect, one frame too late: until then the camera looks at the
           * origin — the floor between the feet — and the body sits above the
           * picture, which reads as a model that failed to load.
           */
          onCreated={({ camera }) => camera.lookAt(0, 86, 0)}
        >
          <color attach="background" args={["#f8fafc"]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[60, 180, 120]} intensity={1.35} />
          <directionalLight position={[-80, 90, -140]} intensity={0.9} />
          <CameraProbe onReady={onCamera} />
          <SkeletonMeshes parts={parts} highlighted={highlighted} groupRef={groupRef} />

          {/* Every saved mark, on the body, all the time — the point of putting
              the ink in the scene. The one being read stands out; the rest stay
              legible without competing with it. */}
          {annotations.map((a) =>
            a.strokes.map((s, i) =>
              s.length > 1 ? (
                <Line
                  key={`${a.id}-${i}`}
                  points={s}
                  color={a.id === openId ? "#0284c7" : "#94a3b8"}
                  lineWidth={a.id === openId ? 3.5 : 2}
                />
              ) : null,
            ),
          )}
          {strokes.map((s, i) =>
            s.length > 1 ? <Line key={`draft-${i}`} points={s} color="#0ea5e9" lineWidth={3.5} /> : null,
          )}
          {liveStroke.length > 1 && <Line points={liveStroke} color="#0ea5e9" lineWidth={3.5} />}

          <OrbitControls
            // Without this `useThree().controls` is null and a saved mark
            // could not restore the angle it was drawn at.
            makeDefault
            /*
             * Always on. A drawing press switches it off for the length of that
             * one stroke — see onPointerDownCapture — so the model stays free
             * to turn in both tools rather than needing a mode of its own.
             */
            enablePan
            screenSpacePanning
            /*
             * And this is what stops the model being cut off: zooming moves
             * toward the pointer rather than the middle of the body, so
             * scrolling over L3 keeps L3 where it is.
             */
            zoomToCursor
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            }}
            target={[0, 86, 0]}
            minDistance={40}
            maxDistance={480}
          />
        </Canvas>

        {/* Shortcuts on the model rather than in the panel: they are about what
            you are looking at, not about the mark you are making. Regions set a
            height and a side; the second row only changes the side. */}
        <div className="pointer-events-auto absolute inset-x-3 top-3 flex flex-col items-center gap-1.5">
          <div className="flex flex-wrap justify-center gap-1.5">
            {REGIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => lookFrom(r.from, r.y, r.distance)}
                className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur transition-colors hover:border-sky-300 hover:text-sky-700"
              >
                {t(r.key)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => lookFrom(v.from)}
                className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-sm backdrop-blur transition-colors hover:border-sky-300 hover:text-sky-700"
              >
                {t(v.key)}
              </button>
            ))}
          </div>
        </div>

        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] font-medium text-slate-500">
          {t(mode === "pen" ? "bodyMap3d.hint.pen" : "bodyMap3d.hint.point")}
        </p>
      </div>

      {/* ── What is being marked, and what it says ────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {hasDraft ? t("bodyMap3d.marked") : t("bodyMap3d.underCursor")}
          </p>
          <p
            className="mt-1 break-words text-3xl font-bold leading-tight tracking-tight text-sky-700"
            dir="ltr"
          >
            {headline}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["pen", "bodyMap3d.mode.pen"],
              ["point", "bodyMap3d.mode.point"],
            ] as const
          ).map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                mode === value
                  ? "bg-sky-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
          {t("bodyMap3d.intro")}
          <br />
          <span className="text-slate-500">{t("bodyMap3d.introDetail")}</span>
        </p>

        {/* The mark being made. Only while one is: an empty note box beside an
            untouched model is a question nobody asked. */}
        {hasDraft && (
          <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/40 p-4">
            <label
              htmlFor="mark-note"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700"
            >
              {t("bodyMap3d.noteOnMark")}
            </label>
            <textarea
              id="mark-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={t("bodyMap3d.notePlaceholder")}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {t("bodyMap3d.saveMark")}
              </button>
              {strokes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStrokes((prev) => prev.slice(0, -1))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
                >
                  {t("bodyMap3d.undoStroke")}
                </button>
              )}
              <button
                type="button"
                onClick={clear}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
              >
                {t("bodyMap3d.clear")}
              </button>
            </div>
          </div>
        )}

        {annotations.length > 0 && (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {t("bodyMap3d.saved")}
            </p>
            <ul className="space-y-2">
              {annotations.map((a) => {
                const open = openId === a.id
                return (
                  <li
                    key={a.id}
                    className={`overflow-hidden rounded-xl border ${
                      open ? "border-sky-200 bg-sky-50/40" : "border-slate-100"
                    }`}
                  >
                    {/* The row itself opens: one tap brings back the angle it
                        was marked from and reveals its note, right here rather
                        than in a card somewhere else on the page. */}
                    <button
                      type="button"
                      onClick={() => toggleOpen(a)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-start"
                    >
                      <span className="min-w-0 flex-1">
                        <span dir="ltr" className="block font-mono text-sm font-semibold text-slate-800">
                          {a.bones.join(" · ") || "—"}
                        </span>
                        {!open && a.note && (
                          <span className="mt-0.5 block truncate text-xs text-slate-600">{a.note}</span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          {new Date(a.createdAt).toLocaleString(localeTag)}
                          {a.strokes.length
                            ? ` · ${t("bodyMap3d.strokeCount", { n: a.strokes.length })}`
                            : ""}
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
                      <div className="border-t border-sky-100 px-3 py-3">
                        <label
                          htmlFor={`note-${a.id}`}
                          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400"
                        >
                          {t("bodyMap3d.note")}
                        </label>
                        <textarea
                          id={`note-${a.id}`}
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          rows={3}
                          placeholder={t("bodyMap3d.notePlaceholder")}
                          className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onUpdateNote(a.id, editNote.trim())}
                            disabled={editNote.trim() === (a.note ?? "")}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                          >
                            {t("bodyMap3d.saveNote")}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(a.id)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                          >
                            {t("bodyMap3d.deleteMark")}
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
      </div>
    </div>
  )
}
