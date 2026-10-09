/**
 * Valida el texto de un QR leído por la cámara: sólo aceptamos enlaces `/ar/<slug>` de nuestro
 * propio sitio y de una experiencia publicada. Cualquier otra cosa se ignora (nunca se navega).
 */
export function resolveScannedExperience(
  raw: string,
  slugs: readonly string[],
  allowedOrigins: readonly string[],
): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!allowedOrigins.includes(url.origin)) return null;

  const match = /^\/ar\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(url.pathname);
  if (!match) return null;
  return slugs.includes(match[1]) ? match[1] : null;
}
