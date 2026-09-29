# Preparación de activos

## Modelo

Original (no publicado, en `.gitignore`): `assets-src/pumpkin-witch-droid-original.glb`
(renombrado desde `Meshy_AI_Pumpkin_Witch_Droid_0929193220_texture.glb`).

| | Original | Publicado (`public/models/pumpkin-witch-droid/model-v1.glb`) |
|---|---|---|
| Peso | 29.57 MB | 2.08 MB |
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

La escala (1.9 unidades de alto) no se normalizó a 30 cm: sin AR, el tamaño físico no importa; la cámara se ajusta al modelo.

## Escenario 360°

- Archivo: `public/environments/satara-night/satara_night_2k.hdr` (7.5 MB, 2048×1024)
- Fuente: [Poly Haven — Satara Night](https://polyhaven.com/a/satara_night), por Greg Zaal, licencia **CC0**.
- Se usa como fondo (`skybox-image`) y como iluminación del modelo.
- `skybox-height="1.6m"` proyecta el suelo del panorama para que el modelo parezca parado sobre él.
- `exposure` 1.4 (en el catálogo) aclara la escena nocturna.

Para cambiar el escenario: descargar otro HDRI de Poly Haven, colocarlo en `public/environments/<nombre>/` y cambiar `environment` en `src/lib/experiences/local-catalog.ts`. Si el HDR pesa mucho para móvil, usar la versión 1k (~1.9 MB) a costa de un fondo más borroso.
