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

**La AR no está probada todavía**: sólo se puede validar en teléfonos reales.

## Pendiente (requiere dispositivos reales)

| Entorno | Qué comprobar |
|---|---|
| iPhone, Safari | Escanear QR, carga, girar/zoom, botón «Ver en tu espacio» → Quick Look (USDZ generado al vuelo), tamaño ~30 cm, apoyo en el suelo |
| Android, Chrome | Lo mismo; anotar si abre WebXR o Scene Viewer. En WebXR: botón «Mantén para reventar», explosión, premio, vibración y sonido |
| Cualquier celular, visor 3D | Mantener presionado con el dedo real (sin menú contextual ni selección de texto) |
| Pantalla del evento | QR escaneable a la distancia real del público, con la iluminación del lugar |
| Red móvil lenta | Indicador de carga (~9.6 MB en total: 2.1 MB modelo + 7.5 MB HDR) |
| Navegador dentro de apps (WhatsApp, Instagram) | Que el visor funcione |
| QR impreso | Lectura y dominio correcto (con `APP_ORIGIN` HTTPS definitivo) |

Registrar: dispositivo, sistema, navegador, fecha, versión del activo (`v2`) y resultado.
