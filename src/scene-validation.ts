import { ExcalidrawScene, ValidationResult } from "./scene-types.js";

const supportedElementTypes = new Set([
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "text",
  "image",
  "frame",
  "magicframe",
  "iframe",
  "embeddable"
]);
const commonNumberFields = ["x", "y", "width", "height", "angle", "strokeWidth", "roughness", "opacity", "seed", "version", "versionNonce", "updated"] as const;
const commonStringFields = ["id", "type", "strokeColor", "backgroundColor", "fillStyle", "strokeStyle"] as const;

export function validateScene(input: unknown): ValidationResult {
  const issues: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: ["Scene must be an object"] };
  }
  if (input.type !== "excalidraw") issues.push('Scene type must be "excalidraw"');
  if (typeof input.version !== "number") issues.push("Scene version must be a number");
  if (typeof input.source !== "string") issues.push("Scene source must be a string");
  if (!Array.isArray(input.elements)) issues.push("Scene elements must be an array");
  if (!isRecord(input.appState)) issues.push("Scene appState must be an object");
  if (!isRecord(input.files)) issues.push("Scene files must be an object");

  if (Array.isArray(input.elements)) {
    input.elements.forEach((element, index) => {
      if (!isRecord(element)) {
        issues.push(`Element ${index} must be an object`);
        return;
      }
      for (const key of commonStringFields) {
        if (typeof element[key] !== "string") issues.push(`Element ${index}.${key} must be a string`);
      }
      if (typeof element.type === "string" && !supportedElementTypes.has(element.type)) {
        issues.push(`Element ${index}.type must be a supported Excalidraw element type`);
      }
      for (const key of commonNumberFields) {
        if (typeof element[key] !== "number") issues.push(`Element ${index}.${key} must be a number`);
      }
      validateStringArray(element.groupIds, `Element ${index}.groupIds`, issues);
      validateNullOrString(element.frameId, `Element ${index}.frameId`, issues);
      validateRoundness(element.roundness, `Element ${index}.roundness`, issues);
      if (typeof element.isDeleted !== "boolean") issues.push(`Element ${index}.isDeleted must be a boolean`);
      if (typeof element.locked !== "boolean") issues.push(`Element ${index}.locked must be a boolean`);
      validateBoundElements(element.boundElements, `Element ${index}.boundElements`, issues);
      validateNullOrString(element.link, `Element ${index}.link`, issues);
      validateTypedElementFields(element, index, issues);
    });
  }
  if (isRecord(input.files)) validateFiles(input.files, issues);

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

function validateStringArray(value: unknown, path: string, issues: string[]): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) issues.push(`${path} must be an array of strings`);
}

function validateNullOrString(value: unknown, path: string, issues: string[]): void {
  if (value !== null && typeof value !== "string") issues.push(`${path} must be null or a string`);
}

function validateRoundness(value: unknown, path: string, issues: string[]): void {
  if (value === null) return;
  if (!isRecord(value) || typeof value.type !== "number") issues.push(`${path} must be null or an object with numeric type`);
}

function validateBoundElements(value: unknown, path: string, issues: string[]): void {
  if (value === null) return;
  if (!Array.isArray(value)) {
    issues.push(`${path} must be null or an array`);
    return;
  }
  value.forEach((entry, entryIndex) => {
    if (!isRecord(entry)) {
      issues.push(`${path}[${entryIndex}] must be an object`);
      return;
    }
    if (typeof entry.id !== "string") issues.push(`${path}[${entryIndex}].id must be a string`);
    if (entry.type !== "arrow" && entry.type !== "text") issues.push(`${path}[${entryIndex}].type must be arrow or text`);
  });
}

function validateTypedElementFields(element: Record<string, unknown>, index: number, issues: string[]): void {
  if (element.type === "text") validateTextElement(element, index, issues);
  if (element.type === "arrow" || element.type === "line") validateLinearElement(element, index, issues);
}

function validateTextElement(element: Record<string, unknown>, index: number, issues: string[]): void {
  for (const key of ["text", "originalText", "textAlign", "verticalAlign"] as const) {
    if (typeof element[key] !== "string") issues.push(`Element ${index}.${key} must be a string`);
  }
  for (const key of ["fontSize", "fontFamily", "baseline", "lineHeight"] as const) {
    if (typeof element[key] !== "number") issues.push(`Element ${index}.${key} must be a number`);
  }
  validateNullOrString(element.containerId, `Element ${index}.containerId`, issues);
}

function validateLinearElement(element: Record<string, unknown>, index: number, issues: string[]): void {
  validatePoints(element.points, `Element ${index}.points`, issues);
  validateBinding(element.startBinding, `Element ${index}.startBinding`, issues);
  validateBinding(element.endBinding, `Element ${index}.endBinding`, issues);
  validateNullOrString(element.startArrowhead, `Element ${index}.startArrowhead`, issues);
  validateNullOrString(element.endArrowhead, `Element ${index}.endArrowhead`, issues);
}

function validateBinding(value: unknown, path: string, issues: string[]): void {
  if (value === null || value === undefined) return;
  if (!isRecord(value)) {
    issues.push(`${path} must be null or an object`);
    return;
  }
  if (typeof value.elementId !== "string") issues.push(`${path}.elementId must be a string`);
  validatePoint(value.fixedPoint, `${path}.fixedPoint`, issues);
  if (value.mode !== "inside" && value.mode !== "orbit" && value.mode !== "skip") issues.push(`${path}.mode must be inside, orbit, or skip`);
}

function validatePoints(value: unknown, path: string, issues: string[]): void {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array of numeric point tuples`);
    return;
  }
  value.forEach((point, pointIndex) => validatePoint(point, `${path}[${pointIndex}]`, issues));
}

function validatePoint(value: unknown, path: string, issues: string[]): void {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "number" || typeof value[1] !== "number") {
    issues.push(`${path} must be a numeric point tuple`);
  }
}

function validateFiles(files: Record<string, unknown>, issues: string[]): void {
  for (const [key, value] of Object.entries(files)) {
    if (!isRecord(value)) {
      issues.push(`File ${key} must be an object`);
      continue;
    }
    if (value.id !== key) issues.push(`File ${key}.id must match its files key`);
    if (typeof value.dataURL !== "string") issues.push(`File ${key}.dataURL must be a string`);
    if (typeof value.mimeType !== "string") issues.push(`File ${key}.mimeType must be a string`);
    if (typeof value.created !== "number") issues.push(`File ${key}.created must be a number`);
  }
}
