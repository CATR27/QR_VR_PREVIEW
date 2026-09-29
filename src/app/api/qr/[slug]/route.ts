import { getAppOrigin } from "@/lib/env";
import { getPublishedExperience } from "@/lib/experiences/repository";
import { buildExperienceUrl, renderQR } from "@/lib/qr";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/qr/[slug]">,
) {
  const { slug } = await ctx.params;
  const experience = await getPublishedExperience(slug);
  if (!experience) {
    return new Response("No encontrado", { status: 404 });
  }

  const format = new URL(request.url).searchParams.get("format") ?? "png";
  if (format !== "png" && format !== "svg") {
    return new Response("format debe ser png o svg", { status: 400 });
  }

  const url = buildExperienceUrl(getAppOrigin(), experience.slug);
  const body = await renderQR(url, format);

  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": format === "svg" ? "image/svg+xml" : "image/png",
      "Content-Disposition": `attachment; filename="qr-${experience.slug}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
