import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scroll } from './scrollState'

/* ============================================================
   THE GARDEN — a point cloud, not vegetation geometry.
   Every point knows two positions:
     aStart  = collapsed into a double helix under the sigil (the "DNA tail")
     position = its final place in the garden
   uBloom 0→1 detonates the tail outward into the garden, and running it
   back to 0 at the end of the scroll reforms the tail. One mechanic,
   both bookends.
   ============================================================ */

const N = 168000
const SPAN_Y = 120

function rnd(a, b) { return a + Math.random() * (b - a) }

// palette: mostly cool green/teal, gold highlights, rare magenta
const PAL = ['#7dffb2', '#2fe0a8', '#9bff6a', '#d8ff8a', '#ffd76a', '#ffb03a', '#65e8ff', '#ff6ad5']
const WEIGHT = [0.26, 0.2, 0.14, 0.12, 0.1, 0.06, 0.09, 0.03]
// blossoms get their own palette — the reference's flowers are dense pink/violet point clusters
const BLOOM_PAL = ['#ff6ad5', '#ff8ecb', '#c86bff', '#9a5cff', '#ffb3e6', '#e0a0ff', '#ff4fa3']
const BLOOM_W = [0.22, 0.2, 0.17, 0.14, 0.12, 0.09, 0.06]

function pickWeighted(pal, weights) {
  let r = Math.random(), acc = 0
  for (let i = 0; i < weights.length; i++) { acc += weights[i]; if (r <= acc) return pal[i] }
  return pal[0]
}

export default function Garden() {
  const ref = useRef()
  const mat = useRef()

  const geo = useMemo(() => {
    const pos = new Float32Array(N * 3)
    const start = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const siz = new Float32Array(N)
    const rn = new Float32Array(N)

    const tmp = new THREE.Color()

    // ---- build a list of plants scattered in a hollow cylinder around the helix
    const plants = []
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * Math.PI * 2
      const rad = rnd(9.5, 24)
      plants.push({
        x: Math.cos(a) * rad,
        z: Math.sin(a) * rad,
        y: rnd(-46, 46),
        // 0 tree · 1 mushroom · 2 hanging tendril · 3 low bush
        kind: (() => { const r = Math.random()
          if (r < 0.20) return 0        // tree
          if (r < 0.32) return 1        // mushroom
          if (r < 0.46) return 2        // hanging tendril
          return 3                      // low bush (real 3D blossoms handle the flowers now)
        })(),
        scale: rnd(0.7, 1.9),
      })
    }

    let i = 0
    while (i < N) {
      const p = plants[(Math.random() * plants.length) | 0]
      const s = p.scale
      let x, y, z

      if (p.kind === 0) {
        // TREE: slim trunk + broad canopy
        if (Math.random() < 0.22) {
          const t = Math.random()
          x = p.x + rnd(-0.16, 0.16) * s
          y = p.y + t * 7 * s
          z = p.z + rnd(-0.16, 0.16) * s
        } else {
          const u = Math.random() * Math.PI * 2
          const v = Math.acos(2 * Math.random() - 1)
          const r = Math.pow(Math.random(), 0.42) * 3.5 * s
          x = p.x + Math.sin(v) * Math.cos(u) * r
          y = p.y + 7 * s + Math.cos(v) * r * 0.62
          z = p.z + Math.sin(v) * Math.sin(u) * r
        }
      } else if (p.kind === 1) {
        // MUSHROOM: short stalk + dome cap
        if (Math.random() < 0.3) {
          const t = Math.random()
          x = p.x + rnd(-0.12, 0.12) * s
          y = p.y + t * 2.1 * s
          z = p.z + rnd(-0.12, 0.12) * s
        } else {
          const u = Math.random() * Math.PI * 2
          const r = Math.pow(Math.random(), 0.5) * 2.1 * s
          const dome = Math.cos((r / (2.1 * s)) * Math.PI * 0.5)
          x = p.x + Math.cos(u) * r
          y = p.y + 2.1 * s + dome * 0.9 * s
          z = p.z + Math.sin(u) * r
        }
      } else if (p.kind === 2) {
        // HANGING TENDRIL: a strand falling, swaying wider as it drops
        const t = Math.pow(Math.random(), 0.8)
        const sway = t * 1.5 * s
        const a2 = p.y * 0.6
        x = p.x + Math.sin(a2 + t * 5) * sway + rnd(-0.1, 0.1)
        y = p.y - t * 11 * s
        z = p.z + Math.cos(a2 + t * 5) * sway + rnd(-0.1, 0.1)
      } else if (p.kind === 3) {
        // LOW BUSH: flattened blob
        const u = Math.random() * Math.PI * 2
        const r = Math.pow(Math.random(), 0.55) * 2.4 * s
        x = p.x + Math.cos(u) * r
        y = p.y + rnd(0, 0.9) * s
        z = p.z + Math.sin(u) * r
      } else {
        // BLOSSOM: a slim trunk carrying several dense clustered flower heads
        if (Math.random() < 0.13) {
          const t2 = Math.random()
          x = p.x + rnd(-0.13, 0.13) * s
          y = p.y + t2 * 5.4 * s
          z = p.z + rnd(-0.13, 0.13) * s
        } else {
          // pick one of a few heads, then fill it densely toward its centre
          const head = (Math.random() * 5) | 0
          const ha = (head / 5) * Math.PI * 2 + p.x
          const hd = 1.5 * s
          const cx = p.x + Math.cos(ha) * hd
          const cy = p.y + 5.4 * s + Math.sin(head * 2.1) * 1.1 * s
          const cz = p.z + Math.sin(ha) * hd
          const u = Math.random() * Math.PI * 2
          const v = Math.acos(2 * Math.random() - 1)
          const r = Math.pow(Math.random(), 0.30) * 2.15 * s   // low exponent = packed centre
          x = cx + Math.sin(v) * Math.cos(u) * r
          y = cy + Math.cos(v) * r * 0.82
          z = cz + Math.sin(v) * Math.sin(u) * r
        }
      }

      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z

      // collapsed state: a tight double helix hanging under the sigil
      const k = i / N
      const strand = i % 2 === 0 ? 0 : Math.PI
      const ha = k * Math.PI * 54 + strand
      const hr = 0.5 + Math.sin(k * Math.PI * 8) * 0.16
      start[i * 3] = Math.cos(ha) * hr
      start[i * 3 + 1] = 10 - k * 26
      start[i * 3 + 2] = Math.sin(ha) * hr

      const isBloom = p.kind === 4
      const hex = isBloom ? pickWeighted(BLOOM_PAL, BLOOM_W) : pickWeighted(PAL, WEIGHT)
      tmp.set(hex).multiplyScalar(rnd(isBloom ? 0.7 : 0.55, isBloom ? 1.35 : 1.15))
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b

      siz[i] = rnd(0.6, 2.9)
      rn[i] = Math.random()
      i++
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1))
    g.setAttribute('aRnd', new THREE.BufferAttribute(rn, 1))
    return g
  }, [])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 },
      uBloom: { value: 0 },
      uAct3: { value: 0 },   // act one's particle field stands down for the statuary
      uPix: { value: Math.min(window.devicePixelRatio, 2) },
      uTint: { value: new THREE.Color('#ffffff') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      attribute vec3 aStart;
      attribute float aSize;
      attribute float aRnd;
      uniform float uT, uBloom, uPix;
      varying vec3 vC;
      varying float vA;
      void main(){
        vC = color;
        // staggered detonation so it unfurls instead of popping
        float b = clamp((uBloom - aRnd * 0.38) / 0.62, 0.0, 1.0);
        b = b * b * (3.0 - 2.0 * b);
        vec3 p = mix(aStart, position, b);
        // idle drift
        float w = aRnd * 6.28 + uT * 0.22;
        p.x += sin(w) * 0.28 * b;
        p.y += cos(w * 0.77) * 0.22 * b;
        p.z += sin(w * 0.61) * 0.28 * b;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        // points near the lens ballooned into soft blobs; clamp the size and fade them out
        vA = (0.45 + 0.55 * sin(aRnd * 20.0 + uT * 1.1)) * (0.25 + 0.75 * b)
             * smoothstep(2.5, 9.0, depth) * (1.0 - smoothstep(46.0, 72.0, depth));
        gl_PointSize = min(aSize * uPix * (125.0 / max(depth, 0.001)), 17.0 * uPix);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uTint;
      uniform float uAct3;
      varying vec3 vC;
      varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float len = length(d);
        // a crisp core with a soft halo reads far sharper than one wide gaussian
        float core = smoothstep(0.30, 0.04, len);
        float halo = smoothstep(0.5, 0.0, len);
        float a = core * 0.85 + halo * halo * 0.4;
        // down to a quarter in the garden — at full strength this confetti buries the marble
        gl_FragColor = vec4(vC * uTint, a * vA * 0.95 * (1.0 - uAct3 * 0.76));
      }`,
  }), [])

  useFrame(({ clock }) => {
    material.uniforms.uT.value = clock.elapsedTime
    material.uniforms.uBloom.value = scroll.bloom
    material.uniforms.uAct3.value = scroll.fin
    material.uniforms.uTint.value.copy(scroll.tint)
    if (ref.current) {
      // parallax: garden rises slower than the cards, so it reads as further away
      ref.current.position.y = scroll.gardenY
      ref.current.rotation.y = clock.elapsedTime * 0.008
    }
  })

  return <points ref={ref} geometry={geo} material={material} frustumCulled={false} userData={{ mat: material }} />
}

export { N as GARDEN_POINTS }
