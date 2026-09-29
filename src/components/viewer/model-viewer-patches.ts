import type { ModelViewerElement } from "@google/model-viewer";

type ARRendererLike = { isPresenting: boolean; onUpdateScene: () => void; __patched?: boolean };

/**
 * model-viewer 4.3.1: cambiar `scale`/`orientation` fuera de la AR llama a
 * arRenderer.onUpdateScene(), que usa la escena de AR (null en ese momento) y lanza
 * "Cannot read properties of null (reading 'add')", cortando el redibujado.
 * Sólo tiene sentido dentro de la AR, así que ahí es el único lugar donde lo dejamos correr.
 * Revisar al actualizar model-viewer: si el bug se corrige, borrar este parche.
 */
export function patchARUpdateScene(el: ModelViewerElement): void {
  let proto: object | null = el;
  while (proto) {
    const sym = Object.getOwnPropertySymbols(proto).find((s) => s.description === "renderer");
    if (sym) {
      const renderer = (el as unknown as Record<symbol, { arRenderer?: ARRendererLike }>)[sym];
      const ar = renderer?.arRenderer;
      if (ar && !ar.__patched) {
        const original = ar.onUpdateScene;
        ar.onUpdateScene = () => {
          if (ar.isPresenting) original();
        };
        ar.__patched = true;
      }
      return;
    }
    proto = Object.getPrototypeOf(proto);
  }
}
