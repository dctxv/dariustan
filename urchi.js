// Draws Urchi's head into the centre cell. The worn ink look is the #ink SVG filter in
// index.html. assets/urchi-head.js is built from urchi-head/ (see README).
import { createUrchi, URCHI_BOX } from "./assets/urchi-head.js";

const HEAD_W = 1012;   // the head's own width in mesh units, what .head is sized to

const head = document.querySelector(".head");

if (head) {
  const urchi = createUrchi({ smooth: true, colourway: "og" });
  const canvas = urchi.canvas;
  canvas.className = "urchi";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Urchi, a spiky little mascot");
  head.append(canvas);

  // Keep the head painted at the size it is shown
  const ratio = Math.min(devicePixelRatio, 2);
  new ResizeObserver(([entry]) => {
    const w = entry.contentRect.width;
    if (w) urchi.setResolution(Math.round(w * (URCHI_BOX.w / HEAD_W) * ratio));
  }).observe(head);

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
  }).observe(head);
}
