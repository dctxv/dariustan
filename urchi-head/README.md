# Urchi's head (portable)

Just the head, cut down to what you asked for: it **nods, blinks, tracks, and tilts or looks left and right**,
and always stays awake. It keeps the random eye colourway. **Left out:** the spacesuit and limbs, sleep / doze /
wake / groggy, the stretch, the angry, happy and embarrassed faces, and everything that reacts to music. Also
gone: the owl's bob, sway, widening, cross-eyes, per-eye lids and the deep breath.

## Files

| File | What it is |
|---|---|
| `character.ts` | The head itself. `createUrchi()` returns a character that paints into a `<canvas>`. No dependencies. |
| `mesh.json` | The baked head mesh (84 vertices, 164 triangles, eye placement). Must sit beside `character.ts`. |
| `Urchi.ts` | Optional three.js host: puts the canvas on a plane, handles resolution, rim, dither/fade in and out. Needs `three` and `gsap`. |
| `demo/` | `index.html` (bare canvas, a button per move) and `three.html` (three.js plane). Build the `.js` first, see the top of each `.ts`. |

Copy the folder into the other project; `tsconfig` needs `"resolveJsonModule": true`. Use `character.ts`
alone for a plain canvas, add `Urchi.ts` for three.js.

## Use

```ts
// plain canvas
import { createUrchi } from "./urchi-head/character";
const urchi = createUrchi({ smooth: true });
urchi.setResolution(720);                 // smooth: canvas width in pixels (follow the size you show it at)
document.body.appendChild(urchi.canvas);
let last = performance.now();
requestAnimationFrame(function tick(now) { urchi.update((now - last) / 1000); last = now; requestAnimationFrame(tick); });

// three.js
import { Urchi } from "./urchi-head/Urchi";
const u = new Urchi();
u.width = 500; u.pixelRatio = devicePixelRatio;   // box width in scene units
scene.add(u.mesh);                                // origin is the head's centre
renderer.setAnimationLoop(() => u.update(dt));    // dt in seconds. u.scaleIn(1.2) / u.fadeIn(1) / u.dither(0.5, 1)
```

`createUrchi` touches `window`/`document` (pointer follow, `matchMedia`), so it is client-side only: in
Next.js, import it from a `"use client"` module or inside an effect. Under `prefers-reduced-motion` the head
stays front, the breath still and the blinks off, until a host calls `attend()`, which brings back blinks and
pupil jumps (still no head movement). `createUrchi({ input: false })` stops it following the pointer.

## Eye colour

One colourway is drawn at random per page load from 100 (weights in the file), then shared by every Urchi on
the page. Iris fills the eye; each pupil has its own colour, so the odd-eyed band has two.

- `?col=denim` in the URL forces one by name (`marmalade`, `laser`, `pinball`, `neapolitan`...).
- `drawnColourway()` returns `{ name, iris, pupilLeft, pupilRight }` (null before any Urchi exists), for matching UI to its eyes.
- `document.documentElement.dataset.eyes` is set to the name, for CSS.

To pin one in code, edit `colourwayFor` in `character.ts`.

## Eye colour

One colourway is drawn at random per page load from 100 (weights in the file), then shared by every Urchi on
the page. Iris fills the eye; each pupil has its own colour, so the odd-eyed band has two.

- `?col=denim` in the URL forces one by name (`marmalade`, `laser`, `pinball`, `neapolitan`...).
- `drawnColourway()` returns `{ name, iris, pupilLeft, pupilRight }` (null before any Urchi exists), for matching UI to its eyes.
- `document.documentElement.dataset.eyes` is set to the name, for CSS.

To pin one in code, edit `colourwayFor` in `character.ts`.

## Movements

**On its own** (nothing to call):
- **Tracking:** follows the pointer (yaw ±41°, pitch +15° down / -17.5° up), eyes first and head about 80 ms later.
- **Nodding:** the breath, 4.29 s per breath, a 3.15° nod.
- **Curious tilts:** every 4-9 s, 6-15° of roll, never more than two the same side in a row.
- **Blinking:** 2.5-6 s apart (log-normal), about one in five doubled. Pupils dart every 0.2-0.8 s, with an occasional small dip.

**On cue**, all on the character:

| Call | Does |
|---|---|
| `blink()` / `doubleBlink()` / `slowBlink(hold?)` | One blink, two, a cat's slow one |
| `lookAt(nx, ny, how?)` / `lookAt(null)` | Look at a point (-1..1, y down), e.g. `lookAt(-0.9, 0)` looks left; `"snap"` or `"quick"`; null hands back to the pointer |
| `glance()` | Look away (to the side opposite where it was looking) for 0.6 s, head and pupils |
| `eyesTo(ex, ey)` / `eyesTo(null)` | Pupils only, head stays put |
| `tiltToward(dir, degrees?)` | The curious tilt now: -1 left, 1 right |
| `setTilts([min, max] \| null)` | Gap between random tilts, or none |
| `pose(yaw, pitch, roll, speed?)` | Hold the head off its aim; `pose(0, 4, 0, 14)` then `pose(0, 0, 0, 9)` 200 ms later is a nod |
| `setBreathPeriod(s)` / `setBreathDepth(d)` | Pace and depth of the nodding breath |
| `setBlinkGap(min, max)` / `setBlinkHold(s)` | Blink rhythm |
| `setReveal(0..1)` | Optional intro: eyes alone first, then the head builds outward from them, then the rim |
| `attend()` | Marks a host as paying attention: turns get speed-by-distance; under reduced motion keeps blinks and pupil jumps |
| `alphaAt(u, v)` | Hit test: is this canvas point on the head or rim |

Read-only: `breath` (-1..1), `shut` (0..1).

## Query-string debug knobs

`?still` freezes breath and follow, `?look=0.6,-0.3` fixes the gaze, `?yaw=90&pitch=0` fixes the angles,
`?roll=12` fixes the tilt, `?blink=0.5` fixes the lids, `?ortho` turns perspective off.

## Not carried over

`attention.ts` (what it chooses to look at: tab pills, motes, boredom, the hours of the night), `acts.ts`,
`hours.ts`, `limbs.ts` and the suit. The sleep/wake version (with `moods.ts`, stretch, faces and the rest) is in
git history at commit `c1d7c2c` if you ever want it back.

The mesh is baked by `urchi/tools/build-mascot.mjs` in the Eigengrau repo; `mesh.json` here is that output.
