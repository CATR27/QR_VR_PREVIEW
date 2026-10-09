import QRCode from "qrcode";

export type QRFormat = "png" | "svg";

const QR_OPTIONS = {
  errorCorrectionLevel: "M",
  margin: 4, // zona blanca mínima de 4 módulos
  color: { dark: "#000000", light: "#ffffff" },
} as const;

export function buildExperienceUrl(origin: string, slug: string): string {
  return new URL(`/ar/${encodeURIComponent(slug)}`, origin).toString();
}

const HALLOWEEN = {
  dark: "#1a0829", // morado casi negro: contraste alto sobre crema
  light: "#fff5e6",
  margin: 4,
} as const;

/**
 * QR decorado para la pantalla de exhibición. Mantiene lo que los lectores necesitan:
 * módulos oscuros sobre fondo claro, zona blanca de 4 módulos y corrección H para
 * la calabaza del centro (tapa ~5% del área; H tolera hasta ~30%).
 */
export function renderHalloweenQRSvg(text: string, printSymbolCm?: number): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const isDark = (r: number, c: number) => qr.modules.get(r, c) === 1;
  const m = HALLOWEEN.margin;
  const total = n + m * 2;

  // Hueco central impar para la calabaza (~22% del lado).
  let hole = Math.round(n * 0.22);
  if (hole % 2 === 0) hole += 1;
  const holeStart = Math.floor((n - hole) / 2);
  const inHole = (r: number, c: number) =>
    r >= holeStart && r < holeStart + hole && c >= holeStart && c < holeStart + hole;

  const finders = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];
  const inFinder = (r: number, c: number) =>
    finders.some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);

  const parts: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!isDark(r, c) || inFinder(r, c) || inHole(r, c)) continue;
      parts.push(
        `<rect x="${c + m + 0.05}" y="${r + m + 0.05}" width="0.9" height="0.9" rx="0.3"/>`,
      );
    }
  }

  const finderSvg = finders
    .map(([fr, fc]) => {
      const x = fc + m;
      const y = fr + m;
      return (
        `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.6" fill="none" stroke="${HALLOWEEN.dark}" stroke-width="1"/>` +
        `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="${HALLOWEEN.dark}"/>`
      );
    })
    .join("");

  const cx = total / 2;
  const s = hole; // lado del hueco en módulos
  const pumpkin = `
    <g transform="translate(${cx} ${cx}) scale(${s / 24})">
      <rect x="-12" y="-12" width="24" height="24" rx="5" fill="${HALLOWEEN.light}"/>
      <path d="M0.5 -8.5 C0.5 -10.5 2 -11.5 3.5 -11" stroke="#3f6212" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="-4.2" cy="1" rx="5.2" ry="8" fill="#ea580c"/>
      <ellipse cx="4.2" cy="1" rx="5.2" ry="8" fill="#ea580c"/>
      <ellipse cx="0" cy="1" rx="5.6" ry="8.6" fill="#f97316"/>
      <path d="M-5.5 -1.5 L-2.2 -1.5 L-3.85 -4.5 Z M5.5 -1.5 L2.2 -1.5 L3.85 -4.5 Z" fill="${HALLOWEEN.dark}"/>
      <path d="M-6 2.5 L-4 4.5 L-2 3 L0 5 L2 3 L4 4.5 L6 2.5 L5 6.5 L-5 6.5 Z" fill="${HALLOWEEN.dark}"/>
    </g>`;

  // Para imprimir: el SÍMBOLO (sin zona blanca) mide `printSymbolCm`; el lienzo completo es proporcionalmente mayor.
  const physical = printSymbolCm ? ` width="${((printSymbolCm * total) / n).toFixed(2)}cm" height="${((printSymbolCm * total) / n).toFixed(2)}cm"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg"${physical} viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision"><rect width="${total}" height="${total}" fill="${HALLOWEEN.light}"/><g fill="${HALLOWEEN.dark}">${parts.join("")}</g>${finderSvg}${pumpkin}</svg>`;
}

export async function renderQR(
  text: string,
  format: QRFormat,
): Promise<string | Buffer> {
  if (format === "svg") {
    return QRCode.toString(text, { ...QR_OPTIONS, type: "svg" });
  }
  return QRCode.toBuffer(text, { ...QR_OPTIONS, type: "png", width: 1024 });
}
