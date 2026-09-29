import Link from "next/link";
import QRDownload from "@/components/viewer/QRDownload";
import { getAppOrigin, isPrintableOrigin } from "@/lib/env";
import { listPublishedExperiences } from "@/lib/experiences/repository";
import { buildExperienceUrl, renderQR } from "@/lib/qr";

// El QR depende de APP_ORIGIN en tiempo de ejecución.
export const dynamic = "force-dynamic";

export default async function Home() {
  const origin = getAppOrigin();
  const printable = isPrintableOrigin(origin);
  const experiences = await listPublishedExperiences();
  const items = await Promise.all(
    experiences.map(async (e) => {
      const url = buildExperienceUrl(origin, e.slug);
      return { ...e, url, svg: (await renderQR(url, "svg")) as string };
    }),
  );

  return (
    <main className="min-h-dvh bg-neutral-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Modelos 3D</h1>
        <p className="mt-2 text-white/80">
          Escanea el código con la cámara del teléfono para abrir el modelo y
          girarlo en su escenario 360°.
        </p>

        <ul className="mt-8 grid gap-6">
          {items.map((e) => (
            <li
              key={e.id}
              className="flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:items-start"
            >
              <QRDownload
                slug={e.slug}
                name={e.name}
                url={e.url}
                svgMarkup={e.svg}
                printable={printable}
              />
              <div className="flex flex-1 flex-col gap-3">
                <h2 className="text-xl font-semibold">{e.name}</h2>
                {e.description && <p className="text-white/80">{e.description}</p>}
                <Link
                  href={`/ar/${e.slug}`}
                  className="inline-flex min-h-12 w-fit items-center rounded-full bg-orange-500 px-6 font-semibold text-black hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Abrir visor 3D
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
