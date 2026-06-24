import type { ExcalidrawElement, ExcalidrawScene } from "./scene-types.js";
import type { CompileDiagramInput, DiagramEdge, DiagramModel, DiagramPrimitive, DiagramSubdiagram, LayoutIntent, SemanticShape, ThemeName } from "./diagram-model.js";
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
  const attempts = optimizerModels(model);
  const attemptResults: OptimizerAttempt[] = [];
  for (const [index, attempt] of attempts.entries()) {
    const scene = sceneFromModel(attempt, {
      attemptIndex: index,
      attemptCount: attempts.length,
      attempts: attemptResults
    });
    const score = scoreDiagramScene(scene);
    attemptResults.push({ index, strategy: optimizerStrategy(index), ok: score.ok, issues: score.issues });
    if (score.ok) {
      return sceneFromModel(attempt, {
        attemptIndex: index,
        attemptCount: attempts.length,
        attempts: attemptResults
      });
    }
  }
  throw new DiagramCompileError(attemptResults.at(-1)?.issues ?? ["Optimizer did not produce a scene"]);
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

type OptimizerAttempt = {
  readonly index: number;
  readonly strategy: string;
  readonly ok: boolean;
  readonly issues: readonly string[];
};

type CompileMetadata = {
  readonly attemptIndex: number;
  readonly attemptCount: number;
  readonly attempts: readonly OptimizerAttempt[];
};

type RendererSpec = {
  readonly key: string;
  readonly family: LayoutIntent;
  readonly edgePolicy: "linear" | "orthogonal" | "radial" | "lane";
  readonly primitivePolicy: "boundary" | "timeline" | "swimlane" | "cluster";
  readonly reviewTone: "technical" | "operational" | "executive";
  readonly routeSpacing: number;
};

const rendererSpecs: Record<LayoutIntent, RendererSpec> = {
  flow: { key: "flow-renderer", family: "flow", edgePolicy: "linear", primitivePolicy: "boundary", reviewTone: "technical", routeSpacing: 18 },
  architecture: { key: "architecture-renderer", family: "architecture", edgePolicy: "orthogonal", primitivePolicy: "cluster", reviewTone: "technical", routeSpacing: 24 },
  sequence: { key: "sequence-renderer", family: "sequence", edgePolicy: "lane", primitivePolicy: "timeline", reviewTone: "technical", routeSpacing: 20 },
  mindmap: { key: "mindmap-renderer", family: "mindmap", edgePolicy: "radial", primitivePolicy: "cluster", reviewTone: "executive", routeSpacing: 16 },
  "data-flow": { key: "data-flow-renderer", family: "data-flow", edgePolicy: "orthogonal", primitivePolicy: "boundary", reviewTone: "technical", routeSpacing: 24 },
  "state-machine": { key: "state-machine-renderer", family: "state-machine", edgePolicy: "orthogonal", primitivePolicy: "timeline", reviewTone: "technical", routeSpacing: 22 },
  swimlane: { key: "swimlane-renderer", family: "swimlane", edgePolicy: "lane", primitivePolicy: "swimlane", reviewTone: "operational", routeSpacing: 20 },
  "incident-response": { key: "incident-response-renderer", family: "incident-response", edgePolicy: "orthogonal", primitivePolicy: "swimlane", reviewTone: "operational", routeSpacing: 26 }
};

function sceneFromModel(model: DiagramModel, metadata: CompileMetadata): ExcalidrawScene {
  resetElementIds();
  const theme = themes[model.themeName];
  const renderer = rendererSpecs[model.layoutIntent];
  const layout = layoutDiagram(model);
  const elements: ExcalidrawElement[] = [];
  for (const primitive of model.primitives) {
    const primitiveElement = primitiveElementFor(primitive, layout, model.themeName);
    if (primitiveElement) elements.push(primitiveElement);
  }
  for (const box of [...layout.laneBoxes, ...layout.groupBoxes]) {
    const container = baseElement("rectangle", box.x, box.y, box.width, box.height, model.themeName, {
      backgroundColor: layout.laneBoxes.some((lane) => lane.id === box.id) ? theme.laneFill : theme.groupFill,
      strokeColor: theme.stroke,
      opacity: 45,
      roundness: { type: 3 },
      customData: { excalidrawer: { role: layout.laneBoxes.some((lane) => lane.id === box.id) ? "lane" : "group", templateName: model.templateName } }
    });
    elements.push(container);
  }
  const nodeElements = new Map<string, ExcalidrawElement>();
  for (const node of layout.nodes) {
    const fill = theme.nodeFill[nodeElements.size % theme.nodeFill.length] ?? theme.nodeFill[0];
    const shape = baseElement(elementTypeFor(node.semanticShape), node.x, node.y, node.width, node.height, model.themeName, {
      backgroundColor: fill,
      strokeColor: theme.stroke,
      roundness: node.semanticShape === "service" || node.semanticShape === "process" || node.semanticShape === "metric" ? { type: 3 } : null,
      customData: {
        excalidrawer: {
          role: "node-shape",
          nodeKind: node.kind,
          semanticShape: node.semanticShape,
          iconKey: node.iconKey,
          rendererKey: renderer.key,
          templateName: model.templateName,
          complexityMode: model.complexityMode
        }
      }
    });
    nodeElements.set(node.id, shape);
    elements.push(shape);
    elements.push(containerText(node.label, shape, model.themeName));
    elements.push(iconText(node.iconKey, shape, model.themeName));
  }
  for (const edge of model.edges) {
    const source = nodeElements.get(edge.sourceId);
    const target = nodeElements.get(edge.targetId);
    if (!source || !target) continue;
    const arrow = routedArrow(source, target, edge, layout, model.themeName, renderer);
    elements.push(arrow);
    elements.push(edgeLabel(edge.label, arrow, model.themeName));
  }
  for (const box of layout.annotationBoxes) {
    const callout = baseElement("rectangle", box.x, box.y, box.width, box.height, model.themeName, {
      backgroundColor: theme.laneFill,
      strokeColor: theme.arrow,
      strokeStyle: "dashed",
      roundness: { type: 3 },
      customData: { excalidrawer: { role: "annotation", templateName: model.templateName, complexityMode: model.complexityMode } }
    });
    elements.push(callout);
    elements.push(containerText(box.label, callout, model.themeName, "annotation-text"));
  }
  for (const subdiagram of model.subdiagrams) {
    elements.push(...subdiagramElements(subdiagram, model, layout));
  }
  if (hasAdvancedReviewSurface(model, layout)) {
    elements.push(...legendElements(model, layout));
    elements.push(...reviewElements(model, layout));
    elements.push(...decorationBadgeElements(model, layout));
  }
  const output = scene(elements);
  return {
    ...output,
    appState: {
      ...output.appState,
      excalidrawerReview: reviewWithOptimizer(model, metadata, renderer),
      excalidrawerRenderer: renderer.key,
      excalidrawerRendererSpec: renderer,
      excalidrawerLayoutHints: model.layoutHints.map((hint) => hint.kind)
    }
  };
}

function hasAdvancedReviewSurface(model: DiagramModel, layout: DiagramLayout): boolean {
  return model.primitives.length > 0 || model.layoutHints.length > 0 || model.subdiagrams.length > 0 || layout.nodes.some((node) => node.decorations.length > 0);
}

function widenModel(model: DiagramModel, factor: number): DiagramModel {
  if (model.layoutIntent === "sequence" || model.layoutIntent === "swimlane" || model.layoutIntent === "mindmap" || model.layoutIntent === "state-machine") {
    return model;
  }
  return { ...model, nodes: model.nodes.map((node) => ({ ...node, order: node.order + factor * Math.floor(node.order / 4) })) };
}

function optimizerModels(model: DiagramModel): readonly DiagramModel[] {
  return [model, widenModel(model, 1), widenModel(model, 2)];
}

function optimizerStrategy(index: number): string {
  return ["base-layout", "relaxed-spacing", "expanded-corridors"][index] ?? `attempt-${index}`;
}

function reviewWithOptimizer(model: DiagramModel, metadata: CompileMetadata, renderer: RendererSpec): Record<string, unknown> {
  return {
    ...model.review,
    attemptCount: metadata.attemptCount,
    selectedAttempt: metadata.attemptIndex,
    optimizerAttempts: metadata.attempts,
    renderer: renderer.key,
    rendererSpec: renderer,
    grammarSummary: {
      legendItems: model.visualGrammar.legendItems.length,
      edgeTypes: [...new Set(model.edges.map((edge) => edge.edgeType))],
      routeGroups: [...new Set(model.edges.map((edge) => edge.routeGroup))]
    }
  };
}

function containerText(value: string, container: ExcalidrawElement, themeName: ThemeName, role = "node-label"): ExcalidrawElement {
  const width = Math.max(180, container.width - 44);
  const height = measureTextHeight(value, width);
  const text = freeText(value, container.x + (container.width - width) / 2, container.y + (container.height - height) / 2, width, themeName, {
    containerId: container.id,
    textAlign: "center",
    verticalAlign: "middle",
    customData: { excalidrawer: { role } }
  });
  container.boundElements = [...(container.boundElements ?? []), { id: text.id, type: "text" }];
  return text;
}

function iconText(value: string, container: ExcalidrawElement, themeName: ThemeName): ExcalidrawElement {
  const text = freeText(value, container.x + 14, container.y + 12, 54, themeName, {
    containerId: container.id,
    fontSize: 13,
    textAlign: "center",
    verticalAlign: "middle",
    customData: { excalidrawer: { role: "icon", iconKey: value } }
  });
  container.boundElements = [...(container.boundElements ?? []), { id: text.id, type: "text" }];
  return text;
}

function edgeLabel(value: string, arrow: ExcalidrawElement, themeName: ThemeName): ExcalidrawElement {
  const points = routePoints(arrow);
  const anchor = routeLabelAnchor(points) ?? { x: arrow.x + arrow.width / 2, y: arrow.y + arrow.height / 2 };
  return freeText(value, anchor.x - 56, anchor.y - 30, 112, themeName, {
    fontSize: 14,
    textAlign: "center",
    verticalAlign: "middle",
    backgroundColor: "#ffffff",
    strokeColor: themes[themeName].arrow,
    customData: { excalidrawer: { role: "edge-label", edgeType: arrow.customData?.excalidrawer?.edgeType } }
  });
}

function routedArrow(
  source: ExcalidrawElement,
  target: ExcalidrawElement,
  edge: DiagramEdge,
  layout: DiagramLayout,
  themeName: ThemeName,
  renderer: RendererSpec
): ExcalidrawElement {
  const route = routeBetween(source, target, edge, layout.nodes, renderer);
  const points = route.points.map((point) => localPoint(point, route.start));
  const arrow = baseElement("arrow", route.start.x, route.start.y, route.end.x - route.start.x, route.end.y - route.start.y, themeName, {
    backgroundColor: "transparent",
    strokeColor: edgeColor(edge.edgeType, themeName),
    strokeStyle: edgeStrokeStyle(edge.edgeType),
    strokeWidth: edge.edgeType === "alert" ? themes[themeName].strokeWidth + 1 : themes[themeName].strokeWidth,
    customData: { excalidrawer: { role: "edge", edgeType: edge.edgeType, routeGroup: edge.routeGroup, routeLane: route.routeLane } }
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

function primitiveElementFor(primitive: DiagramPrimitive, layout: DiagramLayout, themeName: ThemeName): ExcalidrawElement | undefined {
  const members = layout.nodes.filter((node) => primitive.nodeIds.includes(node.id));
  if (members.length === 0) return undefined;
  const padding = primitive.primitiveType === "trust-boundary" ? 34 : 24;
  const minX = Math.min(...members.map((node) => node.x)) - padding;
  const minY = Math.min(...members.map((node) => node.y)) - padding;
  const maxX = Math.max(...members.map((node) => node.x + node.width)) + padding;
  const maxY = Math.max(...members.map((node) => node.y + node.height)) + padding;
  return baseElement("rectangle", minX, minY, maxX - minX, maxY - minY, themeName, {
    backgroundColor: "#eff6ff",
    strokeColor: primitiveStroke(primitive.primitiveType),
    strokeStyle: "dashed",
    opacity: 30,
    roundness: { type: 3 },
    customData: { excalidrawer: { role: "primitive", primitiveType: primitive.primitiveType, rendererKey: `${primitive.primitiveType}-primitive` } }
  });
}

function subdiagramElements(subdiagram: DiagramSubdiagram, model: DiagramModel, layout: DiagramLayout): readonly ExcalidrawElement[] {
  const anchor = lowerBandAnchor(layout, 920);
  const label = subdiagram.label;
  const box = baseElement("rectangle", anchor.x, anchor.y, 440, measuredCardHeight(label, 396), model.themeName, {
    backgroundColor: "#f8fafc",
    strokeColor: "#475569",
    strokeStyle: "dotted",
    roundness: { type: 3 },
    customData: { excalidrawer: { role: "subdiagram", subdiagramId: subdiagram.id, rendererKey: model.visualGrammar.rendererKey } }
  });
  return [box, containerText(label, box, model.themeName, "subdiagram")];
}

function legendElements(model: DiagramModel, layout: DiagramLayout): readonly ExcalidrawElement[] {
  if (model.visualGrammar.legendItems.length === 0 || layout.nodes.length === 0) return [];
  const anchor = lowerBandAnchor(layout, 500);
  const label = model.visualGrammar.legendItems.map((item) => `${item.label}: ${item.edgeType}`).join("\n");
  const legend = baseElement("rectangle", anchor.x, anchor.y, 440, measuredCardHeight(label, 396), model.themeName, {
    backgroundColor: "#ffffff",
    strokeColor: themes[model.themeName].stroke,
    roundness: { type: 3 },
    customData: { excalidrawer: { role: "legend", templateName: model.templateName, rendererKey: model.visualGrammar.rendererKey, legendItem: "auto" } }
  });
  return [legend, containerText(label, legend, model.themeName, "legend")];
}

function reviewElements(model: DiagramModel, layout: DiagramLayout): readonly ExcalidrawElement[] {
  if (layout.nodes.length === 0) return [];
  const anchor = lowerBandAnchor(layout, 720);
  const label = `Review: ${model.review.status}`;
  const note = baseElement("rectangle", anchor.x, anchor.y, 440, measuredCardHeight(label, 396), model.themeName, {
    backgroundColor: "#ecfdf5",
    strokeColor: "#059669",
    roundness: { type: 3 },
    customData: { excalidrawer: { role: "review-note", reviewStatus: model.review.status } }
  });
  return [note, containerText(label, note, model.themeName, "review-note")];
}

function measuredCardHeight(label: string, textWidth: number): number {
  return Math.max(112, measureTextHeight(label, textWidth) + 48);
}

function decorationBadgeElements(model: DiagramModel, layout: DiagramLayout): readonly ExcalidrawElement[] {
  const decorated = layout.nodes.filter((node) => node.decorations.length > 0);
  if (decorated.length === 0) return [];
  const anchor = lowerBandAnchor(layout, 1120);
  return decorated.flatMap((node, index) => {
    const box = baseElement("rectangle", anchor.x + index * 300, anchor.y, 280, 72, model.themeName, {
      backgroundColor: "#fee2e2",
      strokeColor: "#dc2626",
      roundness: { type: 3 },
      customData: { excalidrawer: { role: "badge", nodeKind: node.kind, decoration: node.decorations.join(",") } }
    });
    return [box, containerText(`${node.label}: ${node.decorations.join(", ")}`, box, model.themeName, "badge")];
  });
}

function lowerBandAnchor(layout: DiagramLayout, offset: number): Point {
  const minX = Math.min(...layout.nodes.map((node) => node.x));
  const maxY = Math.max(...layout.nodes.map((node) => node.y + node.height));
  return { x: minX, y: maxY + offset };
}

function primitiveStroke(primitiveType: DiagramPrimitive["primitiveType"]): string {
  switch (primitiveType) {
    case "trust-boundary":
      return "#dc2626";
    case "event-bus":
      return "#7c3aed";
    case "deployment-zone":
      return "#2563eb";
    default:
      return assertNever(primitiveType);
  }
}

function elementTypeFor(shape: SemanticShape): ExcalidrawElement["type"] {
  switch (shape) {
    case "actor":
    case "database":
      return "ellipse";
    case "queue":
    case "state":
    case "alert":
      return "diamond";
    case "service":
    case "process":
    case "metric":
      return "rectangle";
    default:
      return assertNever(shape);
  }
}

function edgeStrokeStyle(edgeType: DiagramEdge["edgeType"]): string {
  return edgeType === "async" || edgeType === "alert" ? "dashed" : edgeType === "event" ? "dotted" : "solid";
}

function edgeColor(edgeType: DiagramEdge["edgeType"], themeName: ThemeName): string {
  if (edgeType === "alert") return "#dc2626";
  if (edgeType === "query") return "#2563eb";
  if (edgeType === "async") return "#7c3aed";
  return themes[themeName].arrow;
}

function routePoints(arrow: ExcalidrawElement): readonly Point[] {
  const points = arrow.points?.length
    ? arrow.points
    : [
        [0, 0],
        [arrow.width, arrow.height]
      ];
  return points.map(([x, y]) => ({ x: arrow.x + x, y: arrow.y + y }));
}

function routeLabelAnchor(points: readonly Point[]): Point | undefined {
  let best: { readonly point: Point; readonly length: number; readonly horizontal: boolean } | undefined;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const length = Math.hypot(dx, dy);
    if (length < 48) continue;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const betterHorizontal = best ? horizontal && (!best.horizontal || length > best.length) : true;
    const betterVertical = best ? !horizontal && !best.horizontal && length > best.length : true;
    if (betterHorizontal || betterVertical) {
      best = { point: { x: previous.x + dx / 2, y: previous.y + dy / 2 }, length, horizontal };
    }
  }
  return best?.point ?? points[Math.floor(points.length / 2)];
}

type ArrowRoute = {
  readonly start: Point;
  readonly end: Point;
  readonly points: readonly Point[];
  readonly startFixedPoint: [number, number];
  readonly endFixedPoint: [number, number];
  readonly routeLane: string;
};

function routeBetween(
  source: ExcalidrawElement,
  target: ExcalidrawElement,
  edge: DiagramEdge,
  nodes: readonly PositionedNode[],
  renderer: RendererSpec
): ArrowRoute {
  const sameRow = Math.abs(source.y - target.y) < 40;
  if (sameRow && source.x < target.x && hasClearHorizontalLane(source, target, nodes)) {
    const start = { x: source.x + source.width + 20, y: source.y + source.height / 2 };
    const end = { x: target.x - 20, y: target.y + target.height / 2 };
    return { start, end, points: [start, end], startFixedPoint: [1, 0.5], endFixedPoint: [0, 0.5], routeLane: `${edge.routeGroup}:direct` };
  }
  const targetIsBelow = target.y > source.y;
  const targetIsAbove = target.y < source.y;
  if (targetIsAbove || targetIsBelow) {
    return exteriorRoute(source, target, edge, nodes, targetIsAbove ? "top" : "bottom", renderer);
  }
  return exteriorRoute(source, target, edge, nodes, "bottom", renderer);
}

function exteriorRoute(
  source: ExcalidrawElement,
  target: ExcalidrawElement,
  edge: DiagramEdge,
  nodes: readonly PositionedNode[],
  side: "top" | "bottom",
  renderer: RendererSpec
): ArrowRoute {
  const bounds = {
    minX: Math.min(...nodes.map((node) => node.x)),
    maxX: Math.max(...nodes.map((node) => node.x + node.width)),
    minY: Math.min(...nodes.map((node) => node.y)),
    maxY: Math.max(...nodes.map((node) => node.y + node.height))
  };
  const lane = routeLane(edge, renderer);
  const gutterY = side === "top" ? bounds.minY - 80 - lane.offset : bounds.maxY + 80 + lane.offset;
  const sourceCenterX = source.x + source.width / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetIsRight = targetCenterX >= sourceCenterX;
  const horizontalGap = Math.abs(targetCenterX - sourceCenterX);
  const useHorizontalPorts = horizontalGap > 40;
  if (!useHorizontalPorts) {
    const sameColumnRoute = sameColumnExteriorRoute(source, target, edge, nodes, bounds, renderer);
    if (sameColumnRoute) return sameColumnRoute;
  }
  const start = {
    x: useHorizontalPorts ? source.x + (targetIsRight ? source.width + 20 : -20) : source.x + source.width / 2,
    y: useHorizontalPorts ? source.y + source.height / 2 : source.y + (side === "top" ? -20 : source.height + 20)
  };
  const end = {
    x: useHorizontalPorts ? target.x + (targetIsRight ? -20 : target.width + 20) : target.x + target.width / 2,
    y: useHorizontalPorts ? target.y + target.height / 2 : target.y + (side === "top" ? -20 : target.height + 20)
  };
  return {
    start,
    end,
    points: [start, { x: start.x, y: gutterY }, { x: end.x, y: gutterY }, end],
    startFixedPoint: useHorizontalPorts ? [targetIsRight ? 1 : 0, 0.5] : [0.5, side === "top" ? 0 : 1],
    endFixedPoint: useHorizontalPorts ? [targetIsRight ? 0 : 1, 0.5] : [0.5, side === "top" ? 0 : 1],
    routeLane: lane.id
  };
}

function sameColumnExteriorRoute(
  source: ExcalidrawElement,
  target: ExcalidrawElement,
  edge: DiagramEdge,
  nodes: readonly PositionedNode[],
  bounds: { readonly minX: number; readonly maxX: number },
  renderer: RendererSpec
): ArrowRoute | undefined {
  const sourceCenterX = source.x + source.width / 2;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const sides: readonly ("left" | "right")[] = sourceCenterX >= centerX ? ["right", "left"] : ["left", "right"];
  const lane = routeLane(edge, renderer);
  for (const portSide of sides) {
    const rightSide = portSide === "right";
    const gutterX = rightSide ? bounds.maxX + 110 + lane.offset : bounds.minX - 110 - lane.offset;
    const start = {
      x: source.x + (rightSide ? source.width + 20 : -20),
      y: source.y + source.height / 2
    };
    const end = {
      x: target.x + (rightSide ? target.width + 20 : -20),
      y: target.y + target.height / 2
    };
    if (!horizontalLegIsClear(start.x, gutterX, start.y, nodes) || !horizontalLegIsClear(end.x, gutterX, end.y, nodes)) continue;
    return {
      start,
      end,
      points: [start, { x: gutterX, y: start.y }, { x: gutterX, y: end.y }, end],
      startFixedPoint: [rightSide ? 1 : 0, 0.5],
      endFixedPoint: [rightSide ? 1 : 0, 0.5],
      routeLane: lane.id
    };
  }
  return undefined;
}

function routeLane(edge: DiagramEdge, renderer: RendererSpec): { readonly id: string; readonly offset: number } {
  const groupIndex = routeGroupIndex(edge.routeGroup);
  const stagger = edge.order % 4;
  return {
    id: `${edge.routeGroup}:lane-${groupIndex}`,
    offset: groupIndex * renderer.routeSpacing + stagger * Math.max(8, renderer.routeSpacing / 2)
  };
}

function routeGroupIndex(routeGroup: string): number {
  if (routeGroup.startsWith("sync-")) return 0;
  if (routeGroup.startsWith("async-")) return 1;
  if (routeGroup.startsWith("query-")) return 2;
  if (routeGroup.startsWith("event-")) return 3;
  if (routeGroup.startsWith("alert-")) return 4;
  if (routeGroup.startsWith("return-")) return 5;
  return 6;
}

function horizontalLegIsClear(startX: number, endX: number, y: number, nodes: readonly PositionedNode[]): boolean {
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  return !nodes.some((node) => {
    const overlapsX = maxX > node.x - 8 && minX < node.x + node.width + 8;
    const overlapsY = y > node.y - 8 && y < node.y + node.height + 8;
    return overlapsX && overlapsY;
  });
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

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
