// Draws Urchi's head into the centre cell. assets/urchi-head.js is built from urchi-head/ (see README).
import { createUrchi, URCHI_BOX, URCHI_FRAME } from "./assets/urchi-head.js";

const frame = document.querySelector(".frame");

if (frame) {
  const urchi = createUrchi({ smooth: true });
  const canvas = urchi.canvas;
  canvas.className = "urchi";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Urchi, a spiky little mascot");
  frame.append(canvas);

  // Keep the canvas at the size it is shown, in device pixels
  const aspect = URCHI_FRAME.w / URCHI_FRAME.h;
  new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const shown = Math.min(width, height * aspect);
    if (shown > 0) urchi.setResolution(Math.round(shown * (URCHI_BOX.w / URCHI_FRAME.w) * devicePixelRatio));
  }).observe(frame);

  // Animate only while the cell is on screen
  let raf = 0, last = 0;
  const tick = (now) => {
    urchi.update(Math.min((now - last) / 1000, 0.1));
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
  }).observe(frame);
}
