import type { DiagramModel, DiagramNode, LayoutIntent } from "./diagram-model.js";
import { measureTextHeight, recommendedTextWidth } from "./scene-quality.js";

export type PositionedNode = {
  readonly id: string;
  readonly label: string;
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
  const nodes = model.nodes.map((node) => positionNode(node, model.layoutIntent, model.nodes.length));
  return {
    nodes,
    groupBoxes: boxesFor(model.groups.map((group) => ({ id: group.id, label: group.label, nodeIds: group.nodeIds })), nodes),
    laneBoxes: model.layoutIntent === "swimlane" || model.layoutIntent === "sequence"
      ? boxesFor(model.lanes.map((lane) => ({ id: lane.id, label: lane.label, nodeIds: lane.nodeIds })), nodes)
      : []
  };
}

function positionNode(node: DiagramNode, intent: LayoutIntent, total: number): PositionedNode {
  const size = nodeSize(node.label);
  switch (intent) {
    case "architecture":
      return gridPosition(node, size, 4);
    case "flow":
    case "data-flow":
      return gridPosition(node, size, Math.min(5, Math.max(2, total)));
    case "mindmap":
    case "state-machine":
      return gridPosition(node, size, Math.min(4, Math.max(2, total)));
    case "sequence":
    case "swimlane":
      return gridPosition(node, size, Math.min(4, Math.max(2, total)));
    default:
      return assertNever(intent);
  }
}

function gridPosition(node: DiagramNode, size: Pick<PositionedNode, "width" | "height">, columns: number): PositionedNode {
  const column = node.order % columns;
  const row = Math.floor(node.order / columns);
  return {
    ...size,
    id: node.id,
    label: node.label,
    groupId: node.groupId,
    laneId: node.laneId,
    x: grid.startX + column * grid.columnStep,
    y: grid.startY + row * grid.rowStep
  };
}

function nodeSize(label: string): Pick<PositionedNode, "width" | "height"> {
  const textWidth = recommendedTextWidth(label);
  return {
    width: Math.max(grid.nodeMinWidth, textWidth + 50),
    height: Math.max(grid.nodeMinHeight, measureTextHeight(label, textWidth) + 54)
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

function assertNever(value: never): never {
  throw new Error(`Unhandled layout intent: ${value}`);
}
