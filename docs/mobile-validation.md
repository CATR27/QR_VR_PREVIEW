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

## Pendiente (requiere dispositivos reales)

| Entorno | Qué comprobar |
|---|---|
| iPhone, Safari | Escanear QR con la cámara, carga, girar con un dedo, pellizcar para acercar, rendimiento |
| Android, Chrome | Lo mismo |
| Red móvil lenta | Indicador de carga (~9.6 MB en total: 2.1 MB modelo + 7.5 MB HDR) |
| Navegador dentro de apps (WhatsApp, Instagram) | Que el visor funcione |
| QR impreso | Lectura y dominio correcto (con `APP_ORIGIN` HTTPS definitivo) |

Registrar: dispositivo, sistema, navegador, fecha, versión del activo (`v1`) y resultado.
