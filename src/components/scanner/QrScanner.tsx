"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Decorations, Pumpkin } from "@/components/display/Decorations";
import { useIsInAppBrowser, usePrefersReducedMotion } from "@/components/viewer/hooks";
import type { Point } from "@/lib/ar/pose";
import { resolveScannedExperience } from "@/lib/scan";
import SummonReveal, { type ScannerExperience } from "./SummonReveal";
import { useQrScan, type CameraError, type ScanHit } from "./useQrScan";

// three.js sólo se descarga al anclar el personaje.
const ArStage = dynamic(() => import("./ArStage"), { ssr: false });

type Props = {
  experiences: ScannerExperience[];
  /** Orígenes cuyos QR aceptamos (el configurado y el del sitio actual). */
  allowedOrigins: string[];
  creepsterClass: string;
  /** Si se abre desde el enlace del QR impreso: sólo esta experiencia y portada de "activar AR". */
  onlySlug?: string;
  /** Enlace secundario al visor 3D sin cámara. */
  viewerHref?: string;
};

type Stage = "idle" | "starting" | "scanning" | "locking" | "anchored" | "summoning";
type Pt = { x: number; y: number };

const LOCK_MS = 550;
const CAMERA_MESSAGES: Record<CameraError, string> = {
  denied: "Necesitamos permiso para usar la cámara. Actívalo en los ajustes del navegador y vuelve a intentarlo.",
  unavailable: "No encontramos una cámara disponible en este dispositivo.",
  insecure: "La cámara sólo funciona en una conexión segura (https).",
  unknown: "No se pudo abrir la cámara. Inténtalo de nuevo.",
};

/** Convierte un punto normalizado del video (object-cover) a coordenadas 0..1 de la pantalla. */
function videoToScreen(p: Pt, video: HTMLVideoElement): Pt {
  const w = video.clientWidth;
  const h = video.clientHeight;
  const vw = video.videoWidth || w;
  const vh = video.videoHeight || h;
  const scale = Math.max(w / vw, h / vh);
  return {
    x: (p.x * vw * scale + (w - vw * scale) / 2) / w,
    y: (p.y * vh * scale + (h - vh * scale) / 2) / h,
  };
}

export default function QrScanner({ experiences, allowedOrigins, creepsterClass, onlySlug, viewerHref }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const [audio, setAudio] = useState<AudioContext | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [found, setFound] = useState<ScannerExperience | null>(null);
  const stageRef = useRef<Stage>("idle");
  const foundRef = useRef<ScannerExperience | null>(null);
  useEffect(() => {
    stageRef.current = stage;
    foundRef.current = found;
  });
  const [corners, setCorners] = useState<Pt[]>([]);
  const [origin, setOrigin] = useState<Pt>({ x: 0.5, y: 0.5 });
  const [notice, setNotice] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const inAppBrowser = useIsInAppBrowser();
  const lockTimer = useRef<number | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const hitRef = useRef<(hit: ScanHit) => void>(() => {});
  const poseSinkRef = useRef<((corners: Point[]) => void) | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  const { start, stopCamera, pause, resume, setTracking, error } = useQrScan(videoRef, (hit) => hitRef.current(hit));

  // Se actualiza en un efecto para no leer valores obsoletos desde el bucle de escaneo.
  useEffect(() => {
    hitRef.current = (hit: ScanHit) => {
      const video = videoRef.current;
      const slug = resolveScannedExperience(
        hit.value,
        experiences.map((e) => e.slug),
        [...allowedOrigins, window.location.origin],
      );
      const exp = experiences.find((e) => e.slug === slug && (!onlySlug || e.slug === onlySlug));
      // Ya anclado: cada lectura del mismo QR actualiza la pose del personaje.
      if (stageRef.current === "anchored" || stageRef.current === "locking") {
        if (exp && exp.slug === foundRef.current?.slug) poseSinkRef.current?.(hit.corners);
        return;
      }
      if (!exp || !video) {
        setNotice("Ese código no es de esta experiencia. Prueba con otro.");
        if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(null), 2500);
        // Pequeña pausa para no repetir el aviso en cada cuadro.
        window.setTimeout(resume, 900);
        return;
      }
      const screen = hit.corners.map((c) => videoToScreen(c, video));
      const center = screen.length
        ? { x: screen.reduce((a, c) => a + c.x, 0) / screen.length, y: screen.reduce((a, c) => a + c.y, 0) / screen.length }
        : { x: 0.5, y: 0.5 };
      setFound(exp);
      setCorners(screen);
      setOrigin(center);
      setStage("locking");
      if (!reducedMotion) navigator.vibrate?.(40);
      // Se sigue leyendo el QR en cada cuadro para anclar el personaje a él.
      setTracking(true);
      poseSinkRef.current?.(hit.corners);
      lockTimer.current = window.setTimeout(() => setStage("anchored"), reducedMotion ? 0 : LOCK_MS);
    };
  });

  useEffect(
    () => () => {
      if (lockTimer.current) window.clearTimeout(lockTimer.current);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      void audioRef.current?.close().catch(() => {});
    },
    [],
  );

  const open = useCallback(async () => {
    setStage("starting");
    // El audio también necesita un toque del usuario para poder sonar después.
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) audioRef.current = new Ctx();
      }
      setAudio(audioRef.current);
      // Sin await: resume() puede no resolverse nunca si el navegador bloquea el audio.
      void audioRef.current?.resume().catch(() => {});
    } catch {
      /* el sonido es opcional */
    }
    const ok = await start();
    setVideoEl(ok ? videoRef.current : null);
    setStage(ok ? "scanning" : "idle");
    if (ok) {
      // Calentar la caché del GLB mientras la persona apunta al QR.
      for (const e of experiences) if (e.glbUrl) void fetch(e.glbUrl).catch(() => {});
    }
  }, [experiences, start]);

  const again = useCallback(() => {
    setTracking(false);
    setFound(null);
    setCorners([]);
    setStage("scanning");
    resume();
  }, [resume, setTracking]);

  const arFailed = useCallback(() => {
    // Sin WebGL o sin modelo: se muestra al personaje flotando sobre la cámara.
    setTracking(false);
    setStage((s) => (s === "locking" || s === "anchored" ? "summoning" : s));
  }, [setTracking]);

  const close = useCallback(() => {
    setTracking(false);
    pause();
    stopCamera();
    setStage("idle");
    setFound(null);
  }, [pause, setTracking, stopCamera]);

  const cameraOn = stage !== "idle" && stage !== "starting";
  const anchoring = stage === "locking" || stage === "anchored";
  const polygon = corners.map((c) => `${c.x * 100},${c.y * 100}`).join(" ");

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#05010a] text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${cameraOn ? "opacity-100" : "opacity-0"}`}
      />

      {/* Portada */}
      {!cameraOn && (
        <div className="absolute inset-0">
          <Decorations />
          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
            <Pumpkin className="w-32" />
            <h1 className={`${creepsterClass} hw-flicker text-[clamp(2.5rem,12vw,4.5rem)] leading-none text-orange-500`}>
              ¿Te atreves?
            </h1>
            <p className="max-w-[30ch] text-lg font-semibold text-orange-100">
              {onlySlug ? (
                <>
                  Toca el botón y <span className="text-orange-400">apunta la cámara al QR</span>: el personaje saldrá de él.
                </>
              ) : (
                <>
                  Abre la cámara y apunta al código QR para <span className="text-orange-400">despertar al personaje</span>.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={open}
              disabled={stage === "starting"}
              className="hw-glow min-h-16 rounded-full bg-orange-500 px-10 text-xl font-bold text-black hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70"
            >
              {stage === "starting" ? "Abriendo cámara…" : onlySlug ? "✨ Activar realidad aumentada" : "🎃 Abrir cámara"}
            </button>
            {error && (
              <p role="alert" className="max-w-sm rounded-2xl bg-black/70 p-4 text-sm text-amber-200">
                {CAMERA_MESSAGES[error]}
              </p>
            )}
            {(error || inAppBrowser) && (
              <div className="flex max-w-sm flex-col items-center gap-3 text-sm text-white/85">
                {inAppBrowser && (
                  <p>Si la cámara no abre, entra desde <strong>Safari</strong> o <strong>Chrome</strong>.</p>
                )}
                {experiences.map((e) => (
                  <Link
                    key={e.slug}
                    href={`/ar/${e.slug}`}
                    className="rounded-full bg-white/15 px-5 py-3 backdrop-blur hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
                  >
                    Ver {e.name} sin cámara
                  </Link>
                ))}
              </div>
            )}
            {viewerHref && (
              <Link href={viewerHref} className="text-sm text-white/80 underline underline-offset-4">
                Verlo en 3D / con la AR de tu teléfono
              </Link>
            )}
            <Link href="/" className="text-sm text-white/60 underline-offset-4 hover:underline">
              Inicio
            </Link>
          </div>
        </div>
      )}

      {/* Buscando QR */}
      {stage === "scanning" && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(5,1,10,0.7)_100%)]" />
          <div className="absolute left-1/2 top-1/2 aspect-square w-[68vmin] -translate-x-1/2 -translate-y-1/2">
            <div className="hw-glow absolute inset-0 rounded-3xl border-4 border-orange-500/90" />
            <div className="absolute inset-2 overflow-hidden rounded-2xl">
              <div className="hw-scanline h-1/3 bg-gradient-to-b from-transparent via-orange-400/40 to-transparent" />
            </div>
          </div>
          <p className="absolute inset-x-0 top-[max(1.5rem,env(safe-area-inset-top))] text-center text-lg font-semibold [text-shadow:0_2px_8px_#000]">
            Apunta al código QR 🎯
          </p>
          {notice && (
            <p role="status" className="absolute inset-x-6 bottom-28 mx-auto max-w-sm rounded-2xl bg-black/75 p-3 text-center text-sm text-amber-200">
              {notice}
            </p>
          )}
        </div>
      )}
      {cameraOn && stage !== "summoning" && !anchoring && (
        <button
          type="button"
          onClick={close}
          className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-20 min-h-11 rounded-full bg-black/60 px-4 text-sm backdrop-blur hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white"
          style={stage === "scanning" ? { top: "auto", bottom: "max(1.5rem, env(safe-area-inset-bottom))" } : undefined}
        >
          ✕ Cerrar cámara
        </button>
      )}

      {/* QR reconocido */}
      {stage === "locking" && polygon && (
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points={polygon} fill="rgba(249,115,22,0.25)" stroke="#f97316" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="hw-lock" />
        </svg>
      )}
      {stage === "locking" && <div className="pointer-events-none absolute inset-0 bg-white/30 [animation:hw-lightning_0.5s_linear_both]" />}

      {/* Personaje anclado al QR (three.js sobre el video) */}
      {anchoring && found && videoEl && (
        <>
          <ArStage
            video={videoEl}
            experience={found}
            sinkRef={poseSinkRef}
            reducedMotion={reducedMotion}
            onFailed={arFailed}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
            <button
              type="button"
              onClick={again}
              className="pointer-events-auto min-h-12 rounded-full bg-orange-500 px-6 font-semibold text-black shadow-[0_0_24px_rgba(249,115,22,0.6)] hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              📷 Escanear otro
            </button>
            <button
              type="button"
              onClick={close}
              className="pointer-events-auto min-h-12 rounded-full bg-white/15 px-5 text-sm backdrop-blur hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
            >
              ✕ Cerrar
            </button>
          </div>
        </>
      )}

      {stage === "summoning" && found && (
        <SummonReveal
          experience={found}
          origin={origin}
          audio={audio}
          reducedMotion={reducedMotion}
          creepsterClass={creepsterClass}
          onAgain={again}
        />
      )}
    </main>
  );
}
