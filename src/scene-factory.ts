import type { ExcalidrawBinding, ExcalidrawElement, ExcalidrawElementType, ExcalidrawScene } from "./scene-types.js";
import type { Point } from "./scene-geometry.js";
import { compileDiagram } from "./diagram-compiler.js";
import { findClearTextPlacement, measureTextHeight, recommendedTextWidth } from "./scene-quality.js";

let idCounter = 0;

const layout = {
  startX: 80,
  startY: 100,
  columns: 3,
  columnGap: 140,
  rowHeight: 260,
  labelPaddingX: 22,
  arrowGap: 18,
  maxNodes: 6
} as const;

export function createSceneFromPrompt(prompt: string): ExcalidrawScene {
  if (shouldUseCompiler(prompt)) return compileDiagram(prompt);
  const labels = prompt
    .split(/\s+(?:to|->|then|and|sends?|calls?|requests?)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const primary = labels.length >= 2 ? labels.slice(0, layout.maxNodes) : promptWords(prompt);
  const nodes = primary.map((label, index) => nodeLayout(label, index));
  const elements: ExcalidrawElement[] = [];

  nodes.forEach((node) => {
    const shape = rectangle(node.x, node.y, node.width, node.height);
    elements.push(shape);
    elements.push(text(node.label, shape));
  });
  for (let index = 1; index < nodes.length; index += 1) {
    const previous = elements[(index - 1) * 2];
    const next = elements[index * 2];
    if (previous && next) elements.push(arrow(previous, next));
  }

  return {
    type: "excalidraw",
    version: 2,
    source: "https://github.com/yappologistic/Excalidrawer",
    elements,
    appState: {
      gridSize: null,
      viewBackgroundColor: "#ffffff",
      exportBackground: true,
      exportWithDarkMode: false,
      exportEmbedScene: false
    },
    files: {}
  };
}

function shouldUseCompiler(prompt: string): boolean {
  return /[,;]|\b(flow|architecture|sequence|mindmap|data-flow|state-machine|swimlane):/i.test(prompt);
}

export function editScene(
  scene: ExcalidrawScene,
  edit: { addText?: string; x?: number; y?: number }
): ExcalidrawScene {
  const result = cloneScene(scene);
  if (edit.addText) {
    const placement = findClearTextPlacement(result, edit.addText, {
      x: edit.x,
      y: edit.y,
      width: Math.max(160, edit.addText.length * 9)
    });
    result.elements.push(freeText(edit.addText, placement.x, placement.y, placement.width));
  }
  return result;
}

type NodeLayout = {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

function nodeLayout(label: string, index: number): NodeLayout {
  const column = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  const textWidth = recommendedTextWidth(label);
  const width = Math.max(220, textWidth + layout.labelPaddingX * 2);
  const height = Math.max(104, measureTextHeight(label, textWidth) + 48);
  const rowWidth = 260 + layout.columnGap;
  return {
    label,
    x: layout.startX + column * rowWidth,
    y: layout.startY + row * layout.rowHeight,
    width,
    height
  };
}

function rectangle(x: number, y: number, width: number, height: number): ExcalidrawElement {
  return baseElement("rectangle", x, y, width, height, {
    backgroundColor: "#e0f2fe",
    roundness: { type: 3 }
  });
}

function text(value: string, container: ExcalidrawElement): ExcalidrawElement {
  const width = Math.max(180, container.width - layout.labelPaddingX * 2);
  const fontSize = 20;
  const height = measureTextHeight(value, width, fontSize);
  const textElement = freeText(
    value,
    container.x + (container.width - width) / 2,
    container.y + (container.height - height) / 2,
    width,
    {
      containerId: container.id,
      textAlign: "center",
      verticalAlign: "middle"
    }
  );
  container.boundElements = [{ id: textElement.id, type: "text" }];
  return textElement;
}

function freeText(
  value: string,
  x: number,
  y: number,
  width: number,
  overrides: Partial<ExcalidrawElement> = {}
): ExcalidrawElement {
  const fontSize = 20;
  const height = measureTextHeight(value, width, fontSize);
  return {
    ...baseElement("text", x, y, width, height, { backgroundColor: "transparent" }),
    text: value,
    originalText: value,
    fontSize,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    baseline: 18,
    containerId: null,
    lineHeight: 1.25,
    ...overrides
  };
}

function arrow(source: ExcalidrawElement, target: ExcalidrawElement): ExcalidrawElement {
  const route = arrowRoute(source, target);
  const points = route.points.map((point) => [point.x - route.start.x, point.y - route.start.y] as [number, number]);
  const width = route.end.x - route.start.x;
  const height = route.end.y - route.start.y;
  const arrowElement = {
    ...baseElement("arrow", route.start.x, route.start.y, width, height, { backgroundColor: "transparent" }),
    points,
    startBinding: binding(source.id, route.startFixedPoint),
    endBinding: binding(target.id, route.endFixedPoint),
    startArrowhead: null,
    endArrowhead: "arrow"
  };
  appendBoundArrow(source, arrowElement.id);
  appendBoundArrow(target, arrowElement.id);
  return arrowElement;
}

function arrowRoute(
  source: ExcalidrawElement,
  target: ExcalidrawElement
): { readonly start: Point; readonly end: Point; readonly points: readonly Point[]; readonly startFixedPoint: [number, number]; readonly endFixedPoint: [number, number] } {
  const sameRow = Math.abs(source.y - target.y) < 1;
  if (sameRow) {
    const start = { x: source.x + source.width + layout.arrowGap, y: source.y + source.height / 2 };
    const end = { x: target.x - layout.arrowGap, y: target.y + target.height / 2 };
    return { start, end, points: [start, end], startFixedPoint: [1, 0.5], endFixedPoint: [0, 0.5] };
  }
  const start = { x: source.x + source.width / 2, y: source.y + source.height + layout.arrowGap };
  const end = { x: target.x + target.width / 2, y: target.y - layout.arrowGap };
  const midY = start.y + (end.y - start.y) / 2;
  return {
    start,
    end,
    points: [
      start,
      { x: start.x, y: midY },
      { x: end.x, y: midY },
      end
    ],
    startFixedPoint: [0.5, 1],
    endFixedPoint: [0.5, 0]
  };
}

function binding(elementId: string, fixedPoint: [number, number]): ExcalidrawBinding {
  return { elementId, fixedPoint, mode: "orbit" };
}

function appendBoundArrow(element: ExcalidrawElement, id: string): void {
  element.boundElements = [...(element.boundElements ?? []), { id, type: "arrow" }];
}

function baseElement(
  type: ExcalidrawElementType,
  x: number,
  y: number,
  width: number,
  height: number,
  overrides: Partial<ExcalidrawElement> = {}
): ExcalidrawElement {
  idCounter += 1;
  return {
    id: `excalidrawer-${Date.now().toString(36)}-${idCounter}`,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "#1e293b",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1000 + idCounter,
    version: 1,
    versionNonce: 2000 + idCounter,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    ...overrides
  };
}

function promptWords(prompt: string): string[] {
  const clean = prompt.trim() || "Untitled diagram";
  const words = clean.split(/\s+/);
  if (words.length <= 4) return [clean, "Review", "Ship"];
  return [
    words.slice(0, 3).join(" "),
    words.slice(3, 6).join(" "),
    words.slice(6, 9).join(" ") || "Done",
    words.slice(9, 12).join(" ") || "Validate"
  ];
}

function cloneScene(scene: ExcalidrawScene): ExcalidrawScene {
  return JSON.parse(JSON.stringify(scene)) as ExcalidrawScene;
}
