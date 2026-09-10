import * as THREE from "three"

/**
 * A schematic human skeleton, generated rather than downloaded.
 *
 * The obvious move is a scanned anatomical mesh, and that is where this ends
 * up if the interaction proves itself. For deciding whether the interaction
 * works, generating the skeleton is better on three counts:
 *
 *  - **Every bone is named because it is built named.** An imported mesh has to
 *    be taken apart in Blender and labelled by hand before a tap can say "T4",
 *    which is most of the work and none of the question being asked here.
 *  - **Nothing to license.** Anatomical models are CC-BY-SA or paid, and a
 *    prototype should not commit the clinic to either.
 *  - **Nothing to download.** No multi-megabyte asset on a clinic tablet.
 *
 * It is schematic and says so: correct in structure, count and proportion —
 * seven cervical, twelve thoracic with their ribs, five lumbar — and not a
 * likeness. For finding a level, which is what a chiropractor marks, the
 * numbering matters more than the silhouette.
 *
 * Units are centimetres on a ~170 cm frame, origin between the feet.
 */

export interface SkeletonPart {
  /** Clinical name. This is what a mark records — `T4`, not a coordinate. */
  name: string
  /** Coarse grouping, for colour and for filtering later. */
  group: "spine" | "skull" | "ribs" | "arms" | "legs" | "pelvis"
  geometry: THREE.BufferGeometry
  position: [number, number, number]
  quaternion?: THREE.Quaternion
}

/** Sagittal curve of the spine: the S every back has, viewed from the side. */
function spinePoints(): { y: number; z: number }[] {
  // Landmarks up the column, z positive being forward (anterior).
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 88, -1.5), // sacral base
    new THREE.Vector3(0, 98, 2.2), // lumbar lordosis, deepest around L3
    new THREE.Vector3(0, 112, -0.5), // thoracolumbar junction
    new THREE.Vector3(0, 128, -3.2), // thoracic kyphosis
    new THREE.Vector3(0, 142, -1.0), // cervicothoracic junction
    new THREE.Vector3(0, 152, 1.8), // cervical lordosis
  ])
  return curve.getPoints(200).map((p) => ({ y: p.y, z: p.z }))
}

/** Sample the spine curve at a height, so a vertebra sits on the curve. */
function zAtHeight(points: { y: number; z: number }[], y: number): number {
  let best = points[0]
  for (const p of points) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p
  return best.z
}

const VERTEBRA_LEVELS = [
  // name, height (cm), body radius, disc height
  ...Array.from({ length: 7 }, (_, i) => ({
    name: `C${7 - i}`,
    y: 138.5 + i * 2.3,
    r: 1.5,
    h: 1.5,
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    name: `T${12 - i}`,
    y: 110 + i * 2.4,
    r: 1.9 + (11 - i) * 0.04,
    h: 1.9,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    name: `L${5 - i}`,
    y: 92 + i * 3.2,
    r: 2.5 + (4 - i) * 0.06,
    h: 2.5,
  })),
]

/** A vertebra: body, spinous process pointing back, two transverse wings. */
function vertebraGeometry(radius: number, height: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []

  const body = new THREE.CylinderGeometry(radius, radius, height, 16)
  parts.push(body)

  const spinous = new THREE.BoxGeometry(radius * 0.5, height * 0.55, radius * 1.9)
  spinous.translate(0, -height * 0.1, -radius * 1.25)
  parts.push(spinous)

  for (const side of [-1, 1]) {
    const wing = new THREE.BoxGeometry(radius * 1.5, height * 0.45, radius * 0.5)
    wing.translate(side * radius * 1.1, 0, -radius * 0.45)
    parts.push(wing)
  }

  return mergeGeometries(parts)
}

/** Minimal merge — three's BufferGeometryUtils is not worth the import here. */
function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  for (const g of list) {
    const geo = g.index ? g.toNonIndexed() : g
    const pos = geo.getAttribute("position")
    const nor = geo.getAttribute("normal")
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i))
    }
    if (geo !== g) geo.dispose()
    g.dispose()
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3))
  return merged
}

/** A long bone: a shaft that swells at both ends, like every long bone does. */
function longBone(length: number, radius: number): THREE.BufferGeometry {
  const shaft = new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, length, 12)
  const top = new THREE.SphereGeometry(radius, 12, 10)
  top.translate(0, length / 2, 0)
  const bottom = new THREE.SphereGeometry(radius * 0.95, 12, 10)
  bottom.translate(0, -length / 2, 0)
  return mergeGeometries([shaft, top, bottom])
}

/** Aim a bone from one point to another, returning position and rotation. */
function between(
  from: [number, number, number],
  to: [number, number, number],
): { position: [number, number, number]; quaternion: THREE.Quaternion; length: number } {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const dir = b.clone().sub(a)
  const length = dir.length()
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  )
  return { position: [mid.x, mid.y, mid.z], quaternion, length }
}

export function buildSkeleton(): SkeletonPart[] {
  const parts: SkeletonPart[] = []
  const spine = spinePoints()

  // ── Spine ────────────────────────────────────────────────────────────────
  for (const level of VERTEBRA_LEVELS) {
    parts.push({
      name: level.name,
      group: "spine",
      geometry: vertebraGeometry(level.r, level.h),
      position: [0, level.y, zAtHeight(spine, level.y)],
    })
  }

  const sacrum = new THREE.CylinderGeometry(2.4, 1.4, 9, 12)
  parts.push({ name: "Sacrum", group: "spine", geometry: sacrum, position: [0, 84, -2.2] })
  const coccyx = new THREE.CylinderGeometry(0.9, 0.5, 3.5, 8)
  parts.push({ name: "Coccyx", group: "spine", geometry: coccyx, position: [0, 78, -3.2] })

  // ── Skull ────────────────────────────────────────────────────────────────
  const cranium = new THREE.SphereGeometry(8.2, 24, 20)
  cranium.scale(0.92, 1.1, 1)
  parts.push({ name: "Cranium", group: "skull", geometry: cranium, position: [0, 163, 1.5] })
  const mandible = new THREE.BoxGeometry(9, 3.6, 7.5)
  parts.push({ name: "Mandible", group: "skull", geometry: mandible, position: [0, 155.5, 3.4] })

  // ── Ribs ─────────────────────────────────────────────────────────────────
  // Twelve pairs off the thoracic vertebrae, sweeping forward and down. The
  // lowest two are floating and stop short of the sternum, as they do.
  for (let i = 0; i < 12; i++) {
    const level = VERTEBRA_LEVELS.find((v) => v.name === `T${i + 1}`)!
    const spread = 1 - Math.abs(i - 6) / 11
    const width = 8.5 + spread * 5.5
    const depth = 6.5 + spread * 4.5
    const floating = i >= 10
    const arc = floating ? Math.PI * 0.62 : Math.PI * 0.92
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 14 }, (_, k) => {
          const t = (k / 13) * arc
          return new THREE.Vector3(
            side * Math.sin(t) * width,
            level.y - Math.pow(t / arc, 2) * (4 + spread * 3),
            zAtHeight(spine, level.y) - 1.5 + (1 - Math.cos(t)) * depth,
          )
        }),
      )
      parts.push({
        name: `Rib ${i + 1}${side < 0 ? "R" : "L"}`,
        group: "ribs",
        geometry: new THREE.TubeGeometry(curve, 24, 0.55, 6, false),
        position: [0, 0, 0],
      })
    }
  }

  const sternum = new THREE.BoxGeometry(4.2, 16, 1.4)
  parts.push({ name: "Sternum", group: "ribs", geometry: sternum, position: [0, 126, 11.5] })

  // ── Shoulder girdle and arms ─────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const s = side < 0 ? "R" : "L"

    const clav = between([side * 1.8, 140, 8], [side * 15, 138.5, 4])
    parts.push({
      name: `Clavicle ${s}`,
      group: "arms",
      geometry: new THREE.CylinderGeometry(0.7, 0.7, clav.length, 10),
      position: clav.position,
      quaternion: clav.quaternion,
    })

    const scap = new THREE.BoxGeometry(9, 12, 1.2)
    scap.translate(0, 0, 0)
    parts.push({
      name: `Scapula ${s}`,
      group: "arms",
      geometry: scap,
      position: [side * 10, 133, -7],
    })

    const hum = between([side * 16.5, 138, 2], [side * 19, 108, 0])
    parts.push({
      name: `Humerus ${s}`,
      group: "arms",
      geometry: longBone(hum.length, 1.9),
      position: hum.position,
      quaternion: hum.quaternion,
    })

    const rad = between([side * 19.5, 106, 1.2], [side * 21, 82, 2])
    parts.push({
      name: `Radius ${s}`,
      group: "arms",
      geometry: longBone(rad.length, 1.1),
      position: rad.position,
      quaternion: rad.quaternion,
    })
    const uln = between([side * 18.2, 106, -1], [side * 19.6, 82, -0.5])
    parts.push({
      name: `Ulna ${s}`,
      group: "arms",
      geometry: longBone(uln.length, 1.05),
      position: uln.position,
      quaternion: uln.quaternion,
    })

    const hand = new THREE.BoxGeometry(4.6, 9, 1.6)
    parts.push({ name: `Hand ${s}`, group: "arms", geometry: hand, position: [side * 20.5, 75, 1] })
  }

  // ── Pelvis and legs ──────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const s = side < 0 ? "R" : "L"

    const ilium = new THREE.SphereGeometry(7.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6)
    ilium.scale(1, 0.85, 0.55)
    parts.push({
      name: `Ilium ${s}`,
      group: "pelvis",
      geometry: ilium,
      position: [side * 5.5, 84, -1],
    })

    const fem = between([side * 8.5, 82, 0], [side * 6, 46, 0])
    parts.push({
      name: `Femur ${s}`,
      group: "legs",
      geometry: longBone(fem.length, 2.5),
      position: fem.position,
      quaternion: fem.quaternion,
    })

    const patella = new THREE.SphereGeometry(1.8, 12, 10)
    patella.scale(1, 1, 0.6)
    parts.push({ name: `Patella ${s}`, group: "legs", geometry: patella, position: [side * 6, 45, 3] })

    const tib = between([side * 6, 44, 0], [side * 5.5, 8, 0])
    parts.push({
      name: `Tibia ${s}`,
      group: "legs",
      geometry: longBone(tib.length, 1.9),
      position: tib.position,
      quaternion: tib.quaternion,
    })
    const fib = between([side * 8.6, 43, -0.5], [side * 8, 9, -0.5])
    parts.push({
      name: `Fibula ${s}`,
      group: "legs",
      geometry: longBone(fib.length, 0.85),
      position: fib.position,
      quaternion: fib.quaternion,
    })

    const foot = new THREE.BoxGeometry(6, 3.2, 13)
    parts.push({ name: `Foot ${s}`, group: "legs", geometry: foot, position: [side * 6, 4, 3.5] })
  }

  return parts
}

/** Overall height of the generated frame, for framing the camera. */
export const SKELETON_HEIGHT = 172
