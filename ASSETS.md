# Assets — every prompt, and where it lands

No binaries ship with this repo. Everything below was generated from a text prompt on
**Higgsfield**; the same prompts work on any comparable image/video/3D service.

Prices are Higgsfield credits at time of build. **Preflight every call with `get_cost: true`** —
it submits nothing and costs nothing.

| Operation | Model | Credits |
|---|---|---|
| Image, 1k medium | `gpt_image_2` | 2 |
| Image, 1k high | `gpt_image_2` | 4 |
| Image, 4k high | `gpt_image_2` | 12 |
| Image → 3D, untextured | `image_to_3d` | 20 |
| Video, 5s | `kling3_0_turbo` | 7.5 |

**Total for a full set: ~250 credits.** Never pay for texturing — `should_texture: false`. The
busts become marble via a material in code, and the spine gets its own iridescent shader.

---

## 1. The busts → `public/models/bust_1..5.glb`

**Where you see them:** act three. Five marble statues in a V, crystallising out of particles and
tracking your cursor.

Two-step: generate the image, then convert it to a mesh. Generate **two variants of each concept**
and convert all of them — conversion is the step that goes wrong most, and at 20 credits it's far
cheaper to convert six and keep five than to regenerate a bad one.

`gpt_image_2`, quality `medium`, resolution `1k`, aspect `1:1`.

**Bust A — woman**
```
Classical Renaissance sculpted bust of a woman, head and shoulders only, neutral calm expression,
hair carved in smooth simplified sculptural masses, completely clean undamaged matte stone surface
with no pores, cracks, veining or grain, front three-quarter view, perfectly centred, even diffuse
studio lighting with soft wraparound fill and no harsh shadows, isolated on pure black background,
no pedestal, no base, no text, no lettering, no logos, no props, clean unambiguous silhouette,
photogrammetry scan reference style, smooth stylised sculpture render not a photograph
```

**Bust B — man.** Same, swapping the subject line for:
```
Classical Renaissance sculpted bust of a man, head and shoulders only, neutral composed expression,
short curled hair and beard carved as smooth simplified sculptural masses, [...rest identical...]
```

**Bust C — turned head.** Same, swapping for:
```
Classical Renaissance sculpted bust of a young androgynous figure, head turned in profile looking
to one side, chin slightly lifted, hair carved in smooth simplified sculptural masses,
[...rest identical...]
```

**Then convert each** with `image_to_3d`, `should_texture: false`, `target_polycount: 60000`.
Use `symmetry_mode: "auto"` for front-facing busts and **`"off"` for the turned-head ones** —
forcing symmetry on a profile mirrors it into a mess.

> The phrasing is doing real work here. *Clean sculpture*, not *photo of a sculpture*: single-image
> 3D needs an unambiguous silhouette and even light, and photographic surface texture converts into
> geometry noise. Every "no pores, no cracks, no veining" clause is there for the converter, not
> for looks.

---

## 2. The garden plate → `public/tex/vines.png`

**Where you see it:** act three, twice. Once as the full backdrop, and again *in front* of the
statues masked down to only its hanging ivy — that's what puts vines over the busts without
modelling a single leaf.

`gpt_image_2`, quality `high`, resolution `4k`, aspect `16:9`. **12 credits.**

```
Wide landscape moonlit formal garden at night, deep green and teal, cinematic film grain, dreamlike.
Foreground is a clearing of dark grass and low mist. Behind it, tall dark clipped hedges and huge old
trees, a stone balustrade, drifts of small glowing blue flowers, fireflies as tiny warm golden points,
a full moon through the canopy. Curtains and swags of trailing ivy and vines hang down from above into
the frame at the left and right edges, framing an empty centre. Cool blue-green moonlight only.
Absolutely no statues, no sculptures, no busts, no people, no figures. No text, no lettering, no logos.
```

Two clauses matter structurally. **"Framing an empty centre"** leaves room for the V of busts.
**"Absolutely no statues"** is non-negotiable — the plate must not contain its own statuary or it
fights the 3D busts standing in front of it.

**Alternate take** — a formal path with empty ivy-covered plinths, if you'd rather stand your busts
on something:

```
Wide landscape moonlit formal garden at night, deep green and teal, cinematic film grain. A stone
path recedes into the centre distance between tall dark clipped hedge walls. Empty weathered stone
plinths stand on either side of the path, thick ivy and trailing vines climbing over them. A carved
stone balustrade crosses the middle distance, also draped in ivy. Drifts of small glowing blue flowers
along the path edges, fireflies as tiny warm golden points, low mist over the grass, huge old trees and
a full moon behind. Cool blue-green moonlight only. Absolutely no statues, no sculptures, no busts,
no people, no figures — the plinths must be EMPTY. No text, no lettering, no logos.
```

---

## 3. Environment map → `public/env/garden.png`

**Where you see it:** in the marble. It's applied per-material, not to `scene.environment`, so the
statues reflect the garden while acts one and two keep their studio lighting.

`gpt_image_2`, quality `high`, resolution `1k`, aspect `16:9`. **4 credits.**

```
Equirectangular panoramic environment map for 3D reflection. Dark night garden surroundings: soft teal
and magenta glowing light sources scattered around a black horizon, diffuse bioluminescent haze, a few
large soft bright patches overhead like moonlight through canopy, dark ground below. Abstract, no
distinct objects, no people, no text, no logos. Smooth gradients suitable for use as an HDRI
reflection environment.
```

---

## 4. The six card films → `public/video/card0..5.mp4`

**Where you see them:** act two. Each plays as its card swings to the front of the spine.

`kling3_0_turbo`, 5s, aspect `16:9`. **7.5 credits each, 45 total.**

Every one follows the same shape: an abstract representation of the work, then a slow push-in that
**settles on a screen** and locks there. The last frame is what a card you've already scrolled past
holds on, so it has to be a resolved image, not a mid-motion smear.

**card0 — search / rankings**
```
Dark moody desk scene, cinematic. Search engine result rankings as glowing lines of text rising through
darkness, teal and magenta light. Camera slowly pushes in and settles on a modern laptop on a dark desk,
its screen showing a clean dark analytics dashboard with a rising green ranking graph. Ends locked on
the screen. Volumetric haze, shallow depth of field, no people visible except a hand leaving frame.
No text overlay, no logos, no watermark.
```

**card1 — sales / post-call**
```
Dark cinematic office at night. A sales call waveform pulses in the air and dissolves into a landing
page, a slide deck and an email assembling themselves from fragments of light, cool blue and cyan.
Camera pushes in and settles on a monitor on a dark desk showing a clean dark sales dashboard. Ends
locked on the screen. Volumetric haze, shallow depth of field. No people, no text overlay, no logos,
no watermark.
```

**card2 — creative testing**
```
Dark cinematic scene, lime green and emerald light. Hundreds of small advertisement thumbnails fly
through darkness in a grid, most dimming and falling away while a few brighten and rise. Camera pushes
in and settles on a monitor on a dark desk showing a clean dark creative-testing dashboard with a grid
of scored thumbnails. Ends locked on the screen. Volumetric haze, shallow depth of field. No people,
no text overlay, no logos, no watermark.
```

**card3 — authority / backlinks**
```
Dark cinematic scene, amber and hot pink light. Fragments of newspaper columns and journalist requests
drift through darkness, threads of light linking them together into a web. Camera pushes in and settles
on a monitor on a dark desk showing a clean dark backlinks dashboard with a rising bar chart. Ends
locked on the screen. Volumetric haze, shallow depth of field. No people, no readable text, no logos,
no watermark.
```

**card4 — operations brief.** Note the shouted dark-mode clause — the first attempt came back as a
bright white dashboard, completely off-palette:
```
Very dark cinematic room at dawn, violet and mint light on near-black. Streams of glowing email
envelopes, calendar blocks and revenue figures made of light converge and compress into a single glowing
brief. Camera pushes in and settles on a monitor on a dark desk. The monitor displays a STRICTLY DARK
MODE interface: near-black charcoal background with thin violet and mint accent lines and small glowing
stat tiles. Dark UI only, no white or light-coloured screen, low screen brightness. Ends locked on the
screen. Volumetric haze, shallow depth of field. No people, no readable text, no logos, no watermark.
```

**card5 — scheduling**
```
Dark cinematic scene, soft white and pale blue light. Six glowing systems arranged in the darkness pulse
gently in sequence, then a single calm empty chair and desk resolve out of the haze. Camera pushes in and
settles on a monitor on a dark desk showing a clean dark calendar with two open slots highlighted. Ends
locked on the screen. Volumetric haze, shallow depth of field. No people, no readable text, no logos,
no watermark.
```

---

## 5. The spine → `public/models/spine_straight.glb`

**Where you see it:** acts one to three. You descend it, and it plants its sacrum in the garden.

Image then `image_to_3d`, `should_texture: false`.

```
A complete human vertebral column, the whole spine from the cervical vertebrae at the top down through
the thoracic and lumbar vertebrae to the sacrum at the bottom. Shown upright and vertical, straight on,
centered, whole object in frame with generous margin. Isolated on a plain flat mid-grey background.
Flat even diffuse lighting from all directions, no shadows, no cast shadow. Smooth simplified sculptural
bone, clean unambiguous silhouette, pale neutral bone colour. Reference photograph for 3D scanning.
No stand, no rod, no skull, no ribs, no text, no labels, no logos.
```

> Generate the **whole column**, not one vertebra to instance. An earlier build repeated a single
> lumbar vertebra 44× and it read as the *base* of a spine stacked on itself, not as a spine.

---

## 6. The blossoms → `public/models/blossom.glb`

**Where you see them:** acts one and two, 520 instances clustered onto 46 bough anchors, drifting
past the cards.

```
A single stylised blossom flower head, seen from slightly above, petals fully open and clearly separated,
simple sculptural form with a clean unambiguous silhouette. Soft pink and violet petals. Isolated and
centered on a plain flat mid-grey background, whole flower in frame with generous margin. Flat even
diffuse lighting from all directions, no shadows, no cast shadow, no stem, no leaves, no vase. Reference
photograph for 3D scanning. No text, no labels, no logos.
```

> These started as point clouds and failed. A flower's whole character is its petal silhouette, and
> loose dots can't describe an edge. Silhouette-defined things need meshes; volume-defined things
> (trees, canopies, statues) are fine as points.

---

## 7. Backdrop loops → `public/video/garden.mp4`, `public/video/ink.mp4`

**Where you see them:** acts one and two, on two large planes far behind everything, additively
blended so their black backgrounds vanish and only the light survives.

`kling3_0_turbo`, 5s. These predate the current build and the exact strings weren't recorded —
these are from the shot list they were made against, so treat them as a starting point:

```
Slow ink blooming in water, teal and magenta on black, macro, cinematic, no text
```
```
Drifting luminous spores rising through darkness, soft bokeh, slow, no text
```

Additive blending is doing the heavy lifting. Any dark, slow, high-contrast loop works — the plane
never reads as a video, only as moving light.

---

## Generating: what to ask for, and what to refuse

- **Preflight with `get_cost: true`.** Free, and it tells you what the model silently defaulted to.
- **"No text, no lettering, no logos"** on every prompt. Generators love inventing brand marks, and
  early runs came back with real logos on them, which are unusable.
- **Name the background colour explicitly.** *Pure black* for cutout subjects, *mid-grey* for things
  headed to 3D conversion.
- **Say "dark mode" like you mean it** for any screen or UI. The default is light, every time.
- **Never pay for texturing.** You're applying your own materials.
