import type { Metadata } from "next";
import { Creepster } from "next/font/google";
import { notFound } from "next/navigation";
import { Decorations, Pumpkin, Spider } from "@/components/display/Decorations";
import FullscreenButton from "@/components/display/FullscreenButton";
import ModelShowcase from "@/components/display/ModelShowcase";
import { getAppOrigin, isPrintableOrigin } from "@/lib/env";
import { getPublishedExperience } from "@/lib/experiences/repository";
import { buildExperienceUrl, renderHalloweenQRSvg } from "@/lib/qr";

const creepster = Creepster({ weight: "400", subsets: ["latin"] });

// El QR depende de APP_ORIGIN en tiempo de ejecución.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/pantalla/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const experience = await getPublishedExperience(slug);
  return experience ? { title: `Pantalla · ${experience.name}` } : {};
}

const STEPS = [
  { icon: "📱", text: "Abre la cámara de tu celular" },
  { icon: "🎯", text: "Apunta al código QR" },
  { icon: "🎃", text: "Toca «Ver en tu espacio»" },
];

export default async function DisplayPage({ params }: PageProps<"/pantalla/[slug]">) {
  const { slug } = await params;
  const experience = await getPublishedExperience(slug);
  if (!experience) notFound();

  const origin = getAppOrigin();
  const url = buildExperienceUrl(origin, experience.slug);
  const qrSvg = renderHalloweenQRSvg(url);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#05010a] text-white">
      <Decorations />
      <FullscreenButton />

      <div className="relative z-10 grid h-full grid-cols-1 items-center gap-[3vh] px-[4vw] py-[4vh] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-[3vw]">
        {/* Texto */}
        <section className="flex flex-col items-center gap-[3vh] text-center lg:items-start lg:text-left">
          <h1
            className={`${creepster.className} hw-flicker text-[clamp(2.5rem,8vh,7rem)] leading-none text-orange-500`}
          >
            ¿Te atreves?
          </h1>
          <p className="max-w-[28ch] text-[clamp(1.1rem,3vh,2.2rem)] font-semibold leading-tight text-orange-100">
            Escanea y trae al <span className="text-orange-400">{experience.name}</span> a tu mundo
            en realidad aumentada
          </p>
          <ol className="flex flex-col gap-[1.6vh]">
            {STEPS.map((step, i) => (
              <li
                key={step.text}
                className="flex items-center gap-4 rounded-2xl border border-purple-400/30 bg-purple-950/50 px-5 py-[1.4vh] text-[clamp(1rem,2.4vh,1.7rem)] backdrop-blur"
              >
                <span className="flex h-[5vh] w-[5vh] min-w-9 min-h-9 items-center justify-center rounded-full bg-orange-500 font-bold text-black">
                  {i + 1}
                </span>
                <span aria-hidden="true">{step.icon}</span>
                {step.text}
              </li>
            ))}
          </ol>
        </section>

        {/* QR */}
        <section className="relative flex flex-col items-center">
          {/* Fuera de la tarjeta: nada debe tapar los módulos del QR. */}
          <Spider className="-right-[6vh] top-0 z-20" />
          <div className="hw-glow relative rounded-[2.5vh] border-4 border-orange-500 bg-[#fff5e6] p-[1.5vh]">
            <div
              role="img"
              aria-label={`Código QR para abrir ${experience.name}`}
              className="h-[min(58vh,80vw)] w-[min(58vh,80vw)] lg:h-[min(58vh,34vw)] lg:w-[min(58vh,34vw)] [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>
          <p
            className={`${creepster.className} mt-[2.5vh] flex items-center gap-3 text-[clamp(1.5rem,4.5vh,3.5rem)] text-orange-400`}
          >
            <span className="hw-arrow inline-block" aria-hidden="true">👉</span>
            ¡Escanéame!
            <span className="inline-block -scale-x-100" aria-hidden="true">
              <span className="hw-arrow inline-block">👉</span>
            </span>
          </p>
          {!isPrintableOrigin(origin) && (
            <p className="mt-2 max-w-sm text-center text-sm text-amber-300">
              Origen local ({origin}): este QR sólo sirve en esta red.
            </p>
          )}
        </section>

        {/* Modelo 3D */}
        <section className="relative hidden h-[70vh] lg:block">
          {experience.glbUrl ? (
            <ModelShowcase src={experience.glbUrl} alt={`${experience.name} girando`} />
          ) : (
            <Pumpkin className="mx-auto mt-[20vh] w-[30vh]" />
          )}
        </section>
      </div>
    </main>
  );
}
