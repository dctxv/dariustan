// Draws Urchi's head into the centre cell. assets/urchi-head.js is built from urchi-head/ (see README).
import { createUrchi, URCHI_BOX } from "./assets/urchi-head.js";

const HEAD_W = 1012;   // the head's own width in mesh units, what .head is sized to

// Paper grain that wears through the ink: fine specks plus a few soft, worn patches.
// Tileable, drawn once at CSS pixel scale.
function grainTile(n = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d");
  const img = g.createImageData(n, n);
  const d = img.data;
  const octave = (m) => {
    const grid = Array.from({ length: m * m }, Math.random);
    const at = (x, y) => grid[(y % m) * m + (x % m)];
    const ease = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const fx = (x / n) * m, fy = (y / n) * m;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = ease(fx - x0), ty = ease(fy - y0);
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      return top + (bottom - top) * ty;
    };
  };
  const broad = octave(6), mid = octave(18);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.random();
      const speck = r > 0.94 ? ((r - 0.94) / 0.06) * 0.85 : 0;
      const v = broad(x, y) * 0.6 + mid(x, y) * 0.4;
      const worn = Math.max(0, (v - 0.64) / 0.36) * 0.28;
      d[(y * n + x) * 4 + 3] = 255 * (1 - (1 - speck) * (1 - worn));
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

const head = document.querySelector(".head");

if (head) {
  const urchi = createUrchi({ smooth: true });
  const src = urchi.canvas;

  const out = document.createElement("canvas");
  out.className = "urchi";
  out.setAttribute("role", "img");
  out.setAttribute("aria-label", "Urchi, a spiky little mascot");
  head.append(out);
  const ctx = out.getContext("2d");
  const tile = grainTile();
  let grain = null;
  let dirty = true;

  // Keep the head painted at the size it is shown, in device pixels
  new ResizeObserver(([entry]) => {
    const w = entry.contentRect.width;
    if (!w) return;
    urchi.setResolution(Math.round(w * (URCHI_BOX.w / HEAD_W) * devicePixelRatio));
    grain = ctx.createPattern(tile, "repeat");
    grain.setTransform(new DOMMatrix().scale(devicePixelRatio));
    dirty = true;
  }).observe(head);

  // Copy the painted head, then let the paper show through the ink
  function compose() {
    if (out.width !== src.width || out.height !== src.height) {
      out.width = src.width;
      out.height = src.height;
    }
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(src, 0, 0);
    if (grain) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = grain;
      ctx.fillRect(0, 0, out.width, out.height);
    }
    ctx.globalCompositeOperation = "source-over";
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
