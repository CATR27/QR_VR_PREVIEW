"use client";

import { useEffect, useState } from "react";

/** Botón discreto para poner la pantalla en modo completo; se oculta al entrar. */
export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (isFullscreen) return null;

  return (
    <button
      type="button"
      onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
      className="absolute right-3 top-3 z-20 rounded-full bg-white/10 px-4 py-2 text-sm text-white/70 opacity-40 backdrop-blur transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white"
    >
      Pantalla completa
    </button>
  );
}
