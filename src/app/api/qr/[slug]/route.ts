import { getAppOrigin } from "@/lib/env";
import { getPublishedExperience } from "@/lib/experiences/repository";
import { buildExperienceUrl, renderHalloweenQRSvg, renderQR } from "@/lib/qr";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/qr/[slug]">,
) {
  const { slug } = await ctx.params;
  const experience = await getPublishedExperience(slug);
  if (!experience) {
    return new Response("No encontrado", { status: 404 });
  }

  const search = new URL(request.url).searchParams;
  const format = search.get("format") ?? "png";
  const style = search.get("style") ?? "plain";
  if (format !== "png" && format !== "svg") {
    return new Response("format debe ser png o svg", { status: 400 });
  }
  if (style !== "plain" && style !== "halloween") {
    return new Response("style debe ser plain o halloween", { status: 400 });
  }
  if (style === "halloween" && format !== "svg") {
    return new Response("el estilo halloween sólo está disponible en svg", { status: 400 });
  }

  // `size` (cm): tamaño impreso del símbolo QR; sólo para el SVG Halloween.
  const sizeParam = search.get("size");
  const sizeCm = sizeParam ? Number(sizeParam) : undefined;
  if (sizeCm !== undefined && (!Number.isFinite(sizeCm) || sizeCm < 5 || sizeCm > 300 || style !== "halloween")) {
    return new Response("size (cm) debe estar entre 5 y 300 y requiere style=halloween", { status: 400 });
  }

  const url = buildExperienceUrl(getAppOrigin(), experience.slug);
  const body =
    style === "halloween" ? renderHalloweenQRSvg(url, sizeCm) : await renderQR(url, format);
  const suffix = (style === "halloween" ? "-halloween" : "") + (sizeCm ? `-${sizeCm}cm` : "");

  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": format === "svg" ? "image/svg+xml" : "image/png",
      "Content-Disposition": `attachment; filename="qr-${experience.slug}${suffix}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
