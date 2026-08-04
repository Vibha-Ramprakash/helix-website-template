import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { scroll } from './scrollState'

/* ACT THREE — the garden floor.
   Past WORK WITH ME the spine plants its sacrum in the lawn and the statuary arrives around it.
   Each bust CRYSTALLISES: garden particles converge onto its surface while it descends, then the
   marble solidifies as it settles onto the grass. Same detonate/reform language as the opening
   bookend, so the ending rhymes with the beginning instead of being a separate scene.
   Every head tracks the same shared `scroll.mouse`, which is what keeps the turn in sync. */

// Lifted from -8.4: with the camera down at ground level the statues' shoulders were running off
// the bottom edge, so they read as cropped rather than as standing on something.
export const GROUND_Y = -6.2

/* A V opening toward the camera: two arms wide and near at the front, tapering to a single main
   bust at the apex, with the spine coming down behind it. All standing — nothing toppled.
   bust_4 (the weakest conversion of the six) is left out; five reads cleaner than six here. */
/* Heights are near-identical on purpose: perspective should do the tapering, not scale. The apex
   bust was 6.4 against 5.7 and read as the CLOSEST thing in frame, which inverted the whole V.
   Arms pulled in from ±16.4 to ±10.4 as well — at the old width the front pair sat off-screen. */
/* Roughly 55% smaller than before and pushed deeper. With the camera dropped to ground level the
   statues now sit BELOW the closing line, and the V's apex — furthest away — reads as the
   smallest, so distance does the tapering. Heights stay near-identical on purpose; scaling them
   by hand is what inverted the perspective last time. */
const BUSTS = [
  { url: '/models/bust_1.glb', x:   0.0, z: -21.0, h: 3.7, spin:  0.00, turn: 0.95, pts: 16000, seed: 3 },
  { url: '/models/bust_2.glb', x:  -6.2, z: -13.0, h: 3.8, spin:  0.26, turn: 0.85, pts: 16000, seed: 7 },
  { url: '/models/bust_6.glb', x:   6.2, z: -13.0, h: 3.8, spin: -0.26, turn: 0.85, pts: 15000, seed: 29 },
  { url: '/models/bust_3.glb', x: -11.4, z:  -4.5, h: 3.9, spin:  0.46, turn: 0.75, pts: 15000, seed: 11 },
  { url: '/models/bust_5.glb', x:  11.4, z:  -4.5, h: 3.9, spin: -0.46, turn: 0.75, pts: 15000, seed: 23 },
]

const easeOutCubic = x => 1 - Math.pow(1 - x, 3)
const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b)

/* A soft pool of ground mist. Without it the busts read as floating no matter how exactly the
   maths seats them — the eye wants a contact patch, not a correct Y coordinate. */
let poolTex = null
function groundPool() {
  if (poolTex) return poolTex
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const rad = g.createRadialGradient(128, 128, 4, 128, 128, 126)
  rad.addColorStop(0.0, 'rgba(206,232,240,0.85)')
  rad.addColorStop(0.28, 'rgba(150,206,210,0.34)')
  rad.addColorStop(0.62, 'rgba(90,150,170,0.10)')
  rad.addColorStop(1.0, 'rgba(0,0,0,0)')
  g.fillStyle = rad
  g.fillRect(0, 0, 256, 256)
  poolTex = new THREE.CanvasTexture(c)
  return poolTex
}

/* Normalise a GLB the way the spine taught us: never scale by the longest axis, and never trust
   image_to_3d's orientation. Returns ONE merged geometry, centred, cross-section = 1. */
function normalise(scene) {
  const geos = []
  scene.traverse(o => {
    if (o.isMesh && o.geometry) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); geos.push(g) }
  })
  if (!geos.length) return null

  const box = new THREE.Box3()
  geos.forEach(g => { g.computeBoundingBox(); box.union(g.boundingBox) })
  const size = new THREE.Vector3(), centre = new THREE.Vector3()
  box.getSize(size); box.getCenter(centre)

  const axis = size.x > size.y && size.x > size.z ? 'x' : size.z > size.y ? 'z' : 'y'
  const orient = new THREE.Matrix4()
  if (axis === 'x') orient.makeRotationZ(Math.PI / 2)
  else if (axis === 'z') orient.makeRotationX(-Math.PI / 2)

  // size by CROSS-SECTION, let height follow
  const cross = axis === 'x' ? Math.max(size.y, size.z)
              : axis === 'z' ? Math.max(size.x, size.y)
              :                Math.max(size.x, size.z)
  const xform = new THREE.Matrix4()
    .multiply(new THREE.Matrix4().makeScale(1 / cross, 1 / cross, 1 / cross))
    .multiply(orient)
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z))

  geos.forEach(g => g.applyMatrix4(xform))
  // keep only position/normal so the merge below can't trip over mismatched attribute sets
  const merged = geos.length === 1 ? geos[0] : mergeSimple(geos)
  merged.computeVertexNormals()
  merged.computeBoundingBox()
  return merged
}

function mergeSimple(geos) {
  let n = 0
  geos.forEach(g => { n += g.attributes.position.count })
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3)
  let o = 0
  geos.forEach(g => {
    const p = g.attributes.position, nn = g.attributes.normal
    const idx = g.index
    // expand indexed geometry so we can concatenate without remapping indices
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        const k = idx.getX(i)
        pos[o*3] = p.getX(k); pos[o*3+1] = p.getY(k); pos[o*3+2] = p.getZ(k)
        if (nn) { nrm[o*3] = nn.getX(k); nrm[o*3+1] = nn.getY(k); nrm[o*3+2] = nn.getZ(k) }
        o++
      }
    } else {
      for (let i = 0; i < p.count; i++) {
        pos[o*3] = p.getX(i); pos[o*3+1] = p.getY(i); pos[o*3+2] = p.getZ(i)
        if (nn) { nrm[o*3] = nn.getX(i); nrm[o*3+1] = nn.getY(i); nrm[o*3+2] = nn.getZ(i) }
        o++
      }
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, o * 3), 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm.subarray(0, o * 3), 3))
  return g
}

/* The crystallising cloud: every point knows both where it starts (scattered out in the garden)
   and where it belongs (on the marble surface). uConverge walks it from one to the other. */
function crystalCloud(geometry, count, seed) {
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(geometry)).build()
  const pos = new Float32Array(count * 3), sca = new Float32Array(count * 3)
  const col = new Float32Array(count * 3), siz = new Float32Array(count), rnd = new Float32Array(count)
  const stone = new THREE.Color('#cfd8e2'), mint = new THREE.Color('#9ff0e4'), rose = new THREE.Color('#ffc2e2')
  const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color()
  let rs = seed * 9301 + 49297
  const rand = () => { rs = (rs * 9301 + 49297) % 233280; return rs / 233280 }
  for (let i = 0; i < count; i++) {
    sampler.sample(p, n)
    pos[i*3] = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z
    // start scattered out and above, as if drifting in off the garden
    const a = rand() * Math.PI * 2, r = 2.5 + rand() * 7
    sca[i*3]   = Math.cos(a) * r
    sca[i*3+1] = 1.5 + rand() * 7
    sca[i*3+2] = Math.sin(a) * r
    const m = rand()
    c.copy(m < 0.65 ? stone : m < 0.87 ? mint : rose).multiplyScalar(0.55 + rand() * 0.7)
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b
    siz[i] = 0.5 + rand() * 1.1
    rnd[i] = rand()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aScatter', new THREE.BufferAttribute(sca, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1))
  g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))
  return g
}

function crystalMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 }, uPix: { value: Math.min(window.devicePixelRatio, 2) },
      uTint: { value: new THREE.Color('#ffffff') }, uFade: { value: 0 }, uConverge: { value: 0 },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: `
      attribute float aSize; attribute float aRnd; attribute vec3 aScatter;
      uniform float uT, uPix, uFade, uConverge;
      varying vec3 vC; varying float vA;
      void main(){
        vC = color;
        // per-point stagger so the cloud lands in a wave rather than all at once
        float k = clamp((uConverge - aRnd * 0.35) / 0.65, 0.0, 1.0);
        k = 1.0 - pow(1.0 - k, 3.0);
        vec3 p = position + aScatter * (1.0 - k);
        p += normalize(p + 0.001) * sin(uT * 0.6 + aRnd * 12.0) * 0.02 * (1.0 - k);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        gl_PointSize = min(aSize * uPix * (110.0 / max(depth, 0.001)), 13.0 * uPix);
        vA = smoothstep(2.0, 8.0, depth) * (1.0 - smoothstep(60.0, 95.0, depth)) * uFade;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uTint;
      varying vec3 vC; varying float vA;
      void main(){
        float r = length(gl_PointCoord - 0.5);
        float a = (smoothstep(0.30, 0.04, r) + smoothstep(0.5, 0.12, r) * 0.3) * vA;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vC * uTint * 0.75, a);
      }`,
  })
}

/* ---------- one statue ---------- */
function Bust({ url, x, z, h, spin, turn, pts, seed, delay }) {
  const lie = 0    // every statue stands now
  const outer = useRef(), inner = useRef(), meshRef = useRef(), cloudRef = useRef(), pool = useRef()
  const { scene } = useGLTF(url)

  // Applied per-material rather than to scene.environment, so acts one and two keep the studio
  // lighting Vibha already signed off on.
  const env = useTexture('/env/garden.png')

  const geo = useMemo(() => normalise(scene), [scene])
  const cloudGeo = useMemo(() => (geo ? crystalCloud(geo, pts, seed) : null), [geo, pts, seed])
  const cloudMat = useMemo(() => crystalMaterial(), [])

  /* Renaissance marble, not bone and not glass. Warm white, softly polished, its colour coming
     from the garden's own teal/magenta rim lights — that's the "modern" half. */
  const marble = useMemo(() => new THREE.MeshPhysicalMaterial({
    // knocked back from #ddd6ca: the scene's two 70-intensity point lights were driving the
    // near side of the stone straight into the bloom pass
    color: '#b9b3a7', roughness: 0.52, metalness: 0.0,
    clearcoat: 0.45, clearcoatRoughness: 0.45,
    sheen: 0.4, sheenColor: new THREE.Color('#bfe4ff'), sheenRoughness: 0.65,
    iridescence: 0.12, iridescenceIOR: 1.3,
    envMapIntensity: 1.35, transparent: true, opacity: 0,
    envMap: (env.mapping = THREE.EquirectangularReflectionMapping, env),
  }), [env])

  // Seat it on the grass EXACTLY. The resting height has to come from the bounding box AFTER the
  // pose rotation — measuring it upright is why the toppled ones were hovering.
  const restY = useMemo(() => {
    if (!geo) return GROUND_Y
    const posed = geo.boundingBox.clone()
    posed.applyMatrix4(new THREE.Matrix4().makeRotationZ(lie))
    return GROUND_Y - posed.min.y * h + 0.04
  }, [geo, lie, h])

  const restYaw = useMemo(() => Math.atan2(-x, 16.4 - z) + spin, [x, z, spin])
  const yaw = useRef(restYaw), pitch = useRef(0)

  useFrame(({ clock }) => {
    const o = outer.current
    if (!o || !geo) return
    const t = clock.elapsedTime
    const lp = THREE.MathUtils.clamp((scroll.fin - delay) / 0.46, 0, 1)

    o.visible = lp > 0.004
    if (!o.visible) return

    // --- descend and settle ---
    const drop = easeOutCubic(lp)
    // a small damped bounce as it touches down, so it lands rather than arrives
    const settle = lp > 0.72 ? Math.sin((lp - 0.72) * 17) * (1 - lp) * 0.35 : 0
    o.position.set(x, restY + (1 - drop) * 13 + settle, z)
    o.scale.setScalar(h)

    // --- crystallise: particles converge, then the marble takes over ---
    cloudMat.uniforms.uT.value = t
    cloudMat.uniforms.uTint.value.copy(scroll.tint)
    cloudMat.uniforms.uConverge.value = smooth(lp, 0.0, 0.72)
    cloudMat.uniforms.uFade.value = 1 - smooth(lp, 0.52, 0.9)
    marble.opacity = smooth(lp, 0.5, 0.93)
    if (meshRef.current) meshRef.current.visible = marble.opacity > 0.01
    if (cloudRef.current) cloudRef.current.visible = cloudMat.uniforms.uFade.value > 0.01

    // --- head tracking, off the shared cursor so every bust turns together ---
    const tx = scroll.mouse.x * 17
    const ty = scroll.mouse.y * 10 + 1.5
    const dx = tx - x, dz = 12 - z, dy = ty - (restY + h * 0.35)
    const want = Math.atan2(dx, dz)
    const d = ((want - restYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    const target = restYaw + THREE.MathUtils.clamp(d, -turn, turn)
    const wantPitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)) * 0.55, -0.26, 0.26)

    // 0.075 -> 0.22. At the old value a full head turn took the better part of a second, which
    // reads as lag rather than lag-as-character. Still eased, just answers immediately.
    yaw.current += (target - yaw.current) * 0.22
    pitch.current += (wantPitch - pitch.current) * 0.22
    o.rotation.y = yaw.current
    if (inner.current) inner.current.rotation.set(pitch.current * (lie ? 0.25 : 1), 0, lie)

    // the contact patch: blooms outward on touchdown, then settles
    if (pool.current) {
      const hit = smooth(lp, 0.55, 0.98)
      const kick = lp > 0.72 ? Math.sin((lp - 0.72) * 11) * (1 - lp) * 0.8 : 0
      pool.current.material.opacity = hit * 0.75
      pool.current.scale.setScalar(h * (0.85 + hit * 0.5 + kick))
      pool.current.visible = hit > 0.01
    }
  })

  if (!geo) return null
  return (
    <>
      <group ref={outer}>
        <group ref={inner}>
          <mesh ref={meshRef} geometry={geo} material={marble} frustumCulled={false} />
          {cloudGeo && <points ref={cloudRef} geometry={cloudGeo} material={cloudMat} frustumCulled={false} />}
        </group>
      </group>
      {/* sits flat on the lawn in WORLD space, outside the bust's own scale and spin */}
      <mesh ref={pool} position={[x, GROUND_Y + 0.07, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={groundPool()} transparent opacity={0} depthWrite={false}
          blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </>
  )
}

/* ---------- the lawn: loose particles only, sitting on the plate's own grass ---------- */
function Grass() {
  const ref = useRef()
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uPix: { value: Math.min(window.devicePixelRatio, 2) },
                uTint: { value: new THREE.Color('#ffffff') }, uFade: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: `
      attribute float aSize; attribute float aRnd;
      uniform float uT, uPix, uFade;
      varying vec3 vC; varying float vA;
      void main(){
        vC = color;
        vec3 p = position;
        p.x += sin(uT * 0.5 + aRnd * 9.0) * 0.05;     // the lawn breathes
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        gl_PointSize = min(aSize * uPix * (95.0 / max(depth, 0.001)), 9.0 * uPix);
        vA = smoothstep(3.0, 11.0, depth) * (1.0 - smoothstep(58.0, 96.0, depth)) * uFade;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uTint;
      varying vec3 vC; varying float vA;
      void main(){
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.06, r) * vA;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vC * uTint * 0.5, a);
      }`,
  }), [])

  const geo = useMemo(() => {
    const N = 46000
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3)
    const siz = new Float32Array(N), rnd = new Float32Array(N)
    // fireflies and glowing blue flowers, per the reference — warm gold sparks over cool green
    const blade = new THREE.Color('#3f8f63'), fly = new THREE.Color('#ffd98a'), bloom = new THREE.Color('#7fc4ff')
    const c = new THREE.Color()
    for (let i = 0; i < N; i++) {
      const r = 46 * Math.sqrt(Math.random())
      const a = Math.random() * Math.PI * 2
      pos[i*3] = Math.cos(a) * r
      pos[i*3+1] = GROUND_Y + Math.random() * 0.9 - 0.18
      pos[i*3+2] = Math.sin(a) * r - 6
      const m = Math.random()
      c.copy(m < 0.70 ? blade : m < 0.88 ? bloom : fly).multiplyScalar(0.45 + Math.random() * 0.85)
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b
      siz[i] = 0.35 + Math.random() * 0.8
      rnd[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1))
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))
    return g
  }, [])

  useFrame(({ clock }) => {
    mat.uniforms.uT.value = clock.elapsedTime
    mat.uniforms.uFade.value = scroll.fin
    mat.uniforms.uTint.value.copy(scroll.tint)
    if (ref.current) ref.current.visible = scroll.fin > 0.01
  })
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />
}

/* A backdrop plate whose TOP dissolves instead of ending.
   A plain textured plane shows a hard horizontal edge where it stops, which is what made the
   generated art read as a photo stuck behind the scene. Fading the top (and the sides) into
   nothing lets it sit underneath the particle work as one continuous space. */
function platePlaneMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uOpacity: { value: 0 } },
    transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uOpacity;
      varying vec2 vUv;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        // The plate now overfills the frame, so its edges are off-screen and only the top needs
        // feathering — that's the seam between the photograph and the WebGL scroll above it.
        float top  = smoothstep(1.0, 0.88, vUv.y);
        float side = 1.0, bot = 1.0;
        gl_FragColor = vec4(t.rgb, t.a * top * side * bot * uOpacity);
      }`,
  })
}

/* ---------- the grove: generated loops on far planes ---------- */
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

/* The same plate again, but IN FRONT of the statuary and masked down to just its hanging ivy at
   the left and right edges. That's what puts vines over the busts without modelling a single
   leaf — the artwork already contains the ivy curtains, we just re-use them as a foreground. */
function foregroundVineMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uOpacity: { value: 0 } },
    transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uOpacity;
      varying vec2 vUv;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        // Tight: only the outer ~16%, only the hanging upper portion, and only pixels bright
        // enough to actually BE a leaf. A looser mask laid a green haze over the whole frame.
        float edge = 1.0 - smoothstep(0.03, 0.16, min(vUv.x, 1.0 - vUv.x));
        float hang = smoothstep(0.28, 0.62, vUv.y);
        float lum = dot(t.rgb, vec3(0.299, 0.587, 0.114));
        float leaf = smoothstep(0.13, 0.34, lum);
        gl_FragColor = vec4(t.rgb, edge * hang * leaf * uOpacity);
      }`,
  })
}

function Grove() {
  /* ONE plate, sized to fill the frame at this distance.
     There is no separate 3D floor: the reference is a single photograph whose own grass, mist
     and hedge already carry the environment, so the statues simply stand in front of it and
     their bases project onto its lawn. */
  const plate = useTexture('/tex/vines.png')
  const back = useRef(), fore = useRef()
  const matBack = useMemo(() => platePlaneMaterial(plate), [plate])
  const matFore = useMemo(() => foregroundVineMaterial(plate), [plate])

  useFrame(({ clock }) => {
    const fin = scroll.fin, t = clock.elapsedTime
    matBack.uniforms.uOpacity.value = fin
    matFore.uniforms.uOpacity.value = fin * 0.95
    if (back.current) {
      back.current.visible = fin > 0.01
      back.current.position.x = Math.sin(t * 0.03) * 0.7          // a breath of drift
      back.current.position.y = 6 + Math.sin(t * 0.045) * 0.4
    }
    if (fore.current) {
      fore.current.visible = fin > 0.01
      // the foreground ivy sways more than the backdrop, which is what sells the depth
      fore.current.position.x = Math.sin(t * 0.11) * 0.5
      fore.current.position.y = 1 + Math.sin(t * 0.14 + 1.3) * 0.32
    }
  })

  return (
    <group>
      {/* THE HARSH LINE AT THE BOTTOM WAS THIS PLANE'S OWN EDGE.
          At 112x63 centred on y=1.2 the bottom of the rectangle fell inside the frustum, and
          there is nothing behind it but the black scene — so you saw the backdrop simply stop.
          Now 139x78 centred on y=6, which is where the tilted view actually looks at this depth,
          so both edges sit outside the frame with margin to spare. */}
      <mesh ref={back} position={[0, 6, -40]} renderOrder={-4}>
        <planeGeometry args={[139, 78]} />
        <primitive object={matBack} attach="material" />
      </mesh>
      <mesh ref={fore} position={[0, 1, 6]} renderOrder={3}>
        <planeGeometry args={[52, 29]} />
        <primitive object={matFore} attach="material" />
      </mesh>
    </group>
  )
}

export default function Finale() {
  return (
    <>
      <Grove />
      <Grass />
      {BUSTS.map((b, i) => <Bust key={b.url} {...b} delay={i * 0.075} />)}
    </>
  )
}

BUSTS.forEach(b => useGLTF.preload(b.url))
