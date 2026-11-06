import * as THREE from "three"

/**
 * The spine on its own, generated rather than downloaded, every piece named.
 *
 * It comes from the skeleton the body map used to be. That model was right in
 * structure, count and proportion (seven cervical, twelve thoracic, five
 * lumbar on an S-curve) and it is kept for the one place a model earns its
 * keep: a level, its two sides and the disc below it are things a
 * chiropractor marks, and a flat figure cannot show them at a size anyone
 * could tap.
 *
 * What a tap names is what a mark stores, in the same vocabulary as
 * `SPINE_ORDER` in regions.ts: `L4` (the vertebra), `L4 R` / `L4 L` (its
 * side, the patient's), `L4/L5` (the disc), `Sacrum`, `SI R`, `Coccyx`.
 *
 * Units are centimetres on a ~170 cm frame. +Z is anterior, so a patient
 * facing +Z has their right at −X.
 */

export interface SpinePart {
  name: string
  kind: "body" | "side" | "disc" | "pelvis"
  geometry: THREE.BufferGeometry
  position: [number, number, number]
}

/** Sagittal curve: the S every back has, seen from the side. */
function spineCurve(): { y: number; z: number }[] {
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

function zAt(points: { y: number; z: number }[], y: number) {
  let best = points[0]
  for (const p of points) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p
  return best.z
}

/** Top to bottom. Height, vertebral body radius and height, in centimetres. */
const LEVELS = [
  ...Array.from({ length: 7 }, (_, i) => ({ name: `C${i + 1}`, y: 152.3 - i * 2.3, r: 1.5, h: 1.5 })),
  ...Array.from({ length: 12 }, (_, i) => ({
    name: `T${i + 1}`,
    y: 136.4 - i * 2.4,
    r: 1.9 + i * 0.04,
    h: 1.9,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    name: `L${i + 1}`,
    y: 104.8 - i * 3.2,
    r: 2.5 + i * 0.06,
    h: 2.5,
  })),
]

/** Minimal merge: three's BufferGeometryUtils is not worth the import here. */
function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
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

export function buildSpine(): SpinePart[] {
  const curve = spineCurve()
  const parts: SpinePart[] = []

  LEVELS.forEach((level, i) => {
    const z = zAt(curve, level.y)
    const { r, h } = level

    // The vertebra itself: body, with the spinous process pointing back.
    const body = new THREE.CylinderGeometry(r, r, h, 18)
    const spinous = new THREE.BoxGeometry(r * 0.5, h * 0.55, r * 1.9)
    spinous.translate(0, -h * 0.1, -r * 1.25)
    parts.push({ name: level.name, kind: "body", geometry: merge([body, spinous]), position: [0, level.y, z] })

    // Each side on its own, so a finding can be one-sided. −X is the
    // patient's right.
    for (const [side, sign] of [
      ["R", -1],
      ["L", 1],
    ] as const) {
      const wing = new THREE.BoxGeometry(r * 1.5, h * 0.55, r * 0.6)
      wing.translate(sign * r * 1.25, 0, -r * 0.45)
      parts.push({ name: `${level.name} ${side}`, kind: "side", geometry: wing, position: [0, level.y, z] })
    }

    // The disc below, between this body and the next one down.
    const below = LEVELS[i + 1]
    const nextName = below ? below.name : "S1"
    const lowerY = below ? below.y + below.h / 2 : 88.6
    const upperY = level.y - h / 2
    const gap = upperY - lowerY
    if (gap > 0.2) {
      const disc = new THREE.CylinderGeometry(r * 0.96, r * 0.96, gap * 0.9, 18)
      const y = (upperY + lowerY) / 2
      parts.push({ name: `${level.name}/${nextName}`, kind: "disc", geometry: disc, position: [0, y, zAt(curve, y)] })
    }
  })

  // Sacrum: a wedge narrowing downward. The sacroiliac joints either side.
  const sacrum = new THREE.CylinderGeometry(4.6, 1.6, 9, 4, 1)
  sacrum.rotateY(Math.PI / 4)
  sacrum.scale(1, 1, 0.5)
  parts.push({ name: "Sacrum", kind: "pelvis", geometry: sacrum, position: [0, 84, -2.2] })
  for (const [side, sign] of [
    ["R", -1],
    ["L", 1],
  ] as const) {
    const joint = new THREE.BoxGeometry(1.2, 6, 2.4)
    joint.rotateZ(sign * 0.32)
    parts.push({ name: `SI ${side}`, kind: "pelvis", geometry: joint, position: [sign * 4.6, 85, -2.4] })
  }
  const coccyx = new THREE.ConeGeometry(0.9, 3.2, 10)
  coccyx.rotateX(Math.PI)
  parts.push({ name: "Coccyx", kind: "pelvis", geometry: coccyx, position: [0, 78, -3.2] })

  return parts
}
