import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ModelViewer from "@/components/viewer/ModelViewer";
import {
  getPublishedExperience,
  listPublishedExperiences,
} from "@/lib/experiences/repository";

// Sólo existen los slugs del catálogo; cualquier otro responde 404 real (sin streaming con estado 200).
export const dynamicParams = false;

export async function generateStaticParams() {
  const experiences = await listPublishedExperiences();
  return experiences.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/ar/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const experience = await getPublishedExperience(slug);
  if (!experience) return {};
  return { title: experience.name, description: experience.description };
}

export default async function ExperiencePage({
  params,
}: PageProps<"/ar/[slug]">) {
  const { slug } = await params;
  const experience = await getPublishedExperience(slug);
  if (!experience) notFound();

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-neutral-950 text-white">
      {experience.glbUrl ? (
        <ModelViewer
          src={experience.glbUrl}
          alt={`${experience.name} en 3D`}
          poster={experience.posterUrl}
          environment={experience.environment}
          ar={experience.ar}
          game={experience.game}
          slug={experience.slug}
          autoRotate={experience.autoRotate}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center">
          <p>
            El modelo 3D de <strong>{experience.name}</strong> todavía no está
            disponible. Vuelve a intentarlo más tarde.
          </p>
        </div>
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4 pb-10">
        <div>
          <h1 className="text-lg font-bold sm:text-2xl">{experience.name}</h1>
          <p className="text-sm text-white/80">
            Arrastra para girar · pellizca o usa la rueda para acercar
          </p>
        </div>
        <Link
          href="/"
          className="pointer-events-auto rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
        >
          Inicio
        </Link>
      </header>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8 text-center text-xs text-white/70">
        {experience.environment.credit}
      </footer>
    </main>
  );
}
