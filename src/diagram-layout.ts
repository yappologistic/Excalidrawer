import type { DiagramModel, DiagramNode, LayoutIntent } from "./diagram-model.js";
import { measureTextHeight, recommendedTextWidth } from "./scene-quality.js";

export type PositionedNode = {
  readonly id: string;
  readonly label: string;
  readonly kind: DiagramNode["kind"];
  readonly semanticShape: DiagramNode["semanticShape"];
  readonly iconKey: string;
  readonly groupId: string;
  readonly laneId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type DiagramLayout = {
  readonly nodes: readonly PositionedNode[];
  readonly groupBoxes: readonly LayoutBox[];
  readonly laneBoxes: readonly LayoutBox[];
  readonly annotationBoxes: readonly LayoutBox[];
};

export type LayoutBox = {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const grid = {
  startX: 100,
  startY: 140,
  columnStep: 310,
  rowStep: 190,
  nodeMinWidth: 220,
  nodeMinHeight: 104,
  padding: 44
} as const;

export function layoutDiagram(model: DiagramModel): DiagramLayout {
  const spacing = spacingFor(model.complexityMode);
  const nodes = model.nodes.map((node) => positionNode(node, model.layoutIntent, model.nodes.length, spacing));
  return {
    nodes,
    groupBoxes: boxesFor(model.groups.map((group) => ({ id: group.id, label: group.label, nodeIds: group.nodeIds })), nodes),
    laneBoxes: model.layoutIntent === "swimlane" || model.layoutIntent === "sequence"
      ? boxesFor(model.lanes.map((lane) => ({ id: lane.id, label: lane.label, nodeIds: lane.nodeIds })), nodes)
      : [],
    annotationBoxes: annotationBoxesFor(model.annotations, nodes, spacing)
  };
}

function positionNode(node: DiagramNode, intent: LayoutIntent, total: number, spacing: Spacing): PositionedNode {
  const size = nodeSize(node.label, spacing);
  switch (intent) {
    case "architecture":
      return gridPosition(node, size, 4, spacing);
    case "flow":
    case "data-flow":
      return gridPosition(node, size, Math.min(5, Math.max(2, total)), spacing);
    case "mindmap":
      if (total > 8) return gridPosition(node, size, 4, spacing);
      return radialPosition(node, size, total, spacing);
    case "state-machine":
      return gridPosition(node, size, Math.min(3, Math.max(2, total)), spacing);
    case "sequence":
    case "swimlane":
      return sequencePosition(node, size, total, spacing);
    case "incident-response":
      return gridPosition(node, size, Math.min(4, Math.max(2, total)), spacing);
    default:
      return assertNever(intent);
  }
}

function gridPosition(node: DiagramNode, size: Pick<PositionedNode, "width" | "height">, columns: number, spacing: Spacing): PositionedNode {
  const column = node.order % columns;
  const row = Math.floor(node.order / columns);
  return {
    ...size,
    id: node.id,
    label: node.label,
    kind: node.kind,
    semanticShape: node.semanticShape,
    iconKey: node.iconKey,
    groupId: node.groupId,
    laneId: node.laneId,
    x: grid.startX + column * spacing.columnStep,
    y: grid.startY + row * spacing.rowStep
  };
}

function sequencePosition(node: DiagramNode, size: Pick<PositionedNode, "width" | "height">, total: number, spacing: Spacing): PositionedNode {
  const columns = Math.min(6, Math.max(2, total));
  const column = node.order % columns;
  const rowBlock = Math.floor(node.order / columns);
  return {
    ...size,
    id: node.id,
    label: node.label,
    kind: node.kind,
    semanticShape: node.semanticShape,
    iconKey: node.iconKey,
    groupId: node.groupId,
    laneId: node.laneId,
    x: grid.startX + column * spacing.columnStep,
    y: grid.startY + (laneIndex(node.laneId) + rowBlock * 3) * spacing.rowStep
  };
}

function radialPosition(node: DiagramNode, size: Pick<PositionedNode, "width" | "height">, total: number, spacing: Spacing): PositionedNode {
  if (node.order === 0) return gridPosition(node, size, 1, spacing);
  const angle = ((node.order - 1) / Math.max(1, total - 1)) * Math.PI * 2;
  const radiusX = Math.max(360, spacing.columnStep * 1.5);
  const radiusY = Math.max(240, spacing.rowStep * 1.2);
  return {
    ...size,
    id: node.id,
    label: node.label,
    kind: node.kind,
    semanticShape: node.semanticShape,
    iconKey: node.iconKey,
    groupId: node.groupId,
    laneId: node.laneId,
    x: grid.startX + radiusX + Math.cos(angle) * radiusX,
    y: grid.startY + radiusY + Math.sin(angle) * radiusY
  };
}

function nodeSize(label: string, spacing: Spacing): Pick<PositionedNode, "width" | "height"> {
  const textWidth = recommendedTextWidth(label);
  return {
    width: Math.max(grid.nodeMinWidth, textWidth + spacing.nodePadding),
    height: Math.max(grid.nodeMinHeight, measureTextHeight(label, textWidth) + spacing.nodePadding)
  };
}

function boxesFor(groups: readonly { readonly id: string; readonly label: string; readonly nodeIds: readonly string[] }[], nodes: readonly PositionedNode[]): readonly LayoutBox[] {
  return groups.flatMap((group) => {
    const members = nodes.filter((node) => group.nodeIds.includes(node.id));
    if (members.length < 2) return [];
    const minX = Math.min(...members.map((node) => node.x)) - grid.padding;
    const minY = Math.min(...members.map((node) => node.y)) - grid.padding;
    const maxX = Math.max(...members.map((node) => node.x + node.width)) + grid.padding;
    const maxY = Math.max(...members.map((node) => node.y + node.height)) + grid.padding;
    return [{ id: group.id, label: group.label, x: minX, y: minY, width: maxX - minX, height: maxY - minY }];
  });
}

type Spacing = {
  readonly columnStep: number;
  readonly rowStep: number;
  readonly nodePadding: number;
};

function spacingFor(mode: DiagramModel["complexityMode"]): Spacing {
  switch (mode) {
    case "compact":
      return { columnStep: 280, rowStep: 178, nodePadding: 48 };
    case "balanced":
      return { columnStep: grid.columnStep, rowStep: grid.rowStep, nodePadding: 56 };
    case "detailed":
      return { columnStep: 360, rowStep: 230, nodePadding: 66 };
    default:
      return assertNever(mode);
  }
}

function laneIndex(laneId: string): number {
  const ids = ["consumer", "platform", "data", "ops"];
  return Math.max(0, ids.indexOf(laneId));
}

function annotationBoxesFor(annotations: DiagramModel["annotations"], nodes: readonly PositionedNode[], spacing: Spacing): readonly LayoutBox[] {
  if (annotations.length === 0 || nodes.length === 0) return [];
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  const minX = Math.min(...nodes.map((node) => node.x));
  return annotations.map((annotation, index) => ({
    id: annotation.id,
    label: annotation.label,
    x: minX + index * Math.min(480, spacing.columnStep + 120),
    y: maxY + 300,
    width: 420,
    height: 132
  }));
}

function assertNever(value: never): never {
  throw new Error(`Unhandled layout intent: ${value}`);
}
