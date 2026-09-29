"use client";

import { useEffect, useRef, useState } from "react";
import type { ModelViewerElement } from "@google/model-viewer";
import type { ExperienceAR, ExperienceEnvironment, ExperienceGame } from "@/lib/experiences/types";
import BurstGame from "./BurstGame";
import {
  useIsInAppBrowser,
  useIsIOS,
  useModelViewerDefined,
  usePrefersReducedMotion,
} from "./hooks";

type Props = {
  src: string;
  alt: string;
  poster?: string | null;
  environment: ExperienceEnvironment;
  ar: ExperienceAR;
  game?: ExperienceGame;
  slug: string;
  autoRotate: boolean;
};

type Status =
  | { kind: "loading"; progress: number | null }
  | { kind: "ready" }
  | { kind: "error"; message: string };

/** Lo que sabemos de la AR: nunca afirmamos que se colocó si el visor no lo confirma. */
type ARState = "unknown" | "available" | "unavailable" | "presenting" | "failed";

type ProgressEvent = CustomEvent<{ totalProgress: number }>;
type ErrorEvent = CustomEvent<{ type?: string }>;
type ARStatusEvent = CustomEvent<{ status: string }>;

/**
 * En iPhone la AR es Quick Look (visor nativo) y la página no recibe toques. Su banner de
 * acción sí: model-viewer copia este #hash del src al USDZ que genera y, al tocar el botón,
 * Quick Look se cierra y emite "quick-look-button-tapped". El hash no viaja en la petición del GLB.
 */
function withQuickLookBanner(src: string, game?: ExperienceGame): string {
  if (!game?.enabled) return src;
  const { callToAction, title, subtitle } = game.quickLookBanner;
  const params = [
    `callToAction=${encodeURIComponent(callToAction)}`,
    `checkoutTitle=${encodeURIComponent(title)}`,
    `checkoutSubtitle=${encodeURIComponent(subtitle)}`,
  ];
  return `${src.split("#")[0]}#${params.join("&")}`;
}

export default function ModelViewer({
  src,
  alt,
  poster,
  environment,
  ar,
  game,
  slug,
  autoRotate,
}: Props) {
  const viewerRef = useRef<ModelViewerElement>(null);
  const defineState = useModelViewerDefined();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: "loading", progress: null });
  const [arState, setArState] = useState<ARState>("unknown");
  const [copied, setCopied] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const inAppBrowser = useIsInAppBrowser();
  const isIOS = useIsIOS();
  const defined = defineState === "ready";

  useEffect(() => {
    const el = viewerRef.current;
    if (!defined || !el) return;

    const onProgress = (e: Event) => {
      const p = (e as ProgressEvent).detail.totalProgress;
      // model-viewer emite un progress final incluso después de un error: no pisar "ready" ni "error".
      setStatus((s) => (s.kind === "loading" ? { kind: "loading", progress: p } : s));
    };
    const onLoad = () => {
      setStatus({ kind: "ready" });
      if (ar.enabled) setArState(el.canActivateAR ? "available" : "unavailable");
    };
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
    const onARStatus = (e: Event) => {
      const s = (e as ARStatusEvent).detail.status;
      if (s === "session-started" || s === "object-placed") setArState("presenting");
      else if (s === "failed") setArState("failed");
      else if (s === "not-presenting") setArState("available");
    };

    el.addEventListener("progress", onProgress);
    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    el.addEventListener("ar-status", onARStatus);
    return () => {
      el.removeEventListener("progress", onProgress);
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
      el.removeEventListener("ar-status", onARStatus);
    };
  }, [defined, attempt, ar.enabled]);

  const retry = () => {
    setStatus({ kind: "loading", progress: null });
    setAttempt((n) => n + 1);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (defineState === "error") {
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
          src={withQuickLookBanner(src, game)}
          ios-src={ar.usdzUrl ?? undefined}
          alt={alt}
          poster={poster ?? undefined}
          ar={ar.enabled}
          ar-modes="webxr scene-viewer quick-look"
          ar-placement={ar.placement}
          ar-scale={ar.allowScaling ? "auto" : "fixed"}
          camera-controls
          touch-action="none"
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
          className="block h-full w-full select-none bg-neutral-950 [-webkit-touch-callout:none] [-webkit-user-select:none]"
        >
          {/* model-viewer sólo muestra este botón si el dispositivo puede abrir AR. */}
          <button
            slot="ar-button"
            type="button"
            className="absolute bottom-16 left-1/2 flex min-h-14 -translate-x-1/2 items-center gap-2 rounded-full bg-orange-500 px-7 text-lg font-bold text-black shadow-[0_0_30px_rgba(249,115,22,0.7)] hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span aria-hidden="true">🎃</span> Ver en tu espacio
          </button>

          {isIOS && game?.enabled && arState === "available" && (
            <p className="pointer-events-none absolute inset-x-4 bottom-[8.25rem] text-center text-sm text-orange-100 [text-shadow:0_1px_4px_#000]">
              En la AR toca <strong>«{game.quickLookBanner.callToAction}»</strong> abajo
            </p>
          )}

          {game?.enabled && status.kind === "ready" && (
            <BurstGame
              viewerRef={viewerRef}
              game={game}
              slug={slug}
              arPresenting={arState === "presenting"}
              reducedMotion={reducedMotion}
            />
          )}
        </model-viewer>
      )}

      {status.kind === "ready" && arState === "unavailable" && (
        <div className="absolute inset-x-4 bottom-14 mx-auto max-w-md rounded-2xl bg-black/70 p-4 text-center text-sm text-white backdrop-blur">
          {inAppBrowser ? (
            <>
              <p>
                Para verlo en realidad aumentada, abre este enlace en{" "}
                <strong>Safari</strong> (iPhone) o <strong>Chrome</strong> (Android).
              </p>
              <button type="button" onClick={copyLink} className={`${buttonClass} mt-3`}>
                {copied ? "¡Enlace copiado!" : "Copiar enlace"}
              </button>
            </>
          ) : (
            <p>
              La realidad aumentada funciona en iPhone/iPad (Safari) y en Android
              compatibles (Chrome). Aquí puedes girarlo en 3D.
            </p>
          )}
        </div>
      )}

      {arState === "failed" && (
        <div
          role="alert"
          className="absolute inset-x-4 bottom-14 mx-auto max-w-md rounded-2xl bg-black/70 p-4 text-center text-sm text-white backdrop-blur"
        >
          No se pudo abrir la realidad aumentada en este dispositivo. Puedes seguir
          viéndolo en 3D.
        </div>
      )}

      {status.kind === "loading" && (
        <Overlay passive>
          <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-orange-400 motion-reduce:animate-none" />
            <span>
              Cargando modelo
              {status.progress ? ` ${Math.round(status.progress * 100)}%` : "…"}
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
