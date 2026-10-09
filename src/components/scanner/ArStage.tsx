"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import BurstGame, { type BurstAdapter } from "@/components/viewer/BurstGame";
import type { Point } from "@/lib/ar/pose";
import type { ScannerExperience } from "./SummonReveal";
import type { ArScene } from "./arScene";

type Props = {
  video: HTMLVideoElement;
  experience: ScannerExperience;
  /** QrScanner llama a esta función con las esquinas del QR en cada detección. */
  sinkRef: MutableRefObject<((corners: Point[]) => void) | null>;
  reducedMotion: boolean;
  /** WebGL o el modelo fallaron: QrScanner pasa al modo flotante. */
  onFailed: () => void;
};

/** Capa three.js sobre el video: el personaje queda anclado al QR físico. */
export default function ArStage({ video, experience, sinkRef, reducedMotion, onFailed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const failedRef = useRef(onFailed);
  useEffect(() => {
    failedRef.current = onFailed;
  });
  const [adapter, setAdapter] = useState<BurstAdapter | null>(null);
  const [visible, setVisible] = useState(false);
  const [everSeen, setEverSeen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !experience.glbUrl) {
      failedRef.current();
      return;
    }
    let disposed = false;
    let scene: ArScene | null = null;
    let ro: ResizeObserver | null = null;
    const onResize = () => scene?.resize();

    import("./arScene")
      .then(({ createArScene }) => {
        if (disposed) return;
        scene = createArScene({
          canvas,
          video,
          modelUrl: experience.glbUrl!,
          anchor: experience.anchor,
          reducedMotion,
          onPresence: (v) => {
            setVisible(v);
            if (v) setEverSeen(true);
          },
          onError: () => failedRef.current(),
        });
        sinkRef.current = (c) => scene?.feed(c);
        setAdapter(scene.adapter);
        scene.resize();
        ro = new ResizeObserver(onResize);
        ro.observe(video);
        window.addEventListener("resize", onResize);
        window.addEventListener("orientationchange", onResize);
        video.addEventListener("loadedmetadata", onResize);
      })
      .catch(() => failedRef.current());

    return () => {
      disposed = true;
      sinkRef.current = null;
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      video.removeEventListener("loadedmetadata", onResize);
      scene?.dispose();
      setAdapter(null);
    };
  }, [video, experience, sinkRef, reducedMotion]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute touch-none select-none [-webkit-touch-callout:none]"
        aria-label={`${experience.name} en realidad aumentada sobre el código QR`}
      />
      {adapter && experience.game?.enabled && (
        <BurstGame
          adapter={adapter}
          game={experience.game}
          slug={experience.slug}
          arPresenting={false}
          reducedMotion={reducedMotion}
        />
      )}
      {everSeen && !visible && (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-6 top-[max(8.5rem,env(safe-area-inset-top))] mx-auto max-w-sm rounded-2xl bg-black/70 p-3 text-center text-sm text-amber-200 backdrop-blur"
        >
          Perdimos el QR. Apúntalo de frente, a 1–4 metros, para que el personaje vuelva. 🎯
        </p>
      )}
    </div>
  );
}
