import type { ExcalidrawElement, ExcalidrawScene, ValidationResult } from "./scene-types.js";

const qualityRules = {
  maxCanvasWidth: 2400,
  maxCanvasHeight: 1600,
  minElementSize: 8,
  minGap: 10,
  overlapRatio: 0.04,
  textPadding: 6,
  textAverageWidth: 0.55,
  defaultFontSize: 20,
  defaultLineHeight: 1.25,
  defaultNoteWidth: 220
} as const;

type Box = {
  readonly id: string;
  readonly type: ExcalidrawElement["type"];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type TextPlacement = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
};

export class SceneQualityError extends Error {
  readonly name = "SceneQualityError";

  constructor(readonly issues: readonly string[]) {
    super(`Scene quality check failed: ${issues.join("; ")}`);
  }
}

export function validateSceneQuality(scene: ExcalidrawScene): ValidationResult {
  const issues: string[] = [];
  const active = scene.elements.filter((element) => !element.isDeleted);
  const boxes = active.map(elementBox);
  validateElementReadability(active, issues);
  validateCanvasBounds(boxes, issues);
  validateCollisions(boxes, issues);
  return { ok: issues.length === 0, issues };
}

export function assertSceneQuality(scene: ExcalidrawScene): ExcalidrawScene {
  const result = validateSceneQuality(scene);
  if (!result.ok) throw new SceneQualityError(result.issues);
  return scene;
}

export function measureTextHeight(value: string, width: number, fontSize: number = qualityRules.defaultFontSize): number {
  const charactersPerLine = Math.max(1, Math.floor(width / (fontSize * qualityRules.textAverageWidth)));
  const lines = textLines(value).reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)),
    0
  );
  return Math.ceil(lines * fontSize * qualityRules.defaultLineHeight);
}

export function recommendedTextWidth(value: string): number {
  const longestLine = Math.max(...textLines(value).map((line) => line.length));
  return clamp(Math.ceil(longestLine * 9), 160, 320);
}

export function findClearTextPlacement(
  scene: ExcalidrawScene,
  value: string,
  preferred: Partial<TextPlacement>
): TextPlacement {
  const width = preferred.width ?? recommendedTextWidth(value);
  const height = measureTextHeight(value, width);
  const bounds = contentBounds(scene.elements.filter((element) => !element.isDeleted).map(elementBox));
  const preferredCandidate =
    preferred.x === undefined || preferred.y === undefined
      ? undefined
      : { x: preferred.x, y: preferred.y, width, height };
  const fallbackY = bounds.maxY + 40;
  const candidates = [
    preferredCandidate,
    { x: bounds.minX, y: fallbackY, width, height },
    { x: bounds.minX + 260, y: fallbackY, width, height },
    { x: bounds.minX, y: fallbackY + 80, width, height },
    { x: bounds.minX + 260, y: fallbackY + 80, width, height }
  ].filter((candidate): candidate is BoxLike => candidate !== undefined);
  const existing = scene.elements.filter((element) => !element.isDeleted).map(elementBox);
  const clear = candidates.find((candidate) => !hasBlockingCollision(candidate, existing));
  if (clear) return { x: clear.x, y: clear.y, width: clear.width };
  return { x: bounds.minX, y: bounds.maxY + 140, width };
}

type BoxLike = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

function validateElementReadability(elements: readonly ExcalidrawElement[], issues: string[]): void {
  for (const element of elements) {
    if ((element.type === "arrow" || element.type === "line") && lineHasLength(element)) continue;
    if (element.width < qualityRules.minElementSize || element.height < qualityRules.minElementSize) {
      issues.push(`Element ${element.id} is too small to read clearly`);
    }
    if (element.type !== "text") continue;
    const text = normalizeText(element.text ?? "");
    const fontSize = element.fontSize ?? qualityRules.defaultFontSize;
    if (text.length === 0) issues.push(`Text element ${element.id} is empty`);
    if (element.width < recommendedTextWidth(text) * 0.45) {
      issues.push(`Text element ${element.id} is too narrow for readable wrapping`);
    }
    if (element.height < fontSize * 0.75) {
      issues.push(`Text element ${element.id} is too short for its label`);
    }
  }
}

function validateCanvasBounds(boxes: readonly Box[], issues: string[]): void {
  const bounds = contentBounds(boxes);
  if (bounds.width > qualityRules.maxCanvasWidth) {
    issues.push(`Scene canvas is too wide for review (${bounds.width}px)`);
  }
  if (bounds.height > qualityRules.maxCanvasHeight) {
    issues.push(`Scene canvas is too tall for review (${bounds.height}px)`);
  }
}

function validateCollisions(boxes: readonly Box[], issues: string[]): void {
  const visible = boxes.filter((box) => box.type !== "arrow" && box.type !== "line");
  for (let leftIndex = 0; leftIndex < visible.length; leftIndex += 1) {
    const left = visible[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < visible.length; rightIndex += 1) {
      const right = visible[rightIndex];
      if (!right || isIntentionalContainment(left, right) || isIntentionalContainment(right, left)) continue;
      const overlap = overlapRatio(left, right);
      if (overlap > qualityRules.overlapRatio) {
        issues.push(`Elements ${left.id} and ${right.id} overlap (${Math.round(overlap * 100)}%)`);
        continue;
      }
      if (gapBetween(left, right) < qualityRules.minGap) {
        issues.push(`Elements ${left.id} and ${right.id} are too close for a readable diagram`);
      }
    }
  }
}

function hasBlockingCollision(candidate: BoxLike, existing: readonly Box[]): boolean {
  return existing
    .filter((box) => box.type !== "arrow" && box.type !== "line")
    .some((box) => overlapRatio(candidate, box) > 0 || gapBetween(candidate, box) < qualityRules.minGap);
}

function elementBox(element: ExcalidrawElement): Box {
  return {
    id: element.id,
    type: element.type,
    x: element.x,
    y: element.y,
    width: Math.max(element.width, 1),
    height: Math.max(element.height, 1)
  };
}

function lineHasLength(element: ExcalidrawElement): boolean {
  return Math.abs(element.width) + Math.abs(element.height) >= qualityRules.minElementSize;
}

function isIntentionalContainment(inner: Box, outer: Box): boolean {
  if (outer.type === "text") return false;
  const outerArea = outer.width * outer.height;
  const innerArea = inner.width * inner.height;
  const isLargeContainer = outerArea / innerArea >= 2;
  const isTextLabel = inner.type === "text";
  if (!isLargeContainer && !isTextLabel) return false;
  const padding = isLargeContainer ? 0 : qualityRules.textPadding;
  return (
    inner.x >= outer.x + padding &&
    inner.y >= outer.y + padding &&
    inner.x + inner.width <= outer.x + outer.width - padding &&
    inner.y + inner.height <= outer.y + outer.height - padding
  );
}

function overlapRatio(left: BoxLike, right: BoxLike): number {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  const area = width * height;
  if (area === 0) return 0;
  return area / Math.min(left.width * left.height, right.width * right.height);
}

function gapBetween(left: BoxLike, right: BoxLike): number {
  const xGap = Math.max(0, Math.max(left.x, right.x) - Math.min(left.x + left.width, right.x + right.width));
  const yGap = Math.max(0, Math.max(left.y, right.y) - Math.min(left.y + left.height, right.y + right.height));
  return Math.hypot(xGap, yGap);
}

function contentBounds(boxes: readonly Box[]): { readonly minX: number; readonly maxY: number; readonly width: number; readonly height: number } {
  if (boxes.length === 0) return { minX: 80, maxY: 80, width: 0, height: 0 };
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return { minX, maxY, width: maxX - minX, height: maxY - minY };
}

function normalizeText(value: string): string {
  return value.trim() || "Untitled";
}

function textLines(value: string): readonly string[] {
  return normalizeText(value)
    .split(/\r?\n/)
    .map((line) => line.trim() || "Untitled");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
