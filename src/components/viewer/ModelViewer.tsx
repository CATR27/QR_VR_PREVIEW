"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ModelViewerElement } from "@google/model-viewer";
import type { ExperienceEnvironment } from "@/lib/experiences/types";

type Props = {
  src: string;
  alt: string;
  poster?: string | null;
  environment: ExperienceEnvironment;
  autoRotate: boolean;
};

type Status =
  | { kind: "loading"; progress: number | null }
  | { kind: "ready" }
  | { kind: "error"; message: string };

type ProgressEvent = CustomEvent<{ totalProgress: number }>;
type ErrorEvent = CustomEvent<{ type?: string }>;

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export default function ModelViewer({
  src,
  alt,
  poster,
  environment,
  autoRotate,
}: Props) {
  const viewerRef = useRef<ModelViewerElement>(null);
  const [defined, setDefined] = useState(false);
  const [defineError, setDefineError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: "loading", progress: null });
  const reducedMotion = usePrefersReducedMotion();

  // Registrar el custom element sólo en el navegador.
  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer")
      .then(() => customElements.whenDefined("model-viewer"))
      .then(() => {
        if (!cancelled) setDefined(true);
      })
      .catch(() => {
        if (!cancelled) setDefineError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = viewerRef.current;
    if (!defined || !el) return;

    const onProgress = (e: Event) => {
      const p = (e as ProgressEvent).detail.totalProgress;
      // model-viewer emite un progress final incluso después de un error: no pisar "ready" ni "error".
      setStatus((s) => (s.kind === "loading" ? { kind: "loading", progress: p } : s));
    };
    const onLoad = () => setStatus({ kind: "ready" });
    const onError = (e: Event) => {
      const type = (e as ErrorEvent).detail?.type;
      setStatus({
        kind: "error",
        message:
          type === "webglcontextlost"
            ? "El navegador perdió el contexto gráfico."
            : "No se pudo cargar el modelo o el entorno.",
      });
    };

    el.addEventListener("progress", onProgress);
    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("progress", onProgress);
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };
  }, [defined, attempt]);

  const retry = () => {
    setStatus({ kind: "loading", progress: null });
    setAttempt((n) => n + 1);
  };

  if (defineError) {
    return (
      <Overlay>
        <p>No se pudo iniciar el visor 3D en este navegador.</p>
        <button type="button" onClick={() => window.location.reload()} className={buttonClass}>
          Recargar página
        </button>
      </Overlay>
    );
  }

  return (
    <div className="relative h-full w-full">
      {defined && (
        <model-viewer
          key={attempt}
          ref={viewerRef}
          src={src}
          alt={alt}
          poster={poster ?? undefined}
          camera-controls
          touch-action="pan-y"
          interaction-prompt="auto"
          auto-rotate={autoRotate && !reducedMotion}
          auto-rotate-delay={1500}
          rotation-per-second="20deg"
          skybox-image={environment.skyboxUrl}
          skybox-height={environment.skyboxHeight}
          environment-image={environment.lightingUrl}
          exposure={environment.exposure}
          shadow-intensity={1}
          shadow-softness={0.8}
          camera-orbit="0deg 80deg auto"
          min-camera-orbit="auto 10deg auto"
          max-camera-orbit="auto 95deg auto"
          className="block h-full w-full bg-neutral-950"
        />
      )}

      {status.kind === "loading" && (
        <Overlay passive>
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-3"
          >
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-orange-400 motion-reduce:animate-none" />
            <span>
              Cargando modelo
              {status.progress !== null ? ` ${Math.round(status.progress * 100)}%` : "…"}
            </span>
          </div>
        </Overlay>
      )}

      {status.kind === "error" && (
        <Overlay>
          <p role="alert">{status.message}</p>
          <button type="button" onClick={retry} className={buttonClass}>
            Reintentar
          </button>
        </Overlay>
      )}
    </div>
  );
}

const buttonClass =
  "min-h-12 rounded-full bg-orange-500 px-6 font-semibold text-black hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function Overlay({
  children,
  passive = false,
}: {
  children: React.ReactNode;
  passive?: boolean;
}) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-950/70 p-6 text-center text-white ${
        passive ? "pointer-events-none" : ""
      }`}
    >
      {children}
    </div>
  );
}
