# Helix Website Template

A scroll-driven WebGL site in three acts: you descend a vertebral column while dashboard cards
spiral around it through a point-cloud garden, and land in a moonlit garden where marble busts
crystallise out of the particles and follow your cursor.

Built with Vite + React 19 + React Three Fiber. No 3D modelling software involved — every asset
is either generated procedurally in a shader or generated from a text prompt (see `ASSETS.md`).

> **This repo ships no binary assets.** The 4K plates, the video, and the meshes are ~110MB and
> they're mine. `ASSETS.md` has every prompt, model and cost so you can generate your own set in
> about twenty minutes. The code runs as soon as they're in place.

---

## Run it

```bash
npm install && npm run dev
```

Then open **http://localhost:5173/app.html** — note the `/app.html`. Vite's default `/` is not
the entry point here.

Without the assets you'll get the geometry, the particle garden and the spine, but the cards will
be blank and act three will be empty. Generate them per `ASSETS.md` and drop them in:

```
public/tex/vines.png              4K garden plate — act three backdrop AND foreground ivy
public/env/garden.png             equirect env map, reflected in the marble
public/models/spine_straight.glb  the vertebral column
public/models/blossom.glb         one blossom, instanced 520×
public/models/bust_1,2,3,5,6.glb  five marble busts
public/video/card0..5.mp4         one 5s film per card
public/video/garden.mp4, ink.mp4  the two additive backdrop loops
public/cards/0..5.png             card poster frames — regenerate with the command below
```

The bust numbering isn't a typo: six were generated and converted, and `bust_4` was the weakest
conversion, so the scene loads the other five. `spine_curved.glb` is optional — `?spine=curved`
switches to it if you generate one.

**Card posters** (dev server must be running):

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for i in 0 1 2 3 4 5; do "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1100,700 --virtual-time-budget=7000 \
  --screenshot="$PWD/public/cards/$i.png" "http://localhost:5173/cardart.html?c=$i"; done
```

Chrome can't read `file://` here — it has to go through the dev server.

---

## The three acts

| | scroll | what happens |
|---|---|---|
| **One** | 0 → 0.12 | A chrome sigil spins alone on black. The title materialises out of blur. On first scroll the particle garden detonates outward from a DNA tail coiled beneath the sigil. |
| **Two** | 0.12 → 0.70 | The vertebral column drops in from above and six cards spiral around it, each playing its own 5-second film as it swings to the front. |
| **Three** | 0.70 → 1 | The column plants its sacrum in a moonlit garden. Five marble busts crystallise out of drifting particles, settle onto the grass, and track your cursor. |

---

## Architecture

```
app.html            the live entry — contains a .gl CSS override, don't remove it
cardart.html        the six dashboards as HTML; ?c=0..5 isolates one for screenshotting
bustcheck.html      dev tool: ?m=<name> renders a GLB as a point cloud from three angles
src/helix.jsx       THE MAIN FILE — cards, camera Rig, Scene, the scroll clock
src/finale.jsx      act three — busts, crystallise, lawn, backdrop plates
src/garden.jsx      168k-point garden (trees, mushrooms, tendrils, bushes)
src/blossoms.jsx    520 instanced 3D blossoms, clustered onto 46 bough anchors
src/boneSpine.jsx   the vertebral column
src/backdrop.jsx    generated video loops on far planes, additively blended
src/scrollState.js  the shared mutable object every module reads
src/systems.js      the six cards' content and colours
```

### The scroll clock

Everything reads one shared mutable object rather than React state — state updates at 60fps
would re-render the tree every frame.

```js
scroll = {
  p,        // eased progress 0..1
  bloom,    // 0 = garden collapsed into the DNA tail, 1 = fully detonated
  spineIn,  // the column entering from above
  fin,      // 0 through the gallery, 1 once you're in the garden
  gardenY,  // parallax offset
  tint,     // world colour, lerped toward the focused card
  mouse,    // cursor in NDC, for the busts' head tracking
}
```

`window.__scroll` is exposed in the browser console for debugging.

### The motion model

```
t     = scroll.p * TOTAL_SLOTS - cardIndex - START   // t === 0 → dead centre, facing camera
angle = t * ANGLE_SPAN        y = t * PITCH
rotation.y = angle * (1 - ease)                      // ease→1 at centre = square to camera
```

Constants at the top of `helix.jsx`: `R 7.7`, `PITCH 3.15`, `ANGLE_SPAN 1.42`, `FOCUS 0.85`,
`TILT 0.19`, `START 1.25`.

**If you add scroll length, change the runway by the same ratio.** `CARD_SLOTS` (6.85) and
`FINALE_SLOTS` (3.05) sum to `TOTAL_SLOTS`, and `.runway`'s height in `index.css` is scaled to
match. Change one without the other and every card re-times.

### The card films

Each card is a 5-second video that starts when the card swings to the **front of the spine**
(`near > 0.55`, i.e. `|t| < ~1.1`) and rewinds on every start, so the footage runs *through* the
focal window instead of arriving spent. Only the focused card decodes; the rest stay paused.
That's the only reason six video textures don't destroy the framerate.

Each card also has a poster PNG. Until a video decodes its first frame the texture is pure black,
and a black panel over a black scene is invisible — the poster guarantees there's always
something on the card.

### The busts

One pipeline produces both the garden and the statuary: **generate an image → convert to a mesh →
sample points off the mesh surface**. In act three each bust renders twice — as a converging point
cloud while it materialises, then as a marble mesh once it lands.

Head tracking reads the same shared `scroll.mouse`, which is what keeps all five heads turning in
sync. Each has a `turn` limit so it never cranes further than a neck would.

---

## Making it yours

- **`src/systems.js`** — the six cards. Name, kicker, description, and a two-colour hue that
  drives the world tint when that card is in focus.
- **`cardart.html`** — the dashboards themselves, as plain HTML. Redesign freely; `liveArt`'s old
  layout-dependent compositing is gone, so nothing downstream cares what these look like.
- **`src/index.css`** — all DOM copy styling, plus the hero's materialise animation.
- **`ASSETS.md`** — swap the prompts for your own subject and the whole world changes.

---

## Verifying changes

The in-app browser panes throttle `requestAnimationFrame` to about one frame, which makes the
canvas look permanently black. It isn't. Use headless Chrome, and pin the scroll with `?s=`:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --enable-unsafe-swiftshader --use-gl=angle --hide-scrollbars \
  --autoplay-policy=no-user-gesture-required \
  --window-size=1500,900 --virtual-time-budget=30000 \
  --screenshot=out.png "http://localhost:5173/app.html?s=0.4"
```

`?s=0.4` pins scroll progress to any point, which is the only reliable way to screenshot a
specific moment. See `LESSONS.md` before changing anything structural.

---

## What went wrong, and what it taught us

Every one of these cost real time. They're in rough order of how much.

### Generating assets

**Prompt for a clean sculpture, never a photo of a sculpture.** Single-image 3D conversion needs an
unambiguous silhouette and even light. Photographic surface texture — pores, grain, veining — gets
read as geometry and comes back as noise. The smooth stylised candidate beat the photoreal one every
time.

**Convert more candidates than you need.** Conversion is the step that fails most. At 20 credits it's
far cheaper to convert six and keep five than to regenerate and wait.

**`image_to_3d` returns arbitrary orientation.** Detect the longest axis and rotate it to Y yourself.

**Never scale a long object by its longest axis.** `height / max(size)` produced a spine as wide as
the cards. Size by *cross-section* and let length follow.

**Generated UI is light-mode by default.** Every screen in a video came back bright white until the
prompt shouted STRICTLY DARK MODE.

**Ask for the background colour explicitly.** Pure black for cutouts, mid-grey for 3D conversion.

### Rendering

**Point clouds cannot be stone, and they cannot be petals.** Additive blending plus a bloom pass turns
any dense cloud into a white glow — the busts only read as marble once they became actual meshes. And
a flower is defined by its petal silhouette, which loose dots can't describe. Points are for volume
(canopies, haze, crowds); meshes are for anything whose *edge* is the point.

**A near-black panel at 94% opacity is identical to a black scene.** Things read straight through it.
If the background is dark, partial transparency buys you nothing.

**`depthWrite: false` is how you control layering, not repositioning.** Blossoms sit right against the
lens by design. Stopping them writing depth lets the cards draw over them — moving them away broke the
look and had to be reverted.

**A hard line across your scene is usually a plane's own edge.** Backdrops are finite. Wherever the
rectangle stops, you see it stop. Size and centre it on where the *tilted* view actually looks at that
depth, not on the world origin.

**A textured floor is what sells "standing on".** Particle haze never did, however correct the maths.
And the eye needs a contact patch — a mist pool at the base — not just a correct Y coordinate.

**Seat objects using the bounding box AFTER the pose rotation.** Measuring a bust upright and then
tipping it over leaves it hovering or sunk.

**Scale by distance, not by height.** Hand-tuning the furthest statue larger made it read as the
nearest and inverted the entire composition.

**`ShapeGeometry` UVs are in shape space.** Re-map them across the bounding box or textures garble.

**`MeshTransmissionMaterial` re-renders the whole scene per instance.** Six of them was most of the
scroll lag. It's gone and it isn't coming back.

**Scattering things randomly reads as debris.** The blossoms only cohered once they were clustered
onto bough anchors. Nature groups; randomness alone looks like litter.

**Bigger objects need the camera further back, not closer.**

### React and the DOM

**Give heavy acts their own `<Suspense>`.** A 12MB plate and six meshes inside the page's single
boundary held the *entire canvas* black on every cold load until they finished downloading.

**Never `appendChild` inside `useMemo`.** StrictMode's double-render and every HMR reload leaked
another decoding `<video>`. It reached 48 and stalled the canvas. Create in `useMemo`, mount in
`useEffect`.

**Re-set `video.src` in the mount effect, not just at creation.** StrictMode runs mount → cleanup →
mount; the cleanup strips the src off the memoised element, and without restoring it every video sits
at `readyState 0` forever.

**Video textures need a poster.** Before the first frame decodes the texture is pure black — and a
black panel over a black scene is invisible. The cards simply weren't there.

**Browsers refuse autoplay until the page is interacted with.** Retry `play()` on the first
`pointerdown`/`wheel`, and pass `--autoplay-policy=no-user-gesture-required` to headless Chrome.

**Trigger playback on geometry, not on a guessed number.** Cards started playing 1.7 slots out, so a
5-second film was spent before the card ever reached centre and everything looked static. The right
trigger was the point where the card crosses to the front of the spine.

**Drive per-frame state through a shared mutable object, not React state.** Sixty re-renders a second
is not a plan.

### Verifying

**In-app browser panes throttle `requestAnimationFrame` to about one frame.** The canvas looks
permanently black and it reads exactly like a hang. It isn't — the tab only advances when a
screenshot wakes it. Verify with headless Chrome and `--virtual-time-budget`.

**Build a scroll-pin parameter early.** `?s=0.42` pins progress to any point and is the only reliable
way to screenshot a specific moment. It paid for itself within an hour.

**Build a preview tool for your pipeline.** `bustcheck.html` renders any GLB as a point cloud from
three angles, which caught orientation and silhouette problems before they reached the scene.

---

## Licence

MIT for the code. The generated art in my build is not included and is not covered — generate
your own from `ASSETS.md`.
