import type { Prize } from "@/lib/experiences/types";

// Sin 0/O ni 1/I/L para que el código se lea sin dudas en el stand.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export type WonPrize = Prize & { code: string; wonAt: string };

export function drawPrize(prizes: readonly Prize[], random: () => number = Math.random): Prize {
  const total = prizes.reduce((sum, p) => sum + p.weight, 0);
  let roll = random() * total;
  for (const prize of prizes) {
    roll -= prize.weight;
    if (roll < 0) return prize;
  }
  return prizes[prizes.length - 1];
}

export function makePrizeCode(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const body = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `${prefix}-${body}`;
}

const storageKey = (slug: string) => `hw-prize:${slug}`;

/** Recuerda el premio en este navegador para que recargar no dé otro (no es una protección real). */
export function loadSavedPrize(slug: string): WonPrize | null {
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as WonPrize) : null;
  } catch {
    return null;
  }
}

export function savePrize(slug: string, prize: WonPrize): void {
  try {
    window.localStorage.setItem(storageKey(slug), JSON.stringify(prize));
  } catch {
    // Sin almacenamiento (modo privado): el premio sólo vive en esta visita.
  }
}
