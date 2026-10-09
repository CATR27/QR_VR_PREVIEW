import type { Metadata } from "next";
import { Creepster } from "next/font/google";
import { headers } from "next/headers";
import QrScanner from "@/components/scanner/QrScanner";
import { getAppOrigin } from "@/lib/env";
import { listPublishedExperiences } from "@/lib/experiences/repository";

const creepster = Creepster({ weight: "400", subsets: ["latin"] });

// El origen aceptado depende de APP_ORIGIN y del host de la petición.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Escanear · Despierta al personaje" };

export default async function ScanPage() {
  const experiences = await listPublishedExperiences();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const allowedOrigins = [...new Set([getAppOrigin(), host ? `${proto}://${host}` : null].filter((o): o is string => !!o))];

  return (
    <QrScanner
      creepsterClass={creepster.className}
      allowedOrigins={allowedOrigins}
      experiences={experiences.map((e) => ({
        slug: e.slug,
        name: e.name,
        glbUrl: e.glbUrl,
        game: e.game,
        anchor: e.anchor,
      }))}
    />
  );
}
