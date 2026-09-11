"use client"

import { Canvas, useThree } from "@react-three/fiber"
import { Line, OrbitControls } from "@react-three/drei"
import { ChevronDown, Undo2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

import { buildSkeleton, type SkeletonPart } from "../lib/skeleton-parts"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { BodyMark3d, BodyMarkTone, BoneStroke } from "@/types/domain"

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

type Mode = "pen" | "point"

const GROUP_COLOR: Record<SkeletonPart["group"], string> = {
  spine: "#dfe6ee",
  skull: "#eef2f7",
  ribs: "#e6ecf3",
  arms: "#e4eaf1",
  legs: "#e4eaf1",
  pelvis: "#e6ecf3",
}

/**
 * The colour a marked bone takes, and the one the pen writes in.
 *
 * The bone carries the finding's colour; the ink never does. A red line on a
 * red bone is an invisible line — so the pen writes in near-black, which reads
 * over red, over yellow and over bare bone alike, and the two say different
 * things without competing: the colour is *what kind*, the ink is *where
 * exactly*.
 */
const TONE_COLOR: Record<BodyMarkTone, string> = {
  pain: "#dc2626",
  nerve: "#eab308",
}
/** Marks made before a finding had a kind. Shown as itself, never guessed at. */
const UNCLASSIFIED_COLOR = "#94a3b8"
const INK = "#111827"
const INK_OTHER = "#64748b"

const toneColor = (tone?: BodyMarkTone) => (tone ? TONE_COLOR[tone] : UNCLASSIFIED_COLOR)

/** Lift off the surface, in centimetres. Enough to clear the bone, small
 *  enough that the line still reads as being on it. */
const INK_LIFT = 0.45

/** What Undo restores. A snapshot rather than a list of reversible operations:
 *  the draft is a handful of arrays, and "put it back exactly" cannot be got
 *  subtly wrong the way "undo a tap that a stroke had already added" can. */
interface Draft {
  bones: string[]
  strokes: BoneStroke[]
  note: string
}

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
  color,
  groupRef,
}: {
  parts: SkeletonPart[]
  highlighted: Set<string>
  color: string
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
            color={highlighted.has(part.name) ? color : GROUP_COLOR[part.group]}
            roughness={0.72}
            metalness={0.04}
            emissive={highlighted.has(part.name) ? color : "#000000"}
            emissiveIntensity={highlighted.has(part.name) ? 0.32 : 0}
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
 * The regions of the body, and the one view each of them means.
 *
 * A region tag is a whole instruction, not half of one. It carries the height
 * to look at, how close to stand, and — the part that was missing — which side
 * to look from, so it lands in the same place every time no matter where the
 * practitioner had turned the model to. Keeping the current angle and changing
 * only the height meant "lower back" pressed while facing the front framed the
 * lumbar spine from the front, which is the chest.
 *
 * Which side follows the anatomy rather than a convention: the spine and the
 * pelvis are read from behind, the ribcage and the limbs from the front. In
 * the model's own axes +Z is anterior — the sternum sits at +11.5, the spinous
 * processes at negative Z — so a posterior view is a negative Z. Each is
 * offset a little to one side and above, because a dead-on view of a symmetric
 * skeleton reads as a flat drawing.
 */
const REGIONS: { key: string; y: number; distance: number; from: [number, number, number] }[] = [
  { key: "bodyMap3d.region.all", y: 84, distance: 305, from: [0.4, 0.14, -1] },
  { key: "bodyMap3d.region.headNeck", y: 152, distance: 118, from: [0.3, 0.14, -1] },
  { key: "bodyMap3d.region.shoulders", y: 134, distance: 150, from: [0.22, 0.16, -1] },
  { key: "bodyMap3d.region.chest", y: 126, distance: 150, from: [0.2, 0.08, 1] },
  { key: "bodyMap3d.region.upperBack", y: 123, distance: 140, from: [0.24, 0.1, -1] },
  { key: "bodyMap3d.region.lowerBack", y: 99, distance: 108, from: [0.24, 0.08, -1] },
  { key: "bodyMap3d.region.pelvis", y: 83, distance: 118, from: [0.24, 0.22, -1] },
  { key: "bodyMap3d.region.legs", y: 45, distance: 180, from: [0.25, 0.06, 1] },
]

const TONES: BodyMarkTone[] = ["pain", "nerve"]

/** What a confirmation is being asked about. Null when nothing is. */
type Pending = { kind: "clear" } | { kind: "delete"; id: string } | null

export function SkeletonViewer({
  annotations,
  onSave,
  onDelete,
  onUpdateNote,
  onUpdateTone,
}: {
  annotations: BodyMark3d[]
  onSave: (annotation: Omit<BodyMark3d, "id" | "createdAt">) => void
  onDelete: (id: string) => void
  onUpdateNote: (id: string, note: string) => void
  onUpdateTone: (id: string, tone: BodyMarkTone) => void
}) {
  const { t, localeTag } = useLocale()
  const parts = useMemo(() => buildSkeleton(), [])
  const [mode, setMode] = useState<Mode>("point")
  const [tone, setTone] = useState<BodyMarkTone>("pain")
  const [hovered, setHovered] = useState<string | null>(null)
  const [strokes, setStrokes] = useState<BoneStroke[]>([])
  const [liveStroke, setLiveStroke] = useState<BoneStroke>([])
  const [bones, setBones] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [history, setHistory] = useState<Draft[]>([])
  /** The saved mark whose details are open, expanded in place in the list. */
  const [openId, setOpenId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState("")
  const [regionKey, setRegionKey] = useState<string | null>(null)
  const [regionOpen, setRegionOpen] = useState(false)
  const [pending, setPending] = useState<Pending>(null)

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
  const regionRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const activePointer = useRef<number | null>(null)
  const penSeen = useRef(false)
  const current = useRef<BoneStroke>([])

  const openMark = annotations.find((a) => a.id === openId) ?? null

  const highlighted = useMemo(
    () => new Set(openMark ? openMark.bones : bones),
    [openMark, bones],
  )
  const highlightColor = openMark ? toneColor(openMark.tone) : TONE_COLOR[tone]

  const onCamera = useCallback((camera: THREE.Camera, controls: unknown) => {
    cameraRef.current = camera
    controlsRef.current = controls as typeof controlsRef.current
  }, [])

  /** Remember the draft as it is now, so the next change can be taken back. */
  const remember = () => setHistory((h) => [...h.slice(-49), { bones, strokes, note }])

  const undo = () => {
    if (!history.length) return
    const previous = history[history.length - 1]
    setBones(previous.bones)
    setStrokes(previous.strokes)
    setNote(previous.note)
    setHistory(history.slice(0, -1))
  }

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

  /** Bones collected while the pen is down. Not an undo step of their own —
   *  the stroke and everything it touched come back together. */
  const addBone = useCallback((name: string | null | undefined) => {
    if (!name) return
    setBones((prev) => (prev.includes(name) ? prev : [...prev, name]))
  }, [])

  /**
   * A tap on a bone adds it; a tap on a bone already chosen takes it off again.
   * Deliberately not a double-click: on a tablet held in one hand a double tap
   * is unreliable to make and easy to make by accident, and the gesture that
   * chose the bone is the obvious one for changing your mind about it.
   */
  const toggleBone = (name: string | null | undefined) => {
    if (!name) return
    remember()
    setBones((prev) => (prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name]))
  }

  const removeBone = (name: string) => {
    remember()
    setBones((prev) => prev.filter((b) => b !== name))
  }

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

    // Once, before the stroke starts: the whole stroke and every bone it runs
    // over are one thing to take back, not forty.
    remember()
    if (controlsRef.current) controlsRef.current.enabled = false
    activePointer.current = e.pointerId
    try {
      // Throws if the pointer is already gone — a stroke that lasted one
      // event is still a dot, and losing capture is not a reason to drop it.
      wrapRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* keep drawing without capture */
    }
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
    /*
     * Take the stroke out of the ref before clearing it. `setStrokes(prev =>
     * [...prev, current.current])` reads the ref when React runs the updater,
     * which is after the next line has emptied it — so every saved mark got an
     * empty stroke and the drawing was lost while the bone names, taken during
     * the drag, looked correct.
     */
    const finished = current.current
    current.current = []
    if (finished.length > 1) setStrokes((prev) => [...prev, finished])
    setLiveStroke([])
  }

  const onPointerUp = (e: React.PointerEvent) => {
    endStroke(e)
    if (mode !== "point" || !pressAt.current) return
    const moved = Math.hypot(e.clientX - pressAt.current.x, e.clientY - pressAt.current.y)
    pressAt.current = null
    if (moved > 6) return
    toggleBone(surfaceAt(e.clientX, e.clientY)?.bone)
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
    const target = controlsRef.current?.target ?? new THREE.Vector3(0, 84, 0)
    onSave({
      bones,
      strokes,
      tone,
      note: note.trim() || undefined,
      camera: [camera.position.x, camera.position.y, camera.position.z],
      target: [target.x, target.y, target.z],
    })
    clear()
    setHistory([])
  }

  /** Open a saved mark: its own angle back, its note in place, in one tap. */
  const toggleOpen = (a: BodyMark3d) => {
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
   * Go to a region: one fixed place, reached the same way from wherever the
   * model happens to be turned to. Nothing about the current view is kept —
   * that is the whole point of a named region.
   */
  const lookFrom = (from: [number, number, number], y: number, distance: number) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    const target = new THREE.Vector3(0, y, 0)
    controls.target.copy(target)
    camera.position.copy(
      target.clone().add(new THREE.Vector3(...from).normalize().multiplyScalar(distance)),
    )
    controls.update()
  }

  const chooseRegion = (region: (typeof REGIONS)[number], remember = true) => {
    lookFrom(region.from, region.y, region.distance)
    setRegionKey(remember ? region.key : null)
    setRegionOpen(false)
  }

  // Close the region list the way every menu closes: a press anywhere else, or
  // Escape. Without this it stays open over the model and swallows the first
  // attempt to draw underneath it.
  useEffect(() => {
    if (!regionOpen) return
    const away = (e: PointerEvent) => {
      if (!regionRef.current?.contains(e.target as Node)) setRegionOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === "Escape" && setRegionOpen(false)
    document.addEventListener("pointerdown", away, true)
    document.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("pointerdown", away, true)
      document.removeEventListener("keydown", key)
    }
  }, [regionOpen])

  const headline = bones.length
    ? bones.join(" · ")
    : (openMark?.bones.join(" · ") ?? hovered ?? "—")

  const hasDraft = strokes.length > 0 || bones.length > 0

  const confirmPending = () => {
    if (!pending) return
    if (pending.kind === "clear") {
      remember()
      clear()
    } else {
      onDelete(pending.id)
      setOpenId(null)
    }
    setPending(null)
  }

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
          camera={{ position: [112, 123, -281], fov: 35 }}
          dpr={[1, 2]}
          /*
           * react-three-fiber sets `touch-action: auto` on the canvas itself,
           * which overrides the wrapper: on a tablet the browser then treats a
           * pen drag as a scroll and swallows the pointermove events the
           * stroke is made of. The mark has to win over the page.
           */
          style={{ touchAction: "none" }}
          /*
           * Aim before the first frame. OrbitControls applies its `target` in
           * an effect, one frame too late: until then the camera looks at the
           * origin — the floor between the feet — and the body sits above the
           * picture, which reads as a model that failed to load.
           *
           * The look-at point is 84, two below the body's own centre, and the
           * distance is set so the skeleton nearly fills the height: the head
           * clears the region control and the feet stand just above the hint
           * line, rather than floating in the middle of an empty panel.
           */
          onCreated={({ camera }) => camera.lookAt(0, 84, 0)}
        >
          <color attach="background" args={["#f8fafc"]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[60, 180, 120]} intensity={1.35} />
          <directionalLight position={[-80, 90, -140]} intensity={0.9} />
          <CameraProbe onReady={onCamera} />
          <SkeletonMeshes
            parts={parts}
            highlighted={highlighted}
            color={highlightColor}
            groupRef={groupRef}
          />

          {/* Every saved mark, on the body, all the time — the point of putting
              the ink in the scene. The one being read stands out; the rest stay
              legible without competing with it. */}
          {annotations.map((a) =>
            a.strokes.map((s, i) =>
              s.length > 1 ? (
                <Line
                  key={`${a.id}-${i}`}
                  points={s}
                  color={a.id === openId ? INK : INK_OTHER}
                  lineWidth={a.id === openId ? 3.5 : 2}
                />
              ) : null,
            ),
          )}
          {strokes.map((s, i) =>
            s.length > 1 ? <Line key={`draft-${i}`} points={s} color={INK} lineWidth={3.5} /> : null,
          )}
          {liveStroke.length > 1 && <Line points={liveStroke} color={INK} lineWidth={3.5} />}

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
            target={[0, 84, 0]}
            minDistance={40}
            /*
             * Far enough out to see the whole body and no further. It was 480,
             * which let a scroll shrink the skeleton to a figure in the middle
             * of a large empty panel — nothing useful is visible from there,
             * and getting back was a guess.
             */
            maxDistance={360}
          />
        </Canvas>

        {/* One control, closed. Eight chips across the top were eight things to
            read every time the panel opened, for a choice made occasionally. */}
        <div ref={regionRef} className="absolute inset-x-3 top-3 z-10 flex justify-center">
          <div className="relative">
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-1 py-1 shadow-sm backdrop-blur">
              <button
                type="button"
                onClick={() => setRegionOpen((v) => !v)}
                aria-expanded={regionOpen}
                aria-haspopup="menu"
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:text-sky-700"
              >
                {regionKey ? t(regionKey) : t("bodyMap3d.selectArea")}
                <ChevronDown
                  className={`size-3.5 text-slate-400 transition-transform ${regionOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {regionKey && (
                <button
                  type="button"
                  onClick={() => chooseRegion(REGIONS[0], false)}
                  aria-label={t("bodyMap3d.clearArea")}
                  className="flex size-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>

            {regionOpen && (
              <div
                role="menu"
                className="absolute start-0 top-full z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              >
                {REGIONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    role="menuitem"
                    onClick={() => chooseRegion(r, r !== REGIONS[0])}
                    className={`block w-full px-3 py-2 text-start text-sm transition-colors hover:bg-slate-50 ${
                      regionKey === r.key ? "font-semibold text-sky-700" : "text-slate-700"
                    }`}
                  >
                    {t(r.key)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/*
         * Undo belongs on the model, not in the side panel.
         *
         * It lived under the tools, which put it at 855px down a 720px
         * viewport — present, working, and below the fold, so a stroke drawn by
         * mistake had no visible way back. Here it is beside the thing being
         * drawn on, where the hand and the eye already are.
         *
         * Outside the draft on purpose: taking off the last bone empties the
         * draft, and a button that vanishes with the thing it would bring back
         * is no use. It stays as long as there is something to take back.
         */}
        {history.length > 0 && (
          <button
            type="button"
            onClick={undo}
            className="absolute end-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            <Undo2 className="size-3.5 rtl:-scale-x-100" aria-hidden />
            {t("bodyMap3d.undo")}
          </button>
        )}

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
            className="mt-1 break-words text-3xl font-bold leading-tight tracking-tight"
            style={{ color: hasDraft || openMark ? highlightColor : "#0369a1" }}
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
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        {/* The kind of finding, beside the tools: it is the other half of what
            you are marking with, and it applies to both of them. */}
        <div className="grid grid-cols-2 gap-2">
          {TONES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTone(value)}
              aria-pressed={tone === value}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                tone === value
                  ? "border-slate-900 bg-white text-slate-900"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: TONE_COLOR[value] }}
                aria-hidden
              />
              {t(`bodyMap3d.tone.${value}`)}
            </button>
          ))}
        </div>

        {/* The mark being made. Directly under the tools, where it is seen the
            moment it exists — it used to sit below a five-line instruction and
            read as missing. */}
        {hasDraft && (
          <div className="rounded-2xl border-2 border-slate-300 bg-slate-50/60 p-4">
            {bones.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {bones.map((bone) => (
                  <span
                    key={bone}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                    dir="ltr"
                  >
                    {bone}
                    <button
                      type="button"
                      onClick={() => removeBone(bone)}
                      aria-label={t("bodyMap3d.removeBone", { bone })}
                      className="text-slate-400 transition-colors hover:text-rose-600"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <label
              htmlFor="mark-note"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
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
              <button
                type="button"
                onClick={() => setPending({ kind: "clear" })}
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
                      open ? "border-slate-300 bg-slate-50/60" : "border-slate-100"
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
                      <span
                        className="mt-1.5 size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: toneColor(a.tone) }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span dir="ltr" className="block font-mono text-sm font-semibold text-slate-800">
                          {a.bones.join(" · ") || "—"}
                        </span>
                        {!open && a.note && (
                          <span className="mt-0.5 block truncate text-xs text-slate-600">{a.note}</span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          {t(a.tone ? `bodyMap3d.tone.${a.tone}` : "bodyMap3d.tone.unclassified")}
                          {" · "}
                          {new Date(a.createdAt).toLocaleString(localeTag)}
                          {a.strokes.length
                            ? ` · ${
                                a.strokes.length === 1
                                  ? t("bodyMap3d.strokeCountOne")
                                  : t("bodyMap3d.strokeCount", { n: a.strokes.length })
                              }`
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
                      <div className="border-t border-slate-200 px-3 py-3">
                        {/* A mark made before findings had a kind can be given
                            one here. Nothing assigns it silently. */}
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {TONES.map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => onUpdateTone(a.id, value)}
                              aria-pressed={a.tone === value}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                                a.tone === value
                                  ? "border-slate-900 text-slate-900"
                                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
                              }`}
                            >
                              <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: TONE_COLOR[value] }}
                                aria-hidden
                              />
                              {t(`bodyMap3d.tone.${value}`)}
                            </button>
                          ))}
                        </div>

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
                            onClick={() => setPending({ kind: "delete", id: a.id })}
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

        {/* Last, not first: it is read once and then never again. */}
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
          {t("bodyMap3d.intro")}
          <br />
          <span className="text-slate-500">{t("bodyMap3d.introDetail")}</span>
        </p>
      </div>

      {/*
       * Anything that loses work asks first. Removing one bone does not: it is
       * a single tap to put back, and the Undo beside it restores the whole
       * draft. These two are the ones you cannot simply do again — a saved mark
       * is gone from the record, and Clear takes the drawing, the bones and the
       * note together.
       */}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t(pending?.kind === "delete" ? "bodyMap3d.confirm.deleteTitle" : "bodyMap3d.confirm.clearTitle")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {t(pending?.kind === "delete" ? "bodyMap3d.confirm.deleteBody" : "bodyMap3d.confirm.clearBody")}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmPending}>
              {t(pending?.kind === "delete" ? "bodyMap3d.deleteMark" : "bodyMap3d.clear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
