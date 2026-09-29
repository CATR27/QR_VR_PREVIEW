# Instalación y despliegue

## Versiones instaladas (29-09-2026)

| Paquete | Versión |
|---|---|
| next | 16.3.7 |
| react / react-dom | 19.2.8 |
| @google/model-viewer | 4.3.1 |
| qrcode | 1.5.4 |
| zod | 4.6.5 |
| typescript | 5.9.3 |
| tailwindcss | 4.3.3 |
| @gltf-transform/cli (dev) | 4.5.1 |

Node 24.19.0, npm 11.17.0.

## Local

```bash
npm install
npm run dev          # desarrollo
npm run build && npm start   # producción
```

Comprobaciones: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Variable de entorno

| Variable | Uso |
|---|---|
| `APP_ORIGIN` | Origen HTTPS público (p. ej. `https://visor.midominio.com`). Se codifica en el QR. |

Sin `APP_ORIGIN`, en Vercel se usa `VERCEL_PROJECT_PRODUCTION_URL`; en local, `http://localhost:3000`. La página de inicio avisa cuando el origen no sirve para imprimir.

## Desplegar en Vercel

1. Subir el repositorio a GitHub e importarlo en Vercel (detecta Next.js solo).
2. En *Settings → Environment Variables* definir `APP_ORIGIN` con el dominio definitivo.
3. Desplegar y abrir `/`: descargar el QR en PNG (pantalla) o SVG (imprenta).

**Importante:** el QR contiene la URL, no el modelo. Mantén el mismo dominio y el slug `pumpkin-witch-droid` para que un QR impreso siga funcionando aunque cambies el modelo.

## Probar en el celular antes de desplegar

El celular y la PC deben estar en la misma red Wi‑Fi:

```bash
npm run build
APP_ORIGIN=http://IP_DE_TU_PC:3000 npm start
```

Abrir `http://IP_DE_TU_PC:3000/` en la PC y escanear el QR con el teléfono. El visor 3D funciona así, pero **la AR necesita HTTPS público** (pruébala en la URL de Vercel), y **no imprimas** un QR con una IP local.

## Pantalla de exhibición

`/pantalla/pumpkin-witch-droid` es la página para la pantalla del evento: QR de Halloween grande, animaciones y el modelo girando. Abrirla en el navegador de la pantalla y pulsar **Pantalla completa** (arriba a la derecha). Diseñada para pantallas horizontales; en vertical se apilan el texto y el QR y se oculta el modelo.

El QR de Halloween también se descarga en `/api/qr/pumpkin-witch-droid?format=svg&style=halloween` (para imprimir).

## Juego: reventar al personaje y ganar un premio

- **Visor 3D (todos los celulares):** mantener presionado 1 s sobre el personaje. Si el dedo se mueve (girar la cámara) o entra un segundo dedo (zoom), se cancela.
- **AR de Android (WebXR):** botón «🎃 Mantén para reventar» (tocar el modelo en AR sirve para moverlo).
- **AR de iPhone (Quick Look):** no es posible; es un visor nativo de Apple y la web no recibe los toques.

Premios, pesos y prefijo del código: `game` en `src/lib/experiences/local-catalog.ts` (**los actuales son de ejemplo**). El sorteo es al azar por peso, en el navegador; el premio queda guardado en ese navegador (`localStorage`) para que recargar no dé otro. **No es una protección real**: modo incógnito u otro navegador permiten jugar de nuevo, y los códigos no se validan en un servidor. Si hace falta stock limitado o códigos únicos verificables, se necesita base de datos (fase 2 del plan).

## Añadir otro modelo

1. Optimizar y escalar el GLB (ver `asset-pipeline.md`) y copiarlo a `public/models/<slug>/model-v1.glb`.
2. Añadir una entrada en `src/lib/experiences/local-catalog.ts`.
3. `npm run build`. Las rutas se generan desde el catálogo; cualquier slug que no esté ahí responde 404.

Para cambiar un modelo ya publicado, usar un nombre nuevo (`model-v2.glb`) y actualizar `glbUrl` y `assetVersion`: los archivos de `/models` y `/environments` se sirven con caché inmutable de un año.
