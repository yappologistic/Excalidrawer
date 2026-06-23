import type { ExcalidrawElement, ExcalidrawScene } from "./scene-types.js";
import type { CompileDiagramInput, DiagramModel, ThemeName } from "./diagram-model.js";
import type { DiagramLayout, PositionedNode } from "./diagram-layout.js";
import type { Point } from "./scene-geometry.js";
import { baseElement, binding, freeText, resetElementIds, scene } from "./diagram-elements.js";
import { parseDiagramPrompt } from "./diagram-parser.js";
import { layoutDiagram } from "./diagram-layout.js";
import { themes } from "./diagram-themes.js";
import { measureTextHeight } from "./scene-quality.js";
import { validateSceneQuality } from "./scene-quality.js";

export { parseDiagramPrompt };

export function compileDiagram(input: string | CompileDiagramInput): ExcalidrawScene {
  const model = parseDiagramPrompt(input);
  if (model.nodes.length === 0) throw new DiagramCompileError(["Diagram prompt did not produce any nodes"]);
  const attempts = [model, widenModel(model, 1), widenModel(model, 2)];
  for (const attempt of attempts) {
    const scene = sceneFromModel(attempt);
    if (scoreDiagramScene(scene).ok) return scene;
  }
  throw new DiagramCompileError(scoreDiagramScene(sceneFromModel(attempts[attempts.length - 1])).issues);
}

export function scoreDiagramScene(scene: ExcalidrawScene): { readonly ok: boolean; readonly issues: readonly string[] } {
  return validateSceneQuality(scene);
}

export class DiagramCompileError extends Error {
  readonly name = "DiagramCompileError";

  constructor(readonly issues: readonly string[]) {
    super(`Unable to produce a polished diagram: ${issues.join("; ")}`);
  }
}

function sceneFromModel(model: DiagramModel): ExcalidrawScene {
  resetElementIds();
  const theme = themes[model.themeName];
  const layout = layoutDiagram(model);
  const elements: ExcalidrawElement[] = [];
  for (const box of [...layout.laneBoxes, ...layout.groupBoxes]) {
    const container = baseElement("rectangle", box.x, box.y, box.width, box.height, model.themeName, {
      backgroundColor: layout.laneBoxes.some((lane) => lane.id === box.id) ? theme.laneFill : theme.groupFill,
      strokeColor: theme.stroke,
      opacity: 45,
      roundness: { type: 3 }
    });
    elements.push(container);
  }
  const nodeElements = new Map<string, ExcalidrawElement>();
  for (const node of layout.nodes) {
    const fill = theme.nodeFill[nodeElements.size % theme.nodeFill.length] ?? theme.nodeFill[0];
    const shape = baseElement("rectangle", node.x, node.y, node.width, node.height, model.themeName, {
      backgroundColor: fill,
      strokeColor: theme.stroke,
      roundness: { type: 3 }
    });
    nodeElements.set(node.id, shape);
    elements.push(shape);
    elements.push(containerText(node.label, shape, model.themeName));
  }
  for (const edge of model.edges) {
    const source = nodeElements.get(edge.sourceId);
    const target = nodeElements.get(edge.targetId);
    if (!source || !target) continue;
    elements.push(routedArrow(source, target, edge.order, layout, model.themeName));
  }
  return scene(elements);
}

function widenModel(model: DiagramModel, factor: number): DiagramModel {
  return { ...model, nodes: model.nodes.map((node) => ({ ...node, order: node.order + factor * Math.floor(node.order / 4) })) };
}

function containerText(value: string, container: ExcalidrawElement, themeName: ThemeName): ExcalidrawElement {
  const width = Math.max(180, container.width - 44);
  const height = measureTextHeight(value, width);
  const text = freeText(value, container.x + (container.width - width) / 2, container.y + (container.height - height) / 2, width, themeName, {
    containerId: container.id,
    textAlign: "center",
    verticalAlign: "middle"
  });
  container.boundElements = [{ id: text.id, type: "text" }];
  return text;
}

function routedArrow(source: ExcalidrawElement, target: ExcalidrawElement, order: number, layout: DiagramLayout, themeName: ThemeName): ExcalidrawElement {
  const route = routeBetween(source, target, order, layout.nodes);
  const points = route.points.map((point) => localPoint(point, route.start));
  const arrow = baseElement("arrow", route.start.x, route.start.y, route.end.x - route.start.x, route.end.y - route.start.y, themeName, {
    backgroundColor: "transparent",
    strokeColor: themes[themeName].arrow
  });
  arrow.points = points;
  arrow.startBinding = binding(source.id, route.startFixedPoint);
  arrow.endBinding = binding(target.id, route.endFixedPoint);
  arrow.startArrowhead = null;
  arrow.endArrowhead = "arrow";
  source.boundElements = [...(source.boundElements ?? []), { id: arrow.id, type: "arrow" }];
  target.boundElements = [...(target.boundElements ?? []), { id: arrow.id, type: "arrow" }];
  return arrow;
}

function routeBetween(
  source: ExcalidrawElement,
  target: ExcalidrawElement,
  order: number,
  nodes: readonly PositionedNode[]
): { readonly start: Point; readonly end: Point; readonly points: readonly Point[]; readonly startFixedPoint: [number, number]; readonly endFixedPoint: [number, number] } {
  const sameRow = Math.abs(source.y - target.y) < 40;
  if (sameRow && source.x < target.x && hasClearHorizontalLane(source, target, nodes)) {
    const start = { x: source.x + source.width + 20, y: source.y + source.height / 2 };
    const end = { x: target.x - 20, y: target.y + target.height / 2 };
    return { start, end, points: [start, end], startFixedPoint: [1, 0.5], endFixedPoint: [0, 0.5] };
  }
  const targetIsBelow = target.y > source.y;
  const targetIsAbove = target.y < source.y;
  const verticalDistance = Math.abs(target.y - source.y);
  if ((targetIsAbove || targetIsBelow) && verticalDistance > 220) {
    return exteriorRoute(source, target, order, nodes, targetIsAbove ? "top" : "bottom");
  }
  if (targetIsBelow || targetIsAbove) {
    const start = {
      x: source.x + source.width / 2,
      y: source.y + (targetIsBelow ? source.height + 20 : -20)
    };
    const end = {
      x: target.x + target.width / 2,
      y: target.y + (targetIsBelow ? -20 : target.height + 20)
    };
    const midY = targetIsBelow
      ? source.y + source.height + (target.y - source.y - source.height) / 2
      : target.y + target.height + (source.y - target.y - target.height) / 2;
    return {
      start,
      end,
      points: [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end],
      startFixedPoint: [0.5, targetIsBelow ? 1 : 0],
      endFixedPoint: [0.5, targetIsBelow ? 0 : 1]
    };
  }
  const start = { x: source.x + source.width / 2, y: source.y + source.height + 20 };
  const end = { x: target.x + target.width / 2, y: target.y + target.height + 20 };
  const gutter = Math.max(...nodes.map((node) => node.y + node.height)) + 80 + order * 16;
  return {
    start,
    end,
    points: [start, { x: start.x, y: gutter }, { x: end.x, y: gutter }, end],
    startFixedPoint: [0.5, 1],
    endFixedPoint: [0.5, 1]
  };
}

function exteriorRoute(
  source: ExcalidrawElement,
  target: ExcalidrawElement,
  order: number,
  nodes: readonly PositionedNode[],
  side: "top" | "bottom"
): { readonly start: Point; readonly end: Point; readonly points: readonly Point[]; readonly startFixedPoint: [number, number]; readonly endFixedPoint: [number, number] } {
  const bounds = {
    minX: Math.min(...nodes.map((node) => node.x)),
    maxX: Math.max(...nodes.map((node) => node.x + node.width)),
    minY: Math.min(...nodes.map((node) => node.y)),
    maxY: Math.max(...nodes.map((node) => node.y + node.height))
  };
  const useLeft = source.x + source.width / 2 <= (bounds.minX + bounds.maxX) / 2;
  const gutterX = useLeft ? bounds.minX - 80 - order * 12 : bounds.maxX + 80 + order * 12;
  const gutterY = side === "top" ? bounds.minY - 80 - order * 12 : bounds.maxY + 80 + order * 12;
  const start = {
    x: source.x + (useLeft ? -20 : source.width + 20),
    y: source.y + source.height / 2
  };
  const end = {
    x: target.x + (useLeft ? -20 : target.width + 20),
    y: target.y + target.height / 2
  };
  return {
    start,
    end,
    points: [start, { x: gutterX, y: start.y }, { x: gutterX, y: gutterY }, { x: end.x, y: gutterY }, end],
    startFixedPoint: [useLeft ? 0 : 1, 0.5],
    endFixedPoint: [useLeft ? 0 : 1, 0.5]
  };
}

function localPoint(point: Point, start: Point): [number, number] {
  return [point.x - start.x, point.y - start.y];
}

function hasClearHorizontalLane(source: ExcalidrawElement, target: ExcalidrawElement, nodes: readonly PositionedNode[]): boolean {
  const left = source.x + source.width;
  const right = target.x;
  const y = source.y + source.height / 2;
  return !nodes.some((node) => {
    if (node.id === source.id || node.id === target.id) return false;
    const overlapsX = node.x < right && node.x + node.width > left;
    const overlapsY = y > node.y - 8 && y < node.y + node.height + 8;
    return overlapsX && overlapsY;
  });
}
