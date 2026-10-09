"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type ScanHit = { value: string; corners: { x: number; y: number }[] };

export type CameraError = "denied" | "unavailable" | "insecure" | "unknown";

type Detector = { detect(source: ImageBitmapSource): Promise<{ rawValue: string; cornerPoints: { x: number; y: number }[] }[]> };

const SCAN_INTERVAL_MS = 110; // ~9 fps: de sobra para un QR y no calienta el teléfono
const MAX_SIDE = 640; // se reduce el cuadro antes de decodificar

async function createDetector(): Promise<Detector> {
  const native = (window as unknown as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector;
  if (native) {
    try {
      return new native({ formats: ["qr_code"] });
    } catch {
      /* el navegador no soporta qr_code: se usa el respaldo */
    }
  }
  // Safari/iOS y Firefox no traen BarcodeDetector: ZXing en WASM, servido desde nuestro propio sitio.
  const mod = await import("barcode-detector/ponyfill");
  mod.prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? `/vendor/${path}` : prefix + path,
    },
  });
  return new mod.BarcodeDetector({ formats: ["qr_code"] }) as unknown as Detector;
}

/**
 * Abre la cámara trasera dentro del <video> y avisa cuando lee un QR.
 * `start()` debe llamarse desde un toque del usuario (iOS lo exige).
 */
export function useQrScan(videoRef: RefObject<HTMLVideoElement | null>, onHit: (hit: ScanHit) => void) {
  const [error, setError] = useState<CameraError | null>(null);
  const [active, setActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const busyRef = useRef(false);
  const scanningRef = useRef(false);
  const tickRef = useRef<() => void>(() => {});
  const onHitRef = useRef(onHit);
  useEffect(() => {
    onHitRef.current = onHit;
  });

  const stopLoop = useCallback(() => {
    scanningRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    setActive(false);
  }, [stopLoop, videoRef]);

  const tick = useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!scanningRef.current || !video || !detector) return;
    if (!busyRef.current && video.readyState >= 2 && video.videoWidth > 0) {
      busyRef.current = true;
      try {
        const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);
        const canvas = (canvasRef.current ??= document.createElement("canvas"));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const found = await detector.detect(canvas);
          if (found.length > 0 && scanningRef.current) {
            const f = found[0];
            // Esquinas normalizadas 0..1 respecto al cuadro de video.
            const corners = (f.cornerPoints ?? []).map((p) => ({ x: p.x / w, y: p.y / h }));
            scanningRef.current = false;
            onHitRef.current({ value: f.rawValue, corners });
          }
        }
      } catch {
        /* un cuadro fallido no detiene el escaneo */
      } finally {
        busyRef.current = false;
      }
    }
    if (scanningRef.current) timerRef.current = window.setTimeout(() => tickRef.current(), SCAN_INTERVAL_MS);
  }, [videoRef]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  /** Reanuda la búsqueda de QR sin cerrar la cámara (p. ej. "Escanear otro"). */
  const resume = useCallback(() => {
    if (!streamRef.current || scanningRef.current) return;
    scanningRef.current = true;
    timerRef.current = window.setTimeout(() => tickRef.current(), SCAN_INTERVAL_MS);
  }, []);

  const pause = stopLoop;

  const start = useCallback(async () => {
    setError(null);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("insecure");
      return false;
    }
    try {
      const [stream, detector] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        }),
        detectorRef.current ? Promise.resolve(detectorRef.current) : createDetector(),
      ]);
      detectorRef.current = detector;
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      video.srcObject = stream;
      await video.play();
      setActive(true);
      resume();
      return true;
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError"
            ? "unavailable"
            : "unknown",
      );
      return false;
    }
  }, [resume, videoRef]);

  // Liberar la cámara al ocultar la pestaña o salir de la página.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") stopCamera();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stopCamera();
    };
  }, [stopCamera]);

  return { start, stopCamera, pause, resume, error, active };
}
