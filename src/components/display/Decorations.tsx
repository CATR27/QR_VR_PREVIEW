import type { CSSProperties } from "react";

/** Decoración puramente visual de la pantalla; todo va con aria-hidden. */

type BatProps = { top: string; duration: string; delay: string; scale: number };

const BATS: BatProps[] = [
  { top: "10%", duration: "18s", delay: "0s", scale: 1.2 },
  { top: "22%", duration: "24s", delay: "-8s", scale: 0.7 },
  { top: "6%", duration: "15s", delay: "-4s", scale: 0.9 },
  { top: "35%", duration: "28s", delay: "-15s", scale: 0.55 },
  { top: "16%", duration: "21s", delay: "-11s", scale: 1 },
];

function Bat({ top, duration, delay, scale }: BatProps) {
  const style = { top, "--d": duration, "--delay": delay, "--s": scale } as CSSProperties;
  return (
    <div className="hw-bat absolute left-0" style={style}>
      <svg viewBox="0 0 64 32" className="hw-bat-wings h-8 w-16 fill-black drop-shadow-[0_0_6px_rgba(124,58,237,0.6)]">
        <path d="M32 12c-2-4-3-6-3-8 1 1 2 2 3 2s2-1 3-2c0 2-1 4-3 8zM30 13C24 4 12 2 0 8c7 1 10 5 11 10 3-3 7-3 9 0 2-3 6-4 9-1l1-4zm4 0c6-9 18-11 30-5-7 1-10 5-11 10-3-3-7-3-9 0-2-3-6-4-9-1l-1-4zM30 13h4l1 9-3 6-3-6z" />
      </svg>
    </div>
  );
}

function Ghost({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 60 72" className={`hw-ghost absolute ${className}`}>
      <path
        d="M30 2C14 2 4 15 4 32v36l8-7 8 7 10-8 10 8 8-7 8 7V32C56 15 46 2 30 2z"
        fill="#f5f3ff"
        fillOpacity="0.85"
      />
      <ellipse cx="21" cy="30" rx="4" ry="6" fill="#1a0829" />
      <ellipse cx="39" cy="30" rx="4" ry="6" fill="#1a0829" />
      <ellipse cx="30" cy="46" rx="5" ry="6" fill="#1a0829" />
    </svg>
  );
}

export function Pumpkin({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 90" className={`hw-candle ${className}`}>
      <path d="M50 18c0-8 4-14 12-15" stroke="#3f6212" strokeWidth="6" fill="none" strokeLinecap="round" />
      <ellipse cx="30" cy="54" rx="24" ry="33" fill="#c2410c" />
      <ellipse cx="70" cy="54" rx="24" ry="33" fill="#c2410c" />
      <ellipse cx="50" cy="54" rx="26" ry="35" fill="#f97316" />
      <path d="M26 44h14l-7-12zM60 44h14l-7-12z" fill="#fde047" />
      <path d="M24 60l7 7 7-5 6 7 6-7 6 7 6-7 7 5 7-7-4 15H28z" fill="#fde047" />
    </svg>
  );
}

function Moon() {
  return (
    <div className="absolute right-[6%] top-[6%] h-[16vh] w-[16vh] rounded-full bg-[radial-gradient(circle_at_35%_35%,#fffbeb,#fde68a_55%,#f59e0b)] shadow-[0_0_80px_30px_rgba(253,230,138,0.25)]">
      <span className="absolute left-[55%] top-[25%] h-[18%] w-[18%] rounded-full bg-amber-300/50" />
      <span className="absolute left-[25%] top-[55%] h-[12%] w-[12%] rounded-full bg-amber-300/50" />
    </div>
  );
}

function Fog() {
  const layer =
    "absolute bottom-0 left-0 h-[30vh] w-[200%] bg-[radial-gradient(ellipse_25%_60%_at_25%_100%,rgba(196,181,253,0.22),transparent),radial-gradient(ellipse_25%_60%_at_75%_100%,rgba(196,181,253,0.22),transparent)] blur-2xl";
  return (
    <>
      <div className={`hw-fog ${layer}`} style={{ "--d": "45s" } as CSSProperties} />
      <div className={`hw-fog ${layer} opacity-70`} style={{ "--d": "70s", bottom: "-6vh" } as CSSProperties} />
    </>
  );
}

export function Decorations() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="hw-sky hw-twinkle absolute inset-0" />
      <Moon />
      {BATS.map((b, i) => (
        <Bat key={i} {...b} />
      ))}
      <Ghost className="left-[26%] top-[8%] w-[7vh]" />
      <Ghost className="right-[3%] top-[45%] w-[5vh] [animation-delay:-3s]" />
      <Fog />
      <Pumpkin className="absolute bottom-[2vh] left-[2vw] w-[12vh]" />
      <Pumpkin className="absolute bottom-[1vh] left-[9vw] w-[8vh] [animation-delay:-1s]" />
      <Pumpkin className="absolute bottom-[2vh] right-[2vw] w-[11vh] [animation-delay:-0.5s]" />
    </div>
  );
}

/** Araña que cuelga de su hilo sobre la tarjeta del QR. */
export function Spider({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`hw-spider pointer-events-none absolute ${className}`}>
      <div className="mx-auto h-[6vh] w-px bg-white/60" />
      <svg viewBox="0 0 40 36" className="w-[4.5vh]">
        <g stroke="#0a0a0a" strokeWidth="2.2" fill="none" strokeLinecap="round">
          <path d="M14 16L4 8M14 19L2 18M14 22L4 30M15 24l-6 10M26 16l10-8M26 19l12-1M26 22l10 8M25 24l6 10" />
        </g>
        <ellipse cx="20" cy="20" rx="8" ry="9" fill="#0a0a0a" />
        <circle cx="20" cy="10" r="5" fill="#0a0a0a" />
        <circle cx="18" cy="9" r="1.3" fill="#f97316" />
        <circle cx="22" cy="9" r="1.3" fill="#f97316" />
      </svg>
    </div>
  );
}
