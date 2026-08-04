import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scroll } from './scrollState'

/* The far layer. Two generated loops on big planes deep behind everything, additively blended
   so their black background disappears and only the light survives. Gives the scene organic
   movement no shader will match, for the cost of one texture. Depth reads:
   video (far) -> point-cloud garden (mid) -> blossoms + cards (front). */

function useLoop(src) {
  return useMemo(() => {
    const v = document.createElement('video')
    v.src = src; v.loop = true; v.muted = true; v.playsInline = true
    v.crossOrigin = 'anonymous'
    v.play().catch(() => {})
    const t = new THREE.VideoTexture(v)
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    return { video: v, texture: t }
  }, [src])
}

export default function Backdrop() {
  const garden = useLoop('/video/garden.mp4')
  const ink = useLoop('/video/ink.mp4')
  const a = useRef(), b = useRef()

  // browsers block autoplay until a gesture; retry once the user interacts
  useEffect(() => {
    const kick = () => { garden.video.play().catch(() => {}); ink.video.play().catch(() => {}) }
    window.addEventListener('pointerdown', kick, { once: true })
    window.addEventListener('wheel', kick, { once: true })
    return () => { window.removeEventListener('pointerdown', kick); window.removeEventListener('wheel', kick) }
  }, [garden, ink])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (a.current) {
      a.current.material.opacity = 0.30 * scroll.bloom
      a.current.position.y = -6 + Math.sin(t * 0.05) * 2 + scroll.gardenY * 0.18
    }
    if (b.current) {
      b.current.material.opacity = 0.22 * scroll.bloom
      b.current.position.y = 8 - Math.sin(t * 0.04) * 2 + scroll.gardenY * 0.1
      b.current.rotation.z = Math.sin(t * 0.02) * 0.06
    }
  })

  return (
    <group>
      <mesh ref={a} position={[0, -6, -46]}>
        <planeGeometry args={[130, 74]} />
        <meshBasicMaterial map={garden.texture} transparent opacity={0.3}
          blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={b} position={[6, 8, -62]}>
        <planeGeometry args={[150, 86]} />
        <meshBasicMaterial map={ink.texture} transparent opacity={0.22}
          blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
