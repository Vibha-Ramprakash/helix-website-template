import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { scroll } from './scrollState'

/* A single FULL vertebral column, cervical down to the sacrum.
   Not a vertebra rubber-stamped: you descend the real thing, and by the end of
   the scroll you have arrived at its base. ?spine=curved swaps the mesh. */

// Size the column by its CROSS-SECTION, never its length. Scaling the longest axis to a
// fixed height made a spine as wide as the cards. A real spine is thin and long, so we set
// the thickness and let the length fall out of it.
const SPINE_W = 5.4

export default function BoneSpine() {
  const ref = useRef()
  const which = typeof location !== 'undefined' && location.search.includes('spine=curved')
    ? '/models/spine_curved.glb' : '/models/spine_straight.glb'
  const { scene } = useGLTF(which)

  const { geometry, height } = useMemo(() => {
    let g = null
    scene.traverse(o => { if (!g && o.isMesh) g = o.geometry.clone() })
    if (!g) return { geometry: new THREE.CylinderGeometry(0.4, 0.4, 20, 12), height: 20 }

    const size = new THREE.Vector3(), c = new THREE.Vector3()
    g.computeBoundingBox(); g.boundingBox.getSize(size); g.boundingBox.getCenter(c)
    g.translate(-c.x, -c.y, -c.z)

    // image_to_3d gives arbitrary orientation: stand the longest axis up along Y
    if (size.x >= size.y && size.x >= size.z) g.rotateZ(Math.PI / 2)
    else if (size.z > size.y && size.z > size.x) g.rotateX(-Math.PI / 2)

    g.computeBoundingBox(); g.boundingBox.getSize(size)
    const k = SPINE_W / Math.max(size.x, size.z)
    g.scale(k, k, k)
    g.computeVertexNormals()
    return { geometry: g, height: size.y * k }
  }, [scene])

  // abalone / dichroic rather than bone: a dark base whose colour is almost all
  // iridescence and rim light, so it sits inside the palette instead of glaring out of it
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#131a20', roughness: 0.22, metalness: 0.55,
    clearcoat: 1, clearcoatRoughness: 0.14,
    iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 760],
    envMapIntensity: 2.4, sheen: 0.6, sheenColor: new THREE.Color('#7fffd0'),
    transparent: true, opacity: 1,
  }), [])

  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    // start at the cervical end, arrive at the sacrum as the scroll completes
    const travel = Math.max(0, height - 13)
    // ...and in act three it retreats to the apex of the V and drives its sacrum down THROUGH the
    // ground plane, which is opaque — so the column simply disappears into the earth behind the
    // main bust instead of stopping dead on the surface.
    // The column ENTERS from above rather than being there from frame one: at spineIn 0 it sits
    // a full height up, out of frame, so the opening is just the sigil on black.
    const entry = (1 - scroll.spineIn) * (height * 0.85)
    m.position.y = -travel / 2 + scroll.p * travel - scroll.fin * 1.6 + entry
    m.position.z = -scroll.fin * 19    // in act three, just behind the apex bust
    m.visible = scroll.spineIn > 0.002
    m.rotation.y = clock.elapsedTime * 0.07
    m.rotation.z = Math.sin(clock.elapsedTime * 0.13) * 0.02
    // dissolve into the garden rather than standing in it as a hard object
    material.opacity = 1 - scroll.fin * 0.88
  })

  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}

useGLTF.preload('/models/spine_straight.glb')
