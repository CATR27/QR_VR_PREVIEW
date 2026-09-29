import { localCatalog } from "./local-catalog";
import { slugSchema, type Experience } from "./types";

/**
 * Contrato estable del catálogo. Hoy lee la configuración local;
 * en una fase futura puede leer PostgreSQL sin cambiar a quien lo llama.
 */
export async function getPublishedExperience(
  slug: string,
): Promise<Experience | null> {
  if (!slugSchema.safeParse(slug).success) return null;
  return localCatalog.find((e) => e.slug === slug && e.active) ?? null;
}

export async function listPublishedExperiences(): Promise<Experience[]> {
  return localCatalog.filter((e) => e.active);
}
