import { useRef, useMemo, useEffect, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, useTexture } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import Lenis from 'lenis'
import { SYSTEMS } from './systems'
import { scroll } from './scrollState'
import Garden from './garden.jsx'
import BoneSpine from './boneSpine.jsx'
import Blossoms from './blossoms.jsx'
import Finale from './finale.jsx'
import Backdrop from './backdrop.jsx'

// t = scrollSlots - i - START ; t===0 => dead centre, square to camera & readable.
// Away from centre the card banks right, climbs, and passes behind the spine.
const R = 7.7, PITCH = 3.15, ANGLE_SPAN = 1.42, FOCUS = 0.85, TILT = 0.19, START = 1.25
// Vibha approved the card pacing, so CARD_SLOTS must not change. Act three is added by extending
// BOTH the slot count and the runway height by the same factor (900vh -> 1300vh in index.css),
// which leaves the cards moving at exactly the same rate per pixel scrolled.
const CARD_SLOTS = SYSTEMS.length + START - 0.4      // 6.85
const FINALE_SLOTS = 3.05
const TOTAL_SLOTS = CARD_SLOTS + FINALE_SLOTS        // 9.9
const FIN_FROM = CARD_SLOTS / TOTAL_SLOTS + 0.012    // where the garden starts assembling
const HUE = new THREE.Color(), WHITE = new THREE.Color('#ffffff')

// A flat rounded panel with proper 0..1 UVs. ShapeGeometry's own UVs are in shape space,
// so the texture has to be re-mapped across the bounding box or it comes out garbage.
function roundedPanel(w, h, r) {
  const s = new THREE.Shape()
  s.moveTo(-w/2+r, -h/2)
  s.lineTo(w/2-r,-h/2); s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r)
  s.lineTo(w/2,h/2-r);  s.quadraticCurveTo(w/2,h/2,w/2-r,h/2)
  s.lineTo(-w/2+r,h/2); s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r)
  s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2)
  const g = new THREE.ShapeGeometry(s, 22)
  const pos = g.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i*2]   = (pos.getX(i) + w/2) / w
    uv[i*2+1] = (pos.getY(i) + h/2) / h
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

function roundedSlab(w, h, r, depth) {
  const s = new THREE.Shape()
  s.moveTo(-w/2+r, -h/2)
  s.lineTo(w/2-r,-h/2); s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r)
  s.lineTo(w/2,h/2-r);  s.quadraticCurveTo(w/2,h/2,w/2-r,h/2)
  s.lineTo(-w/2+r,h/2); s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r)
  s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2)
  const g = new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:0.055,bevelSize:0.055,bevelSegments:5,curveSegments:28})
  g.center(); return g
}

/* ---------- THE SPINE: stacked particle rings, not solid vertebrae ---------- */
function Spine() {
  const RINGS = 280, PER = 190, SPAN = 96
  const geo = useMemo(() => {
    const n = RINGS * PER
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const siz = new Float32Array(n)
    const rn  = new Float32Array(n)
    const cool = new THREE.Color('#8ff4ff'), warm = new THREE.Color('#cfe6ff'), hot = new THREE.Color('#ff8ad0')
    const tmp = new THREE.Color()
    let i = 0
    const VERT = 26          // discrete vertebrae over the span
    for (let r = 0; r < RINGS; r++) {
      const u = r / RINGS
      const y = -SPAN/2 + u * SPAN
      // ANATOMY OF ONE VERTEBRA
      //  h        = height within this vertebra, 0..1
      //  centrum  = the barrel-shaped body: flared at both ends, waisted in the middle
      //  disc     = the narrow joint separating one vertebra from the next
      //  process  = two lateral wings at mid-height, which is what actually reads as bone
      const h = (u * VERT) % 1
      const disc = h > 0.86
      const waist = Math.pow(Math.abs(h - 0.43) * 2.15, 1.9)
      const centrum = 0.36 + waist * 0.66
      // BUG THAT MADE IT READ AS A COIL: the ring angle carried a continuous `twist`, and the
      // lobes were measured against that same twisted angle. So the processes traced a helix up
      // the column instead of sitting still on each bone. Lobes are now locked per VERTEBRA.
      const vi = Math.floor(u * VERT)
      const lobeAxis = vi * 0.19        // each vertebra rotated a touch from the one below
      const wingH = Math.exp(-Math.pow((h - 0.46) * 3.4, 2))   // strongest at mid-height
      for (let k = 0; k < PER; k++) {
        const a = (k / PER) * Math.PI * 2
        let rad = disc ? 0.18 : centrum
        if (!disc) {
          const c = Math.cos(a - lobeAxis)
          const lobe = Math.pow(Math.max(0, c), 10) + Math.pow(Math.max(0, -c), 10)
          rad += wingH * lobe * 0.62
        }
        pos[i*3]   = Math.cos(a) * rad
        pos[i*3+1] = y
        pos[i*3+2] = Math.sin(a) * rad
        const m = Math.random()
        tmp.copy(m < 0.6 ? cool : m < 0.93 ? warm : hot).multiplyScalar(0.55 + Math.random() * 0.7)
        col[i*3] = tmp.r; col[i*3+1] = tmp.g; col[i*3+2] = tmp.b
        siz[i] = 0.5 + Math.random() * 1.25
        rn[i]  = Math.random()
        i++
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos,3))
    g.setAttribute('color',    new THREE.BufferAttribute(col,3))
    g.setAttribute('aSize',    new THREE.BufferAttribute(siz,1))
    g.setAttribute('aRnd',     new THREE.BufferAttribute(rn,1))
    return g
  }, [])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms:{ uT:{value:0}, uOff:{value:0}, uPix:{value:Math.min(window.devicePixelRatio,2)}, uSpan:{value:SPAN}, uIn:{value:0} },
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, vertexColors:true,
    vertexShader:`
      attribute float aSize; attribute float aRnd;
      uniform float uT, uOff, uPix, uSpan;
      varying vec3 vC; varying float vA;
      void main(){
        vC = color;
        vec3 p = position;
        // scroll the column and wrap it, so the spine is effectively endless
        p.y = mod(p.y + uOff + uSpan*0.5, uSpan) - uSpan*0.5;
        float br = 0.55 + 0.45*sin(aRnd*15.0 + uT*1.6);
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        vA = br;
        gl_PointSize = aSize * uPix * (54.0 / max(-mv.z, 0.001));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader:`
      uniform float uIn;
      varying vec3 vC; varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d));
        gl_FragColor = vec4(vC, a*a*vA*0.5*uIn);
      }`,
  }), [])

  useFrame(({ clock }) => {
    material.uniforms.uT.value = clock.elapsedTime
    material.uniforms.uOff.value = scroll.p * TOTAL_SLOTS * PITCH
    material.uniforms.uIn.value = scroll.spineIn      // enters with the bone column
  })

  return (
    <group>
      <points geometry={geo} material={material} frustumCulled={false} />
      {/* the nerve running up the middle */}
      <mesh><cylinderGeometry args={[0.05,0.05,SPAN,8,1,true]} />
        <meshBasicMaterial color="#cff9ff" transparent opacity={0.15} toneMapped={false} /></mesh>
    </group>
  )
}

/* ---------- THE SIGIL: present only at the two bookends ---------- */
function Sigil() {
  const grp = useRef()
  useFrame(({ clock }) => {
    const g = grp.current; if (!g) return
    const t = clock.elapsedTime
    const presence = 1 - scroll.bloom          // 1 at both ends, 0 through the gallery
    g.rotation.y = t * 0.3
    g.rotation.x = Math.sin(t * 0.4) * 0.18
    g.scale.setScalar(0.001 + presence * 1.15)
    g.visible = presence > 0.02
  })
  return (
    <group ref={grp}>
      {/* a polished mirror in a dark room reflects darkness, so it needs its own light */}
      <mesh>
        <torusGeometry args={[1.85, 0.13, 40, 170]} />
        <meshPhysicalMaterial metalness={0.92} roughness={0.08} envMapIntensity={2.6}
          iridescence={1} iridescenceIOR={1.6} color="#ffffff"
          emissive="#8fe9ff" emissiveIntensity={0.55} />
      </mesh>
      <mesh>
        <torusGeometry args={[1.98, 0.035, 16, 150]} />
        <meshBasicMaterial color="#bff4ff" transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.62, 0.02, 12, 130]} />
        <meshBasicMaterial color="#ff9ad8" transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.92, 0]} />
        <meshPhysicalMaterial transmission={1} thickness={1.4} roughness={0.02} ior={1.7}
          iridescence={1} iridescenceIOR={1.5} clearcoat={1} metalness={0}
          envMapIntensity={2.2} color="#ffffff" />
      </mesh>
    </group>
  )
}

/* Browsers refuse autoplay until the page has been interacted with. backdrop.jsx already learned
   this; the cards need the same escape hatch or the very first card can arrive still frozen. */
const PENDING = new Set()
if (typeof window !== 'undefined') {
  const kick = () => PENDING.forEach(v => v.play().then(() => v.pause()).catch(() => {}))
  window.addEventListener('pointerdown', kick, { once: true })
  window.addEventListener('wheel', kick, { once: true, passive: true })
}

/* ---------- ONE CARD ---------- */
function Card({ sys, i, onFocus }) {
  const grp = useRef()
  /* Each card is its own 5-second film now, instead of six variations on the same chart.
     ONLY the focused card decodes: the others are paused, which is the whole reason six video
     textures don't melt the framerate. It plays once on arrival and holds its last frame — which
     is deliberately the dashboard-on-a-screen shot — so a card you've already passed still reads
     as a finished thing rather than a frozen mid-motion smear. */
  const vid = useMemo(() => {
    const v = document.createElement('video')
    v.src = `/video/card${i}.mp4`
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.loop = false
    v.crossOrigin = 'anonymous'
    // Attached, not detached: Chrome does not reliably decode a video that never enters the
    // document, so readyState stayed 0 and the poster never handed over to the film.
    v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px'
    return v
  }, [i])
  // The dashboard still exists as a POSTER. Until the video has decoded a frame its texture is
  // pure black, and a black panel with depthWrite off over a black scene is invisible — the card
  // simply vanished. This guarantees there is always something on the panel.
  const poster = useTexture(`/cards/${i}.png`)
  const matRef = useRef()
  const usingVideo = useRef(false)
  const tex = useMemo(() => {
    const t = new THREE.VideoTexture(vid)
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    return t
  }, [vid])
  /* Mounting the element belongs in an effect, NOT in the useMemo that creates it. Doing the
     appendChild during render meant every StrictMode double-render and every HMR reload leaked
     another decoding <video> — it reached 48 of them and stalled the whole canvas. */
  useEffect(() => {
    // The src is (re)set HERE, not just at creation. StrictMode runs mount -> cleanup -> mount,
    // and the cleanup's teardown strips the source off the memoised element; without restoring it
    // the second mount left all six videos with an empty src and readyState 0 forever.
    vid.src = `/video/card${i}.mp4`
    document.body.appendChild(vid)
    PENDING.add(vid)               // so the first gesture can kick it if autoplay was refused
    vid.load()
    return () => { vid.pause(); PENDING.delete(vid); vid.remove(); vid.removeAttribute('src'); vid.load() }
  }, [vid, i])

  // No glass frame at all now: just the footage itself with a gently rounded edge.
  const panel = useMemo(() => roundedPanel(6.7, 4.26, 0.17), [])
  const was = useRef(false)
  const playing = useRef(false)
  useFrame(({ clock }) => {
    const g = grp.current; if (!g) return
    const time = clock.elapsedTime
    const t = scroll.p*TOTAL_SLOTS - i - START
    const angle = t*ANGLE_SPAN
    g.position.set(Math.sin(angle)*R, t*PITCH, Math.cos(angle)*R)
    const w = 1 - THREE.MathUtils.clamp(Math.abs(t)/FOCUS, 0, 1)
    const ease = w*w*(3-2*w)
    g.rotation.y = angle*(1-ease)
    g.rotation.z = -t*TILT*(1-ease*0.55) + Math.sin(time*0.5+i)*0.012
    g.rotation.x = t*0.055*(1-ease)
    const near = Math.max(0, 1 - Math.abs(t)/2.4)
    // shrink away once act three starts, so the gallery clears out of the garden
    g.scale.setScalar((0.78 + near*near*0.3) * scroll.bloom * (1 - scroll.fin))
    g.visible = Math.abs(t) < 3.1 && scroll.bloom > 0.05 && scroll.fin < 0.99

    // swap poster -> film the moment the video actually has a frame to show
    const ready = vid.readyState >= 2
    if (matRef.current && ready !== usingVideo.current) {
      usingVideo.current = ready
      matRef.current.map = ready ? tex : poster
      matRef.current.needsUpdate = true
    }

    /* Hold the film until the card has actually swung round to the FRONT of the spine.
       A card crosses in front at |t| < ~1.1 (angle inside ±90°), which is near > 0.55 — just
       before it squares up to camera. The old 0.30 threshold fired a full 1.7 slots out, so the
       5s film had finished before the card ever reached centre and every card you actually
       looked at sat frozen on its last frame. Rewinding on every start is the other half: it
       guarantees the footage runs THROUGH the focal window rather than arriving spent. */
    const wantsPlay = g.visible && near > 0.55
    if (wantsPlay && !playing.current) {
      playing.current = true
      vid.currentTime = 0
      vid.play().catch(() => {})
    } else if (!wantsPlay && playing.current) {
      playing.current = false
      vid.pause()
    }
    if (ease > 0.6 && !was.current) { was.current = true; onFocus(i) }
    if (ease < 0.4) was.current = false
  })
  return (
    <group ref={grp}>
      {/* renderOrder 2 puts the card in the transparent pass, drawn after the opaque garden and
          blossoms — so the flowers read THROUGH the dashboard instead of over it. The old note
          about 94% opacity being pointless was true against a black scene; now there's a garden
          back there, so a little transparency actually shows something. */}
      <mesh geometry={panel} renderOrder={2}>
        <meshBasicMaterial ref={matRef} map={poster} toneMapped={false} side={THREE.DoubleSide}
          transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ---------- camera + the scroll clock everything reads from ---------- */
function Rig() {
  const { camera, scene } = useThree(); const m = useRef({x:0,y:0})
  useEffect(() => {
    const h = e => {
      m.current.x = (e.clientX/window.innerWidth-0.5)*2; m.current.y = (e.clientY/window.innerHeight-0.5)*2
      scroll.mouse.set(m.current.x, -m.current.y)   // NDC for the busts' raycast (y is flipped)
    }
    window.addEventListener('pointermove', h); return () => window.removeEventListener('pointermove', h)
  }, [])
  useFrame(() => {
    scroll.p += (scroll.target - scroll.p)*0.062
    const p = scroll.p
    // Detonate out of the tail early. The old reform-into-the-tail close is gone: the scroll now
    // ends in the garden instead of back at the sigil.
    // THE OPENING, staged rather than all-at-once. At p=0 there is only the spinning sigil on
    // black; the particles bloom in first, the spine drops in behind them, and card 01 is already
    // on its way by the time the column is fully down.
    scroll.bloom  = THREE.MathUtils.smoothstep(p, 0.012, 0.115)   // particles
    scroll.spineIn = THREE.MathUtils.smoothstep(p, 0.055, 0.165)  // column enters from above
    scroll.intro  = THREE.MathUtils.smoothstep(p, 0.0, 0.18)
    scroll.fin = THREE.MathUtils.smoothstep(p, FIN_FROM, 0.97)
    scroll.gardenY = p * TOTAL_SLOTS * PITCH * 0.42
    const idx = THREE.MathUtils.clamp(Math.round(p * TOTAL_SLOTS - START), 0, SYSTEMS.length - 1)
    HUE.set(SYSTEMS[idx].hue[0]).lerp(WHITE, 0.55)
    scroll.tint.lerp(HUE, 0.03)
    const fin = scroll.fin
    // Thicken the fog in the garden so the lawn's far edge dissolves instead of ending in a hard
    // horizon line. At 25 units this is still only ~9% on the statuary, so the marble stays crisp.
    if (scene.fog) scene.fog.density = 0.006 + fin * 0.0062
    // Act three drops to GROUND level and tilts slightly UP, so you stand among the statues and
    // look up at the closing line, rather than hovering above and looking down onto a lawn.
    camera.position.x += (m.current.x*1.5 - camera.position.x)*0.04
    camera.position.y += ((-m.current.y*0.9 - fin*2.4) - camera.position.y)*0.04
    camera.position.z = 16.4 + fin*10.0
    camera.lookAt(0, camera.position.y*0.25 + fin*2.6, -fin*5)
    camera.rotation.z += (m.current.x*0.02 - camera.rotation.z)*0.04
  })
  return null
}

/* The spine is act one and two. Once you're on the garden floor it would be a column growing out
   of the lawn, so it stands down. */
function UntilFinale({ children }) {
  const g = useRef()
  useFrame(() => { if (g.current) g.current.visible = scroll.fin < 0.92 })
  return <group ref={g}>{children}</group>
}

function Scene({ onFocus }) {
  return (
    <>
      <color attach="background" args={['#04050a']} />
      <fogExp2 attach="fog" args={['#04050a', 0.006]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[6,9,8]} intensity={2.4} color="#ffe9f6" />
      <pointLight position={[-9,-4,5]} intensity={70} distance={40} color="#5ee9ff" />
      <pointLight position={[9,6,-3]} intensity={55} distance={40} color="#ff4d9d" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3.2} position={[0,6,9]} scale={[12,5,1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2.2} position={[-9,1,4]} scale={[4,12,1]} color="#7ad8ff" />
        <Lightformer form="rect" intensity={2.0} position={[9,-2,3]} scale={[4,12,1]} color="#ff7ab8" />
        <Lightformer form="circle" intensity={2.6} position={[0,-7,6]} scale={[7,7,1]} color="#cfe0ff" />
      </Environment>
      <Backdrop />
      <Garden />
      {/* Only the endless particle spine stands down — it has no base, so it can't be planted.
          The bone column stays and terminates in the lawn. */}
      <UntilFinale><Spine /></UntilFinale>
      <BoneSpine />
      <Blossoms />
      {/* Act three owns a 12MB plate and six bust meshes. Inside the page's single Suspense
          boundary that held the ENTIRE canvas black until they finished downloading — the
          opening frame was blank on every cold load. Its own boundary lets acts one and two
          render immediately and the garden stream in behind them. */}
      <Suspense fallback={null}><Finale /></Suspense>
      <Sigil />
      {SYSTEMS.map((s,i) => <Card key={s.id} sys={s} i={i} onFocus={onFocus} />)}
      <EffectComposer disableNormalPass>
        {/* threshold 0.18 -> 0.42: lit marble sits around 0.7 luminance and was blowing straight
            out to white. The particle work all sits above this anyway. */}
        <Bloom intensity={0.72} luminanceThreshold={0.42} luminanceSmoothing={0.45} mipmapBlur radius={0.75} />
        <ChromaticAberration offset={[0.0007,0.0011]} />
        <Vignette offset={0.28} darkness={0.82} />
      </EffectComposer>
    </>
  )
}

const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%'
function useScramble(text) {
  const [out, setOut] = useState(text)
  useEffect(() => {
    let f = 0; const steps = 15
    const id = setInterval(() => {
      f++
      setOut(text.split('').map((c,i) => c === ' ' ? ' ' : i < (f/steps)*text.length ? c : CH[(Math.random()*CH.length)|0]).join(''))
      if (f >= steps) { clearInterval(id); setOut(text) }
    }, 26)
    return () => clearInterval(id)
  }, [text])
  return out
}

export default function Helix() {
  const [focus, setFocus] = useState(0)
  const [entered, setEntered] = useState(false)
  const [inGarden, setInGarden] = useState(false)
  const title = useScramble(SYSTEMS[focus].n)
  useEffect(() => {
    // ?s=0.42 pins the scroll for headless screenshots. No effect in normal use.
    const forced = parseFloat(new URLSearchParams(location.search).get('s'))
    // The hero used to come BACK at p > 0.93, because that was where the old bookend reformed the
    // sigil. Act three lives there now, so the title would land on top of the garden. It leaves
    // at 0.06 and stays gone.
    if (!Number.isNaN(forced)) {
      scroll.target = forced; scroll.p = forced
      setEntered(forced > 0.06); setInGarden(forced > FIN_FROM + 0.03)
      return
    }
    const lenis = new Lenis({ duration: 1.5, smoothWheel: true, wheelMultiplier: 0.85 })
    lenis.on('scroll', ({ progress }) => {
      scroll.target = progress
      setEntered(progress > 0.06)
      setInGarden(progress > FIN_FROM + 0.03)   // the card caption must not label the garden
    })
    let raf; const loop = t => { lenis.raf(t); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); lenis.destroy() }
  }, [])
  return (
    <>
      <Canvas className="gl" dpr={[1,2]} gl={{ antialias:true, powerPreference:'high-performance' }}
        camera={{ position:[0,0,16.4], fov:42, near:0.1, far:260 }}>
        <Suspense fallback={null}><Rig /><Scene onFocus={setFocus} /></Suspense>
      </Canvas>
      <div className="vig" /><div className="grain" />
      <nav>
        <span className="mark">VIBHA</span>
        <span className="pill"><a href="#">Systems</a><i /><a href="#">Work with me</a></span>
      </nav>
      <header className="hero" style={{ opacity: entered ? 0 : 1 }}>
        <p className="kicker">AI systems · built, not prompted</p>
        <h1><span>CREATIVE</span><span>BUSINESS</span><span>SYSTEMS</span></h1>
        <p className="sub">scroll to climb the spine</p>
      </header>
      {/* The closing beat, in the garden only. It sits UNDER mist — blurred and faint by default,
          with a soft circle of clarity following the cursor that lifts the fog off whatever it
          passes over. The garden is what you look at; the line is something you find. */}
      {/* The closing frame: sharp, centred, and it asks for something. The mist reveal is gone —
          it made the one piece of copy that has a job to do the hardest thing on the page to read. */}
      <div className="ending" data-in={inGarden ? '1' : '0'} style={{ opacity: inGarden ? 1 : 0 }}>
        <p className="kicker">six systems · all of them running</p>
        <h2><span>NOTHING HERE</span><span>IS A DEMO</span></h2>
        <p className="esub">Every system on this page is one I built and run myself.
          No mockups, no borrowed case studies.</p>
        <a className="cta" href="#book">Book a call<i /></a>
      </div>
      <aside className="cap" style={{ opacity: entered && !inGarden ? 1 : 0 }}>
        <i>{String(focus+1).padStart(2,'0')} / {String(SYSTEMS.length).padStart(2,'0')}</i>
        <b>{title}</b>
        <p>{SYSTEMS[focus].d}</p>
      </aside>
      <div className="runway" />
    </>
  )
}
