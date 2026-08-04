// Shared scroll/animation state. Written by Rig each frame, read by every module.
import * as THREE from 'three'

export const scroll = {
  tint: new THREE.Color('#ffffff'), // world colour, lerped toward the focused system
  p: 0,        // eased scroll progress 0..1
  target: 0,   // raw scroll progress from Lenis
  bloom: 0,    // 0 = garden collapsed into the DNA tail, 1 = fully detonated
  gardenY: 0,  // parallax offset for the garden
  fin: 0,      // 0 through the card gallery, 1 once you're down in the garden
  // The opening beats, each 0..1 and staggered: the sigil spins alone, the title materialises,
  // then the particles bloom in, then the spine drops in from above, then card 01 arrives.
  intro: 0,    // 0 = sigil only, 1 = world fully present
  spineIn: 0,  // the bone column entering from above
  // Cursor in normalised device coords (-1..1). Written by Rig, read by the busts so they
  // can look at where you actually are rather than at a fixed point.
  mouse: new THREE.Vector2(0, 0),
}

// exposed for debugging in the console: window.__scroll.fin etc.
if (typeof window !== 'undefined') window.__scroll = scroll
