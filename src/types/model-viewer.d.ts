import type { DetailedHTMLProps, HTMLAttributes } from "react";
import type { ModelViewerElement } from "@google/model-viewer";

/** Atributos de <model-viewer> que usa esta app (subconjunto acotado). */
interface ModelViewerAttributes
  extends DetailedHTMLProps<HTMLAttributes<ModelViewerElement>, ModelViewerElement> {
  src?: string;
  alt?: string;
  poster?: string;
  "camera-controls"?: boolean;
  "auto-rotate"?: boolean;
  "auto-rotate-delay"?: number;
  "rotation-per-second"?: string;
  "interaction-prompt"?: "auto" | "none";
  "touch-action"?: "pan-y" | "pan-x" | "none";
  "skybox-image"?: string;
  "skybox-height"?: string;
  "environment-image"?: string;
  exposure?: number;
  "shadow-intensity"?: number;
  "shadow-softness"?: number;
  "camera-orbit"?: string;
  "min-camera-orbit"?: string;
  "max-camera-orbit"?: string;
  "field-of-view"?: string;
  loading?: "auto" | "lazy" | "eager";
  reveal?: "auto" | "manual";
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}
