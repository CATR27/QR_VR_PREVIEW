import { z } from "zod";

const originSchema = z
  .url()
  .transform((value) => new URL(value).origin);

/**
 * Origen público de la app, usado para construir las URLs de los QR.
 * En desarrollo cae a localhost; un QR con ese origen no sirve para imprimir.
 */
export function getAppOrigin(): string {
  const raw = process.env.APP_ORIGIN?.trim();
  if (raw) return originSchema.parse(raw);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export function isPrintableOrigin(origin: string): boolean {
  const url = new URL(origin);
  return (
    url.protocol === "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  );
}
