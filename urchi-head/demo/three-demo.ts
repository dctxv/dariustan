// The head as a plane in a three.js scene (Urchi.ts). Build:
//   npx esbuild urchi-head/demo/three-demo.ts --bundle --outfile=urchi-head/demo/three-demo.js
import * as THREE from "three";
import { Urchi } from "../Urchi";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-innerWidth / 2, innerWidth / 2, innerHeight / 2, -innerHeight / 2, -10, 10);

const urchi = new Urchi();
urchi.width = Math.min(innerWidth, innerHeight) * 0.7;   // the mascot's box width in scene units
urchi.pixelRatio = devicePixelRatio;                      // smooth: canvas follows the size it is shown at
urchi.scaleIn(1.2);                                       // or fadeIn(), or leave appear = 1
scene.add(urchi.mesh);                                    // origin = the head's centre

let last = performance.now();
renderer.setAnimationLoop((now) => {
  urchi.update((now - last) / 1000);
  last = now;
  renderer.render(scene, cam);
});
(window as unknown as { urchi: Urchi }).urchi = urchi;
