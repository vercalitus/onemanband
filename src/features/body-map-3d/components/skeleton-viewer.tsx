"use client"

import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

import { buildSkeleton, SKELETON_HEIGHT, type SkeletonPart } from "../lib/skeleton-parts"
import { drawStrokes, type Stroke, type StrokePoint } from "@/features/patients/lib/canvas-strokes"

/**
 * One skeleton, turned to any angle, drawn on with the pen.
 *
 * The question this exists to answer is whether marking a rotatable model
 * beats three fixed diagrams on a tablet, in the hand of someone with a
 * patient in front of them. So the two things it does are rotate and draw.
 *
 * **Rotate, freeze, draw** rather than painting onto the mesh. A stroke
 * painted onto the surface follows the bone when the model turns, which
 * sounds better and costs a per-patient texture, seams where the ink breaks,
 * and a fixed resolution that goes soft when you zoom. Freezing the view keeps
 * the stroke a vector — the same one the session canvas draws — and matches
 * how a finding is actually recorded: turn to the angle that shows it, then
 * annotate that.
 *
 * A tap that does not travel is not a stroke: it is a question about a bone,
 * answered by raycasting the model and naming what was hit.
 */

export interface Annotation {
  id: string
  /** Bones the pen passed over. What makes this a record and not a picture. */
  bones: string[]
  strokes: Stroke[]
  /** Where the camera stood, so the annotation can be shown from its own angle. */
  camera: [number, number, number]
  target: [number, number, number]
  note?: string
  createdAt: string
}

const GROUP_COLOR: Record<SkeletonPart["group"], string> = {
  spine: "#e2e8f0",
  skull: "#eef2f7",
  ribs: "#e8edf4",
  arms: "#e6ebf2",
  legs: "#e6ebf2",
  pelvis: "#e8edf4",
}

/** Screen-space drawing surface. Coordinates are the element's own pixels. */
interface DrawSurface {
  width: number
  height: number
}

function SkeletonMeshes({
  parts,
  highlighted,
  onHover,
  onPick,
  picking,
}: {
  parts: SkeletonPart[]
  highlighted: Set<string>
  onHover: (name: string | null) => void
  onPick: (name: string, point: THREE.Vector3) => void
  picking: boolean
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
            if (picking) return
            e.stopPropagation()
            onHover(part.name)
          }}
          onPointerOut={() => !picking && onHover(null)}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation()
            onPick(part.name, e.point)
          }}
        >
          <meshStandardMaterial
            color={highlighted.has(part.name) ? "#0284c7" : GROUP_COLOR[part.group]}
            roughness={0.75}
            metalness={0.05}
            emissive={highlighted.has(part.name) ? "#0369a1" : "#000000"}
            emissiveIntensity={highlighted.has(part.name) ? 0.35 : 0}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Hands the live camera out, so an annotation can remember where it was made. */
function CameraProbe({ onReady }: { onReady: (c: THREE.Camera, controls: unknown) => void }) {
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
  const [mode, setMode] = useState<"rotate" | "mark">("rotate")
  const [hovered, setHovered] = useState<string | null>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [bones, setBones] = useState<string[]>([])
  const [viewing, setViewing] = useState<Annotation | null>(null)

  const cameraRef = useRef<THREE.Camera | null>(null)
  const controlsRef = useRef<{ target: THREE.Vector3; update: () => void } | null>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const activePointer = useRef<number | null>(null)
  const penSeen = useRef(false)
  const current = useRef<Stroke>([])
  const [surface, setSurface] = useState<DrawSurface>({ width: 0, height: 0 })

  const onCamera = useCallback((camera: THREE.Camera, controls: unknown) => {
    cameraRef.current = camera
    controlsRef.current = controls as { target: THREE.Vector3; update: () => void } | null
  }, [])

  /* Keep the drawing surface the same pixel size as the viewport it covers. */
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

  const pointFrom = (e: React.PointerEvent): StrokePoint => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    }
  }

  /* Palm rejection, the same rule the session canvas learned: one pointer
     draws, and once a pen has been seen, touch is not ink. */
  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== "mark" || viewing) return
    if (e.pointerType === "pen") penSeen.current = true
    if (e.pointerType === "touch" && penSeen.current) return
    if (activePointer.current !== null) return
    activePointer.current = e.pointerId
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drawing.current = true
    current.current = [pointFrom(e)]
    const bone = boneAt(e.clientX, e.clientY)
    if (bone) setBones((prev) => (prev.includes(bone) ? prev : [...prev, bone]))
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current || e.pointerId !== activePointer.current) return
    current.current.push(pointFrom(e))
    const canvas = overlayRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || current.current.length < 2) return
    const pts = current.current
    const a = pts[pts.length - 2]
    const b = pts[pts.length - 1]
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineWidth = 1.5 + (b.pressure || 0.5) * 2.5
    ctx.strokeStyle = `rgba(15,23,42,${0.72 + (b.pressure || 0.5) * 0.2})`
    ctx.lineCap = "round"
    ctx.stroke()
    // Every few points, ask what is under the pen — a stroke that crosses from
    // T4 to T6 should say so.
    if (current.current.length % 12 === 0) {
      const bone = boneAt(e.clientX, e.clientY)
      if (bone) setBones((prev) => (prev.includes(bone) ? prev : [...prev, bone]))
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drawing.current || e.pointerId !== activePointer.current) return
    drawing.current = false
    activePointer.current = null
    if (current.current.length > 1) setStrokes((prev) => [...prev, current.current])
    current.current = []
  }

  const save = () => {
    const camera = cameraRef.current
    if (!camera || (!strokes.length && !bones.length)) return
    const target = controlsRef.current?.target ?? new THREE.Vector3(0, SKELETON_HEIGHT / 2, 0)
    void SKELETON_HEIGHT
    onSave({
      bones,
      strokes,
      camera: [camera.position.x, camera.position.y, camera.position.z],
      target: [target.x, target.y, target.z],
    })
    setStrokes([])
    setBones([])
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

  const marking = mode === "mark" && !viewing

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setViewing(null)
            setMode(marking ? "rotate" : "mark")
          }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            marking
              ? "bg-emerald-700 text-white hover:bg-emerald-800"
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {marking ? "מסובבים — לחזור לסיבוב" : "סימון בעט"}
        </button>
        {marking && (
          <>
            <button
              type="button"
              onClick={() => setStrokes((prev) => prev.slice(0, -1))}
              disabled={!strokes.length}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 disabled:opacity-40"
            >
              ביטול קו
            </button>
            <button
              type="button"
              onClick={() => {
                setStrokes([])
                setBones([])
              }}
              disabled={!strokes.length && !bones.length}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 disabled:opacity-40"
            >
              ניקוי
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!strokes.length && !bones.length}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
            >
              שמירת סימון
            </button>
          </>
        )}
        {viewing && (
          <button
            type="button"
            onClick={() => setViewing(null)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
          >
            סגירת תצוגה
          </button>
        )}
        <span className="ms-auto font-mono text-xs text-slate-500">
          {marking
            ? bones.length
              ? `העט עבר על: ${bones.join(" · ")}`
              : "ציירו על השלד"
            : hovered
              ? hovered
              : "גררו לסיבוב · שתי אצבעות לזום"}
        </span>
      </div>

      <div
        ref={wrapRef}
        className="relative h-[540px] overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white"
        style={{ touchAction: marking ? "none" : "auto" }}
      >
        {/*
          A three-quarter view from behind, framed to hold the whole frame.
          Behind, because the back is what gets treated and the curve of the
          spine is the thing being read; three-quarter, because a flat
          posterior view flattens the kyphosis it exists to show.

          The distance is not a guess: the frame is ~172 cm and at 35° a
          camera has to stand about 300 cm back to see all of it.
        */}
        <Canvas camera={{ position: [140, 108, -270], fov: 35 }} dpr={[1, 2]}>
          <color attach="background" args={["#f8fafc"]} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[60, 180, 120]} intensity={1.5} />
          <directionalLight position={[-80, 60, -100]} intensity={0.5} />
          <CameraProbe onReady={onCamera} />
          <SkeletonMeshes
            parts={parts}
            highlighted={new Set(viewing ? viewing.bones : bones)}
            onHover={setHovered}
            onPick={(name) =>
              marking && setBones((prev) => (prev.includes(name) ? prev : [...prev, name]))
            }
            picking={marking}
          />
          <OrbitControls
            enabled={!marking}
            enablePan={false}
            // Mid-frame, so turning orbits the body rather than swinging it.
            target={[0, 86, 0]}
            minDistance={70}
            maxDistance={420}
          />
        </Canvas>

        {/* The ink layer. Transparent to pointers unless the pen is armed, so
            rotating never has to fight the drawing surface. */}
        <canvas
          ref={overlayRef}
          width={surface.width}
          height={surface.height}
          className="absolute inset-0"
          style={{ pointerEvents: marking ? "auto" : "none", cursor: marking ? "crosshair" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      {annotations.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            סימונים שמורים
          </p>
          <ul className="space-y-2">
            {annotations.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => show(a)}
                  className="min-w-0 flex-1 text-start"
                >
                  <span className="block font-mono text-sm font-semibold text-slate-800">
                    {a.bones.length ? a.bones.join(" · ") : "ללא עצם מזוהה"}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {new Date(a.createdAt).toLocaleString("he-IL")} · {a.strokes.length} קווים
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
  )
}
