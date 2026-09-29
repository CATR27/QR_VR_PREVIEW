"use client";

import { useEffect, useRef, useState } from "react";
import type { ModelViewerElement } from "@google/model-viewer";
import { useModelViewerDefined, usePrefersReducedMotion } from "@/components/viewer/hooks";

/** Modelo girando sin controles para la pantalla de exhibición. Si falla, simplemente no se muestra. */
export default function ModelShowcase({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<ModelViewerElement>(null);
  const defineState = useModelViewerDefined();
  const reducedMotion = usePrefersReducedMotion();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
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

  if (defineState === "error" || failed) return null;

  return (
    <div
      className={`hw-float h-full w-full transition-opacity duration-1000 ${loaded ? "opacity-100" : "opacity-0"}`}
    >
      {defineState === "ready" && (
        <model-viewer
          ref={ref}
          src={src}
          alt={alt}
          auto-rotate={!reducedMotion}
          auto-rotate-delay={0}
          rotation-per-second="30deg"
          interaction-prompt="none"
          environment-image="neutral"
          exposure={1.1}
          shadow-intensity={1.2}
          shadow-softness={1}
          camera-orbit="0deg 78deg auto"
          className="block h-full w-full"
        />
      )}
    </div>
  );
}
