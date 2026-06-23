import type { ExcalidrawElement, ExcalidrawScene, ValidationResult } from "./scene-types.js";
import {
  boxCenter,
  containsBox,
  contentBounds,
  elementBox,
  gapBetween,
  overlapRatio,
  type Box
} from "./scene-geometry.js";
import { validateArrowQuality } from "./scene-arrow-quality.js";

const qualityRules = {
  maxCanvasWidth: 2400,
  maxCanvasHeight: 2600,
  minElementSize: 8,
  minGap: 10,
  overlapRatio: 0.04,
  textPadding: 6,
  textAverageWidth: 0.55,
  defaultFontSize: 20,
  defaultLineHeight: 1.25,
  defaultNoteWidth: 220
} as const;

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
  validateCollisions(active, boxes, issues);
  validateTextContainers(active, boxes, issues);
  validateArrowQuality(active, boxes, issues);
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
    (total, line) => total + Math.max(1, Math.ceil(visualUnits(line) / charactersPerLine)),
    0
  );
  return Math.ceil(lines * fontSize * qualityRules.defaultLineHeight);
}

export function recommendedTextWidth(value: string): number {
  const longestLine = Math.max(...textLines(value).map((line) => visualUnits(line)));
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
    if (element.customData?.excalidrawer?.role === "icon") continue;
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

function validateCollisions(elements: readonly ExcalidrawElement[], boxes: readonly Box[], issues: string[]): void {
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const visible = boxes.filter((box) => {
    const element = elementById.get(box.id);
    return (
      box.type !== "arrow" &&
      box.type !== "line" &&
      element?.customData?.excalidrawer?.role !== "icon" &&
      element?.customData?.excalidrawer?.role !== "edge-label" &&
      !isSectionContainer(box, boxes)
    );
  });
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

function isSectionContainer(box: Box, boxes: readonly Box[]): boolean {
  if (box.type === "text") return false;
  const contained = boxes.filter(
    (candidate) => candidate.id !== box.id && candidate.type !== "arrow" && candidate.type !== "line" && containsBox(box, candidate, 0)
  );
  return contained.length >= 2;
}

function validateTextContainers(elements: readonly ExcalidrawElement[], boxes: readonly Box[], issues: string[]): void {
  const elementById = new Map(elements.map((element) => [element.id, element]));
  for (const element of elements) {
    if (element.type !== "text" || !element.containerId) continue;
    const container = elementById.get(element.containerId);
    if (!container) {
      issues.push(`Text element ${element.id} references a missing container`);
      continue;
    }
    const labelBox = elementBox(element);
    const containerBox = elementBox(container);
    if (!containsBox(containerBox, labelBox, 0)) {
      issues.push(`Text element ${element.id} overflows its container ${container.id}`);
    }
    if (element.customData?.excalidrawer?.role === "icon") continue;
    const centerDelta = Math.hypot(boxCenter(labelBox).x - boxCenter(containerBox).x, boxCenter(labelBox).y - boxCenter(containerBox).y);
    if (centerDelta > Math.max(24, containerBox.height * 0.2)) {
      issues.push(`Text element ${element.id} is not centered in container ${container.id}`);
    }
    if (element.textAlign !== "center" || element.verticalAlign !== "middle") {
      issues.push(`Text element ${element.id} should be centered for polished box labels`);
    }
  }
  for (const box of boxes.filter((candidate) => candidate.type === "text")) {
    const matching = elements.find((element) => element.id === box.id);
    if (matching?.containerId && !boxes.some((candidate) => candidate.id === matching.containerId)) {
      issues.push(`Text element ${box.id} has no visible container`);
    }
  }
}

function hasBlockingCollision(candidate: BoxLike, existing: readonly Box[]): boolean {
  return existing
    .filter((box) => box.type !== "arrow" && box.type !== "line")
    .some((box) => overlapRatio(candidate, box) > 0 || gapBetween(candidate, box) < qualityRules.minGap);
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
  return containsBox(outer, inner, isLargeContainer ? 0 : qualityRules.textPadding);
}

function normalizeText(value: string): string {
  return value.trim() || "Untitled";
}

function textLines(value: string): readonly string[] {
  return normalizeText(value)
    .split(/\r?\n/)
    .map((line) => line.trim() || "Untitled");
}

function visualUnits(value: string): number {
  return Array.from(value).reduce((total, char) => total + (char.charCodeAt(0) > 127 ? 1.7 : 1), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
