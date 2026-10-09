import type { Metadata } from "next";
import { Creepster } from "next/font/google";
import { notFound } from "next/navigation";
import QrScanner from "@/components/scanner/QrScanner";
import { getPublishedExperience, listPublishedExperiences } from "@/lib/experiences/repository";

const creepster = Creepster({ weight: "400", subsets: ["latin"] });

// Sólo existen los slugs del catálogo; cualquier otro responde 404 real (sin streaming con estado 200).
export const dynamicParams = false;

export async function generateStaticParams() {
  const experiences = await listPublishedExperiences();
  return experiences.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/ar/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const experience = await getPublishedExperience(slug);
  if (!experience) return {};
  return { title: experience.name, description: experience.description };
}

/** Destino del QR impreso: "Toca para activar la AR" y el personaje sale del propio QR. */
export default async function ExperiencePage({ params }: PageProps<"/ar/[slug]">) {
  const { slug } = await params;
  const experience = await getPublishedExperience(slug);
  if (!experience) notFound();

  return (
    <QrScanner
      creepsterClass={creepster.className}
      allowedOrigins={[]}
      onlySlug={experience.slug}
      viewerHref={`/ar/${experience.slug}/visor`}
      experiences={[
        {
          slug: experience.slug,
          name: experience.name,
          glbUrl: experience.glbUrl,
          game: experience.game,
          anchor: experience.anchor,
        },
      ]}
    />
  );
}
