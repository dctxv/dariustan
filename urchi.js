// Draws Urchi's head into the centre cell as a flat two-ink halftone print: black for the head
// and pupils, a spot colour for the iris, both on one dot screen at 45°, with no outline, and
// paper wherever Urchi is light (the rim). assets/urchi-head.js is built from urchi-head/ (see README).
import { createUrchi, drawnColourway, COLOURWAY_COUNT, URCHI_BOX } from "./assets/urchi-head.js";

const HEAD_W = 1012;     // the head's own width in mesh units, what .head is sized to
const SCREEN = 4.8;      // dot spacing in CSS pixels
const TONE = 0.6;        // how much ink the dots lay down, 0..1 (around 0.79 the dots start to join)
const FADE = 0.36;       // how much lighter the top is than the bottom
const SPOT_TONE = 0.06;  // how much lighter the spot ink prints than the black
const SHUT = 0.15;       // under this share of the most iris seen, the eyes count as shut
const DRIFT = 1.5;       // how far the spot plate slips off register toward the pointer, in px

// The iris is the page's one spot colour. It only prints if it reads as colour on the paper:
// at least this much chroma, and at least this far in lightness from the paper (OKLab), picked
// by eye from all 100 irises on the day paper. Anything greyer, or too close to the paper (umbrella
// and lilypad by day), falls back to one of these.
const MIN_CHROMA = 0.09;
const MIN_CONTRAST = 0.15;
const STRONG = ["siren", "lobster", "jukebox", "pool", "valentine"];

const rgb = (hex) => {
  hex = hex.trim().replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, "#$1$1$2$2$3$3");
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
};
// The current print's inks, read from the stylesheet when the sky changes, not per frame
const inkOf = (name) => rgb(getComputedStyle(document.documentElement).getPropertyValue(name));

function oklab([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, C: Math.hypot(a, bb) };
}

function printable(hex, paper) {
  const { L, C } = oklab(rgb(hex));
  return C >= MIN_CHROMA && Math.abs(L - oklab(paper).L) >= MIN_CONTRAST;
}

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

const root = document.documentElement;
const head = document.querySelector(".head");

// Squared distance between two colours, 0..1
const dist = (d, p, c) => ((d[p] - c[0]) ** 2 + (d[p + 1] - c[1]) ** 2 + (d[p + 2] - c[2]) ** 2) / 195075;
const NEAR = 0.06;       // within this (squared) of a known eye colour counts as that colour

if (head) {
  // Let the eyes draw at random (?col= still forces one); redraw with a strong one if the
  // iris would print too pale or too grey to see
  let INK = inkOf("--ink");
  let urchi = createUrchi({ smooth: true });
  let eyes = drawnColourway();
  if (!printable(eyes.iris, inkOf("--paper"))) {
    urchi.dispose();
    urchi = createUrchi({ smooth: true, colourway: STRONG[(Math.random() * STRONG.length) | 0] });
    eyes = drawnColourway();
  }
  root.style.setProperty("--spot", eyes.iris);
  // Stamp the edition with the colourway that actually printed, fallback or not
  root.dataset.print = String(eyes.index).padStart(3, "0");
  root.dataset.prints = COLOURWAY_COUNT;
  document.dispatchEvent(new Event("edition"));
  const iris = rgb(eyes.iris), pupils = [rgb(eyes.pupilLeft), rgb(eyes.pupilRight)];
  const src = urchi.canvas;
  const ratio = Math.min(devicePixelRatio, 2);

  // Two plates, like a two-ink print: black, and the spot over it, from the same mask and screen
  const out = document.createElement("canvas");
  out.className = "urchi plate-ink";
  out.setAttribute("role", "img");
  out.setAttribute("aria-label", "Urchi, a spiky little mascot");
  out.tabIndex = 0;
  const spot = document.createElement("canvas");
  spot.className = "urchi plate-spot";
  spot.setAttribute("aria-hidden", "true");
  head.append(out, spot);
  const ctx = out.getContext("2d", { willReadFrequently: true });
  const spotCtx = spot.getContext("2d");
  let spotImg = null;
  let field = null, mask = null;
  let dirty = true;
  let irisMost = 0, shut = false;

  // Night falls (or the sun comes up) while the page is open: reprint in the new ink
  document.addEventListener("printchange", () => {
    INK = inkOf("--ink");
    dirty = true;
  });

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
      out.width = spot.width = w;
      out.height = spot.height = h;
      spotImg = spotCtx.createImageData(w, h);
      field = screen(w, h, ratio);
      mask = new Uint8Array(w * h);
      irisMost = 0;
    }
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    // Three inks: 0 paper, 1 black, 2 spot. The iris (coloured, not near black or white)
    // is spot; the pupils stay black whatever colour they are drawn; otherwise dark and
    // opaque is black and light parts (the rim) are paper.
    let irisNow = 0;
    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
      const lum = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255;
      let ink = d[p + 3] / 255 - lum > 0.5 ? 1 : 0;
      if (d[p + 3] > 127) {
        const toIris = dist(d, p, iris);
        const toPupil = Math.min(dist(d, p, pupils[0]), dist(d, p, pupils[1]));
        const chroma = (Math.max(d[p], d[p + 1], d[p + 2]) - Math.min(d[p], d[p + 1], d[p + 2])) / 255;
        if (toIris < NEAR && toIris < toPupil && chroma > 0.15 && lum > 0.08 && lum < 0.94) { ink = 2; irisNow++; }
        else if (toPupil < NEAR && toPupil <= toIris) ink = 1;
      }
      mask[i] = ink;
    }

    // The colour lives in the eyes: when the iris all but vanishes they are shut, and the page's
    // accent dims with them. Only touch the page when that changes.
    irisMost = Math.max(irisMost, irisNow);
    if ((irisNow < irisMost * SHUT) !== shut) {
      shut = !shut;
      if (shut) root.dataset.blink = "";
      else delete root.dataset.blink;
    }

    // Dots on one screen for both plates, so they register; the shape is only the edge of the dots
    const { dot, tone } = field;
    const s = spotImg.data;
    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
      d[p + 3] = s[p + 3] = 0;
      if (mask[i] === 1 && tone[i] > dot[i]) {
        d[p] = INK[0]; d[p + 1] = INK[1]; d[p + 2] = INK[2]; d[p + 3] = 255;
      } else if (mask[i] === 2 && tone[i] - SPOT_TONE > dot[i]) {
        s[p] = iris[0]; s[p + 1] = iris[1]; s[p + 2] = iris[2]; s[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    spotCtx.putImageData(spotImg, 0, 0);
    if (specimen.on) specimen.place(anchors(w, h, !shut));
    dirty = false;
  }

  // Points on the print to annotate, in canvas pixels, read off the mask: the two irises (either
  // side of the iris's median x), the ear tips (topmost ink in each half of the head) and a point
  // on the lower cheek (leftmost ink at 70% of the head's height). Irises keep their last place
  // while the eyes are shut.
  let lastIris = { left: null, right: null };
  function anchors(w, h, eyesOpen) {
    const colN = new Uint32Array(w), colY = new Float64Array(w);
    let x0 = w, x1 = -1, y0 = h, y1 = -1, spots = 0;
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i++) {
        const m = mask[i];
        if (m === 2) { colN[x]++; colY[x] += y; spots++; }
        else if (m === 1) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    if (x1 < 0) return {};
    if (eyesOpen && spots) {
      let seen = 0, median = 0;
      while (seen < spots / 2) seen += colN[median++];
      const centroid = (a, b) => {
        let n = 0, sx = 0, sy = 0;
        for (let x = a; x < b; x++) { n += colN[x]; sx += colN[x] * x; sy += colY[x]; }
        return n ? [sx / n, sy / n] : null;
      };
      lastIris = { left: centroid(0, median), right: centroid(median, w) };
    }
    const mid = (x0 + x1) / 2, tips = [null, null];
    for (let y = y0, i = y0 * w; y <= y1 && !(tips[0] && tips[1]); y++) {
      for (let x = 0; x < w; x++, i++) {
        if (mask[i] !== 1) continue;
        const side = x < mid ? 0 : 1;
        if (!tips[side]) tips[side] = [x, y];
      }
    }
    const cy = Math.round(y0 + (y1 - y0) * 0.7);
    let cheek = null;
    for (let x = 0, i = cy * w; x < w; x++, i++) if (mask[i] === 1) { cheek = [x, cy]; break; }
    return { irisL: lastIris.left, irisR: lastIris.right, earL: tips[0], earR: tips[1], cheek };
  }

  // The specimen plate: hover the print (or focus it) and the page annotates its own print, in the
  // empty paper either side of the centre cell. Desktop with a fine pointer only.
  const sheet = document.querySelector(".sheet");
  const specimen = (() => {
    const svgNS = "http://www.w3.org/2000/svg";
    const layer = document.createElement("div");
    layer.className = "specimen";
    layer.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS(svgNS, "svg");
    layer.append(svg);
    sheet.append(layer);
    // Which anchor each label hangs from, and which side of the head it sits on
    const LABELS = [
      { key: "irisL", side: -1, text: () => `Iris / ${(root.dataset.eyes || "").toUpperCase()} / ${eyes.iris.toUpperCase()}` },
      { key: "cheek", side: -1, text: () => "Plate 01 / Ink" },
      { key: "irisR", side: 1, text: () => "Plate 02 / Spot" },
      { key: "earR", side: 1, text: () => `Screen 45° / ${SCREEN}px` },
    ];
    const DOTS = ["irisL", "irisR", "earL", "earR", "cheek"];
    for (const l of LABELS) {
      l.el = document.createElement("span");
      l.el.className = "lbl spec-lbl";
      layer.append(l.el);
    }
    const GAP = 16, STEP = 18;

    function place(at) {
      const s = sheet.getBoundingClientRect(), c = out.getBoundingClientRect(), box = head.getBoundingClientRect();
      const toSheet = ([x, y]) => [c.left - s.left + (x / out.width) * c.width, c.top - s.top + (y / out.height) * c.height];
      const inBox = ([x, y]) => x >= box.left - s.left && x <= box.right - s.left && y >= box.top - s.top && y <= box.bottom - s.top;
      const pts = {};
      for (const k of DOTS) if (at[k]) { const p = toSheet(at[k]); if (inBox(p)) pts[k] = p; }
      const top = box.top - s.top + 6, bottom = box.bottom - s.top - 6;
      const avoid = [...document.querySelectorAll(".top-l, .top-r, .projects, .skills, .foot")].map((el) => el.getBoundingClientRect());
      let marks = "";
      for (const side of [-1, 1]) {
        let floor = top;
        for (const l of LABELS.filter((l) => l.side === side).sort((a, b) => (pts[a.key]?.[1] ?? 0) - (pts[b.key]?.[1] ?? 0))) {
          const p = pts[l.key];
          l.el.textContent = l.text();
          const lw = l.el.offsetWidth, lh = l.el.offsetHeight;
          const y = p ? Math.max(floor, p[1] - lh / 2) : 0;
          const x = side < 0 ? box.left - s.left - GAP - lw : box.right - s.left + GAP;
          const r = { left: s.left + x, right: s.left + x + lw, top: s.top + y, bottom: s.top + y + lh };
          const hits = avoid.some((a) => r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top);
          if (!p || y + lh > bottom || x < 0 || hits) { l.el.hidden = true; continue; }
          l.el.hidden = false;
          l.el.style.transform = `translate(${x}px, ${y}px)`;
          floor = y + STEP;
          const end = side < 0 ? x + lw + 6 : x - 6;
          marks += `<line x1="${p[0]}" y1="${p[1]}" x2="${end}" y2="${y + lh / 2}"/>`;
        }
      }
      for (const k in pts) marks += `<circle cx="${pts[k][0]}" cy="${pts[k][1]}" r="1.5"/>`;
      svg.innerHTML = marks;
    }

    const able = () => matchMedia("(hover: hover) and (pointer: fine)").matches && innerWidth >= 900;
    const api = {
      on: false,
      place,
      show() {
        if (!able()) return;
        api.on = true;
        dirty = true;
        layer.classList.add("on");
      },
      hide() {
        api.on = false;
        layer.classList.remove("on");
      },
    };
    return api;
  })();
  const fig = head.closest(".fig");
  fig.addEventListener("pointerover", (e) => { if (e.pointerType !== "touch") specimen.show(); });
  fig.addEventListener("pointerleave", () => { if (document.activeElement !== out) specimen.hide(); });
  out.addEventListener("focus", () => specimen.show());
  out.addEventListener("blur", () => specimen.hide());

  // Hover the print and the spot plate slips off register toward the pointer, a little and a
  // little late, then settles back. Only ever a translate on that one canvas.
  if (matchMedia("(hover: hover) and (pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let aim = [0, 0], at = [0, 0], drifting = 0;
    const drift = () => {
      at = at.map((v, k) => v + (aim[k] - v) * 0.12);
      const settled = Math.abs(aim[0] - at[0]) + Math.abs(aim[1] - at[1]) < 0.01;
      if (settled) at = aim.slice();
      spot.style.translate = `${at[0].toFixed(2)}px ${at[1].toFixed(2)}px`;
      drifting = settled ? 0 : requestAnimationFrame(drift);
    };
    const aimAt = (x, y) => {
      aim = [x, y];
      if (!drifting) drifting = requestAnimationFrame(drift);
    };
    fig.addEventListener("pointermove", (e) => {
      const r = fig.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const k = Math.min(1, Math.hypot(dx, dy) / (r.width / 2)) * DRIFT / (Math.hypot(dx, dy) || 1);
      aimAt(dx * k, dy * k);
    });
    fig.addEventListener("pointerleave", () => aimAt(0, 0));
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
