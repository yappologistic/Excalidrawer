import type { ExcalidrawElement } from "./scene-types.js";
import {
  absolutePoints,
  containsBox,
  expandedBox,
  lineSegments,
  pointInBox,
  segmentIntersectsBox,
  type Box
} from "./scene-geometry.js";

const arrowRules = {
  clearance: 4
} as const;

export function validateArrowQuality(
  elements: readonly ExcalidrawElement[],
  boxes: readonly Box[],
  issues: string[]
): void {
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const blockers = boxes.filter((box) => box.type === "text" && !isSectionContainer(box, boxes));
  for (const arrow of elements.filter((element) => element.type === "arrow" || element.type === "line")) {
    validateArrowShape(arrow, issues);
    validateBinding(arrow, arrow.startBinding?.elementId, "start", elementById, issues);
    validateBinding(arrow, arrow.endBinding?.elementId, "end", elementById, issues);
    validateRouteClearance(arrow, blockers, elementById, issues);
  }
}

function validateArrowShape(arrow: ExcalidrawElement, issues: string[]): void {
  const firstPoint = arrow.points?.[0];
  if (!firstPoint || firstPoint[0] !== 0 || firstPoint[1] !== 0 || absolutePoints(arrow).length < 2) {
    issues.push(`Arrow ${arrow.id} must use normalized local points starting at [0,0]`);
  }
  if (arrow.type === "arrow" && arrow.endArrowhead !== "arrow") {
    issues.push(`Arrow ${arrow.id} should render with a visible arrowhead`);
  }
}

function validateRouteClearance(
  arrow: ExcalidrawElement,
  blockers: readonly Box[],
  elementById: ReadonlyMap<string, ExcalidrawElement>,
  issues: string[]
): void {
  const points = absolutePoints(arrow);
  for (const segment of lineSegments(points)) {
    for (const box of blockers) {
      if (isBoundEndpointBox(arrow, box, elementById)) continue;
      if (segmentIntersectsBox(segment, expandedBox(box, arrowRules.clearance))) {
        issues.push(`Arrow ${arrow.id} crosses visible content ${box.id}`);
      }
    }
  }
  for (const point of [points[0], points[points.length - 1]]) {
    if (!point) continue;
    const blockingBox = blockers.find((box) => !isBoundEndpointBox(arrow, box, elementById) && pointInBox(point, box));
    if (blockingBox) issues.push(`Arrow ${arrow.id} endpoint overlaps visible content ${blockingBox.id}`);
  }
}

function isSectionContainer(box: Box, boxes: readonly Box[]): boolean {
  if (box.type === "text") return false;
  const contained = boxes.filter(
    (candidate) => candidate.id !== box.id && candidate.type !== "arrow" && candidate.type !== "line" && containsBox(box, candidate, 0)
  );
  return contained.length >= 2;
}

function validateBinding(
  arrow: ExcalidrawElement,
  elementId: string | undefined,
  side: "start" | "end",
  elementById: ReadonlyMap<string, ExcalidrawElement>,
  issues: string[]
): void {
  if (!elementId) {
    issues.push(`Arrow ${arrow.id} is missing ${side} binding`);
    return;
  }
  const element = elementById.get(elementId);
  if (!element) {
    issues.push(`Arrow ${arrow.id} ${side} binding references missing element ${elementId}`);
    return;
  }
  if (!element.boundElements?.some((bound) => bound.id === arrow.id && bound.type === "arrow")) {
    issues.push(`Arrow ${arrow.id} is not registered on bound element ${elementId}`);
  }
}

function isBoundEndpointBox(arrow: ExcalidrawElement, box: Box, elementById: ReadonlyMap<string, ExcalidrawElement>): boolean {
  if (box.id === arrow.startBinding?.elementId || box.id === arrow.endBinding?.elementId) return true;
  const element = elementById.get(box.id);
  return element?.containerId === arrow.startBinding?.elementId || element?.containerId === arrow.endBinding?.elementId;
}
