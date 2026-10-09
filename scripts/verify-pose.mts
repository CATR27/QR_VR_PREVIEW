// Verifica poseFromCorners con proyecciones sintéticas: node --experimental-strip-types scripts/verify-pose.mts
import { approximateIntrinsics, isPlausibleQuad, poseFromCorners } from "../src/lib/ar/pose.ts";

const k = approximateIntrinsics(720, 1280);
const size = 0.4;

function rotation(yaw: number, pitch: number, roll: number): number[][] {
  const [cy, sy, cp, sp, cr, sr] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch), Math.cos(roll), Math.sin(roll)];
  const rz = [[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]];
  const rx = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]];
  const ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const mul = (a: number[][], b: number[][]) => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
  return mul(ry, mul(rx, rz));
}

let failures = 0;
const cases = [
  { yaw: 0, pitch: 0, roll: 0, t: [0, 0, 2] },
  { yaw: 0.5, pitch: 0.2, roll: 0.3, t: [0.3, -0.2, 3] },
  { yaw: -0.8, pitch: -0.4, roll: 2.5, t: [-0.5, 0.4, 1.5] },
];
for (const c of cases) {
  // Pose verdadera en el marco three.js (cámara mira -z): el marcador está en z negativo.
  const r = rotation(c.yaw, c.pitch, c.roll);
  const t = [c.t[0], c.t[1], -c.t[2]];
  const h = size / 2;
  const model = [[-h, h], [h, h], [h, -h], [-h, -h]];
  const pixels = model.map(([x, y]) => {
    const px = r[0][0] * x + r[0][1] * y + t[0];
    const py = r[1][0] * x + r[1][1] * y + t[1];
    const pz = r[2][0] * x + r[2][1] * y + t[2];
    // three.js → OpenCV: (x, -y, -z), luego proyección.
    const xc = px, yc = -py, zc = -pz;
    return { x: (xc / zc) * k.fx + k.cx, y: (yc / zc) * k.fy + k.cy };
  });
  const pose = poseFromCorners(pixels, k, size);
  if (!pose) { console.error("FALLÓ: sin pose", c); failures++; continue; }
  const dt = Math.hypot(pose.t[0] - t[0], pose.t[1] - t[1], pose.t[2] - t[2]);
  const flat = [r[0][0], r[0][1], r[0][2], r[1][0], r[1][1], r[1][2], r[2][0], r[2][1], r[2][2]];
  // Compara columnas X e Y; la tercera sale del producto vectorial.
  const dr = Math.max(...[0, 1, 3, 4, 6, 7].map((i) => Math.abs(pose.r[i] - flat[i === 0 ? 0 : i])));
  const ok = dt < 1e-3 && dr < 1e-3 && isPlausibleQuad(pixels);
  console.log(ok ? "OK " : "MAL", JSON.stringify(c), "error t:", dt.toExponential(1), "error R:", dr.toExponential(1));
  if (!ok) failures++;
}

// Degenerados
console.log(poseFromCorners([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], k, size) === null ? "OK  colineales → null" : "MAL colineales");
console.log(isPlausibleQuad([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }]) ? "MAL no convexo" : "OK  no convexo rechazado");
process.exit(failures ? 1 : 0);
