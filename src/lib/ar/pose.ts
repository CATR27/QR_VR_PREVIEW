/**
 * Pose de un QR (cuadrado plano de lado conocido) a partir de sus 4 esquinas en la imagen.
 *
 * Sistema del marcador: origen en el centro del QR, X a la derecha, Y hacia arriba (en la lectura
 * normal del QR) y Z saliendo hacia el espectador. Esquinas en orden TL, TR, BR, BL (el orden en
 * que las devuelven BarcodeDetector y ZXing).
 *
 * El resultado está expresado en el marco de cámara de three.js (x derecha, y arriba, mira hacia -z),
 * de modo que `[R | t]` se puede asignar directamente a la matriz de un objeto con la cámara en el origen.
 */

export type Point = { x: number; y: number };
export type Intrinsics = { fx: number; fy: number; cx: number; cy: number };
export type Pose = {
  /** Rotación 3×3 por filas (marcador → cámara three.js). */
  r: [number, number, number, number, number, number, number, number, number];
  /** Posición del centro del QR en metros (cámara three.js). */
  t: [number, number, number];
};

/** Resuelve A·x = b (n×n) con pivoteo parcial; null si es singular. */
function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r][n];
    for (let c = r + 1; c < n; c++) s -= m[r][c] * x[c];
    x[r] = s / m[r][r];
  }
  return x;
}

function cross(a: number[], b: number[]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a: number[]): number {
  return Math.hypot(a[0], a[1], a[2]);
}
function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function poseFromCorners(
  corners: readonly Point[],
  k: Intrinsics,
  sizeMeters: number,
): Pose | null {
  if (corners.length !== 4) return null;
  const h = sizeMeters / 2;
  const model: Point[] = [
    { x: -h, y: h },
    { x: h, y: h },
    { x: h, y: -h },
    { x: -h, y: -h },
  ];

  // Homografía plano del marcador → plano normalizado de la cámara (h33 = 1).
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: X, y: Y } = model[i];
    const xn = (corners[i].x - k.cx) / k.fx;
    const yn = (corners[i].y - k.cy) / k.fy;
    a.push([X, Y, 1, 0, 0, 0, -xn * X, -xn * Y]);
    b.push(xn);
    a.push([0, 0, 0, X, Y, 1, -yn * X, -yn * Y]);
    b.push(yn);
  }
  const sol = solveLinear(a, b);
  if (!sol) return null;
  const [h1, h2, h3, h4, h5, h6, h7, h8] = sol;

  // H ≈ λ·[r1 r2 t]; la escala sale de que r1 y r2 son unitarios.
  const m1 = [h1, h4, h7];
  const m2 = [h2, h5, h8];
  const m3 = [h3, h6, 1];
  const lambda = 2 / (norm(m1) + norm(m2));
  if (!Number.isFinite(lambda) || lambda <= 0) return null;

  // Marco OpenCV (y abajo, z adelante). Ortonormalizar por Gram-Schmidt.
  let r1 = m1.map((v) => v * lambda);
  let r2 = m2.map((v) => v * lambda);
  const t = m3.map((v) => v * lambda);
  if (t[2] <= 0) return null; // detrás de la cámara
  const n1 = norm(r1);
  r1 = r1.map((v) => v / n1);
  const proj = dot(r1, r2);
  r2 = r2.map((v, i) => v - proj * r1[i]);
  const n2 = norm(r2);
  r2 = r2.map((v) => v / n2);
  const r3 = cross(r1, r2);

  // Con Y hacia arriba en el marcador y la imagen con v hacia abajo, r1×r2 ya apunta al espectador (−z OpenCV).
  // Pasar al marco de three.js: (x, y, z) → (x, −y, −z).
  const flip = (v: number[]): [number, number, number] => [v[0], -v[1], -v[2]];
  const c1 = flip(r1);
  const c2 = flip(r2);
  const c3 = flip(r3);
  const tt = flip(t);
  return {
    r: [c1[0], c2[0], c3[0], c1[1], c2[1], c3[1], c1[2], c2[2], c3[2]],
    t: tt,
  };
}

/** Intrínsecos aproximados: FOV típico de un celular (~64° en el lado largo), punto principal al centro. */
export function approximateIntrinsics(width: number, height: number, focalRatio = 0.8): Intrinsics {
  const f = focalRatio * Math.max(width, height);
  return { fx: f, fy: f, cx: width / 2, cy: height / 2 };
}

/** Descarta detecciones imposibles: cuadrilátero no convexo, diminuto o con proporciones absurdas. */
export function isPlausibleQuad(c: readonly Point[], minSidePx = 12): boolean {
  if (c.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p = c[i];
    const q = c[(i + 1) % 4];
    const r = c[(i + 2) % 4];
    const z = (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
    if (Math.abs(z) < 1e-6) return false;
    const s = Math.sign(z);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  if (sign < 0) return false; // sentido contrario: espejo o esquinas en otro orden
  const sides = c.map((p, i) => Math.hypot(c[(i + 1) % 4].x - p.x, c[(i + 1) % 4].y - p.y));
  const min = Math.min(...sides);
  const max = Math.max(...sides);
  return min >= minSidePx && max / min < 4;
}

/** Filtro One-Euro: suaviza el temblor con poco retraso cuando hay movimiento rápido. */
export class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;
  constructor(minCutoff = 1.2, beta = 8, dCutoff = 1) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(value: number, timeSec: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = timeSec;
      return value;
    }
    const dt = Math.max(1e-3, timeSec - this.t);
    this.t = timeSec;
    const rawD = (value - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (rawD - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset() {
    this.x = null;
    this.dx = 0;
  }
}
