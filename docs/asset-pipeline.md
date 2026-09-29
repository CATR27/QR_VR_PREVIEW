# Preparación de activos

## Modelo

Original (no publicado, en `.gitignore`): `assets-src/pumpkin-witch-droid-original.glb`
(renombrado desde `Meshy_AI_Pumpkin_Witch_Droid_0929193220_texture.glb`).

| | Original | Publicado (`public/models/pumpkin-witch-droid/model-v2.glb`) |
|---|---|---|
| Peso | 29.57 MB | 2.08 MB |
| Tamaño real | 1.63 × 1.90 × 1.17 m | 0.26 × **0.30** × 0.19 m (ancho × alto × fondo) |
| Triángulos | 809,534 | 48,568 |
| Vértices | 435,647 | 40,279 |
| Texturas | 3 × JPEG (color, normal, metal/rugosidad) | 3 × WebP 2048×2048 |
| Materiales / mallas | 1 / 1 | 1 / 1 |
| Compresión de geometría | — | ninguna (sin Draco/Meshopt) |

Comandos usados:

```bash
npx gltf-transform optimize assets-src/pumpkin-witch-droid-original.glb assets-src/tmp-opt.glb \
  --compress false --simplify-ratio 0.06 --simplify-error 0.01 \
  --texture-compress webp --texture-size 2048
npx gltf-transform center assets-src/tmp-opt.glb public/models/pumpkin-witch-droid/model-v1.glb --pivot below
npx gltf-transform inspect public/models/pumpkin-witch-droid/model-v1.glb
```

`center --pivot below` deja la base del personaje en y = 0 para que se apoye en el suelo del escenario.

Revisión visual en Chrome de escritorio: silueta, sombrero, capa, calabaza y bolso se ven bien a distancia normal. Si al acercar mucho se nota pérdida de detalle, repetir con `--simplify-ratio 0.12` (~100k triángulos).

### Escala para AR (v2)

En AR el modelo aparece con su tamaño real (glTF: 1 unidad = 1 metro), así que se horneó una escala a 0.30 m de alto con la base en el suelo:

```bash
node scripts/scale-model.mjs <glb-optimizado> public/models/pumpkin-witch-droid/model-v2.glb 0.30
```

Factor aplicado: 0.15771. Con `ar-scale="auto"` la gente puede agrandarlo/achicarlo con los dedos. Para otro tamaño, volver a correr el script con otra altura, publicar como `model-v3.glb` y actualizar `glbUrl`, `heightMeters`, `assetVersion` y `skyboxHeight` (≈ 0.83 × altura) en el catálogo.

### iOS (Quick Look)

No hay USDZ explícito (`ar.usdzUrl: null`): model-viewer genera el USDZ desde el GLB en el propio iPhone al pulsar el botón. Si en iPhone falla o se ve distinto, exportar un USDZ desde Meshy o Blender con el mismo tamaño y ponerlo en `ar.usdzUrl`.

## Escenario 360°

- Archivo: `public/environments/satara-night/satara_night_2k.hdr` (7.5 MB, 2048×1024)
- Fuente: [Poly Haven — Satara Night](https://polyhaven.com/a/satara_night), por Greg Zaal, licencia **CC0**.
- Se usa como fondo (`skybox-image`) y como iluminación del modelo.
- `skybox-height="0.25m"` proyecta el suelo del panorama para que el modelo parezca parado sobre él.
- `exposure` 1.4 (en el catálogo) aclara la escena nocturna.

Para cambiar el escenario: descargar otro HDRI de Poly Haven, colocarlo en `public/environments/<nombre>/` y cambiar `environment` en `src/lib/experiences/local-catalog.ts`. Si el HDR pesa mucho para móvil, usar la versión 1k (~1.9 MB) a costa de un fondo más borroso.
