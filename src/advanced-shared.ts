import type { ExcalidrawScene } from "./scene-types.js";

export function cleanLabel(value: string): string {
  return value.replace(/[{}()[\]";]/g, " ").replace(/\s+/g, " ").replace(/\s+[-=]+$/g, "").trim() || "node";
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map(cleanLabel).filter(Boolean))];
}

export function labelsFor(scene: ExcalidrawScene): readonly string[] {
  return unique(
    scene.elements
      .filter((element) => element.type === "text" && (element.customData?.excalidrawer?.role === "node-label" || element.customData?.excalidrawer?.role === undefined))
      .map((element) => element.originalText ?? element.text ?? "")
      .filter(Boolean)
  );
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled structured import format: ${String(value)}`);
}
