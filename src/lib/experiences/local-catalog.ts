import { experienceSchema, type Experience } from "./types";

const rawCatalog: unknown[] = [
  {
    id: "exp_pumpkin_witch_droid",
    slug: "pumpkin-witch-droid",
    name: "Pumpkin Witch Droid",
    description:
      "Personaje de Halloween creado en Meshy. Gíralo, acércalo y colócalo en tu espacio con realidad aumentada.",
    glbUrl: "/models/pumpkin-witch-droid/model-v2.glb",
    posterUrl: null,
    environment: {
      skyboxUrl: "/environments/satara-night/satara_night_2k.hdr",
      skyboxHeight: "0.25m",
      exposure: 1.4,
      credit: "HDRI “Satara Night” por Greg Zaal — Poly Haven (CC0)",
    },
    heightMeters: 0.3,
    ar: {
      enabled: true,
      placement: "floor",
      allowScaling: true,
      usdzUrl: null,
    },
    autoRotate: true,
    active: true,
    assetVersion: "v2",
  },
];

// Validar al cargar el módulo: un error en el catálogo debe fallar el build, no la página en producción.
export const localCatalog: readonly Experience[] = rawCatalog.map((entry) =>
  experienceSchema.parse(entry),
);
