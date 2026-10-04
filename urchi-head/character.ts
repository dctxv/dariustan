import MESH_DATA from "./mesh.json";

/**
 * Urchi's head, on its own: the low-poly mesh painted into a canvas, with the random eye colourway.
 * Lifted from the Eigengrau site's character.ts, cut down to a head that is always awake: it nods
 * (the breath), blinks, tracks, and tilts or looks left and right. No spacesuit, sleep, stretch,
 * faces, or anything that reacts to music.
 *
 * What it does by itself (nothing to call): follows the pointer, breathes (a slow nod), tips its
 * head in curious tilts, darts its pupils, blinks (log-normal gaps, now and then twice).
 * What a host can ask of it on top: see UrchiCharacter below.
 *
 * `smooth` paints without pixels (anti-aliased, resolution set by the host); otherwise it is the
 * standalone page's small hard-pixel canvas. Query-string knobs work on any page:
 *   ?col=denim  ?still  ?look=0.6,-0.3  ?yaw=90&pitch=0  ?ortho  ?blink=0.5  ?roll=12
 */

type Vec2 = [number, number];
type Vec3 = [number, number, number];
/** A 2D canvas transform, as setTransform takes it. */
type CanvasTransform6 = [number, number, number, number, number, number];
type EyeSpec = { c: Vec3; dzdx: number; dzdy: number; n: Vec3 };
type Mesh = {
  v: Vec3[];
  f: Vec3[];
  g: number[];
  eye: { rx: number; ry: number; prx: number; pry: number; pin: number };
  eyes?: EyeSpec[];
  pivot: Vec3;
};
const MESH = MESH_DATA as unknown as Mesh;

/** The canvas's frame in mesh units (x right, y down): wider and taller than the box, so a tilted head fits. */
export const URCHI_FRAME = { x: -701.25, y: -674, w: 1402.5, h: 1230 } as const;
/** The mascot's box, the standalone page's viewBox: what its width is measured by. */
export const URCHI_BOX = { x: -540, y: -500, w: 1080, h: 1056 } as const;
/** The head itself, from ear tips to chin. */
export const URCHI_HEAD = { top: -436, bottom: 435.5 } as const;
/** The ear tips at rest, the highest point of the head each side of its middle, in mesh units (x right, y down): the viewer's left, then right. */
export const URCHI_EARS: [[number, number], [number, number]] = (() => {
  const tip = (side: number): [number, number] => {
    let best: [number, number] = [0, Infinity];
    for (const v of MESH.v) if (v[0] * side > 0 && v[1] < best[1]) best = [v[0], v[1]];
    return best;
  };
  return [tip(-1), tip(1)];
})();
/** The head's pivot for a tilt, in mesh units (y down): low in the head, like a neck. */
export const URCHI_PIVOT: [number, number] = [MESH.pivot[0], MESH.pivot[1]];
/** The eye distance render() uses unless ?ortho asks for none. */
const PERSPECTIVE_AT_REST = 2800;

/**
 * The eyes as drawn at rest (facing front, open, in perspective), in mesh
 * units, x right and y down: where each centre lands, and how far from it the
 * eye reaches. A host that shows the eyes before the head (the Space intro)
 * lays things out around them with this.
 */
export const URCHI_EYES: { centres: [number, number][]; reach: number } = (() => {
  const eyes = MESH.eyes || [];
  const s = (z: number) => PERSPECTIVE_AT_REST / (PERSPECTIVE_AT_REST - z);
  let reach = 0;
  const centres = eyes.map(({ c: [cx, cy, cz], dzdx, dzdy }): [number, number] => {
    const x0 = cx * s(cz), y0 = cy * s(cz);
    for (let k = 0; k < 40; k++) {
      const t = (2 * Math.PI * k) / 40, x = cx + MESH.eye.rx * Math.cos(t), y = cy + MESH.eye.ry * Math.sin(t);
      const z = cz + dzdx * (x - cx) + dzdy * (y - cy);
      reach = Math.max(reach, Math.hypot(x * s(z) - x0, y * s(z) - y0));
    }
    return [x0, y0];
  });
  return { centres, reach };
})();

// ------------------------------------------------------------------ eye colours
// One colourway is drawn at random on every page load, weighted exactly as the LilGuy eyes
// trait sheet: 100 colourways in seven bands (weights 1, .8, .9, .7, .3, .5, .2; total 52.7).
// [name, weight, iris, pupil]  or, for the odd-eyed band, [name, weight, iris, pupil on the
// viewer's left, pupil on the viewer's right]. Only colours change: the eye and pupil shapes
// stay as they are. The iris colour fills the eye (and the closed-lid arc).
//   ?col=denim   force a colourway by name
type Colourway = [string, number, string, string] | [string, number, string, string, string];
const COLOURWAYS: Colourway[] = [
  // Base fourteen: weight 1.0
  ["marmalade", 1.0, "#F99F05", "#6E6123"],
  ["matcha", 1.0, "#C7FBA6", "#5E6E06"],
  ["houseplant", 1.0, "#039442", "#71FF6F"],
  ["terrarium", 1.0, "#6FF5D0", "#106E54"],
  ["whale", 1.0, "#0059A3", "#0095FF"],
  ["frog", 1.0, "#42DE86", "#436A16"],
  ["denim", 1.0, "#6C92F8", "#102A6E"],
  ["petunia", 1.0, "#F8AFFB", "#F006B4"],
  ["lipgloss", 1.0, "#A10180", "#FC609C"],
  ["jawbreaker", 1.0, "#F6759F", "#56031F"],
  ["cherry", 1.0, "#AE0002", "#FF5252"],
  ["pebble", 1.0, "#645252", "#A4A4A4"],
  ["valentine", 1.0, "#DD06CB", "#7B1612"],
  ["plum", 1.0, "#7260E6", "#622058"],
  // Pale-pupil five: weight 0.8
  ["gumball", 0.8, "#F20F07", "#FFFFFF"],
  ["sprinkler", 0.8, "#59BF05", "#FFFFFF"],
  ["pool", 0.8, "#05A8F9", "#FCEEEE"],
  ["moon", 0.8, "#4028FF", "#EBFFFC"],
  ["bubblegum", 0.8, "#F442E7", "#FFFFFF"],
  // Light-iris twelve: weight 0.9
  ["seaglass", 0.9, "#FBFBFB", "#167B61"],
  ["laser", 0.9, "#FFFFFF", "#FF0000"],
  ["snowball", 0.9, "#FFFFFF", "#5A79F3"],
  ["smoothie", 0.9, "#FFECE0", "#CE0959"],
  ["peach", 0.9, "#FDFBE2", "#F76E5D"],
  ["goldfish", 0.9, "#E0F4FB", "#DE9109"],
  ["seashell", 0.9, "#FCD9CF", "#070571"],
  ["hydrangea", 0.9, "#E1BFE1", "#2722DB"],
  ["cupcake", 0.9, "#F9FFB2", "#CA00CA"],
  ["limeade", 0.9, "#EAFCC5", "#09B6CE"],
  ["teacup", 0.9, "#F6E5A5", "#0D73F7"],
  ["candycane", 0.9, "#9CFBD5", "#790C05"],
  // Hard-black five: weight 0.7
  ["ladybug", 0.7, "#C3110E", "#000000"],
  ["avocado", 0.7, "#8BD67C", "#230606"],
  ["submarine", 0.7, "#0F7BA9", "#000000"],
  ["eggplant", 0.7, "#E202E8", "#0A0A0A"],
  ["og", 0.7, "#FFFFFF", "#000000"],
  // Neon thirty-seven: weight 0.3
  ["lobster", 0.3, "#F95320", "#044A5F"],
  ["pumpkin", 0.3, "#E87102", "#55FC6E"],
  ["beachball", 0.3, "#F6FD21", "#1C9DE3"],
  ["glowstick", 0.3, "#E9F905", "#360342"],
  ["cactus", 0.3, "#C4F41D", "#530AEC"],
  ["highlighter", 0.3, "#95F124", "#F50DCF"],
  ["kiwi", 0.3, "#55F927", "#9F7717"],
  ["flytrap", 0.3, "#15F817", "#5E045E"],
  ["junebug", 0.3, "#14DA70", "#3516AF"],
  ["sunset", 0.3, "#AE2400", "#F855FC"],
  ["robin", 0.3, "#15ABF8", "#5E2304"],
  ["jukebox", 0.3, "#024BDE", "#FB4CC3"],
  ["starboy", 0.3, "#7B43F5", "#F6BD49"],
  ["sonar", 0.3, "#126487", "#2EE605"],
  ["guava", 0.3, "#84FB8E", "#F64982"],
  ["blacklight", 0.3, "#6922F0", "#A3F410"],
  ["taffy", 0.3, "#F474DC", "#E8FCA6"],
  ["lilac", 0.3, "#7202FC", "#FDB0CE"],
  ["nightlight", 0.3, "#7768FE", "#55FC87"],
  ["crocus", 0.3, "#D602E8", "#FBF823"],
  ["rosebush", 0.3, "#1E6935", "#FC7AC0"],
  ["parakeet", 0.3, "#018335", "#23FAFB"],
  ["glowworm", 0.3, "#F40DF8", "#19F515"],
  ["spearmint", 0.3, "#9CFBCE", "#790572"],
  ["motel", 0.3, "#FA486F", "#92FABE"],
  ["buoy", 0.3, "#14ABD6", "#EEFA24"],
  ["slushie", 0.3, "#C206AD", "#49F6D9"],
  ["siren", 0.3, "#FD0C0D", "#2905E6"],
  ["ember", 0.3, "#994400", "#00EEFF"],
  ["jelly", 0.3, "#B60080", "#429EFB"],
  ["popsicle", 0.3, "#71FEAE", "#5598FC"],
  ["dragonfruit", 0.3, "#B60053", "#CFFA0F"],
  ["hibiscus", 0.3, "#B6003C", "#05E605"],
  ["jam", 0.3, "#C5013C", "#09CE93"],
  ["candle", 0.3, "#973849", "#F7FBBC"],
  ["calculator", 0.3, "#737373", "#09E151"],
  ["doorbell", 0.3, "#BEBEBE", "#E42D06"],
  // Muted thirteen: weight 0.5
  ["postcard", 0.5, "#BE6A6A", "#76D8EB"],
  ["flowerpot", 0.5, "#CC6262", "#3E4002"],
  ["juicebox", 0.5, "#F6826C", "#95059B"],
  ["mallard", 0.5, "#7B8401", "#0737A7"],
  ["tomato", 0.5, "#60A611", "#B4040F"],
  ["chamomile", 0.5, "#509156", "#F4C524"],
  ["peacock", 0.5, "#02B0B6", "#7923FB"],
  ["sandbox", 0.5, "#B8804A", "#F7F574"],
  ["kite", 0.5, "#7DB5F4", "#C10787"],
  ["puddle", 0.5, "#A7AFF6", "#837605"],
  ["moth", 0.5, "#EC75F6", "#564803"],
  ["strawberry", 0.5, "#FCB7F2", "#069A1E"],
  ["flamingo", 0.5, "#FCB7C3", "#068F9A"],
  // Odd-eyed fourteen: weight 0.2
  ["static", 0.2, "#666666", "#000000", "#FFFFFF"],
  ["eraser", 0.2, "#666666", "#FFEDED", "#000000"],
  ["pinball", 0.2, "#B60207", "#D2F9F9", "#60D105"],
  ["socks", 0.2, "#B865A8", "#76D8EB", "#8F1716"],
  ["koi", 0.2, "#FE6873", "#0A0A0A", "#D0F910"],
  ["marble", 0.2, "#D1D9FA", "#C11207", "#D20ADF"],
  ["stoplight", 0.2, "#34F7FD", "#038C03", "#F91024"],
  ["bumblebee", 0.2, "#FDCB21", "#0A0A0A", "#D10566"],
  ["lilypad", 0.2, "#D1F63B", "#10812B", "#0F91F4"],
  ["popcorn", 0.2, "#EAF66E", "#BB240A", "#0964E7"],
  ["spumoni", 0.2, "#F6EAB9", "#177E39", "#2722DB"],
  ["umbrella", 0.2, "#E7E3E9", "#F65F28", "#4F6BF8"],
  ["sherbet", 0.2, "#E4F4E2", "#4A0A99", "#DB8405"],
  ["neapolitan", 0.2, "#87493B", "#EB76DD", "#B7ABF3"],
];
/** Drawn (or forced) once per page load and shared by every Urchi on the site's pages from then on. */
let drawn: Colourway | null = null;
function colourwayFor(params: URLSearchParams, pinned?: string): Colourway {
  const forced = COLOURWAYS.find((c) => c[0] === (pinned || params.get("col")));
  if (forced) return (drawn = forced);
  if (drawn) return drawn;
  let r = Math.random() * COLOURWAYS.reduce((s, c) => s + c[1], 0);
  for (const c of COLOURWAYS) {
    r -= c[1];
    if (r < 0) return (drawn = c);
  }
  return (drawn = COLOURWAYS[COLOURWAYS.length - 1]);
}

/** This visit's colourway, as drawn (or forced with ?col=) by the first Urchi on the page; null before any Urchi exists. */
export function drawnColourway(): { name: string; iris: string; pupilLeft: string; pupilRight: string } | null {
  if (!drawn) return null;
  return { name: drawn[0], iris: drawn[2], pupilLeft: drawn[3], pupilRight: drawn[4] || drawn[3] };
}

export type UrchiOptions = {
  reducedMotion?: boolean;
  /** Always use this colourway (by name, e.g. "og") instead of a random one, even over ?col=. */
  colourway?: string;
  /**
   * Mesh units per canvas pixel: 7.5 (the default) paints the 187 x 164 head of the standalone page.
   * A coarser cell paints a smaller canvas whose rim is still exactly one pixel, for a small Urchi
   * (the About mark, the favicon) that must stay crisp instead of being minified.
   */
  cell?: number;
  /** false: no window listeners, so the gaze never follows the pointer (the favicon). Default true. */
  input?: boolean;
  /**
   * Paint without pixels: anti-aliased edges and a drawn rim, at a resolution the host sets with
   * setResolution (the box's width in canvas pixels). `cell` then only sets the starting size.
   */
  smooth?: boolean;
};

export type UrchiCharacter = {
  /** The painted head, VBW / CELL by VBH / CELL pixels (187 x 164 at the default cell); transparent around the rim. */
  readonly canvas: HTMLCanvasElement;
  /**
   * One frame: steps the springs and repaints, unless nothing it draws has moved since the last
   * paint (the canvas already shows this frame). Returns whether it painted. dt in seconds.
   */
  update(dt: number): boolean;
  /** A slow, deliberate blink, a cat's. `hold` keeps it shut longer (a long, patient blink). */
  slowBlink(hold?: number): void;
  /** A look away, head and pupils, for a moment. */
  glance(): void;
  /** One ordinary blink now (never a double); the next random one waits its usual gap after it. */
  blink(): void;
  /**
   * Look at a point instead of the pointer: nx, ny in the pointer's space (the viewport, x right,
   * y down, each -1..1). The pupils go at once and, when the look moves far, the head follows
   * about 80ms later on its usual springs (`how` can make it snap there or turn quickly); the
   * pupils settle toward it with small flicks. Attended, the eyes stay ahead of a head still on
   * its way (EYES_FIRST), and a small turn is quick and a big one slow (TURN_SPEED). lookAt(null)
   * hands the gaze back to the pointer (or straight ahead without one). Reduced motion keeps the
   * head front.
   */
  lookAt(nx: number | null, ny?: number, how?: LookHow): void;
  /**
   * How much of Urchi is painted, 0..1 (1, the default, is all of it and costs nothing extra).
   * 0 paints the eyes alone, as they would show on the head, on nothing. Between, the head's art
   * pixels switch on in order of their distance from the nearer eye centre, and once the head is
   * whole the white rim switches on in the same order. The curious tilt holds off until it is 1.
   */
  setReveal(r: number): void;
  /** Whether canvas coordinates (u, v in 0..1, v up) fall on the head or its rim. */
  alphaAt(u: number, v: number): boolean;
  /**
   * The canvas's resolution: the mascot's box (URCHI_BOX, 1080 units) this many canvas pixels
   * across. A new size resizes the canvas (hosts showing it as a texture make a new one), and the
   * next update paints it. A smooth Urchi's host keeps this at the size it is shown, in device pixels.
   */
  setResolution(boxPx: number): void;
  /**
   * A smooth rim's width in mesh units, as the host wants it (Space holds it between 2 and 3.5
   * screen px); null is one art pixel, 7.5 units. Never under a canvas pixel and a quarter.
   */
  setRim(units: number | null): void;
  /** The canvas's frame in mesh units (URCHI_FRAME). */
  readonly frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

  // ---- host hooks (all inert until called)
  /**
   * Something is paying attention for it. Under reduced motion the head still stays front and
   * the breath still, but blinks run and the pupils jump (without easing) to what it looks at,
   * so it still notices things instead of being a picture.
   */
  attend(): void;
  /**
   * The pupils alone, in their own reach (-1..1 each way, a little wider than the darts), while
   * the head keeps to lookAt: reading a line, finding you through one opened eye. null lets them
   * follow the gaze again.
   */
  eyesTo(ex: number | null, ey?: number): void;
  /** Seconds per breath (4.29 by default); eases there over a couple of breaths. */
  setBreathPeriod(seconds: number): void;
  /** The breath's depth, 1 by default: 1.4 is a deeper nod. */
  setBreathDepth(depth: number): void;
  /**
   * The gap between ordinary blinks, in seconds: log-normal, the middle half of the gaps between
   * `min` and `max` (2.5..6 by default), so now and then a pair comes close and now and then a
   * long look goes without one.
   */
  setBlinkGap(min: number, max: number): void;
  /** How long an ordinary blink stays shut (0.15s by default); a longer hold reads as a heavier blink. */
  setBlinkHold(seconds: number): void;
  /**
   * The curious tilt, now, toward a side (-1 left, 1 right), at its usual angle or `degrees`.
   * It is cued, so it happens even with the random tilts off: then it holds a moment
   * and the head comes level again.
   */
  tiltToward(dir: number, degrees?: number): void;
  /** The random curious tilts: `[min, max]` seconds apart (4..9 by default), or null for none (it straightens). */
  setTilts(gap: [number, number] | null): void;
  /** Hold the head off its aim by these angles in degrees (a nod, a lean), on a spring of `speed`. */
  pose(yaw: number, pitch: number, roll: number, speed?: number): void;
  /** Two blinks, close together. */
  doubleBlink(): void;
  /** The breath now, -1 .. 1: +1 is the top of an in-breath. */
  readonly breath: number;
  /** How shut the eyes are right now, 0 .. 1 (the more shut of the two). */
  readonly shut: number;
  dispose(): void;
};

/** How the gaze turns when lookAt moves it: "snap" is already there; "quick" turns faster than usual. */
export type LookHow = "snap" | "quick";

export function createUrchi(o: UrchiOptions = {}): UrchiCharacter {
  const D2R = Math.PI / 180;
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

  // Local debug knobs (ignored when there is no query string):
  //   ?still            freeze breathing and the cursor follow (stable screenshots)
  //   ?look=0.6,-0.3    fix the gaze target (x right, y down, each -1..1)
  //   ?yaw=90&pitch=0   fix the head's angles in degrees (90 = right side view)
  //   ?ortho            no perspective (for comparing against the reference views)
  //   ?blink=0.5        fix how far the eyes are shut (0 open .. 1 closed)
  //   ?roll=12          fix the head tilt in degrees (positive tips the top to the right)
  const params = new URLSearchParams(location.search);
  const STILL = params.has("still");
  const reduceMotion = STILL || !!o.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (STILL) document.documentElement.dataset.still = "";

  const colourway = colourwayFor(params, o.colourway);
  const EYE_COLOUR = { iris: colourway[2], pupilLeft: colourway[3], pupilRight: colourway[4] || colourway[3] };
  document.documentElement.dataset.eyes = colourway[0];

  // ------------------------------------------------------------------ mesh
  const V = MESH.v, F = MESH.f, G = MESH.g;   // triangles, and the drawn plane each belongs to
  const GN = new Float64Array((Math.max(...G) + 1) * 3), tarea = new Float64Array(F.length);
  const EYES = MESH.eyes || [];
  // canvas in the SVG's coordinates, one pixel per CELL units; it covers x -701.25..701.25 and
  // y -674..556, wider and taller than the SVG's viewBox so a tilted head never gets cut off
  const VBX: number = URCHI_FRAME.x, VBY: number = URCHI_FRAME.y, VBW: number = URCHI_FRAME.w, VBH: number = URCHI_FRAME.h;
  let CELL = o.cell && o.cell > 0 ? o.cell : 7.5;
  const SMOOTH = !!o.smooth;
  const canvas = document.createElement("canvas");
  // The pixel pass reads the frame back every time; a smooth frame is never read, so it can stay on the GPU.
  const ctx = (SMOOTH ? canvas.getContext("2d") : canvas.getContext("2d", { willReadFrequently: true }))!;
  canvas.width = Math.ceil(VBW / CELL); canvas.height = Math.ceil(VBH / CELL);
  const COLOR = { base: "#040404" };
  const BASE = 1.5;   // dark base grown beyond the silhouette (units), so joins between planes show dark
  let rimMask = new Uint8Array(canvas.width * canvas.height);
  /** The last frame's pixels, for alphaAt. */
  let lastPx: Uint8ClampedArray | null = null;
  /** A smooth frame's silhouette and its canvas transform, for alphaAt. */
  let lastHead: Path2D | null = null;
  let lastToCanvas: CanvasTransform6 | null = null;
  /** The host's rim, in mesh units (setRim); null for one art pixel. */
  let rim: number | null = null;
  /** A smooth rim's width in mesh units: one art pixel (7.5) or the host's, and never under a canvas pixel and a quarter. */
  const rimWidth = () => Math.max(rim ?? 7.5, 1.25 * CELL);

  // ------------------------------------------------------------------ look
  // the cursor at a screen edge turns the head about 41 degrees (up/down 17.5 / 15)
  const LOOK = { yaw: 41.25 * D2R, pitchUp: 17.5 * D2R, pitchDown: 15 * D2R };
  const LIGHT = (() => { const l = [0.18, 0.88, 0.44], n = Math.hypot(...l); return l.map(v => v / n); })();   // view space: x right, y up, z toward viewer
  const FORCED_ROLL = params.has("roll") ? (Number(params.get("roll")) || 0) * D2R : null;
  const FORCED_BLINK = params.has("blink") ? Math.min(1, Math.max(0, Number(params.get("blink")) || 0)) : null;
  const PERSPECTIVE = params.has("ortho") ? Infinity : PERSPECTIVE_AT_REST;                             // eye distance in mesh units
  const PIVOT_Y = MESH.pivot[1];                                                                        // turn about the middle of the head
  const FORCED = params.has("yaw") || params.has("pitch") ? [Number(params.get("yaw")) || 0, Number(params.get("pitch")) || 0].map(v => v * D2R) : null;
  type Spring = { v: number; vel: number; target: number };
  const spring = (v = 0): Spring => ({ v, vel: 0, target: v });
  const S = { yaw: spring(), pitch: spring(), pointer: { nx: 0, ny: 0, has: false }, t: 0, lastMove: -99 };
  if (params.get("look")) {
    const [nx, ny] = params.get("look")!.split(",").map(Number);
    Object.assign(S.pointer, { nx: clamp(nx || 0, -1, 1), ny: clamp(ny || 0, -1, 1), has: true });
  }
  function stepSpring(s: Spring, dt: number, omega = 9, zeta = 0.8) {
    const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
    for (let i = 0; i < n; i++) { const acc = -omega * omega * (s.v - s.target) - 2 * zeta * omega * s.vel; s.vel += acc * h; s.v += s.vel * h; }
  }

  // ------------------------------------------------------------------ input
  const P = S.pointer;
  const listeners: [string, EventListener, AddEventListenerOptions | undefined][] = [];
  const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
    window.addEventListener(type, fn as EventListener, opts);
    listeners.push([type, fn as EventListener, opts]);
  };
  function pointerAt(e: PointerEvent) {
    P.nx = clamp(e.clientX / innerWidth * 2 - 1, -1, 1);
    P.ny = clamp(e.clientY / innerHeight * 2 - 1, -1, 1);
    P.has = true; S.lastMove = S.t;
  }
  let release = 0;
  if (!reduceMotion && o.input !== false) {
    on("pointermove", pointerAt, { passive: true });
    on("pointerdown", pointerAt, { passive: true });
    // a touch has no hover: hold the gaze where the finger was for a moment, then drift back
    on("pointerdown", () => clearTimeout(release));
    on("pointerup", e => { if (e.pointerType === "touch") release = window.setTimeout(() => { P.has = false; }, 1400); });
    on("pointerout", e => { if (!e.relatedTarget && e.pointerType !== "touch") P.has = false; });
    on("blur", () => { P.has = false; });
  }

  // ------------------------------------------------------------------ breathing
  // A slow loop: the head tips up as it rises and down as it settles, like a gentle nod.
  const BREATH = { period: 4.29, nod: 3.15 * D2R, rise: 5.25, settle: 0.8 };   // seconds per breath, nod amplitude, rise in SVG units (~1.75px), seconds for the depth to settle
  // `period` eases toward `toPeriod` and `depth` settles toward `base`, so a host can change the pace without a jump.
  const breath = { phase: 0, depth: 1, base: 1, w: 0, period: BREATH.period, toPeriod: BREATH.period };
  let rise = 0;
  function breathe(dt: number) {
    let w = 0;   // +depth at the top of the in-breath
    breath.period += (breath.toPeriod - breath.period) * (1 - Math.exp(-dt / 2));
    if (reduceMotion || FORCED) {
      w = 0;
    } else {
      breath.phase = (breath.phase + 2 * Math.PI * dt / breath.period) % (2 * Math.PI);
      breath.depth += (breath.base - breath.depth) * (1 - Math.exp(-dt / BREATH.settle));
      w = Math.sin(breath.phase) * breath.depth;
    }
    breath.w = w;
    rise = -BREATH.rise * w;
    return -BREATH.nod * w;   // negative pitch tips the face up
  }

  // ------------------------------------------------------------------ curious head tilt
  // A random sequence of head moves, usually 4-9s apart (about one in ten comes sooner, after
  // 1.5-2.5s, so there is no steady beat; after straightening it may rest up to 10s).
  //   from level:  tilt to a random side, but never more than two tilts in a row to one side
  //   from a tilt: straighten (35%), swing across to the other side (30%), or re-settle on the
  //                same side at a new angle (35%, never twice in a row)
  // Each move picks its own angle (usually 6-15 degrees, about one in four a small 3-6), its
  // own pace (slow lean to quick perk), a slight turn toward that side and a small look up or
  // down. The tilt pivots low in the head, like a neck, through a soft spring.
  const TILT = { pivot: 250, maxSameSide: 2 };
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const tilt = { roll: spring(), yaw: spring(), pitch: spring(), speed: 5.5, side: 0, lastSide: 0, streak: 0, next: rand(2, 5), resettled: false };
  /** The gap between moves (a host can stretch it, or stop the random tilts: `on` false). */
  const tilts = { on: true, min: 4, max: 9 };
  /** With the random tilts off, how long a cued tilt holds before the head comes level. */
  const CUED_HOLD: Vec2 = [1.3, 1.8];
  let cuedUntil = -1;
  function level() {
    tilt.side = 0; tilt.roll.target = 0; tilt.yaw.target = 0; tilt.pitch.target = 0;
  }
  function tiltTo(dir: number, degrees?: number) {
    const small = Math.random() < 0.25;
    tilt.roll.target = dir * (degrees ?? rand(small ? 3 : 6, small ? 6 : 15)) * D2R;
    tilt.yaw.target = dir * rand(1, 5) * D2R;
    tilt.pitch.target = rand(-3, 2) * D2R;   // mostly a slight look up, sometimes down
    tilt.side = dir;
  }
  function newTilt(dir: number) {                     // a fresh tilt to a side: counts toward the same-side limit
    if (dir === tilt.lastSide && tilt.streak >= TILT.maxSameSide) dir = -dir;
    tilt.streak = dir === tilt.lastSide ? tilt.streak + 1 : 1;
    tilt.lastSide = dir;
    tiltTo(dir);
  }
  function stepTilt(t: number, dt: number) {
    if (reveal < 1) {                                  // a head not yet drawn holds level, so the eyes stay where the host put them
      level();
      tilt.next = Math.max(tilt.next, t + rand(2, 4));
    } else if (!tilts.on) {                            // no random tilts: level, once a cued one has had its moment
      if (t >= cuedUntil) { level(); tilt.next = Math.max(tilt.next, t + rand(2, 4)); }
    } else if (t >= tilt.next) {
      let rest = false;
      const wasResettled = tilt.resettled; tilt.resettled = false;
      if (tilt.side === 0) newTilt(Math.random() < 0.5 ? 1 : -1);
      else {
        const r = Math.random();
        if (r < 0.35) { tilt.side = 0; tilt.roll.target = 0; tilt.yaw.target = 0; tilt.pitch.target = 0; rest = true; }
        else if (r < 0.65 || wasResettled) newTilt(-tilt.side);
        else { tiltTo(tilt.side); tilt.resettled = true; }   // same side, new angle (once in a row): not a new tilt
      }
      tilt.speed = rand(3.5, 8);                // this move's pace: slow lean .. quick perk
      const sooner = tilts.min <= 4 && Math.random() < 0.1;
      tilt.next = t + (sooner ? rand(1.5, 2.5) : rand(tilts.min, rest ? tilts.max + 1 : tilts.max));
    }
    stepSpring(tilt.roll, dt, tilt.speed, 0.62); stepSpring(tilt.yaw, dt, tilt.speed, 0.7); stepSpring(tilt.pitch, dt, tilt.speed, 0.7);
  }

  // ------------------------------------------------------------------ pupil movement
  // The pupils move as a pair, separately from the eye whites: small, smooth darts up, down,
  // left and right, and now and then a quick dip to 95% height and back. A new change comes
  // every 0.2-0.8s (with the dips' returns, 2.5 changes a second on average); each eases into place over about 0.2s.
  // With a gaze target (lookAt) the darts centre on it and shrink to small flicks.
  // eyesTo steers the pupils alone, over a slightly wider reach, with quicker jumps (reading).
  const GAZE = { minGap: 0.2, maxGap: 0.8, x: 10, y: 9, dip: 0.95, dipChance: 0.25, dipHold: [0.25, 0.45] as Vec2, flick: 3 };
  const EYES_REACH = { x: 20, y: 16, omega: 34 };
  /**
   * Eyes first (attended looks): while the head is still turning, the pupils are further round than
   * they rest, by `lead` of the turn still to go, up to their own reach (EYES_REACH), and they come
   * back as the head arrives, as eyes do when the head catches up with them.
   */
  const EYES_FIRST = { lead: 0.8 };
  const gaze = { x: spring(), y: spring(), h: spring(1), next: 0.5, undip: -1, instant: false };
  // the target, this moment's flick about it, and where the head aims (it follows the pupils after a lead)
  const look = { on: false, nx: 0, ny: 0, fx: 0, fy: 0, hx: 0, hy: 0, headAt: -1, quick: -1 };
  const eyes = { on: false, x: 0, y: 0 };
  function stepGaze(t: number, dt: number) {
    if (gaze.undip >= 0 && t >= gaze.undip) { gaze.h.target = 1; gaze.undip = -1; }
    if (t >= gaze.next) {
      if (eyes.on) {
        look.fx = look.fy = 0;
      } else if (Math.random() < GAZE.dipChance && gaze.undip < 0) {
        gaze.h.target = GAZE.dip; gaze.undip = t + rand(...GAZE.dipHold);
      } else if (look.on) {
        look.fx = rand(-GAZE.flick, GAZE.flick); look.fy = rand(-GAZE.flick, GAZE.flick);
      } else {
        gaze.x.target = rand(-GAZE.x, GAZE.x);
        gaze.y.target = rand(-GAZE.y, GAZE.y);
      }
      gaze.next = t + rand(GAZE.minGap, GAZE.maxGap);
    }
    if (eyes.on) {
      gaze.x.target = eyes.x * EYES_REACH.x; gaze.y.target = eyes.y * EYES_REACH.y;
    } else if (look.on) {   // kept on the target as it moves, and ahead of a head still turning there
      const [ax, ay] = attended && !reduceMotion ? eyesAhead() : [0, 0];
      gaze.x.target = clamp(clamp(look.nx * GAZE.x + look.fx, -GAZE.x, GAZE.x) + ax, -EYES_REACH.x, EYES_REACH.x);
      gaze.y.target = clamp(clamp(look.ny * GAZE.y + look.fy, -GAZE.y, GAZE.y) + ay, -EYES_REACH.y, EYES_REACH.y);
    }
    if (t < away.eyesUntil) { gaze.x.target = away.eyes * GAZE.x; gaze.y.target = 0; }   // the glance's pupils, whatever the gaze
    if (gaze.instant) {   // reduced motion, attended: jumps without easing
      gaze.x.v = gaze.x.target; gaze.y.v = gaze.y.target; gaze.h.v = 1;
      return;
    }
    const w = eyes.on ? EYES_REACH.omega : 22;
    stepSpring(gaze.x, dt, w, 0.9); stepSpring(gaze.y, dt, w, 0.9); stepSpring(gaze.h, dt, 22, 0.9);
  }
  /** How much further round the pupils are than they rest (mesh units), for the turn the head has still to make to the look (see EYES_FIRST). */
  function eyesAhead(): Vec2 {
    const [yaw, pitch] = headAim(look.nx, look.ny);
    return [EYES_FIRST.lead * ((yaw - S.yaw.v) / LOOK.yaw) * GAZE.x, EYES_FIRST.lead * (lookOfPitch(pitch) - lookOfPitch(S.pitch.v)) * GAZE.y];
  }

  // ------------------------------------------------------------------ eyes + blink
  // Open: an oval ring with an oval pupil hole (pupil nudged toward the nose). Blinking: the
  // ring squashes shut from the top toward a pivot low in the eye, then snaps to the closed
  // look, a thin arc curving down like a relaxed lid, and reopens the same way.
  const EYE = MESH.eye, STEPS = 40, ARC = 24;
  let blinkAmount = 0;   // 0 open .. 1 shut
  /** An eye: open, squashing shut with the blink, or the closed arc. */
  function ownEye(e: EyeSpec, b: number): { white: Vec2[]; pupil: Vec2[] | null } {
    const [cx, cy] = e.c, side = cx > 0 ? 1 : -1;
    const open = 1 - b;
    const ellipse = (x: number, y: number, rx: number, ry: number) => Array.from({ length: STEPS }, (_, k): Vec2 => { const t = 2 * Math.PI * k / STEPS; return [x + rx * Math.cos(t), y + ry * Math.sin(t)]; });
    // the pupil is its own layer: blinking never changes it (the lid just covers it); only the
    // pupil movement below moves it and briefly shortens it (and converging draws each toward the nose)
    const pupil = ellipse(cx - side * EYE.pin + gaze.x.v, cy + gaze.y.v, EYE.prx, EYE.pry * gaze.h.v);   // same offset for both: they move as a pair
    if (open > 0.22) {
      // the white opening: the eye outline squashed from the top toward a pivot low in the eye
      const pivot = cy + 0.3 * EYE.ry;
      const white = ellipse(cx, cy, EYE.rx, EYE.ry).map(([x, y]): Vec2 => [x, pivot + (y - pivot) * open]);
      return { white, pupil };
    }
    // closed: tapered crescent, ends level, sagging down in the middle; no pupil
    const y0 = cy + 0.16 * EYE.ry, x0 = cx - 1.02 * EYE.rx, w = 2.04 * EYE.rx, top = 0.2 * EYE.ry, bottom = top + 0.2 * EYE.ry;
    const upper = Array.from({ length: ARC + 1 }, (_, k): Vec2 => { const t = k / ARC; return [x0 + t * w, y0 + 4 * top * t * (1 - t)]; });
    const lower = Array.from({ length: ARC - 1 }, (_, k): Vec2 => { const t = 1 - (k + 1) / ARC; return [x0 + t * w, y0 + 4 * bottom * t * (1 - t)]; });
    return { white: [...upper, ...lower], pupil: null };
  }
  // A calm, deliberate blink: ~90ms to close, 150ms fully shut, ~140ms to open (opening is slower),
  // the middle half of them 2.5-6s apart, now and then twice in a row.
  type BlinkTiming = { close: number; hold: number; open: number };
  const BLINK: BlinkTiming = { close: 0.09, hold: 0.15, open: 0.14 };
  /** The site's slow blink: the same curves, drawn out. */
  const SLOW_BLINK: BlinkTiming = { close: 0.35, hold: 0.2, open: 0.35 };
  const blink = { start: -1, next: 1.2 + Math.random() * 2, double: false, timing: BLINK, cued: false, twice: false, gap: [2.5, 6] as Vec2 };
  /**
   * The gap to the next ordinary blink is log-normal, as people's are, so there is no beat to it:
   * most gaps near the middle of `blink.gap`, now and then two blinks close together or a long
   * look without one. The gap's two ends are its quartiles (the middle half of the gaps falls
   * between them); no gap is under `min` seconds or over `most` times the gap's top.
   */
  const BLINK_GAP = { min: 0.8, most: 2.5 };
  function blinkGap() {
    const [lo, hi] = blink.gap, sigma = Math.log(hi / lo) / 1.349;   // a normal's quartiles are 1.349 sigmas apart
    const z = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
    return clamp(Math.sqrt(lo * hi) * Math.exp(sigma * z), BLINK_GAP.min, hi * BLINK_GAP.most);
  }
  function stepBlink(t: number) {
    if (blink.start < 0) { if (t >= blink.next) blink.start = t; else return 0; }
    const e = t - blink.start, { close, hold, open } = blink.timing;
    if (e < close) { const u = e / close; return u * u * (3 - 2 * u); }   // lid eases down, deliberate rather than a snap
    if (e < close + hold) return 1;
    if (e < close + hold + open) { const u = (e - close - hold) / open; return 1 - (1 - (1 - u) * (1 - u)); }   // eases open
    const lone = blink.timing !== BLINK || blink.cued;   // a slow blink or one on cue is never doubled
    blink.start = -1; blink.timing = BLINK; blink.cued = false;
    blink.double = blink.twice || (!lone && !blink.double && Math.random() < 0.18);   // at most two in a row
    blink.twice = false;
    blink.next = t + (blink.double ? 0.12 : blinkGap());
    return 0;
  }

  // ------------------------------------------------------------------ the site's hooks
  // The glance away: the head turns off and the pupils follow for a moment.
  const GLANCE = { yaw: 22 * D2R, hold: 0.6 };
  const away = { turn: spring(), until: -1, eyes: 0, eyesUntil: -1 };
  // The pose: angles the head holds off its aim (a nod, say), on springs.
  const pose = { yaw: spring(), pitch: spring(), roll: spring(), speed: 6 };
  /** Reduced motion, with a host attending: blinks and pupil jumps run, nothing else moves. */
  let attended = false;

  // The reveal (the intro's "eyes first"). While it is under 1, render() also paints the eyes as
  // they show on the head into a mask, and its pixel pass (after the alpha snap and the rim) turns
  // off every head pixel beyond the sweep: the head's pixels switch on in order of distance from
  // the nearer eye centre over the first REVEAL.head of the way, the rim's over the rest.
  const REVEAL = { head: 0.72 };
  let reveal = 1;
  let revealMask: CanvasRenderingContext2D | null = null;
  let revealDist: Float32Array | null = null;
  const eyeAt = new Float64Array(EYES.length * 2);   // the eye centres this frame, in canvas pixels
  /** The eyes' reach, in canvas pixels: the head's sweep starts at their edge rather than their centre. */
  const eyeReach = () => URCHI_EYES.reach / CELL;
  function maskContext() {
    if (!revealMask) {
      const c = document.createElement("canvas");
      c.width = canvas.width; c.height = canvas.height;
      revealMask = c.getContext("2d", { willReadFrequently: true })!;
      revealDist = new Float32Array(c.width * c.height);
    }
    return revealMask;
  }
  /** The reveal's pixel pass over the snapped, rimmed frame: what the sweep has not reached goes transparent. */
  function hideUnrevealed(px: Uint8ClampedArray, eyes: Uint8ClampedArray, W: number, H: number) {
    const dist = revealDist!, EYE_REACH = eyeReach();
    let farHead = EYE_REACH, nearRim = Infinity, farRim = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!px[i * 4 + 3]) continue;
      let d = Infinity;
      for (let k = 0; k < eyeAt.length; k += 2) d = Math.min(d, Math.hypot(x + 0.5 - eyeAt[k], y + 0.5 - eyeAt[k + 1]));
      dist[i] = d;
      if (!rimMask[i]) farHead = Math.max(farHead, d);
      else { nearRim = Math.min(nearRim, d); farRim = Math.max(farRim, d); }
    }
    const u = reveal / REVEAL.head, v = (reveal - REVEAL.head) / (1 - REVEAL.head);
    const headR = reveal <= 0 ? -1 : EYE_REACH + Math.min(1, u) * (farHead - EYE_REACH);
    const rimR = v <= 0 ? -1 : nearRim + Math.min(1, v) * (farRim - nearRim);
    for (let i = 0; i < W * H; i++) {
      if (!px[i * 4 + 3]) continue;
      const on = rimMask[i] ? dist[i] <= rimR : eyes[i * 4 + 3] >= 128 || dist[i] <= headR;
      if (!on) px[i * 4 + 3] = 0;
    }
  }

  // ------------------------------------------------------------------ render
  const proj = new Float64Array(V.length * 3);   // rotated x, y (screen, y down) and z (toward viewer) per vertex
  const depth = new Float64Array(F.length);

  type Plane = { z: number; n: number; path: Path2D; color: string };
  type Item = { z: number; plane?: Plane; eye?: { white: Path2D; pupil: Path2D | null; left: boolean } };

  function render(yaw: number, pitch: number, roll = 0) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll), RP = TILT.pivot;
    const project = ([px, py, pz]: Vec3): Vec3 => {
      const x = px, y = py - PIVOT_Y, z = pz;
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y2 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp;
      // roll (the head tilt) about the view axis, pivoting low in the head; positive tips the top to the right
      const xr = x1 * cr - (y2 - RP) * sr, yr = x1 * sr + (y2 - RP) * cr + RP;
      const s = PERSPECTIVE === Infinity ? 1 : PERSPECTIVE / (PERSPECTIVE - z2);
      return [xr * s, (yr + PIVOT_Y) * s, z2];
    };
    for (let i = 0; i < V.length; i++) {
      const x = V[i][0], y = V[i][1] - PIVOT_Y, z = V[i][2];
      // yaw about the vertical axis (positive turns the face to the viewer's right), then
      // pitch about the horizontal axis (positive tips the face down; y points down here)
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y2 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp;
      const xr = x1 * cr - (y2 - RP) * sr, yr = x1 * sr + (y2 - RP) * cr + RP;
      const s = PERSPECTIVE === Infinity ? 1 : PERSPECTIVE / (PERSPECTIVE - z2);
      proj[i * 3] = xr * s; proj[i * 3 + 1] = (yr + PIVOT_Y) * s; proj[i * 3 + 2] = z2;
    }
    // 1. per triangle: screen winding (visibility), depth, and its normal summed into its plane
    GN.fill(0);
    for (let fi = 0; fi < F.length; fi++) {
      const f = F[fi];
      let area = 0, nx = 0, ny = 0, nz = 0, zsum = 0;
      for (let k = 0; k < 3; k++) {
        const a = f[k], b = f[(k + 1) % 3];
        const ax = proj[a * 3], ay = -proj[a * 3 + 1], az = proj[a * 3 + 2];
        const bx = proj[b * 3], by = -proj[b * 3 + 1], bz = proj[b * 3 + 2];
        area += proj[a * 3] * proj[b * 3 + 1] - proj[b * 3] * proj[a * 3 + 1];
        nx += (ay - by) * (az + bz); ny += (az - bz) * (ax + bx); nz += (ax - bx) * (ay + by);
        zsum += az;
      }
      depth[fi] = zsum / 3; tarea[fi] = area;
      const g = G[fi]; GN[g * 3] += nx; GN[g * 3 + 1] += ny; GN[g * 3 + 2] += nz;
    }
    // 2. visible triangles, merged per plane into one shape (so no seams show inside a plane),
    //    each plane taking its one shade; the silhouette is the union of everything
    const planes = new Map<number, Plane>(), head = new Path2D();
    for (let fi = 0; fi < F.length; fi++) {
      if (!(tarea[fi] > 0)) continue;
      const g = G[fi], f = F[fi];
      let pl = planes.get(g);
      if (!pl) {
        let nx = GN[g * 3], ny = GN[g * 3 + 1], nz = GN[g * 3 + 2];
        const l = Math.hypot(nx, ny, nz) || 1;
        if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const i = Math.pow(Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / l), 1.2);
        const c = Math.round(4 + 24 * i);   // near-black: planes range from #040404 to about #1C1C1C
        pl = { z: 0, n: 0, path: new Path2D(), color: `rgb(${c},${c},${c})` };
        planes.set(g, pl);
      }
      const tri = new Path2D();
      tri.moveTo(proj[f[0] * 3], proj[f[0] * 3 + 1]); tri.lineTo(proj[f[1] * 3], proj[f[1] * 3 + 1]); tri.lineTo(proj[f[2] * 3], proj[f[2] * 3 + 1]); tri.closePath();
      pl.path.addPath(tri); head.addPath(tri);
      pl.z += depth[fi]; pl.n++;
    }
    const items: Item[] = [];
    for (const pl of planes.values()) items.push({ z: pl.z / pl.n, plane: pl });
    // 3. eyes: drawn on their face plane, hidden once that face turns away, and sorted just in
    //    front of what they lie on so nearer parts of the head cover them
    EYES.forEach(e => {
      const n = e.n, nz1 = -n[0] * sy + n[2] * cy, nz2 = -n[1] * sp + nz1 * cp;
      if (nz2 < 0.15) return;
      const onPlane = ([x, y]: Vec2): Vec3 => [x, y, e.c[2] + e.dzdx * (x - e.c[0]) + e.dzdy * (y - e.c[1])];
      let zmax = -Infinity;
      const path = (ring: Vec2[]) => { const p = new Path2D(); ring.forEach(([x, y], k) => { const q = project(onPlane([x, y])); if (q[2] > zmax) zmax = q[2]; if (k) p.lineTo(q[0], q[1]); else p.moveTo(q[0], q[1]); }); p.closePath(); return p; };
      const shape = ownEye(e, blinkAmount);
      items.push({ z: 0, eye: { white: path(shape.white), pupil: shape.pupil && path(shape.pupil), left: e.c[0] < 0 } });
      items[items.length - 1].z = zmax + 10;
    });
    items.sort((a, b) => a.z - b.z);   // painter's order: far first

    // 4. paint: dark base (silhouette grown by BASE, so joins between planes show dark), the
    //    planes and eyes far-to-near, then snap the edge to whole pixels and add the rim.
    //    During a reveal the eyes also go into a mask, and planes nearer than an eye cut it.
    const toCanvas: CanvasTransform6 = [1 / CELL, 0, 0, 1 / CELL, (0 - VBX) / CELL, (rise - VBY) / CELL];
    if (SMOOTH) {
      paintSmooth(head, items, toCanvas, reveal < 1 ? EYES.map((e) => project(e.c)) : null);
      return;
    }
    const mask = reveal < 1 ? maskContext() : null;
    if (mask) {
      mask.setTransform(1, 0, 0, 1, 0, 0);
      mask.clearRect(0, 0, canvas.width, canvas.height);
      mask.setTransform(...toCanvas);
      mask.lineJoin = "round"; mask.lineWidth = CELL; mask.fillStyle = mask.strokeStyle = "#fff";
      EYES.forEach((e, k) => { const q = project(e.c); eyeAt[k * 2] = (q[0] - VBX) / CELL; eyeAt[k * 2 + 1] = (q[1] + rise - VBY) / CELL; });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(...toCanvas);
    ctx.lineJoin = "round";
    ctx.fillStyle = ctx.strokeStyle = COLOR.base; ctx.lineWidth = 2 * BASE; ctx.fill(head); ctx.stroke(head);
    ctx.lineWidth = CELL;   // one canvas pixel
    for (const it of items) {
      // one-pixel stroke in the plane's own colour closes the anti-aliasing gap to its neighbours
      if (it.plane) {
        ctx.fillStyle = ctx.strokeStyle = it.plane.color; ctx.fill(it.plane.path); ctx.stroke(it.plane.path);
        if (mask) { mask.globalCompositeOperation = "destination-out"; mask.fill(it.plane.path); mask.stroke(it.plane.path); }
        continue;
      }
      const eye = it.eye!;
      ctx.save(); ctx.clip(head);                                     // a turned-away eye never sticks out past the head
      ctx.fillStyle = EYE_COLOUR.iris; ctx.fill(eye.white);
      if (eye.pupil) { ctx.clip(eye.white); ctx.fillStyle = eye.left ? EYE_COLOUR.pupilLeft : EYE_COLOUR.pupilRight; ctx.fill(eye.pupil); }   // the lid covers the pupil
      ctx.restore();
      if (mask) { mask.save(); mask.globalCompositeOperation = "source-over"; mask.clip(head); mask.fill(eye.white); mask.restore(); }
    }
    pixelFinish(mask);
  }

  /**
   * The pixel paint's last pass: a hard pixel edge against the page (each pixel is head or
   * background), then the white rim: every background pixel touching the head (8 neighbours)
   * turns white, one art pixel wide. During a reveal, what the sweep has not reached goes.
   */
  function pixelFinish(mask: CanvasRenderingContext2D | null) {
    const W = canvas.width, H = canvas.height;
    const img = ctx.getImageData(0, 0, W, H), px = img.data;
    for (let k = 3; k < px.length; k += 4) px[k] = px[k] < 128 ? 0 : 255;
    rimMask.fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (px[(y * W + x) * 4 + 3]) continue;
      let touch = false;
      for (let dy = -1; dy <= 1 && !touch; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && px[(ny * W + nx) * 4 + 3]) { touch = true; break; }
      }
      if (touch) rimMask[y * W + x] = 1;
    }
    for (let i = 0; i < rimMask.length; i++) if (rimMask[i]) { const k = i * 4; px[k] = px[k + 1] = px[k + 2] = 255; px[k + 3] = 255; }
    if (mask) hideUnrevealed(px, mask.getImageData(0, 0, W, H).data, W, H);
    ctx.putImageData(img, 0, 0);
    lastPx = px;
  }

  /**
   * The smooth paint: the rim first, as the silhouette's outline (its inner half is covered by
   * what follows), then the dark base, the planes and the eyes far to near, all anti-aliased.
   * During a reveal, circles about the eye centres (in mesh units) grow over the head and then
   * over the rim, in the pixel pass's order, and the eyes show on their own over whatever is there.
   */
  function paintSmooth(head: Path2D, items: Item[], toCanvas: CanvasTransform6, eyeC: Vec3[] | null) {
    const RIM = rimWidth();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(...toCanvas);
    ctx.lineJoin = "round";
    let headR = Infinity, rimR = Infinity;
    if (eyeC) {
      let far = URCHI_EYES.reach;
      for (let i = 0; i < V.length; i++) {
        let d = Infinity;
        for (const c of eyeC) d = Math.min(d, Math.hypot(proj[i * 3] - c[0], proj[i * 3 + 1] - c[1]));
        far = Math.max(far, d);
      }
      far += BASE;
      const u = reveal / REVEAL.head, v = (reveal - REVEAL.head) / (1 - REVEAL.head), near = far * 0.55;
      headR = reveal <= 0 ? -1 : URCHI_EYES.reach + Math.min(1, u) * (far - URCHI_EYES.reach);
      rimR = v <= 0 ? -1 : near + Math.min(1, v) * (far + RIM - near);
    }
    const circles = (r: number) => {
      const p = new Path2D();
      eyeC!.forEach(([x, y]) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, Math.PI * 2); });
      return p;
    };
    if (rimR > 0) {
      ctx.save();
      if (eyeC) ctx.clip(circles(rimR));
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * (RIM + BASE); ctx.stroke(head);
      ctx.restore();
    }
    if (headR > 0) {
      ctx.save();
      if (eyeC) ctx.clip(circles(headR));
      ctx.fillStyle = ctx.strokeStyle = COLOR.base; ctx.lineWidth = 2 * BASE; ctx.fill(head); ctx.stroke(head);
      ctx.lineWidth = CELL;   // one canvas pixel in the plane's own colour closes the gaps to its neighbours
      for (const it of items) {
        if (it.plane) { ctx.fillStyle = ctx.strokeStyle = it.plane.color; ctx.fill(it.plane.path); ctx.stroke(it.plane.path); }
        else if (!eyeC) paintEye(it.eye!, head);
      }
      ctx.restore();
    }
    if (eyeC) for (const it of items) if (it.eye) paintEye(it.eye, head);
    lastHead = head; lastToCanvas = toCanvas;
  }
  function paintEye(eye: NonNullable<Item["eye"]>, head: Path2D) {
    ctx.save(); ctx.clip(head);                                       // a turned-away eye never sticks out past the head
    ctx.fillStyle = EYE_COLOUR.iris; ctx.fill(eye.white);
    if (eye.pupil) { ctx.clip(eye.white); ctx.fillStyle = eye.left ? EYE_COLOUR.pupilLeft : EYE_COLOUR.pupilRight; ctx.fill(eye.pupil); }   // the lid covers the pupil
    ctx.restore();
  }


  // ------------------------------------------------------------------ frame
  // Eyes lead, head follows: when a look moves far, the pupils go at once and the head's aim
  // catches up this much later (a quick turn stiffens the head's springs for a moment).
  const LEAD = { seconds: 0.08, jump: 0.05, quick: 0.6 };
  const HEAD = { omega: 9, quick: 16 };
  /**
   * How fast the head turns, by how far (attended only: the host's looks): a small turn is quick
   * and a big one slow, as a neck's are. A new turn (its aim moving `jump` degrees or more) sets
   * the head's spring for itself from the turn it has to make: HEAD.omega at `ref` degrees, and as
   * the square root of `ref` over the turn, so a turn's top speed grows only as its square root and
   * its time with it (3 degrees in about 0.17s, 40 in about 0.6s); never stiffer than `fast` nor
   * softer than `slow`.
   */
  const TURN_SPEED = { ref: 12, fast: 18, slow: 4.5, jump: 1 };
  /** The head's spring as the current turn has it, and the aim that turn was for (radians). */
  const turning = { omega: HEAD.omega, yaw: 0, pitch: 0 };
  /** The head's angles for an aim in the pointer's space. */
  const headAim = (nx: number, ny: number): Vec2 => [nx * LOOK.yaw, ny > 0 ? ny * LOOK.pitchDown : ny * LOOK.pitchUp];
  /** A head pitch back in the pointer's space: headAim's own, the other way. */
  const lookOfPitch = (pitch: number) => (pitch > 0 ? pitch / LOOK.pitchDown : pitch / LOOK.pitchUp);
  /** Blinks and pupil moves run: always, except under reduced motion with nothing attending (or ?still). */
  const lively = () => !reduceMotion || (attended && !STILL);

  /**
   * What render() read for the last paint. A frame whose every input is within DRAWN_EPS of it
   * would draw the same picture (a hundredth of a canvas pixel at most), so the canvas keeps it
   * and a host can skip its upload. Null paints the next frame whatever (a new size, the first).
   */
  let lastDrawn: number[] | null = null;
  const DRAWN_EPS = 1e-5;
  function paint(yaw: number, pitch: number, roll: number): boolean {
    const now = [yaw, pitch, roll, blinkAmount, gaze.x.v, gaze.y.v, gaze.h.v, rise, reveal, CELL, rimWidth()];
    const was = lastDrawn;
    if (was && was.length === now.length && now.every((v, i) => Math.abs(v - was[i]) < DRAWN_EPS)) return false;
    lastDrawn = now;
    render(yaw, pitch, roll);
    return true;
  }

  // The standalone page's frame, called by the host's ticker instead of its own.
  function frame(dtSeconds: number): boolean {
    const dt = Math.min(0.05, Math.max(0.001, dtSeconds));
    S.t += dt;
    let tx = 0, ty = 0;   // a gaze target outranks the pointer
    if (look.on && !reduceMotion) {
      if (look.headAt < 0 || S.t >= look.headAt) { look.hx = look.nx; look.hy = look.ny; look.headAt = -1; }
      tx = look.hx; ty = look.hy;
    } else if (P.has) { tx = P.nx; ty = P.ny; }
    [S.yaw.target, S.pitch.target] = headAim(tx, ty);
    if (!attended) turning.omega = HEAD.omega;
    else if (Math.hypot(S.yaw.target - turning.yaw, S.pitch.target - turning.pitch) >= TURN_SPEED.jump * D2R) {
      // a new turn: its spring from how far the head has to go (see TURN_SPEED)
      const far = Math.max(1e-3, Math.hypot(S.yaw.target - S.yaw.v, S.pitch.target - S.pitch.v) / D2R);
      turning.omega = clamp(HEAD.omega * Math.sqrt(TURN_SPEED.ref / far), TURN_SPEED.slow, TURN_SPEED.fast);
      turning.yaw = S.yaw.target; turning.pitch = S.pitch.target;
    }
    const omega = S.t < look.quick ? Math.max(HEAD.quick, turning.omega) : turning.omega;
    stepSpring(S.yaw, dt, omega); stepSpring(S.pitch, dt, omega);
    if (STILL) { S.yaw.v = S.yaw.target; S.pitch.v = S.pitch.target; }
    if (FORCED) { S.yaw.v = FORCED[0]; S.pitch.v = FORCED[1]; }
    blinkAmount = FORCED_BLINK ?? (lively() ? stepBlink(S.t) : 0);
    const nod = breathe(dt);
    if (!reduceMotion && !FORCED) { stepTilt(S.t, dt); stepGaze(S.t, dt); }
    else if (lively() && !FORCED) stepGaze(S.t, dt);   // reduced motion, attended: the pupils still jump
    if (away.until >= 0 && S.t >= away.until) { away.turn.target = 0; away.until = -1; }
    stepSpring(away.turn, dt, 12, 0.8);
    // a held pose, on springs (none of it under reduced motion)
    stepSpring(pose.yaw, dt, pose.speed, 0.85); stepSpring(pose.pitch, dt, pose.speed, 0.85); stepSpring(pose.roll, dt, pose.speed, 0.85);
    const extra = reduceMotion || FORCED ? { yaw: 0, pitch: 0, roll: 0 } : { yaw: pose.yaw.v, pitch: pose.pitch.v, roll: pose.roll.v };
    const roll = FORCED_ROLL ?? tilt.roll.v + extra.roll;
    return paint(S.yaw.v + tilt.yaw.v + away.turn.v + extra.yaw, S.pitch.v + tilt.pitch.v + nod + extra.pitch, roll);
  }
  // ---- head moves
  function slowBlink(hold?: number) {
    if (!lively()) return;
    blink.start = S.t; blink.timing = hold === undefined ? SLOW_BLINK : { ...SLOW_BLINK, hold };
  }
  function tiltToward(dir: number, degrees?: number) {
    if (reduceMotion || reveal < 1) return;
    const side = dir < 0 ? -1 : 1;
    tilt.streak = side === tilt.lastSide ? tilt.streak + 1 : 1; tilt.lastSide = side;
    tiltTo(side, degrees); tilt.resettled = false;
    tilt.speed = rand(6, 8);   // a perk rather than a lean
    if (tilts.on) tilt.next = S.t + rand(tilts.min, tilts.max);
    else cuedUntil = S.t + rand(...CUED_HOLD);
  }
  blinkAmount = FORCED_BLINK ?? 0;
  breathe(0);
  render(FORCED ? FORCED[0] : 0, FORCED ? FORCED[1] : 0, FORCED_ROLL ?? 0);

  return {
    canvas,
    update: frame,
    slowBlink,
    glance() {
      if (!lively()) return;
      const dir = S.yaw.v + tilt.yaw.v > 0 ? -1 : 1;   // away from where it was looking
      if (!reduceMotion) { away.turn.target = dir * GLANCE.yaw; away.until = S.t + GLANCE.hold; }
      away.eyes = dir; away.eyesUntil = S.t + GLANCE.hold;
      gaze.x.target = dir * GAZE.x; gaze.next = S.t + GLANCE.hold;
    },
    blink() {
      if (!lively() || blink.start >= 0) return;
      blink.start = S.t; blink.timing = BLINK; blink.cued = true; blink.double = false;
    },
    lookAt(nx, ny = 0, how) {
      if (nx === null) { look.on = false; look.headAt = -1; gaze.next = S.t; return; }
      if (!look.on) {   // the head was on the pointer (or ahead): the lead starts from where it has got to
        look.fx = look.fy = 0;
        look.hx = S.yaw.v / LOOK.yaw; look.hy = lookOfPitch(S.pitch.v);
      }
      look.on = true; look.nx = clamp(nx, -1, 1); look.ny = clamp(ny, -1, 1);   // the pupils go at once; the head follows on its springs
      if (how === "snap") {   // already there: head, pupils and all
        look.hx = look.nx; look.hy = look.ny; look.headAt = -1;
        if (!reduceMotion) { [S.yaw.v, S.pitch.v] = headAim(look.nx, look.ny); S.yaw.vel = S.pitch.vel = 0; }
        gaze.x.v = gaze.x.target = look.nx * GAZE.x; gaze.y.v = gaze.y.target = look.ny * GAZE.y;
        return;
      }
      if (look.headAt < 0 && Math.hypot(look.nx - look.hx, look.ny - look.hy) > LEAD.jump) look.headAt = S.t + LEAD.seconds;
      if (how === "quick") look.quick = S.t + LEAD.quick;
    },
    setReveal(r) {
      reveal = clamp(r, 0, 1);
    },
    setResolution(boxPx) {
      const next = URCHI_BOX.w / Math.max(8, boxPx);
      if (Math.abs(next - CELL) < 1e-9) return;
      CELL = next;
      canvas.width = Math.ceil(VBW / CELL); canvas.height = Math.ceil(VBH / CELL);
      rimMask = new Uint8Array(canvas.width * canvas.height);
      revealMask = null; revealDist = null; lastPx = null; lastHead = null; lastDrawn = null;
    },
    setRim(units) {
      rim = units === null ? null : Math.max(0, units);
    },
    get frame() {
      return URCHI_FRAME;
    },
    alphaAt(u, v) {
      if (SMOOTH) {
        if (!lastHead || !lastToCanvas) return false;
        const x = u * canvas.width, y = (1 - v) * canvas.height;
        ctx.save();
        ctx.setTransform(...lastToCanvas);
        ctx.lineJoin = "round"; ctx.lineWidth = 2 * (rimWidth() + BASE);
        const on = ctx.isPointInPath(lastHead, x, y) || ctx.isPointInStroke(lastHead, x, y);
        ctx.restore();
        return on;
      }
      if (!lastPx) return false;
      const x = Math.floor(u * canvas.width), y = Math.floor((1 - v) * canvas.height);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
      return lastPx[(y * canvas.width + x) * 4 + 3] > 0;
    },

    // ---- host hooks
    attend() {
      attended = true;
      gaze.instant = reduceMotion && !STILL;
    },
    eyesTo(ex, ey = 0) {
      if (ex === null) { eyes.on = false; gaze.next = S.t; return; }
      eyes.on = true; eyes.x = clamp(ex, -1, 1); eyes.y = clamp(ey, -1, 1);
    },
    setBreathPeriod(seconds) {
      breath.toPeriod = Math.max(1, seconds);
    },
    setBreathDepth(depth) {
      breath.base = Math.max(0, depth);
    },
    setBlinkGap(min, max) {
      blink.gap = [Math.max(0.2, min), Math.max(min, max)];
      // a blink already drawn waits its gap, unless it is longer than any the new gap allows
      if (blink.start < 0 && !blink.double) blink.next = Math.min(blink.next, S.t + blink.gap[1] * BLINK_GAP.most);
    },
    setBlinkHold(seconds) {
      BLINK.hold = clamp(seconds, 0.05, 2);
    },
    tiltToward,
    setTilts(gap) {
      tilts.on = !!gap;
      if (gap) { tilts.min = gap[0]; tilts.max = Math.max(gap[0], gap[1]); tilt.next = Math.min(tilt.next, S.t + tilts.max); cuedUntil = -1; }
    },
    pose(yaw, pitch, roll, speed = 6) {
      pose.yaw.target = yaw * D2R; pose.pitch.target = pitch * D2R; pose.roll.target = roll * D2R; pose.speed = speed;
    },
    doubleBlink() {
      if (!lively()) return;
      blink.start = S.t; blink.timing = BLINK; blink.cued = false; blink.double = false; blink.twice = true;
    },
    get breath() {
      return breath.w;
    },
    get shut() {
      return blinkAmount;
    },
    dispose() {
      listeners.forEach(([type, fn, opts]) => window.removeEventListener(type, fn, opts));
      listeners.length = 0;
      clearTimeout(release);
    },
  };
}
