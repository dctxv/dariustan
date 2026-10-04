// Draws Urchi's head into the centre cell as a stamped print: pure ink or paper, no in-between
// tones, with grain breaking through the black. assets/urchi-head.js is built from urchi-head/.
import { createUrchi, URCHI_BOX } from "./assets/urchi-head.js";

const HEAD_W = 1012;   // the head's own width in mesh units, what .head is sized to
const INK = [17, 17, 17];
const SPECK = 0.8;     // grain above this breaks through solid black (lower = more worn)
const EDGE = 0.6;      // how far the grain eats into the edges

// Smooth value noise on a grid `step` pixels apart, sampled per pixel.
function valueNoise(w, h, step) {
  const gw = Math.ceil(w / step) + 2, gh = Math.ceil(h / step) + 2;
  const grid = Float32Array.from({ length: gw * gh }, Math.random);
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

// The paper's grain at this canvas size: fine specks, small clumps and broad worn areas.
// It stays put while the head moves under it, the way paper would.
function grainField(w, h, px) {
  const clump = valueNoise(w, h, 2.5 * px);
  const wear = valueNoise(w, h, 70 * px);
  const s = new Float32Array(w * h);
  const cell = Math.max(1, Math.round(px));
  const cw = Math.ceil(w / cell);
  const fine = Float32Array.from({ length: cw * Math.ceil(h / cell) }, Math.random);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const f = fine[((y / cell) | 0) * cw + ((x / cell) | 0)];
      s[i] = f * 0.4 + clump[i] * 0.6 + (wear[i] - 0.5) * 0.35;
    }
  }
  return s;
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
  let grain = null;
  let dirty = true;

  // Keep the head painted at the size it is shown
  new ResizeObserver(([entry]) => {
    const w = entry.contentRect.width;
    if (!w) return;
    urchi.setResolution(Math.round(w * (URCHI_BOX.w / HEAD_W) * ratio));
    dirty = true;
  }).observe(head);

  // Threshold the painted head into ink and paper, with the grain mixed in first
  function compose() {
    const w = src.width, h = src.height;
    if (out.width !== w || out.height !== h || !grain) {
      out.width = w;
      out.height = h;
      grain = grainField(w, h, ratio);
    }
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0, p = 0; i < grain.length; i++, p += 4) {
      const a = d[p + 3];
      if (!a) continue;
      const lum = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255;
      const ink = (a / 255) * (1 - lum);
      const n = grain[i];
      if (ink > 0.5 + (n - 0.5) * EDGE && n < SPECK) {
        d[p] = INK[0]; d[p + 1] = INK[1]; d[p + 2] = INK[2]; d[p + 3] = 255;
      } else {
        d[p + 3] = 0;
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
