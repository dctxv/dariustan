import * as THREE from "three";
import gsap from "gsap";
import { URCHI_BOX, URCHI_FRAME, URCHI_HEAD, createUrchi, type UrchiCharacter } from "./character";

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/**
 * The ordered dither Urchi comes and goes through (Space, taken with you and home again): an 8x8
 * Bayer matrix laid over the screen's own pixels in cells `uCell` device pixels square, the site's
 * pixel heritage. A cell whose place in the matrix is under `uDither` is dropped, so at 0 all of
 * Urchi shows and at 1 none of it, and in between it breaks up in the matrix's even order. The
 * matrix is built from its 2x2 (each finer bit of the cell's place adds its quarter), so it needs
 * no table.
 */
const dither = /* glsl */ `
uniform float uDither;
uniform float uCell;
float bayer2(vec2 a) { a = floor(mod(a, 2.0)); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer8(vec2 a) { return bayer2(0.25 * a) * 0.0625 + bayer2(0.5 * a) * 0.25 + bayer2(a); }
bool dithered() { return uDither > 0.0 && bayer8(gl_FragCoord.xy / uCell) < uDither; }`;

/** Pixel paint: every pixel of the canvas is either head or background, so a hard cut keeps its edge. */
const fragPixel = /* glsl */ `
uniform sampler2D uMap;
uniform float uFade;
varying vec2 vUv;
${dither}
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.5 || dithered()) discard;
  gl_FragColor = vec4(c.rgb, uFade);
}`;

/**
 * Smooth paint: the canvas's own anti-aliased edges, premultiplied so they blend without a dark
 * fringe. Pixelated (`uPix`, a cell in device pixels, 0 for none), the screen is cut into cells that
 * square on the same grid as the dither's, and each cell shows the one texel under its centre with a
 * hard edge: the uv at the centre is found from how the uv changes across the screen, so the plane
 * may be turned any way.
 */
const fragSmooth = /* glsl */ `
uniform sampler2D uMap;
uniform float uFade;
uniform float uPix;
varying vec2 vUv;
${dither}
void main() {
  if (uPix > 0.0) {
    vec2 at = (floor(gl_FragCoord.xy / uPix) + 0.5) * uPix - gl_FragCoord.xy;
    vec2 uv = vUv + dFdx(vUv) * at.x + dFdy(vUv) * at.y;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
    vec4 p = texture2D(uMap, uv);
    if (p.a < 0.5 || dithered()) discard;
    gl_FragColor = vec4(p.rgb / p.a, 1.0) * uFade;
    return;
  }
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.004 || dithered()) discard;
  gl_FragColor = c * uFade;
}`;

/**
 * A smooth canvas is resized in steps of this many pixels, so a zoom does not rebuild it every
 * frame, and never paints the box more than RES_MAX across: past that a large retina screen would
 * upload several times the texture for a sharpness nobody sees at that size.
 */
const RES_STEP = 16;
const RES_MAX = 1400;
const SIDE_MAX = Math.max(URCHI_FRAME.w, URCHI_FRAME.h);
/** One art pixel in mesh units: the width a rim is when nobody holds it (see UrchiHostOptions.rim). */
const ART_PIXEL = 7.5;
/** A pixelated Urchi's rim, in its canvas's pixels (see pixelCell). */
const PIXEL_RIM = 2;

type Frame = UrchiCharacter["frame"];
/**
 * A plane over a frame, in its own units (1 its width and height), placed from the head's centre
 * (mesh y 0, y up); `mx`, `my` of its size more on each side (a pixelated plane's: see fitFrame),
 * where its uv runs past 0 .. 1.
 */
function planeFor(f: Frame, mx = 0, my = 0) {
  const g = new THREE.PlaneGeometry(1, 1);
  if (mx || my) {
    g.scale(1 + 2 * mx, 1 + 2 * my, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - 0.5) * (1 + 2 * mx) + 0.5, (uv.getY(i) - 0.5) * (1 + 2 * my) + 0.5);
  }
  return g.translate(f.x / f.w + 0.5, -f.y / f.h - 0.5, 0);
}
/** A pixelated plane reaches this many of the canvas's pixels past it, so a cell at its edge is never cut on the slant as it turns. */
const PIXEL_MARGIN = 2;

export type UrchiHostOptions = {
  /** Write depth, for a perspective scene whose other objects pass in front of and behind it. */
  depth?: boolean;
  reducedMotion?: boolean;
  /** Mesh units per canvas pixel (see UrchiOptions.cell): coarser for a small Urchi, so its rim stays one pixel. */
  cell?: number;
  /**
   * Paint without pixels (the default): the canvas follows the size the host shows it at, from
   * `width`, `zoom` and `pixelRatio`, so Urchi is drawn at the screen's own resolution with
   * smooth edges. false keeps the standalone page's hard pixels at `cell`.
   */
  smooth?: boolean;
  /**
   * Smooth only: the rim is one art pixel of the head as shown (the head is about 116 of them tall),
   * held between these many host units, [min, max]. A big head's full art pixel would read as a
   * sticker's outline. Unset, it is one art pixel at any size (About's mark).
   */
  rim?: readonly [number, number];
};

/**
 * Urchi in a three.js scene: the character paints its canvas each frame
 * something in it moves, and a plane shows it (uploaded only then). Smooth
 * (the default), the canvas is kept at the size it is shown at, in device
 * pixels up to RES_MAX, and sampled linearly; otherwise it is the
 * standalone page's small canvas with nearest-neighbour sampling and hard
 * pixel edges. The host places `mesh` at the head's centre and sets `width`,
 * the mascot's box width in its own units (and, smooth, `pixelRatio`, device
 * pixels per unit); `appear` scales it in from nothing.
 */
export class Urchi {
  readonly character: UrchiCharacter;
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  /**
   * The canvas; the fade (the dim); how far through the dither it has gone (0 all there, 1 gone), and
   * the dither's cell in device px; and the pixelation's cell (see pixelCell).
   */
  readonly uniforms: { uMap: { value: THREE.Texture }; uFade: { value: number }; uDither: { value: number }; uCell: { value: number }; uPix: { value: number } };
  /** The mascot's box width in host units. */
  width = 1;
  /** 0 hidden .. 1 full size. */
  appear = 0;
  /** A size for a moment, on top of `appear`: a host can ease it in or out, or lean it closer. */
  zoom = 1;
  /** Device pixels per host unit, which a smooth Urchi paints its canvas to match. */
  pixelRatio = 1;
  /**
   * Smooth only: pixelated in square cells this many device pixels across (0, the default, not at
   * all). The canvas is then painted at one of its pixels per cell and sampled nearest, the plane
   * covers the canvas itself (a whole number of its pixels, a little past the frame) so a pixel is
   * exactly a cell, and the shader shows each cell's texel with a hard edge (see fragSmooth).
   */
  pixelCell = 0;
  private texture: THREE.CanvasTexture;
  private readonly smooth: boolean;
  private readonly rim: readonly [number, number] | null;
  /** The box's width in canvas pixels, as last set (smooth only). */
  private resolution = 0;
  /** The canvas's frame the plane is laid out for. */
  private frame: Frame = URCHI_FRAME;
  /** What the plane covers, mesh units from the head's centre (y down): the frame, or pixelated, the canvas itself. */
  private covered: Frame = URCHI_FRAME;
  /** The texture is sampled nearest (a pixel paint, or pixelated). */
  private nearest = false;
  /** The canvas's size the texture was made for. */
  private texSize = [0, 0];

  constructor(o: UrchiHostOptions = {}) {
    this.smooth = o.smooth !== false;
    this.rim = this.smooth && o.rim ? o.rim : null;
    this.character = createUrchi({ reducedMotion: o.reducedMotion, cell: o.cell, smooth: this.smooth });
    this.texture = this.makeTexture();
    this.uniforms = { uMap: { value: this.texture }, uFade: { value: 1 }, uDither: { value: 0 }, uCell: { value: 3 }, uPix: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vert,
      fragmentShader: this.smooth ? fragSmooth : fragPixel,
      transparent: true,
      premultipliedAlpha: this.smooth,
      depthWrite: !!o.depth,
      depthTest: !!o.depth,
    });
    // The plane covers the canvas's frame; its origin is the head's centre, where hosts put it.
    this.mesh = new THREE.Mesh(planeFor(this.covered), material);
    this.mesh.scale.set(1e-4, 1e-4, 1);
  }

  /** A texture over the character's canvas: raw colour, as every texture on the site; smooth or hard pixels when scaled. */
  private makeTexture() {
    this.texSize = [this.character.canvas.width, this.character.canvas.height];
    this.nearest = !this.smooth || this.pixelated;
    const tex = new THREE.CanvasTexture(this.character.canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.magFilter = this.nearest ? THREE.NearestFilter : THREE.LinearFilter;
    tex.minFilter = this.pixelated ? THREE.NearestFilter : THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.premultiplyAlpha = this.smooth;
    return tex;
  }

  /**
   * A smooth canvas follows the size it is shown at: a new size resizes it, and the texture is rebuilt
   * to match. Pixelated, it is exactly one of its pixels per cell.
   */
  private fitResolution() {
    const f = this.character.frame, cap = (RES_MAX * SIDE_MAX) / Math.max(f.w, f.h), shown = this.width * this.zoom * this.pixelRatio;
    const px = this.pixelated ? shown / this.pixelCell : Math.min(cap, Math.max(RES_STEP, Math.ceil(shown / RES_STEP) * RES_STEP));
    if (px === this.resolution) return;
    this.resolution = px;
    this.character.setResolution(px);
    this.remakeTexture();
  }

  private remakeTexture() {
    const old = this.texture;
    this.texture = this.makeTexture();
    if (this.uniforms) this.uniforms.uMap.value = this.texture;
    old.dispose();
  }

  private fitFrame() {
    this.frame = this.character.frame;
    const c = this.character.canvas;
    if (c.width !== this.texSize[0] || c.height !== this.texSize[1] || this.nearest !== (!this.smooth || this.pixelated)) this.remakeTexture();
    // pixelated, the plane covers the canvas's whole pixels (the frame, rounded up to them)
    const cell = URCHI_BOX.w / Math.max(8, this.resolution);
    const f = this.pixelated ? { x: this.frame.x, y: this.frame.y, w: c.width * cell, h: c.height * cell } : this.frame;
    const was = this.covered;
    if (f.x === was.x && f.y === was.y && f.w === was.w && f.h === was.h) return;
    this.covered = f;
    const old = this.mesh.geometry;
    this.mesh.geometry = this.pixelated ? planeFor(f, PIXEL_MARGIN / c.width, PIXEL_MARGIN / c.height) : planeFor(f);
    old.dispose();
  }

  /**
   * A held rim follows the head's size as shown: one art pixel, within its bounds. Pixelated, it is
   * at least PIXEL_RIM of the canvas's pixels (any narrower, cut to cells, it breaks up into dots)
   * and never narrower than it is smooth, so the finest cells do not thin it.
   */
  private fitRim() {
    const smooth = this.rimFor(this.unit * this.zoom);
    const r = this.pixelated ? Math.max(smooth ?? 0, (PIXEL_RIM * URCHI_BOX.w) / Math.max(8, this.resolution)) : smooth;
    if (r !== null) this.character.setRim(r);
  }

  /** The rim it holds (mesh units) for the head shown at `shown` host units per mesh unit; null if it holds none. */
  private rimFor(shown: number): number | null {
    if (!this.rim || shown <= 0) return null;
    const [min, max] = this.rim;
    return Math.min(max / shown, Math.max(min / shown, ART_PIXEL));
  }

  /** Pixelated now (see pixelCell). */
  private get pixelated() {
    return this.smooth && this.pixelCell > 0;
  }

  /** Host units per mesh unit. */
  private get unit() {
    return this.width / URCHI_BOX.w;
  }

  /** Host units per mesh unit as the plane is drawn now (its size for a moment included). */
  get shownUnit() {
    return this.mesh.scale.x / this.covered.w;
  }

  /** What the plane covers, mesh units from the head's centre (y down): the canvas's frame, or pixelated, its whole pixels. */
  get cover(): Frame {
    return this.covered;
  }

  /** The head's visible height, ear tips to chin, in host units. */
  get headHeight() {
    return (URCHI_HEAD.bottom - URCHI_HEAD.top) * this.unit;
  }

  /** Called from the host's frame, dt in seconds. Uploads the canvas only on a frame that painted it. */
  update(dt: number) {
    if (this.smooth) {
      this.fitResolution();
      this.fitRim();
    }
    this.fitFrame();
    if (this.character.update(dt)) this.texture.needsUpdate = true;
    this.uniforms.uPix.value = this.pixelated ? this.pixelCell : 0;
    const s = Math.max(this.appear * this.zoom, 1e-4);
    this.mesh.scale.set(this.covered.w * this.unit * s, this.covered.h * this.unit * s, 1);
  }

  /** Whether a point in the mesh's parent space falls on the head or its rim, turned with the plane. */
  hit(x: number, y: number) {
    const w = this.mesh.scale.x, h = this.mesh.scale.y;
    if (w < 1e-3 || h < 1e-3) return false;
    let dx = x - this.mesh.position.x, dy = y - this.mesh.position.y;
    const r = this.mesh.rotation.z;
    if (r) [dx, dy] = [dx * Math.cos(r) + dy * Math.sin(r), dy * Math.cos(r) - dx * Math.sin(r)];
    const f = this.covered;
    const u = dx / w - f.x / f.w;
    const v = dy / h + f.y / f.h + 1;
    return this.character.alphaAt(u, v);
  }

  /** Scale in from nothing. */
  scaleIn(duration: number, delay = 0) {
    gsap.killTweensOf(this);
    this.appear = 0.001;
    gsap.to(this, { appear: 1, duration, ease: "power3.out", delay });
  }

  /** Already full size; fade in with the room. */
  fadeIn(duration: number) {
    gsap.killTweensOf(this);
    this.appear = 1;
    this.fade(1, duration, 0, 0);
  }

  /** Tween the fade (the dim), from `from` when given. */
  fade(value: number, duration: number, delay = 0, from?: number) {
    const u = this.uniforms.uFade;
    if (from !== undefined) u.value = from;
    gsap.to(u, { value, duration, ease: "power2.out", delay, overwrite: true });
  }

  /**
   * Through the dither to `to` (0 all of it, 1 none) over `seconds` (0 at once), at an even pace,
   * so the matrix's cells go (or come) as many at a time all the way; then `done`.
   */
  dither(to: number, seconds: number, done?: () => void) {
    const u = this.uniforms.uDither;
    gsap.killTweensOf(u);
    if (seconds <= 0) {
      u.value = to;
      done?.();
    } else gsap.to(u, { value: to, duration: seconds, ease: "none", onComplete: done });
  }

  dispose() {
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.uniforms.uFade);
    gsap.killTweensOf(this.uniforms.uDither);
    this.character.dispose();
    this.texture.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
