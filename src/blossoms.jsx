import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { scroll } from './scrollState'

/* Real 3D blossoms scattered through the garden.
   The point-cloud version read as confetti because a flower's whole character is its
   petal silhouette, which loose dots can never describe. One mesh, instanced, does. */

const COUNT = 520
const SPAN_Y = 58

export default function Blossoms() {
  const ref = useRef()
  const { scene } = useGLTF('/models/blossom.glb')

  const geometry = useMemo(() => {
    let g = null
    scene.traverse(o => { if (!g && o.isMesh) g = o.geometry.clone() })
    if (!g) return new THREE.SphereGeometry(0.3, 8, 6)
    const size = new THREE.Vector3(), c = new THREE.Vector3()
    g.computeBoundingBox(); g.boundingBox.getSize(size); g.boundingBox.getCenter(c)
    g.translate(-c.x, -c.y, -c.z)
    const k = 1 / Math.max(size.x, size.y, size.z)   // unit size; per-instance scale does the rest
    g.scale(k, k, k)
    g.computeVertexNormals()
    return g
  }, [scene])

  /* Blossoms stay exactly where they were — right up against the lens, big. The layering fix is
     `depthWrite: false`: a petal in front of a card no longer writes depth, so the card (which
     renders later, at renderOrder 2) draws straight over it instead of being punched through.
     Petals stay visible over the card as a soft pink veil rather than a pink wall. */
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff8ed8', roughness: 0.55, metalness: 0.05,
    emissive: '#c04fa0', emissiveIntensity: 0.35,
    envMapIntensity: 1.2, side: THREE.DoubleSide,
    vertexColors: true,
    transparent: true, opacity: 0.5, depthWrite: false,
  }), [])

  // per-instance colour across pinks and violets
  const colours = useMemo(() => {
    const arr = new Float32Array(COUNT * 3)
    const pal = ['#ff6ad5', '#ff9ed6', '#c86bff', '#a86bff', '#ffc0e8', '#e59bff']
    const c = new THREE.Color()
    for (let i = 0; i < COUNT; i++) {
      c.set(pal[(Math.random() * pal.length) | 0]).multiplyScalar(0.75 + Math.random() * 0.6)
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b
    }
    return new THREE.InstancedBufferAttribute(arr, 3)
  }, [])

  // Flowers scattered at random read as disconnected debris. Real blossom grows in CLUSTERS on
  // a bough, so seed a set of bough anchors and hang several flowers off each one.
  const seeds = useMemo(() => {
    const BOUGHS = 46
    const anchors = Array.from({ length: BOUGHS }, () => ({
      a: Math.random() * Math.PI * 2,
      rad: 8 + Math.random() * 13,
      y: (Math.random() - 0.5) * SPAN_Y,
    }))
    return Array.from({ length: COUNT }, (_, i) => {
      const b = anchors[i % BOUGHS]
      const spread = 1.1 + Math.random() * 2.6      // tight around its bough
      const off = Math.random() * Math.PI * 2
      return {
        a: b.a + Math.cos(off) * spread * 0.055,
        rad: b.rad + Math.sin(off) * spread,
        y: b.y + (Math.random() - 0.5) * spread * 1.7,
        s: 0.7 + Math.pow(Math.random(), 1.5) * 2.2,
        rx: Math.random() * Math.PI, ry: Math.random() * Math.PI * 2, rz: Math.random() * Math.PI,
        sp: 0.3 + Math.random() * 0.7,
      }
    })
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(({ clock }) => {
    const inst = ref.current
    if (!inst) return
    const t = clock.elapsedTime
    // Nearly out in act three — the pink petals fight the green night garden badly, and the
    // reference has none of them.
    material.opacity = 0.5 * (1 - scroll.fin * 0.94)
    const lift = scroll.gardenY
    for (let i = 0; i < COUNT; i++) {
      const p = seeds[i]
      let y = p.y + lift
      y = ((y + SPAN_Y / 2) % SPAN_Y + SPAN_Y) % SPAN_Y - SPAN_Y / 2
      dummy.position.set(Math.cos(p.a) * p.rad, y, Math.sin(p.a) * p.rad)
      dummy.rotation.set(p.rx + Math.sin(t * 0.2 * p.sp) * 0.15, p.ry + t * 0.05 * p.sp, p.rz)
      // straight multiply, not 0.35 + 0.65*bloom — at rest that left them at a third of full size
      // and the opening frame is supposed to be nothing but the sigil on black
      dummy.scale.setScalar(p.s * scroll.bloom)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    }
    inst.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[geometry, material, COUNT]} frustumCulled={false}>
      <instancedBufferAttribute attach="instanceColor" args={[colours.array, 3]} />
    </instancedMesh>
  )
}

useGLTF.preload('/models/blossom.glb')
