"use client"

import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

import { buildSkeleton, type SkeletonPart } from "../lib/skeleton-parts"
import { drawStrokes, type Stroke, type StrokePoint } from "@/features/patients/lib/canvas-strokes"

/**
 * One skeleton, turned to any angle, marked on two ways.
 *
 * The question this exists to answer is whether marking a rotatable model
 * beats three fixed diagrams on a tablet, in the hand of someone with a
 * patient in front of them.
 *
 * **Rotate, freeze, draw** rather than painting onto the mesh. A stroke
 * painted onto the surface follows the bone when the model turns, which
 * sounds better and costs a per-patient texture, seams where the ink breaks,
 * and a fixed resolution that goes soft when you zoom. Freezing the view keeps
 * the stroke a vector — the same one the session canvas draws — and matches
 * how a finding is recorded: turn to the angle that shows it, then annotate.
 *
 * Two ways to mark, because they are two different acts. Drawing outlines an
 * area with the pen. Pointing names one bone and says something about it —
 * that one keeps the model turnable, because finding the level is most of the
 * work.
 *
 * What makes either a record rather than a picture: the model is raycast, so
 * a mark knows it is on T4.
 */

export interface Annotation {
  id: string
  /** Bones the mark covers. What makes this a record and not a picture. */
  bones: string[]
  strokes: Stroke[]
  note?: string
  /** Where the camera stood, so the mark can be shown from its own angle. */
  camera: [number, number, number]
  target: [number, number, number]
  createdAt: string
}

type Mode = "rotate" | "pen" | "point"

const GROUP_COLOR: Record<SkeletonPart["group"], string> = {
  spine: "#dfe6ee",
  skull: "#eef2f7",
  ribs: "#e6ecf3",
  arms: "#e4eaf1",
  legs: "#e4eaf1",
  pelvis: "#e6ecf3",
}

function SkeletonMeshes({
  parts,
  highlighted,
  onHover,
  onPick,
  pickable,
}: {
  parts: SkeletonPart[]
  highlighted: Set<string>
  onHover: (name: string | null) => void
  onPick: (name: string) => void
  pickable: boolean
}) {
  return (
    <group>
      {parts.map((part, i) => (
        <mesh
          key={`${part.name}-${i}`}
          geometry={part.geometry}
          position={part.position}
          quaternion={part.quaternion}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation()
            onHover(part.name)
          }}
          onPointerOut={() => onHover(null)}
          // `onClick` and not `onPointerDown`: a drag that starts on a bone is
          // someone turning the model, not someone choosing it.
          onClick={(e: ThreeEvent<MouseEvent>) => {
            if (!pickable) return
            e.stopPropagation()
            onPick(part.name)
          }}
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

export function SkeletonViewer({
  annotations,
  onSave,
  onDelete,
}: {
  annotations: Annotation[]
  onSave: (annotation: Omit<Annotation, "id" | "createdAt">) => void
  onDelete: (id: string) => void
}) {
  const parts = useMemo(() => buildSkeleton(), [])
  const [mode, setMode] = useState<Mode>("rotate")
  const [hovered, setHovered] = useState<string | null>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [bones, setBones] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [viewing, setViewing] = useState<Annotation | null>(null)

  const cameraRef = useRef<THREE.Camera | null>(null)
  const controlsRef = useRef<{ target: THREE.Vector3; update: () => void } | null>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const activePointer = useRef<number | null>(null)
  const penSeen = useRef(false)
  const current = useRef<Stroke>([])
  const [surface, setSurface] = useState({ width: 0, height: 0 })

  const drawingMode = mode === "pen" && !viewing
  const pointMode = mode === "point" && !viewing

  const onCamera = useCallback((camera: THREE.Camera, controls: unknown) => {
    cameraRef.current = camera
    controlsRef.current = controls as { target: THREE.Vector3; update: () => void } | null
  }, [])

  /* Keep the ink layer the same pixel size as the viewport it covers. */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setSurface({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const shownStrokes = viewing ? viewing.strokes : strokes
  useEffect(() => {
    const canvas = overlayRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawStrokes(ctx, shownStrokes)
  }, [shownStrokes, surface])

  /** Which bone sits under a screen point, if any. */
  const boneAt = useCallback(
    (clientX: number, clientY: number): string | null => {
      const el = wrapRef.current
      const camera = cameraRef.current
      if (!el || !camera) return null
      const rect = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      const ray = new THREE.Raycaster()
      ray.setFromCamera(ndc, camera)
      let closest: { name: string; distance: number } | null = null
      for (const part of parts) {
        const mesh = new THREE.Mesh(part.geometry)
        mesh.position.set(...part.position)
        if (part.quaternion) mesh.quaternion.copy(part.quaternion)
        mesh.updateMatrixWorld()
        const hits = ray.intersectObject(mesh, false)
        if (hits.length && (!closest || hits[0].distance < closest.distance)) {
          closest = { name: part.name, distance: hits[0].distance }
        }
      }
      return closest?.name ?? null
    },
    [parts],
  )

  const addBone = useCallback((name: string | null) => {
    if (!name) return
    setBones((prev) => (prev.includes(name) ? prev : [...prev, name]))
  }, [])

  const pointFrom = (e: React.PointerEvent): StrokePoint => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 }
  }

  /* Palm rejection, the same rule the session canvas learned: one pointer
     draws, and once a pen has been seen, touch is not ink. */
  const onPointerDown = (e: React.PointerEvent) => {
    if (!drawingMode) return
    if (e.pointerType === "pen") penSeen.current = true
    if (e.pointerType === "touch" && penSeen.current) return
    if (activePointer.current !== null) return
    activePointer.current = e.pointerId
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drawing.current = true
    current.current = [pointFrom(e)]
    addBone(boneAt(e.clientX, e.clientY))
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current || e.pointerId !== activePointer.current) return
    current.current.push(pointFrom(e))
    const ctx = overlayRef.current?.getContext("2d")
    if (!ctx || current.current.length < 2) return
    const pts = current.current
    const a = pts[pts.length - 2]
    const b = pts[pts.length - 1]
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineWidth = 1.5 + (b.pressure || 0.5) * 2.5
    ctx.strokeStyle = `rgba(2,132,199,${0.8 + (b.pressure || 0.5) * 0.2})`
    ctx.lineCap = "round"
    ctx.stroke()
    // A stroke that crosses from T4 to T6 should say so.
    if (current.current.length % 10 === 0) addBone(boneAt(e.clientX, e.clientY))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drawing.current || e.pointerId !== activePointer.current) return
    drawing.current = false
    activePointer.current = null
    if (current.current.length > 1) setStrokes((prev) => [...prev, current.current])
    current.current = []
  }

  const clear = () => {
    setStrokes([])
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
    setMode("rotate")
  }

  const show = (a: Annotation) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (camera && controls) {
      camera.position.set(...a.camera)
      controls.target.set(...a.target)
      controls.update()
    }
    setViewing(a)
    setMode("rotate")
  }

  /** The bone the reader is being told about, largest thing on the panel. */
  const headline = viewing
    ? viewing.bones.join(" · ") || "—"
    : bones.length
      ? bones.join(" · ")
      : hovered || "—"

  const hasDraft = strokes.length > 0 || bones.length > 0

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      {/* ── The model ─────────────────────────────────────────────────────── */}
      <div
        ref={wrapRef}
        className="relative h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white"
        style={{ touchAction: drawingMode ? "none" : "auto" }}
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
          <SkeletonMeshes
            parts={parts}
            highlighted={new Set(viewing ? viewing.bones : bones)}
            onHover={setHovered}
            onPick={(name) => addBone(name)}
            pickable={pointMode}
          />
          <OrbitControls
            // Without this `useThree().controls` is null and a saved mark
            // could not restore the angle it was drawn at.
            makeDefault
            enabled={!drawingMode}
            /*
             * Panning matters more here than it looks. Zoomed in on the
             * lumbar spine with no pan, the only way to reach the neck is to
             * zoom out and back in — the model is pinned to its centre and
             * the top of it is simply off the screen.
             */
            enablePan
            screenSpacePanning
            target={[0, 86, 0]}
            minDistance={40}
            maxDistance={480}
          />
        </Canvas>

        {/* The ink layer. Transparent to pointers unless the pen is armed, so
            turning the model never has to fight the drawing surface. */}
        <canvas
          ref={overlayRef}
          width={surface.width}
          height={surface.height}
          className="absolute inset-0"
          style={{
            pointerEvents: drawingMode ? "auto" : "none",
            cursor: drawingMode ? "crosshair" : pointMode ? "pointer" : "grab",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {drawingMode && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-semibold text-sky-700">
            התצוגה קפואה — ציירו על השלד
          </p>
        )}
      </div>

      {/* ── What is being marked, and what it says ────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {pointMode || drawingMode ? "מסומן" : "מתחת לסמן"}
          </p>
          <p
            className="mt-1 break-words text-3xl font-bold leading-tight tracking-tight text-sky-700"
            dir="ltr"
          >
            {headline}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["rotate", "סיבוב"],
              ["pen", "עט"],
              ["point", "נקודה"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setViewing(null)
                setMode(value)
              }}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                mode === value && !viewing
                  ? "bg-sky-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
          מרטין — אפשר להגדיל, להקטין, לסובב ולסמן מה שרוצים.
          <br />
          <span className="text-slate-500">
            <b>סיבוב</b>: גרירה מסובבת · שתי אצבעות מזיזות ומקרבות ·{" "}
            <b>עט</b>: התצוגה נעצרת וציירו חופשי · <b>נקודה</b>: הקישו על עצם
            כדי לבחור אותה.
          </span>
        </p>

        {(hasDraft || viewing) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              הערה
            </label>
            {viewing ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                {viewing.note || <span className="italic text-slate-400">ללא הערה</span>}
              </p>
            ) : (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="מה נמצא כאן"
                className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
              />
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              {viewing ? (
                <button
                  type="button"
                  onClick={() => setViewing(null)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
                >
                  סגירה
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={save}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    שמירה
                  </button>
                  {strokes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setStrokes((prev) => prev.slice(0, -1))}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
                    >
                      ביטול קו
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clear}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
                  >
                    ניקוי
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {annotations.length > 0 && (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              סימונים שמורים
            </p>
            <ul className="space-y-2">
              {annotations.map((a) => (
                <li key={a.id} className="flex items-start gap-2 rounded-xl border border-slate-100 px-3 py-2">
                  <button type="button" onClick={() => show(a)} className="min-w-0 flex-1 text-start">
                    <span dir="ltr" className="block font-mono text-sm font-semibold text-slate-800">
                      {a.bones.join(" · ") || "—"}
                    </span>
                    {a.note && (
                      <span className="mt-0.5 block text-xs leading-snug text-slate-600">{a.note}</span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {new Date(a.createdAt).toLocaleString("he-IL")}
                      {a.strokes.length ? ` · ${a.strokes.length} קווים` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    className="shrink-0 text-xs font-semibold text-slate-400 hover:text-rose-600"
                  >
                    מחיקה
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
