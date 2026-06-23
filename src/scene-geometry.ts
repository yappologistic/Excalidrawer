import type { ExcalidrawElement } from "./scene-types.js";

export type Point = {
  readonly x: number;
  readonly y: number;
};

export type Segment = {
  readonly start: Point;
  readonly end: Point;
};

export type Box = {
  readonly id: string;
  readonly type: ExcalidrawElement["type"];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export function elementBox(element: ExcalidrawElement): Box {
  if (isLinear(element)) {
    return pointsBox(element.id, element.type, absolutePoints(element));
  }
  const x = Math.min(element.x, element.x + element.width);
  const y = Math.min(element.y, element.y + element.height);
  return {
    id: element.id,
    type: element.type,
    x,
    y,
    width: Math.max(Math.abs(element.width), 1),
    height: Math.max(Math.abs(element.height), 1)
  };
}

export function absolutePoints(element: ExcalidrawElement): readonly Point[] {
  const points = element.points?.length
    ? element.points
    : [
        [0, 0],
        [element.width, element.height]
      ];
  return points.map(([x, y]) => ({ x: element.x + x, y: element.y + y }));
}

export function lineSegments(points: readonly Point[]): readonly Segment[] {
  const segments: Segment[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (start && end) segments.push({ start, end });
  }
  return segments;
}

export function contentBounds(boxes: readonly Box[]): {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
} {
  if (boxes.length === 0) return { minX: 80, minY: 80, maxX: 80, maxY: 80, width: 0, height: 0 };
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function boxCenter(box: Pick<Box, "x" | "y" | "width" | "height">): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function expandedBox(box: Box, padding: number): Box {
  return {
    ...box,
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2
  };
}

export function containsBox(outer: Box, inner: Box, padding: number): boolean {
  return (
    inner.x >= outer.x + padding &&
    inner.y >= outer.y + padding &&
    inner.x + inner.width <= outer.x + outer.width - padding &&
    inner.y + inner.height <= outer.y + outer.height - padding
  );
}

export function overlapRatio(left: Pick<Box, "x" | "y" | "width" | "height">, right: Pick<Box, "x" | "y" | "width" | "height">): number {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  const area = width * height;
  if (area === 0) return 0;
  return area / Math.min(left.width * left.height, right.width * right.height);
}

export function gapBetween(left: Pick<Box, "x" | "y" | "width" | "height">, right: Pick<Box, "x" | "y" | "width" | "height">): number {
  const xGap = Math.max(0, Math.max(left.x, right.x) - Math.min(left.x + left.width, right.x + right.width));
  const yGap = Math.max(0, Math.max(left.y, right.y) - Math.min(left.y + left.height, right.y + right.height));
  return Math.hypot(xGap, yGap);
}

export function segmentIntersectsBox(segment: Segment, box: Box): boolean {
  if (pointInBox(segment.start, box) || pointInBox(segment.end, box)) return true;
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height }
  ];
  return corners.some((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    return next ? segmentsIntersect(segment, { start: corner, end: next }) : false;
  });
}

export function pointInBox(point: Point, box: Box): boolean {
  return point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height;
}

function pointsBox(id: string, type: ExcalidrawElement["type"], points: readonly Point[]): Box {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return { id, type, x: minX, y: minY, width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) };
}

function isLinear(element: ExcalidrawElement): boolean {
  return element.type === "arrow" || element.type === "line";
}

function segmentsIntersect(left: Segment, right: Segment): boolean {
  const d1 = direction(right.start, right.end, left.start);
  const d2 = direction(right.start, right.end, left.end);
  const d3 = direction(left.start, left.end, right.start);
  const d4 = direction(left.start, left.end, right.end);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return (
    (d1 === 0 && onSegment(right.start, right.end, left.start)) ||
    (d2 === 0 && onSegment(right.start, right.end, left.end)) ||
    (d3 === 0 && onSegment(left.start, left.end, right.start)) ||
    (d4 === 0 && onSegment(left.start, left.end, right.end))
  );
}

function direction(start: Point, end: Point, point: Point): number {
  return (point.x - start.x) * (end.y - start.y) - (point.y - start.y) * (end.x - start.x);
}

function onSegment(start: Point, end: Point, point: Point): boolean {
  return (
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y)
  );
}
