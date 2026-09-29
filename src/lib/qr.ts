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

export async function renderQR(
  text: string,
  format: QRFormat,
): Promise<string | Buffer> {
  if (format === "svg") {
    return QRCode.toString(text, { ...QR_OPTIONS, type: "svg" });
  }
  return QRCode.toBuffer(text, { ...QR_OPTIONS, type: "png", width: 1024 });
}
