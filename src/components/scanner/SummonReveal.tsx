"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ModelViewerElement } from "@google/model-viewer";
import BurstGame from "@/components/viewer/BurstGame";
import { useModelViewerDefined } from "@/components/viewer/hooks";
import type { ExperienceAnchor, ExperienceGame } from "@/lib/experiences/types";

export type ScannerExperience = {
  slug: string;
  name: string;
  glbUrl: string | null;
  game?: ExperienceGame;
  anchor: ExperienceAnchor;
};

type Props = {
  experience: ScannerExperience;
  /** Punto de la pantalla (0..1) donde estaba el QR: ahí se abre el portal. */
  origin: { x: number; y: number };
  audio: AudioContext | null;
  reducedMotion: boolean;
  creepsterClass: string;
  onAgain: () => void;
};

const MODEL_DELAY_MS = 900; // el portal se abre un momento antes de que salga el personaje
const SPIN_MS = 1700;
const BATS = [
  { top: "14%", d: "5s", delay: "0.6s", s: 1.2 },
  { top: "28%", d: "6.5s", delay: "1.1s", s: 0.9 },
  { top: "9%", d: "7s", delay: "1.8s", s: 1.5 },
  { top: "40%", d: "5.5s", delay: "2.4s", s: 0.8 },
];

/** Retumbo + trueno + "buuu" sintetizados (sin archivos de audio). */
function playSummonSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  const rumble = ctx.createOscillator();
  rumble.type = "sawtooth";
  rumble.frequency.setValueAtTime(48, now);
  rumble.frequency.exponentialRampToValueAtTime(130, now + 1.4);
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0.0001, now);
  rg.gain.exponentialRampToValueAtTime(0.28, now + 0.6);
  rg.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 400;
  rumble.connect(lp).connect(rg).connect(ctx.destination);
  rumble.start(now);
  rumble.stop(now + 1.9);

  const len = Math.floor(ctx.sampleRate * 0.7);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const thunder = ctx.createBufferSource();
  thunder.buffer = buf;
  const tf = ctx.createBiquadFilter();
  tf.type = "lowpass";
  tf.frequency.setValueAtTime(2500, now + 0.05);
  tf.frequency.exponentialRampToValueAtTime(150, now + 0.7);
  const tg = ctx.createGain();
  tg.gain.value = 0.7;
  thunder.connect(tf).connect(tg).connect(ctx.destination);
  thunder.start(now + 0.05);

  const boo = ctx.createOscillator();
  boo.type = "triangle";
  boo.frequency.setValueAtTime(180, now + MODEL_DELAY_MS / 1000);
  boo.frequency.exponentialRampToValueAtTime(520, now + 1.5);
  boo.frequency.exponentialRampToValueAtTime(140, now + 2.3);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, now + MODEL_DELAY_MS / 1000);
  bg.gain.exponentialRampToValueAtTime(0.22, now + 1.4);
  bg.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
  boo.connect(bg).connect(ctx.destination);
  boo.start(now + MODEL_DELAY_MS / 1000);
  boo.stop(now + 2.5);
}

export default function SummonReveal({
  experience,
  origin,
  audio,
  reducedMotion,
  creepsterClass,
  onAgain,
}: Props) {
  const viewerRef = useRef<ModelViewerElement>(null);
  const defineState = useModelViewerDefined();
  const [modelShown, setModelShown] = useState(false);
  const [titleShown, setTitleShown] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Línea de tiempo: portal → personaje → título.
  useEffect(() => {
    if (audio && !reducedMotion) {
      try {
        playSummonSound(audio);
      } catch {
        /* sin audio no pasa nada */
      }
    }
    if (!reducedMotion) navigator.vibrate?.([60, 40, 60, 40, 220]);
    const t1 = window.setTimeout(() => setModelShown(true), reducedMotion ? 0 : MODEL_DELAY_MS);
    const t2 = window.setTimeout(() => setTitleShown(true), reducedMotion ? 0 : MODEL_DELAY_MS + 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [audio, reducedMotion]);

  useEffect(() => {
    const el = viewerRef.current;
    if (defineState !== "ready" || !el) return;
    const onLoad = () => setLoaded(true);
    const onError = () => setFailed(true);
    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };
  }, [defineState]);

  // Giro de 360° al emerger. Se anima la cámara, no la escala del modelo (ver model-viewer-patches).
  const ready = modelShown && loaded;
  useEffect(() => {
    const el = viewerRef.current;
    if (!ready || !el) return;
    if (reducedMotion) {
      el.cameraOrbit = "0deg 78deg auto";
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / SPIN_MS);
      const eased = 1 - (1 - k) ** 3;
      el.cameraOrbit = `${(1 - eased) * 360}deg 78deg auto`;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ready, reducedMotion]);

  const portalStyle = { left: `${origin.x * 100}%`, top: `${origin.y * 100}%` } as CSSProperties;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Cámara oscurece y se tiñe de morado */}
      <div className="hw-vignette absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(46,16,101,0.35)_0%,rgba(5,1,10,0.88)_85%)]" />
      <div className="hw-lightning absolute inset-0 bg-white" />

      {/* Portal: anillos que nacen en el QR */}
      {[0, 0.18, 0.36].map((delay, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="hw-portal absolute h-[60vmin] w-[60vmin] rounded-full border-[6px]"
          style={
            {
              ...portalStyle,
              "--delay": `${delay}s`,
              "--end": 3 - i * 0.4,
              "--spin": i % 2 ? "-200deg" : "200deg",
              borderColor: i === 1 ? "#a78bfa" : "#f97316",
              boxShadow: "0 0 40px 8px #f97316aa, inset 0 0 40px 8px #7c3aed88",
            } as CSSProperties
          }
        />
      ))}

      {/* Niebla subiendo */}
      <div
        aria-hidden="true"
        className="hw-mist pointer-events-none absolute inset-x-[-20%] bottom-0 h-[55%] bg-[radial-gradient(ellipse_50%_60%_at_30%_100%,rgba(196,181,253,0.5),transparent),radial-gradient(ellipse_50%_60%_at_75%_100%,rgba(249,115,22,0.35),transparent)] blur-2xl"
      />

      {/* Murciélagos */}
      {!reducedMotion &&
        BATS.map((b, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="hw-bat absolute left-0 text-4xl"
            style={{ top: b.top, "--d": b.d, "--delay": b.delay, "--s": b.s } as CSSProperties}
          >
            🦇
          </span>
        ))}

      {/* Personaje */}
      {experience.glbUrl && defineState === "ready" && !failed && (
        <div
          className={`absolute inset-x-0 bottom-[16%] top-[14%] ${modelShown ? "hw-rise" : "opacity-0"}`}
        >
          <model-viewer
            ref={viewerRef}
            src={experience.glbUrl}
            alt={`${experience.name} en 3D`}
            camera-controls
            touch-action="none"
            interaction-prompt="none"
            environment-image="neutral"
            exposure={1.25}
            shadow-intensity={0}
            auto-rotate={false}
            camera-orbit="360deg 78deg auto"
            min-camera-orbit="auto 20deg auto"
            max-camera-orbit="auto 100deg auto"
            className="block h-full w-full select-none [-webkit-touch-callout:none] [-webkit-user-select:none] [--poster-color:transparent]"
          >
            {ready && experience.game?.enabled && (
              <BurstGame
                viewerRef={viewerRef}
                game={experience.game}
                slug={experience.slug}
                arPresenting={false}
                reducedMotion={reducedMotion}
              />
            )}
          </model-viewer>
        </div>
      )}

      {failed && (
        <p role="alert" className="absolute inset-x-6 top-1/3 text-center text-white">
          No se pudo cargar el modelo. Puedes abrir el visor completo abajo.
        </p>
      )}

      {/* Título y acciones */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-4 pt-[max(1rem,env(safe-area-inset-top))] text-center">
        {titleShown && (
          <>
            <h2
              className={`${creepsterClass} hw-title-in text-[clamp(2rem,9vw,3.5rem)] leading-none text-orange-400 [text-shadow:0_0_18px_#ea580c,0_2px_6px_#000]`}
            >
              ¡{experience.name} ha despertado!
            </h2>
          </>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
        <button
          type="button"
          onClick={onAgain}
          className="min-h-12 rounded-full bg-orange-500 px-6 font-semibold text-black shadow-[0_0_24px_rgba(249,115,22,0.6)] hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          📷 Escanear otro
        </button>
        <Link
          href={`/ar/${experience.slug}`}
          className="flex min-h-12 items-center rounded-full bg-white/15 px-5 text-sm backdrop-blur hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
        >
          Verlo en tu espacio (AR)
        </Link>
      </div>
    </div>
  );
}
