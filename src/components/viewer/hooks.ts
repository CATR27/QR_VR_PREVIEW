"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type DefineState = "pending" | "ready" | "error";

/** Registra <model-viewer> sólo en el navegador y avisa cuando ya se puede usar. */
export function useModelViewerDefined(): DefineState {
  const [state, setState] = useState<DefineState>("pending");
  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer")
      .then(() => customElements.whenDefined("model-viewer"))
      .then(() => {
        if (!cancelled) setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

const noopSubscribe = () => () => {};
// Navegadores integrados de redes sociales, donde la AR suele no estar disponible.
const IN_APP_BROWSER = /Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|musical_ly|Snapchat|LinkedInApp/i;

export function useIsInAppBrowser(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => IN_APP_BROWSER.test(navigator.userAgent),
    () => false,
  );
}
