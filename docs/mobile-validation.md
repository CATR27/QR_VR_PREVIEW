# Registro de validación

## Comprobado (29-09-2026, Windows 11, Chrome de escritorio, build de producción local)

| Prueba | Resultado |
|---|---|
| `npx tsc --noEmit`, `npm run lint`, `npm run build` | Pasan |
| `/` muestra el QR y botones PNG/SVG | OK |
| `/ar/pumpkin-witch-droid` carga el modelo real con texturas y fondo 360° | OK |
| Rotar arrastrando con el ratón | OK (el fondo gira con la cámara) |
| Sin errores de hidratación ni de consola | OK |
| `/ar/no-existe` | 404 |
| `/api/qr/pumpkin-witch-droid?format=png` / `svg` | 200, `image/png` / `image/svg+xml` |
| `/api/qr/nada` → 404; `?format=gif` → 400 | OK |
| El PNG del QR decodifica a la URL esperada (jsQR) | OK (`http://localhost:3210/ar/pumpkin-witch-droid`) |
| GLB servido con `model/gltf-binary` y caché inmutable | OK |
| Fallo de carga (src roto) → mensaje + **Reintentar** → vuelve a cargar | OK |

## Comprobado (29-09-2026, segunda entrega: AR + pantalla)

| Prueba | Resultado |
|---|---|
| QR de Halloween decodifica (jsQR) a 800, 300 y 160 px, y con desenfoque | OK |
| QR decodifica desde una captura real de `/pantalla/...` (1478, 600 y 400 px de ancho) | OK |
| `/pantalla/pumpkin-witch-droid` muestra animaciones y modelo girando, sin errores de consola | OK (Chrome escritorio) |
| `/pantalla/nada` → 404; `style=halloween` con png → 400 | OK |
| Visor: en escritorio `canActivateAR = false`, no aparece el botón AR y se muestra la explicación | OK |

### Tercera entrega: juego de reventar

| Prueba (Chrome escritorio, pulsación simulada) | Resultado |
|---|---|
| Pulsación sobre el modelo → anillo de carga, modelo se infla y tiembla → explota → tarjeta con premio y código | OK |
| Pulsación fuera del modelo no inicia nada (prueba de impacto) | OK |
| Mover el dedo >12 px durante la carga la cancela y el modelo vuelve a su tamaño | OK |
| «Reventarlo otra vez» restaura el modelo; la segunda vez muestra el mismo premio y código | OK |
| Sin errores de consola (tras el parche de `onUpdateScene` de model-viewer 4.3.1) | OK |

### Cuarta entrega: iPhone con banner de Quick Look

| Prueba (Chrome escritorio) | Resultado |
|---|---|
| El `src` del visor lleva `#callToAction=…&checkoutTitle=…&checkoutSubtitle=…` y el GLB sigue cargando desde `/models/pumpkin-witch-droid/model-v2.glb` | OK |
| Evento `quick-look-button-tapped` simulado → explosión + tarjeta de premio | OK |
| Pulsación larga con `touch-action="none"` y margen de 18 px (un movimiento de 14 px no la cancela) | OK |
| Sin errores de consola | OK |

**La AR no está probada todavía**: sólo se puede validar en teléfonos reales.

## Pendiente (requiere dispositivos reales)

| Entorno | Qué comprobar |
|---|---|
| iPhone, Safari | Escanear QR, carga, girar/zoom, botón «Ver en tu espacio» → Quick Look (USDZ generado al vuelo), tamaño ~30 cm, apoyo en el suelo. **Banner «¡Reventar y ganar!» visible → tocarlo cierra la AR → explosión y premio en la página.** Mantener presionado en el visor 3D (sin lupa ni menú) |
| Android, Chrome | Lo mismo; anotar si abre WebXR o Scene Viewer. En WebXR: botón «Mantén para reventar», explosión, premio, vibración y sonido |
| Cualquier celular, visor 3D | Mantener presionado con el dedo real (sin menú contextual ni selección de texto) |
| Pantalla del evento | QR escaneable a la distancia real del público, con la iluminación del lugar |
| Red móvil lenta | Indicador de carga (~9.6 MB en total: 2.1 MB modelo + 7.5 MB HDR) |
| Navegador dentro de apps (WhatsApp, Instagram) | Que el visor funcione |
| QR impreso | Lectura y dominio correcto (con `APP_ORIGIN` HTTPS definitivo) |

Registrar: dispositivo, sistema, navegador, fecha, versión del activo (`v2`) y resultado.

## AR anclada al QR impreso (`/ar/<slug>`)

El personaje se ancla al QR físico: se calcula la pose del QR con sus 4 esquinas (`src/lib/ar/pose.ts`) y se dibuja con three.js sobre el video (`src/components/scanner/arScene.ts`). Verificado sólo con una cámara simulada en Chrome de escritorio; **falta probarlo con el QR impreso en iPhone y Android.**

### Antes de imprimir
- Descarga el SVG exacto en la home (`🖨️ SVG para imprimir`) o `/api/qr/<slug>?format=svg&style=halloween&size=40`. El tamaño en cm es el del **símbolo** (sin zona blanca); `anchor.qrSizeMeters` en `local-catalog.ts` debe coincidir con lo impreso (hoy 0.40 m). Si imprimes otro tamaño, cámbialo ahí o el personaje saldrá mal escalado.
- Impresión **mate**, contraste alto, zona blanca intacta, superficie plana, sin sol directo ni reflejos.
- El dominio del QR no se puede cambiar una vez impreso: define `APP_ORIGIN` con el dominio definitivo y conserva la ruta `/ar/pumpkin-witch-droid`.
- Distancia útil estimada con 40 cm: 1.5–4 m, de frente (menos de ~60° de inclinación).

### Qué ajustar tras la prueba de campo
- `anchor.modelHeightInQr` (tamaño del personaje respecto al QR) y `anchor.mount` (`wall` si el QR es vertical, `floor` si es horizontal).
- `approximateIntrinsics(..., focalRatio = 0.8)` en `src/lib/ar/pose.ts`: si el personaje "flota" o se desplaza al acercarte/alejarte, probar 0.7–1.0.
- Si hay temblor: subir `minCutoff` bajo / bajar `beta` en `OneEuro`. Si hay retraso al mover: lo contrario.
