# Visor 3D con QR

Un código QR abre una página web donde el modelo 3D (Pumpkin Witch Droid, creado en Meshy) se puede **girar y acercar** dentro de un **escenario 360° (HDRI nocturno)**. Sin realidad aumentada.

- Página del modelo: `/ar/pumpkin-witch-droid`
- Inicio con el QR y descargas PNG/SVG: `/`
- QR directo: `/api/qr/pumpkin-witch-droid?format=png|svg`

```bash
npm install
npm run dev        # http://localhost:3000
```

Documentación:

- [docs/setup.md](docs/setup.md) — correr, desplegar y generar el QR definitivo
- [docs/asset-pipeline.md](docs/asset-pipeline.md) — cómo se optimizó el modelo y de dónde sale el HDRI
- [docs/mobile-validation.md](docs/mobile-validation.md) — qué se probó y qué falta probar

La especificación original (con AR) está en `Plan_AR_Meshy_Claude.md`; este proyecto implementa su fase 1 sin la parte de AR.
