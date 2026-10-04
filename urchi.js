// Draws Urchi's head into the centre cell as a flat halftone print: one dot screen at 45°,
// a thin solid outline, and paper wherever Urchi is light (the eye whites, the rim).
// assets/urchi-head.js is built from urchi-head/ (see README).
import { createUrchi, URCHI_BOX } from "./assets/urchi-head.js";

const HEAD_W = 1012;     // the head's own width in mesh units, what .head is sized to
const INK = [17, 17, 17];
const SCREEN = 4.8;      // dot spacing in CSS pixels
const TONE = 0.6;        // how much ink the dots lay down, 0..1 (around 0.79 the dots start to join)
const FADE = 0.36;       // how much lighter the top is than the bottom
const OUTLINE = 1.2;     // solid outline width in CSS pixels

// Smooth value noise on a grid `step` pixels apart, for a little print unevenness.
function valueNoise(w, h, step) {
  const gw = Math.ceil(w / step) + 2;
  const grid = Float32Array.from({ length: gw * (Math.ceil(h / step) + 2) }, Math.random);
  const ease = (t) => t * t * (3 - 2 * t);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / step, y0 = fy | 0, ty = ease(fy - y0);
    for (let x = 0; x < w; x++) {
      const fx = x / step, x0 = fx | 0, tx = ease(fx - x0);
      const i = y0 * gw + x0;
      const top = grid[i] + (grid[i + 1] - grid[i]) * tx;
      const bottom = grid[i + gw] + (grid[i + gw + 1] - grid[i + gw]) * tx;
      out[y * w + x] = top + (bottom - top) * ty;
    }
  }
  return out;
}

// The screen, fixed to the paper: for each pixel, the tone needed to ink it (dot) and the
// tone the print lays down there (a flat 2D tone, a touch heavier lower down).
function screen(w, h, px) {
  const dot = new Float32Array(w * h);
  const tone = new Float32Array(w * h);
  const uneven = valueNoise(w, h, 40 * px);
  const cell = SCREEN * px;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + y) * Math.SQRT1_2 / cell, v = (x - y) * Math.SQRT1_2 / cell;
      const du = u - Math.floor(u) - 0.5, dv = v - Math.floor(v) - 0.5;
      const i = y * w + x;
      dot[i] = Math.PI * (du * du + dv * dv);   // a dot covering this much of its cell reaches here
      tone[i] = TONE + (y / h - 0.5) * FADE + (uneven[i] - 0.5) * 0.08;
    }
  }
  return { dot, tone };
}

const head = document.querySelector(".head");

if (head) {
  const urchi = createUrchi({ smooth: true, colourway: "og" });
  const src = urchi.canvas;
  const ratio = Math.min(devicePixelRatio, 2);

  const out = document.createElement("canvas");
  out.className = "urchi";
  out.setAttribute("role", "img");
  out.setAttribute("aria-label", "Urchi, a spiky little mascot");
  head.append(out);
  const ctx = out.getContext("2d", { willReadFrequently: true });
  let field = null, mask = null;
  let dirty = true;

  // Keep the head painted at the size it is shown
  new ResizeObserver(([entry]) => {
    const w = entry.contentRect.width;
    if (!w) return;
    urchi.setResolution(Math.round(w * (URCHI_BOX.w / HEAD_W) * ratio));
    dirty = true;
  }).observe(head);

  function compose() {
    const w = src.width, h = src.height;
    if (out.width !== w || out.height !== h || !field) {
      out.width = w;
      out.height = h;
      field = screen(w, h, ratio);
      mask = new Uint8Array(w * h);
    }
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    // Where Urchi is ink: dark and opaque. Light parts (eye whites, rim) count as paper.
    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
      const lum = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255;
      mask[i] = d[p + 3] / 255 - lum > 0.5 ? 1 : 0;
    }

    // Dots inside, a solid line where the shape meets paper
    const r = Math.max(1, Math.round(OUTLINE * ratio));
    const { dot, tone } = field;
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i++) {
        const p = i * 4;
        let ink = false;
        if (mask[i]) {
          const edge = x < r || y < r || x >= w - r || y >= h - r ||
            !mask[i - r] || !mask[i + r] || !mask[i - r * w] || !mask[i + r * w];
          ink = edge || tone[i] > dot[i];
        }
        if (ink) {
          d[p] = INK[0]; d[p + 1] = INK[1]; d[p + 2] = INK[2]; d[p + 3] = 255;
        } else {
          d[p + 3] = 0;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    dirty = false;
  }

  // Animate only while the cell is on screen
  let raf = 0, last = 0;
  const tick = (now) => {
    if (urchi.update(Math.min((now - last) / 1000, 0.1)) || dirty) compose();
    last = now;
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!entry.isIntersecting && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }).observe(head);
}
