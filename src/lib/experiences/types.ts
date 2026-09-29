import { z } from "zod";

export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug inválido");

export const environmentSchema = z.object({
  /** Imagen equirectangular (HDR o JPG) mostrada como fondo 360°. */
  skyboxUrl: z.string(),
  /** Iluminación del modelo; si se omite se usa el propio skybox. */
  lightingUrl: z.string().optional(),
  /** Altura de proyección del suelo del skybox (p. ej. "1.5m"); vacío = esfera infinita. */
  skyboxHeight: z.string().optional(),
  exposure: z.number().positive().default(1),
  credit: z.string(),
});

export const experienceSchema = z.object({
  id: z.string(),
  slug: slugSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  /** null = archivo pendiente; nunca apuntar a un archivo inexistente. */
  glbUrl: z.string().nullable(),
  posterUrl: z.string().nullable().optional(),
  environment: environmentSchema,
  autoRotate: z.boolean(),
  active: z.boolean(),
  assetVersion: z.string(),
});

export type Experience = z.infer<typeof experienceSchema>;
export type ExperienceEnvironment = z.infer<typeof environmentSchema>;
