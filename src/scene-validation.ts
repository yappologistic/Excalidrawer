import { ExcalidrawScene, ValidationResult } from "./scene-types.js";

export function validateScene(input: unknown): ValidationResult {
  const issues: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: ["Scene must be an object"] };
  }
  if (input.type !== "excalidraw") issues.push('Scene type must be "excalidraw"');
  if (typeof input.version !== "number") issues.push("Scene version must be a number");
  if (!Array.isArray(input.elements)) issues.push("Scene elements must be an array");
  if (!isRecord(input.appState)) issues.push("Scene appState must be an object");
  if (!isRecord(input.files)) issues.push("Scene files must be an object");

  if (Array.isArray(input.elements)) {
    input.elements.forEach((element, index) => {
      if (!isRecord(element)) {
        issues.push(`Element ${index} must be an object`);
        return;
      }
      for (const key of ["id", "type"]) {
        if (typeof element[key] !== "string") issues.push(`Element ${index}.${key} must be a string`);
      }
      for (const key of ["x", "y", "width", "height"]) {
        if (typeof element[key] !== "number") issues.push(`Element ${index}.${key} must be a number`);
      }
    });
  }

  return { ok: issues.length === 0, issues };
}

export function assertScene(input: unknown): ExcalidrawScene {
  const validation = validateScene(input);
  if (!validation.ok) {
    throw new Error(`Invalid Excalidraw scene: ${validation.issues.join("; ")}`);
  }
  return input as ExcalidrawScene;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
