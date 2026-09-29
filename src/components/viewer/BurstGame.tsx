"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { ModelViewerElement } from "@google/model-viewer";
import type { ExperienceGame } from "@/lib/experiences/types";
import { patchARUpdateScene } from "./model-viewer-patches";
import { drawPrize, loadSavedPrize, makePrizeCode, savePrize, type WonPrize } from "@/lib/prizes";

type Props = {
  viewerRef: RefObject<ModelViewerElement | null>;
  game: ExperienceGame;
  slug: string;
  /** En la AR de Android tocar el modelo lo arrastra, así que ahí se usa un botón. */
  arPresenting: boolean;
  reducedMotion: boolean;
};

type Phase = "idle" | "charging" | "bursting" | "prize";
type Point = { x: number; y: number };
type Particle = {
  id: number;
  emoji: string;
  tx: number;
  ty: number;
  rot: number;
  size: number;
  delay: number;
};

const MOVE_TOLERANCE_PX = 12;
const BURST_MS = 1100;
const PARTICLE_EMOJIS = ["🍬", "🍭", "🎃", "👻", "🦇", "🍫", "🕷️", "⭐", "💀", "🍬"];
const IDLE_SCALE = "1 1 1";
const IDLE_ORIENTATION = "0deg 0deg 0deg";

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, id) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 120 + Math.random() * 260;
    return {
      id,
      emoji: PARTICLE_EMOJIS[id % PARTICLE_EMOJIS.length],
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance - 60,
      rot: (Math.random() - 0.5) * 720,
      size: 22 + Math.random() * 26,
      delay: Math.random() * 120,
    };
  });
}

/** Pop + "buuu" sintetizados: no hace falta cargar archivos de audio. */
function playBurstSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const pop = ctx.createBufferSource();
  pop.buffer = noise;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(3000, now);
  lowpass.frequency.exponentialRampToValueAtTime(200, now + 0.35);
  const popGain = ctx.createGain();
  popGain.gain.setValueAtTime(0.9, now);
  popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  pop.connect(lowpass).connect(popGain).connect(ctx.destination);
  pop.start(now);

  const boo = ctx.createOscillator();
  boo.type = "triangle";
  boo.frequency.setValueAtTime(420, now + 0.1);
  boo.frequency.exponentialRampToValueAtTime(110, now + 0.9);
  const booGain = ctx.createGain();
  booGain.gain.setValueAtTime(0.0001, now);
  booGain.gain.exponentialRampToValueAtTime(0.25, now + 0.2);
  booGain.gain.exponentialRampToValueAtTime(0.0001, now + 1);
  boo.connect(booGain).connect(ctx.destination);
  boo.start(now + 0.1);
  boo.stop(now + 1.05);
}

export default function BurstGame({ viewerRef, game, slug, arPresenting, reducedMotion }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [point, setPoint] = useState<Point>({ x: 0, y: 0 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [prize, setPrize] = useState<WonPrize | null>(null);
  const [alreadyWon, setAlreadyWon] = useState(false);

  const phaseRef = useRef<Phase>("idle");
  const rafRef = useRef<number | null>(null);
  const startRef = useRef({ t: 0, x: 0, y: 0, pointerId: -1 });
  const audioRef = useRef<AudioContext | null>(null);
  const burstTimerRef = useRef<number | null>(null);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const restoreModel = useCallback(() => {
    const el = viewerRef.current;
    if (!el) return;
    el.scale = IDLE_SCALE;
    el.orientation = IDLE_ORIENTATION;
  }, [viewerRef]);

  const stopLoop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const cancelCharge = useCallback(() => {
    if (phaseRef.current !== "charging") return;
    stopLoop();
    restoreModel();
    setProgress(0);
    setPhaseBoth("idle");
  }, [restoreModel]);

  const burst = useCallback(() => {
    stopLoop();
    setPhaseBoth("bursting");
    setProgress(0);
    setParticles(makeParticles(reducedMotion ? 12 : 42));

    const el = viewerRef.current;
    if (el) {
      // "Reventar": el modelo desaparece de golpe (también dentro de la AR).
      el.orientation = IDLE_ORIENTATION;
      el.scale = "0.001 0.001 0.001";
    }
    if (audioRef.current) playBurstSound(audioRef.current);
    navigator.vibrate?.([80, 40, 160]);

    const saved = loadSavedPrize(slug);
    if (saved) {
      setPrize(saved);
      setAlreadyWon(true);
    } else {
      const drawn = drawPrize(game.prizes);
      const won: WonPrize = { ...drawn, code: makePrizeCode(game.codePrefix), wonAt: new Date().toISOString() };
      savePrize(slug, won);
      setPrize(won);
      setAlreadyWon(false);
    }

    burstTimerRef.current = window.setTimeout(() => setPhaseBoth("prize"), BURST_MS);
  }, [game.codePrefix, game.prizes, reducedMotion, slug, viewerRef]);

  const startCharge = useCallback(
    (at: Point, pointerId: number, clientX: number, clientY: number) => {
      if (phaseRef.current !== "idle") return;
      // El AudioContext debe crearse durante un gesto del usuario.
      try {
        audioRef.current ??= new AudioContext();
        void audioRef.current.resume();
      } catch {
        audioRef.current = null;
      }
      startRef.current = { t: performance.now(), x: clientX, y: clientY, pointerId };
      setPoint(at);
      setPhaseBoth("charging");

      let lastModelUpdate = 0;
      const tick = (now: number) => {
        const p = Math.min(1, (now - startRef.current.t) / game.holdMs);
        setProgress(p);
        const el = viewerRef.current;
        // Inflar y temblar ~30 veces por segundo (cada cambio recalcula la escena).
        if (el && now - lastModelUpdate > 33) {
          lastModelUpdate = now;
          const k = 1 + 0.3 * p;
          el.scale = `${k} ${k} ${k}`;
          if (!reducedMotion) el.orientation = `${Math.sin(now / 25) * 10 * p}deg 0deg 0deg`;
        }
        if (p >= 1) burst();
        else rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [burst, game.holdMs, reducedMotion, viewerRef],
  );

  useEffect(() => {
    if (viewerRef.current) patchARUpdateScene(viewerRef.current);
  }, [viewerRef]);

  // Visor 3D: mantener presionado sobre el propio modelo.
  useEffect(() => {
    const el = viewerRef.current;
    if (!el || arPresenting) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) {
        cancelCharge(); // un segundo dedo = pellizco para hacer zoom
        return;
      }
      if ((e.target as Element).closest("[data-game-ui]")) return;
      if (el.positionAndNormalFromPoint(e.clientX, e.clientY) === null) return;
      const rect = el.getBoundingClientRect();
      startCharge({ x: e.clientX - rect.left, y: e.clientY - rect.top }, e.pointerId, e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (phaseRef.current !== "charging" || e.pointerId !== startRef.current.pointerId) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (dx * dx + dy * dy > MOVE_TOLERANCE_PX ** 2) cancelCharge(); // está girando la cámara
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerId === startRef.current.pointerId) cancelCharge();
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerEnd);
    el.addEventListener("pointercancel", onPointerEnd);
    el.addEventListener("contextmenu", onContextMenu);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, [arPresenting, cancelCharge, startCharge, viewerRef]);

  // Al entrar o salir de la AR, abortar lo que estuviera a medias.
  useEffect(() => {
    cancelCharge();
  }, [arPresenting, cancelCharge]);

  useEffect(
    () => () => {
      stopLoop();
      if (burstTimerRef.current !== null) clearTimeout(burstTimerRef.current);
      void audioRef.current?.close();
    },
    [],
  );

  const playAgain = () => {
    restoreModel();
    setParticles([]);
    setPhaseBoth("idle");
  };

  const arButtonDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = viewerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    startCharge({ x: rect.width / 2, y: rect.height * 0.45 }, e.pointerId, e.clientX, e.clientY);
  };

  const circumference = 2 * Math.PI * 34;

  return (
    <div data-game-ui className="pointer-events-none absolute inset-0 z-10 select-none [-webkit-touch-callout:none]">
      {/* Pista para el visor 3D */}
      {phase === "idle" && !arPresenting && (
        <p className="absolute left-1/2 top-24 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-orange-200 backdrop-blur">
          👆 Mantén presionado al personaje para reventarlo
        </p>
      )}

      {/* Botón para la AR (Android/WebXR) */}
      {arPresenting && (phase === "idle" || phase === "charging") && (
        <button
          type="button"
          onPointerDown={arButtonDown}
          onPointerUp={cancelCharge}
          onPointerLeave={cancelCharge}
          onPointerCancel={cancelCharge}
          onContextMenu={(e) => e.preventDefault()}
          className="pointer-events-auto absolute bottom-10 left-1/2 flex min-h-16 -translate-x-1/2 items-center gap-2 rounded-full bg-orange-500 px-8 text-lg font-bold text-black shadow-[0_0_30px_rgba(249,115,22,0.8)] active:scale-95"
        >
          🎃 {phase === "charging" ? "¡Aguanta…!" : "Mantén para reventar"}
        </button>
      )}

      {/* Anillo de carga donde está el dedo */}
      {phase === "charging" && (
        <svg
          className="absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2"
          style={{ left: point.x, top: point.y }}
          viewBox="0 0 80 80"
          aria-hidden="true"
        >
          <circle cx="40" cy="40" r="34" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="#f97316"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform="rotate(-90 40 40)"
          />
          <text x="40" y="47" textAnchor="middle" fontSize="22">
            🎃
          </text>
        </svg>
      )}

      {/* Explosión */}
      {(phase === "bursting" || phase === "prize") && particles.length > 0 && (
        <div className="absolute" style={{ left: point.x, top: point.y }} aria-hidden="true">
          <span className="hw-burst-flash absolute -translate-x-1/2 -translate-y-1/2 rounded-full" />
          {phase === "bursting" && (
            <span className="hw-boo absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-6xl font-black text-orange-400">
              ¡BOO!
            </span>
          )}
          {particles.map((p) => (
            <span
              key={p.id}
              className="hw-particle absolute -translate-x-1/2 -translate-y-1/2"
              style={
                {
                  fontSize: p.size,
                  "--tx": `${p.tx}px`,
                  "--ty": `${p.ty}px`,
                  "--rot": `${p.rot}deg`,
                  animationDelay: `${p.delay}ms`,
                } as CSSProperties
              }
            >
              {p.emoji}
            </span>
          ))}
        </div>
      )}

      {/* Premio */}
      {phase === "prize" && prize && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="prize-title"
            className="hw-prize-in w-full max-w-sm rounded-3xl border-4 border-orange-500 bg-gradient-to-b from-purple-950 to-neutral-950 p-6 text-center text-white shadow-[0_0_60px_rgba(249,115,22,0.6)]"
          >
            <div className="text-7xl" aria-hidden="true">
              {prize.emoji}
            </div>
            <h2 id="prize-title" className="mt-3 text-2xl font-black text-orange-400">
              {alreadyWon ? "¡Ya tienes tu premio!" : "¡Lo reventaste! Ganaste:"}
            </h2>
            <p className="mt-2 text-xl font-bold">{prize.title}</p>
            {prize.description && <p className="mt-1 text-sm text-white/80">{prize.description}</p>}
            <div className="mt-5 rounded-2xl border-2 border-dashed border-orange-400 bg-black/40 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-white/60">Tu código</p>
              <p className="font-mono text-3xl font-black tracking-widest text-orange-300">{prize.code}</p>
            </div>
            <p className="mt-3 text-sm text-white/80">Muestra este código en el stand para reclamarlo 🎃</p>
            <button
              type="button"
              onClick={playAgain}
              className="mt-5 min-h-12 w-full rounded-full bg-orange-500 px-6 font-bold text-black hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Reventarlo otra vez
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
