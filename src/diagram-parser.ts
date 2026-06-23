import {
  layoutIntents,
  type CompileDiagramInput,
  type ComplexityMode,
  type DiagramEdge,
  type DiagramModel,
  type DiagramNode,
  type EdgeType,
  type LayoutIntent,
  type SemanticShape
} from "./diagram-model.js";

const edgePattern = /\s*(?:,|;|\n|\band\b|\bthen\b)\s*/i;
const relationPattern = /\s+(to|calls?|writes?|reads?|consumes?|retries?|issues?|observes?|notifies?|sends?|returns?|queues?|publishes?|subscribes?|routes?|validates?|exports?|renders?|authenticates?|reports?|investigates?|transitions?)\s+/i;

export function parseDiagramPrompt(input: string | CompileDiagramInput): DiagramModel {
  const prompt = typeof input === "string" ? input : input.prompt;
  const explicitIntent = typeof input === "string" ? undefined : input.layoutIntent;
  const themeName = typeof input === "string" ? "technical" : input.themeName ?? "technical";
  const layoutIntent = explicitIntent ?? inferLayoutIntent(prompt);
  const templateName = typeof input === "string" ? layoutIntent : input.templateName ?? layoutIntent;
  const complexityMode = typeof input === "string" ? inferComplexityMode(prompt) : input.complexityMode ?? inferComplexityMode(prompt);
  const parts = stripIntentPrefix(prompt, layoutIntent).split(edgePattern).map((part) => part.trim()).filter(Boolean);
  const parsedEdges = parseMixedEdges(parts);
  const labels = parsedEdges.length > 0 ? uniqueLabels(parsedEdges) : fallbackLabels(parts);
  const edges = parsedEdges.length > 0 ? parsedEdges : sequentialEdges(labels);
  const nodes = labels.map((label, order) => nodeFromLabel(label, order, layoutIntent));
  const nodeIds = new Map(nodes.map((node) => [node.label.toLowerCase(), node.id]));
  const resolvedEdges: readonly DiagramEdge[] = edges.flatMap((edge) => {
    const sourceId = nodeIds.get(edge.sourceLabel.toLowerCase());
    const targetId = nodeIds.get(edge.targetLabel.toLowerCase());
    return sourceId && targetId
      ? [{ id: `edge-${edge.order}`, sourceId, targetId, label: edge.verb, verb: edge.verb, edgeType: edgeTypeFromVerb(edge.verb), order: edge.order }]
      : [];
  });

  return {
    nodes,
    edges: resolvedEdges,
    groups: buckets(nodes, "groupId").map(([id, bucket]) => ({ id, label: title(id), nodeIds: bucket.map((node) => node.id) })),
    lanes: buckets(nodes, "laneId").map(([id, bucket]) => ({ id, label: title(id), nodeIds: bucket.map((node) => node.id) })),
    clusters: buckets(nodes, "clusterId").map(([id, bucket]) => ({ id, label: title(id), nodeIds: bucket.map((node) => node.id) })),
    annotations: annotationsFor(layoutIntent, complexityMode, nodes),
    layoutIntent,
    themeName,
    templateName,
    complexityMode
  };
}

function fallbackLabels(parts: readonly string[]): readonly string[] {
  const labels = parts.flatMap((part) => part.split(/\s*(?:->|=>)\s*|\s+\b(?:to|then)\b\s+/i).map((label) => label.trim()).filter(Boolean));
  return [...new Set(labels)];
}

function sequentialEdges(labels: readonly string[]): readonly ParsedEdge[] {
  return labels.slice(0, -1).map((sourceLabel, order) => ({ sourceLabel, targetLabel: labels[order + 1] ?? "", verb: "to", order }));
}

function stripIntentPrefix(prompt: string, layoutIntent: LayoutIntent): string {
  return prompt.replace(new RegExp(`^\\s*(?:layout:)?${layoutIntent}\\s*:\\s*`, "i"), "");
}

type ParsedEdge = {
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly verb: string;
  readonly order: number;
};

function parseMixedEdges(parts: readonly string[]): readonly ParsedEdge[] {
  const edges: ParsedEdge[] = [];
  let lastLabel: string | undefined;
  for (const part of parts) {
    const parsed = parseEdge(part, edges.length)[0];
    if (parsed) {
      edges.push(parsed);
      lastLabel = parsed.targetLabel;
      continue;
    }
    for (const label of fallbackLabels([part])) {
      if (lastLabel && label.toLowerCase() !== lastLabel.toLowerCase()) {
        edges.push({ sourceLabel: lastLabel, targetLabel: label, verb: "to", order: edges.length });
      }
      lastLabel = label;
    }
  }
  return edges;
}

function parseEdge(part: string, order: number): readonly ParsedEdge[] {
  const match = relationPattern.exec(part);
  if (!match?.[1]) return [];
  const sourceLabel = part.slice(0, match.index).trim();
  const targetLabel = part.slice(match.index + match[0].length).trim();
  if (!sourceLabel || !targetLabel) return [];
  return [{ sourceLabel, targetLabel, verb: match[1].toLowerCase(), order }];
}

function inferLayoutIntent(prompt: string): LayoutIntent {
  const lower = prompt.toLowerCase();
  const named = layoutIntents.find((intent) => lower.startsWith(`${intent}:`) || lower.includes(`layout:${intent}`));
  if (named) return named;
  if (lower.includes("incident") || lower.includes("outage") || lower.includes("on-call")) return "incident-response";
  if (lower.includes("lane") || lower.includes("team")) return "swimlane";
  if (lower.includes("state") || lower.includes("transition")) return "state-machine";
  if (lower.includes("actor") || lower.includes("message")) return "sequence";
  if (lower.includes("source") || lower.includes("sink") || lower.includes("transform")) return "data-flow";
  if (lower.includes("parent") || lower.includes("child") || lower.includes("idea")) return "mindmap";
  if (lower.includes("api") || lower.includes("service") || lower.includes("database") || lower.includes("queue")) return "architecture";
  return "flow";
}

function uniqueLabels(edges: readonly ParsedEdge[]): readonly string[] {
  return [...new Set(edges.flatMap((edge) => [edge.sourceLabel, edge.targetLabel]))];
}

function nodeFromLabel(label: string, order: number, layoutIntent: LayoutIntent): DiagramNode {
  const kind = kindFromLabel(label);
  const groupId = groupFromKind(kind, layoutIntent);
  return {
    id: `node-${order}`,
    label,
    kind,
    semanticShape: semanticShapeFromKind(kind),
    iconKey: iconFromKind(kind),
    groupId,
    laneId: laneFromKind(kind),
    clusterId: groupId,
    order
  };
}

function kindFromLabel(label: string): DiagramNode["kind"] {
  const lower = label.toLowerCase();
  if (/(user|admin|client|frontend|browser)/.test(lower)) return "actor";
  if (/(postgres|database|db|warehouse)/.test(lower)) return "database";
  if (/(queue|topic|stream)/.test(lower)) return "queue";
  if (/(metric|collector|dashboard)/.test(lower)) return "metric";
  if (/(alert|pager|notify)/.test(lower)) return "alert";
  if (/(state|status)/.test(lower)) return "state";
  if (/(api|service|auth|worker)/.test(lower)) return "service";
  return "process";
}

function semanticShapeFromKind(kind: DiagramNode["kind"]): SemanticShape {
  return kind;
}

function iconFromKind(kind: DiagramNode["kind"]): string {
  switch (kind) {
    case "actor":
      return "USER";
    case "database":
      return "DB";
    case "queue":
      return "Q";
    case "metric":
      return "MET";
    case "alert":
      return "ALR";
    case "state":
      return "ST";
    case "service":
      return "API";
    case "process":
      return "PROC";
    default:
      return assertNever(kind);
  }
}

function edgeTypeFromVerb(verb: string): EdgeType {
  if (/writes?|reads?|queries?/.test(verb)) return "query";
  if (/consumes?|queues?|publishes?|subscribes?|retries?/.test(verb)) return "async";
  if (/notifies?|alerts?|reports?/.test(verb)) return "alert";
  if (/returns?/.test(verb)) return "return";
  if (/observes?|sends?/.test(verb)) return "event";
  return "sync";
}

function inferComplexityMode(prompt: string): ComplexityMode {
  const lower = prompt.toLowerCase();
  if (lower.includes("compact")) return "compact";
  if (lower.includes("detailed") || lower.includes("complex")) return "detailed";
  return "balanced";
}

function annotationsFor(layoutIntent: LayoutIntent, complexityMode: ComplexityMode, nodes: readonly DiagramNode[]) {
  const base = [{ id: "annotation-main", label: `${title(layoutIntent)} diagram generated from ${nodes.length} entities`, nodeIds: nodes.slice(0, 3).map((node) => node.id) }];
  if (complexityMode !== "detailed") return base;
  return [
    ...base,
    { id: "annotation-risk", label: "Review async boundaries, ownership, and failure handling before implementation.", nodeIds: nodes.slice(-3).map((node) => node.id) }
  ];
}

function groupFromKind(kind: DiagramNode["kind"], layoutIntent: LayoutIntent): string {
  if (layoutIntent === "sequence") return "sequence";
  if (kind === "actor") return "experience";
  if (kind === "database" || kind === "queue") return "data";
  if (kind === "metric" || kind === "alert") return "operations";
  return "services";
}

function laneFromKind(kind: DiagramNode["kind"]): string {
  if (kind === "actor") return "consumer";
  if (kind === "database" || kind === "queue") return "data";
  if (kind === "metric" || kind === "alert") return "ops";
  return "platform";
}

function buckets(nodes: readonly DiagramNode[], key: "groupId" | "laneId" | "clusterId"): readonly [string, readonly DiagramNode[]][] {
  const ids = [...new Set(nodes.map((node) => node[key]))];
  return ids.map((id) => [id, nodes.filter((node) => node[key] === id)]);
}

function title(value: string): string {
  return value.split("-").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
