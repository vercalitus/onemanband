"use client"

import { Canvas, type ThreeEvent } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { useMemo, useState } from "react"
import * as THREE from "three"

import { buildSpine, type SpinePart } from "../lib/spine-model"
import { spineLabel } from "../lib/regions"
import { useLocale } from "@/components/providers/locale-provider"

const BASE: Record<SpinePart["kind"], string> = {
  body: "#e7ecf2",
  side: "#d9e1ea",
  disc: "#9fc4d8",
  pelvis: "#e2e8ef",
}

/**
 * The spine model, turned with a drag and marked with a tap.
 *
 * Loaded only when it is opened (three.js is not small), and drawn inside the
 * figures' own panel so it reads as looking closer at the back, not as a
 * separate tool. `colors` comes from the map: the items of the mark being made
 * in its colour, saved findings in theirs.
 */
export function SpineViewer({
  colors,
  emphasis,
  onToggle,
}: {
  colors: Map<string, string>
  emphasis: Set<string>
  onToggle: (item: string) => void
}) {
  const { t } = useLocale()
  const parts = useMemo(() => buildSpine(), [])
  const [hovered, setHovered] = useState<string | null>(null)

  const click = (e: ThreeEvent<MouseEvent>, name: string) => {
    e.stopPropagation()
    // A drag that turned the model is not a choice.
    if (e.delta > 6) return
    onToggle(name)
  }

  return (
    <div className="relative h-[620px] w-full touch-none overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-white">
      <Canvas
        // Far enough back that C1 and the coccyx both fit, from behind and a
        // little to one side: a spine seen dead-on reads as a flat stack.
        camera={{ position: [60, 124, -146], fov: 32 }}
        dpr={[1, 2]}
        style={{ touchAction: "none" }}
        onCreated={({ camera }) => camera.lookAt(0, 116, 0)}
        onPointerMissed={() => setHovered(null)}
      >
        <color attach="background" args={["#f8fafc"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[60, 180, 120]} intensity={1.2} />
        <directionalLight position={[-80, 90, -140]} intensity={1} />
        {parts.map((part) => {
          const color = colors.get(part.name)
          const isHover = hovered === part.name
          return (
            <mesh
              key={part.name}
              geometry={part.geometry}
              position={part.position}
              onClick={(e) => click(e, part.name)}
              onPointerOver={(e) => {
                e.stopPropagation()
                setHovered(part.name)
              }}
              onPointerOut={() => setHovered((h) => (h === part.name ? null : h))}
            >
              <meshStandardMaterial
                color={color ?? (isHover ? "#bae6fd" : BASE[part.kind])}
                roughness={0.7}
                metalness={0.03}
                emissive={color ?? "#000000"}
                emissiveIntensity={color ? (emphasis.has(part.name) ? 0.35 : 0.15) : 0}
                side={THREE.DoubleSide}
              />
            </mesh>
          )
        })}
        <OrbitControls
          makeDefault
          target={[0, 116, 0]}
          enablePan
          screenSpacePanning
          zoomToCursor
          minDistance={25}
          maxDistance={220}
        />
      </Canvas>
      <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-lg font-bold text-sky-700" dir="ltr">
        {hovered ? spineLabel(t, hovered) : ""}
      </p>
      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] font-medium text-slate-500">
        {t("bodyMap.spine.hint")}
      </p>
    </div>
  )
}
