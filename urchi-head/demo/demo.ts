// A bare-canvas demo of the head: no three.js, no framework. Build and open it:
//   npx esbuild urchi-head/demo/demo.ts --bundle --outfile=urchi-head/demo/demo.js
import { createUrchi, drawnColourway } from "../character";

const urchi = createUrchi({ smooth: true });
urchi.setResolution(720);   // smooth: the box's width in canvas pixels

const stage = document.getElementById("stage")!;
urchi.canvas.style.cssText = "width:min(90vw,520px);height:auto;display:block";
stage.appendChild(urchi.canvas);

let last = performance.now();
(function tick(now: number) {
  urchi.update((now - last) / 1000);
  last = now;
  requestAnimationFrame(tick);
})(last);

const colour = drawnColourway();
document.getElementById("eyes")!.textContent = colour ? `${colour.name}  iris ${colour.iris}  pupils ${colour.pupilLeft} / ${colour.pupilRight}` : "";

const moves: Record<string, () => void> = {
  blink: () => urchi.blink(),
  "double blink": () => urchi.doubleBlink(),
  "slow blink": () => urchi.slowBlink(),
  "tilt left": () => urchi.tiltToward(-1, 12),
  "tilt right": () => urchi.tiltToward(1, 12),
  "look left": () => { urchi.lookAt(-0.9, 0); setTimeout(() => urchi.lookAt(null), 1500); },
  "look right": () => { urchi.lookAt(0.9, 0); setTimeout(() => urchi.lookAt(null), 1500); },
  glance: () => urchi.glance(),
  nod: () => { urchi.pose(0, 4, 0, 14); setTimeout(() => urchi.pose(0, 0, 0, 9), 200); },
};
const bar = document.getElementById("moves")!;
for (const [name, fn] of Object.entries(moves)) {
  const b = document.createElement("button");
  b.textContent = name;
  b.onclick = fn;
  bar.appendChild(b);
}
(window as unknown as { urchi: typeof urchi }).urchi = urchi;
