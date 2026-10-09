import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  OneEuro,
  approximateIntrinsics,
  isPlausibleQuad,
  poseFromCorners,
  type Point,
} from "@/lib/ar/pose";
import type { BurstAdapter } from "@/components/viewer/BurstGame";
import type { ExperienceAnchor } from "@/lib/experiences/types";

export type ArSceneOptions = {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  modelUrl: string;
  anchor: ExperienceAnchor;
  reducedMotion: boolean;
  /** true cuando el QR se ve; false cuando se perdió más de LOST_AFTER_S. */
  onPresence(visible: boolean): void;
  onError(): void;
};

export type ArScene = {
  /** Esquinas del QR normalizadas (0..1 sobre el cuadro de video), en orden TL, TR, BR, BL. */
  feed(corners: Point[]): void;
  resize(): void;
  adapter: BurstAdapter;
  dispose(): void;
};

const LOST_AFTER_S = 1.5;
const RING_COLORS = [0xf97316, 0xa78bfa, 0xfde047];
const SPARK_COUNT = 140;

const easeOutCubic = (k: number) => 1 - (1 - k) ** 3;
const easeOutBack = (k: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2;
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,200,120,0.6)");
  grad.addColorStop(1, "rgba(255,160,60,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createArScene(opts: ArSceneOptions): ArScene {
  const { canvas, video, anchor: cfg, reducedMotion } = opts;
  const size = cfg.qrSizeMeters;
  const modelHeight = size * cfg.modelHeightInQr;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const baseExposure = 1.1;
  renderer.toneMappingExposure = baseExposure;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  const key = new THREE.DirectionalLight(0xffd2a0, 1.6);
  key.position.set(0.5, 1, 1.5);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(60, 9 / 16, 0.01, 100);

  // Todo cuelga del ancla: su matriz es la pose del QR (el marcador mide `size` de lado).
  const anchor = new THREE.Group();
  anchor.matrixAutoUpdate = false;
  anchor.visible = false;
  scene.add(anchor);

  // ── Portal: anillos sobre el plano del QR ──
  const disposables: { dispose(): void }[] = [pmrem, envTexture];
  const rings = RING_COLORS.map((color) => {
    const geo = new THREE.RingGeometry(0.46 * size, 0.5 * size, 64);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    disposables.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    anchor.add(mesh);
    return mesh;
  });
  // Aro tenue permanente alrededor del QR: "portal" abierto.
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const haloGeo = new THREE.RingGeometry(0.62 * size, 0.66 * size, 64);
  disposables.push(haloMat, haloGeo);
  const halo = new THREE.Mesh(haloGeo, haloMat);
  anchor.add(halo);

  // ── Chispas ──
  const glow = glowTexture();
  disposables.push(glow);
  const sparkPos = new Float32Array(SPARK_COUNT * 3);
  const sparkVel = new Float32Array(SPARK_COUNT * 3);
  const sparkBorn = new Float32Array(SPARK_COUNT);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    map: glow,
    color: 0xffa040,
    size: 0.08 * size,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(sparkGeo, sparkMat);
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  sparks.visible = false;
  anchor.add(sparks);
  for (let i = 0; i < SPARK_COUNT; i++) sparkBorn[i] = -1;

  // ── Personaje ──
  const wrapper = new THREE.Group(); // posición/escala de la aparición
  const holder = new THREE.Group(); // giro, balanceo y temblor
  wrapper.add(holder);
  wrapper.visible = false;
  anchor.add(wrapper);
  if (cfg.mount === "floor") wrapper.rotation.x = Math.PI / 2; // su "arriba" sale de la normal del QR
  const finalPos =
    cfg.mount === "wall" ? new THREE.Vector3(0, -0.5 * size, 0.1 * size) : new THREE.Vector3(0, 0, 0);
  const startPos = new THREE.Vector3(0, 0, 0.02 * size);

  let modelReady = false;
  new GLTFLoader().load(
    opts.modelUrl,
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const sz = box.getSize(new THREE.Vector3());
      const ctr = box.getCenter(new THREE.Vector3());
      model.position.set(-ctr.x, -box.min.y, -ctr.z);
      const fit = new THREE.Group();
      fit.scale.setScalar(modelHeight / Math.max(sz.y, 1e-6));
      fit.add(model);
      holder.add(fit);
      modelReady = true;
    },
    undefined,
    () => opts.onError(),
  );

  // ── Seguimiento del QR ──
  const posFilters = [new OneEuro(), new OneEuro(), new OneEuro()];
  const targetQuat = new THREE.Quaternion();
  const curQuat = new THREE.Quaternion();
  const curPos = new THREE.Vector3();
  const tmpMat = new THREE.Matrix4();
  const tmpScale = new THREE.Vector3(1, 1, 1);
  let haveFirstPose = false;
  let lastSeen = -Infinity;
  let appearT0: number | null = null; // inicio de la aparición
  let presence = 0; // 0 = oculto, 1 = visible
  let reportedVisible = false;
  let vw = 0;
  let vh = 0;
  const now = () => performance.now() / 1000;

  function feed(norm: Point[]) {
    if (!vw || !vh) return;
    const k = approximateIntrinsics(vw, vh);
    const px = norm.map((p) => ({ x: p.x * vw, y: p.y * vh }));
    if (!isPlausibleQuad(px)) return;
    const pose = poseFromCorners(px, k, size);
    if (!pose) return;
    const t = now();
    const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = pose.r;
    tmpMat.set(m00, m01, m02, 0, m10, m11, m12, 0, m20, m21, m22, 0, 0, 0, 0, 1);
    targetQuat.setFromRotationMatrix(tmpMat);
    const p = [0, 1, 2].map((i) => posFilters[i].filter(pose.t[i], t));
    if (!haveFirstPose) {
      curQuat.copy(targetQuat);
      curPos.set(p[0], p[1], p[2]);
      haveFirstPose = true;
    } else {
      const angle = curQuat.angleTo(targetQuat);
      curQuat.slerp(targetQuat, clamp01(0.3 + angle * 2.5));
      curPos.set(p[0], p[1], p[2]);
    }
    lastSeen = t;
  }

  // ── Tamaño: el canvas cubre el mismo recorte que el <video> (object-cover) ──
  function resize() {
    const cw = video.clientWidth;
    const ch = video.clientHeight;
    vw = video.videoWidth;
    vh = video.videoHeight;
    if (!cw || !ch || !vw || !vh) return;
    const scale = Math.max(cw / vw, ch / vh);
    const w = vw * scale;
    const h = vh * scale;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.left = `${(cw - w) / 2}px`;
    canvas.style.top = `${(ch - h) / 2}px`;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    const k = approximateIntrinsics(vw, vh);
    camera.aspect = vw / vh;
    camera.fov = (2 * Math.atan(vh / 2 / k.fy) * 180) / Math.PI;
    camera.updateProjectionMatrix();
  }

  // ── Juego de reventar ──
  const charge = { k: 1, shake: 0, popped: false };
  const raycaster = new THREE.Raycaster();
  const adapter: BurstAdapter = {
    target: canvas,
    hitTest(x, y) {
      if (!modelReady || charge.popped || !wrapper.visible) return false;
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObject(holder, true).length > 0;
    },
    setCharge(k, shakeDeg) {
      charge.k = k;
      charge.shake = (shakeDeg * Math.PI) / 180;
    },
    pop() {
      charge.popped = true;
      charge.k = 1;
      charge.shake = 0;
    },
    restore() {
      charge.popped = false;
      charge.k = 1;
      charge.shake = 0;
      appearT0 = now() - 0.4; // vuelve a salir del QR
    },
  };

  // ── Bucle de render ──
  let raf = 0;
  let last = now();
  let nextSpark = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const t = now();
    const dt = Math.min(0.05, t - last);
    const lastFrame = last;
    last = t;
    if (!vw) resize();

    const seen = haveFirstPose && t - lastSeen < LOST_AFTER_S;
    if (seen !== reportedVisible) {
      reportedVisible = seen;
      opts.onPresence(seen);
    }
    // La aparición empieza cuando hay pose y el modelo ya cargó.
    if (haveFirstPose && modelReady && appearT0 === null) appearT0 = t;
    // Con tiempo real (no `dt` acotado) para que también se desvanezca si el navegador reduce los cuadros.
    presence += ((seen ? 1 : 0) - presence) * Math.min(1, Math.min(0.5, t - lastFrame) * (seen ? 8 : 5));

    anchor.visible = haveFirstPose && presence > 0.01;
    if (anchor.visible) {
      tmpMat.compose(curPos, curQuat, tmpScale);
      anchor.matrix.copy(tmpMat);
      anchor.matrixWorldNeedsUpdate = true;
    }

    const e = appearT0 === null ? 0 : t - appearT0; // segundos desde que sale
    let flash = 0;

    // Anillos del portal
    rings.forEach((ring, i) => {
      const k = clamp01((e - i * 0.22) / 1.2);
      const live = appearT0 !== null && k > 0 && k < 1 && !reducedMotion;
      ring.visible = live;
      if (live) {
        ring.scale.setScalar(0.4 + easeOutCubic(k) * 2.2);
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.95;
        ring.rotation.z = k * (i % 2 ? -2 : 2);
      }
    });
    haloMat.opacity = appearT0 === null ? 0 : (0.28 + 0.14 * Math.sin(t * 3)) * clamp01(e / 0.8) * presence;

    // Destello al abrirse el portal
    if (!reducedMotion) flash = Math.max(0, 1 - Math.abs(e - 0.45) / 0.4);
    renderer.toneMappingExposure = baseExposure + flash * 1.4;

    // Chispas
    if (appearT0 !== null && !reducedMotion && e > 0.25 && e < 2 && t >= nextSpark) {
      nextSpark = t + 0.012;
      for (let n = 0; n < 4; n++) {
        const i = sparkBorn.findIndex((b) => b < 0 || t - b > 1.6);
        if (i < 0) break;
        const a = Math.random() * Math.PI * 2;
        const sp = (0.15 + Math.random() * 0.5) * size;
        sparkPos.set([(Math.random() - 0.5) * 0.5 * size, (Math.random() - 0.5) * 0.5 * size, 0], i * 3);
        sparkVel.set([Math.cos(a) * sp * 0.5, Math.sin(a) * sp * 0.5, (0.6 + Math.random() * 1.2) * size], i * 3);
        sparkBorn[i] = t;
      }
    }
    let anySpark = false;
    for (let i = 0; i < SPARK_COUNT; i++) {
      if (sparkBorn[i] < 0) continue;
      if (t - sparkBorn[i] > 1.6) {
        sparkBorn[i] = -1;
        sparkPos[i * 3 + 2] = -1000;
        continue;
      }
      anySpark = true;
      sparkPos[i * 3] += sparkVel[i * 3] * dt;
      sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
      sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
      sparkVel[i * 3 + 2] -= 0.5 * size * dt;
    }
    sparks.visible = anySpark;
    if (anySpark) sparkGeo.attributes.position.needsUpdate = true;

    // Personaje: sale del centro del QR, crece con rebote y gira
    const k2 = clamp01((e - 0.45) / (reducedMotion ? 0.01 : 1.5));
    const grow = appearT0 === null ? 0 : Math.max(0, easeOutBack(k2));
    const shown = charge.popped ? 0 : grow * presence * charge.k;
    wrapper.visible = modelReady && shown > 0.002;
    if (wrapper.visible) {
      wrapper.position.lerpVectors(startPos, finalPos, easeOutCubic(k2));
      wrapper.scale.setScalar(shown);
      const spin = reducedMotion ? 0 : (1 - easeOutCubic(k2)) * Math.PI * 2;
      const sway = k2 >= 1 && !reducedMotion ? Math.sin(t * 0.9) * 0.25 : 0;
      holder.rotation.y = spin + sway;
      holder.rotation.z = charge.shake;
      holder.position.y = k2 >= 1 && !reducedMotion ? Math.sin(t * 2) * 0.02 * size : 0;
    }

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  return {
    feed,
    resize,
    adapter,
    dispose() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          Object.values(x).forEach((v) => (v as THREE.Texture | undefined)?.isTexture && (v as THREE.Texture).dispose());
          x.dispose();
        });
      });
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
