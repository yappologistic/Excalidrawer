import { layoutIntents, type CompileDiagramInput, type DiagramModel, type DiagramNode, type LayoutIntent } from "./diagram-model.js";

const edgePattern = /\s*(?:,|;|\n|\band\b|\bthen\b)\s*/i;
const relationPattern = /\s+(to|calls?|writes?|reads?|consumes?|retries?|issues?|observes?|notifies?|sends?|returns?|queues?|publishes?|subscribes?|routes?|validates?|exports?|renders?|authenticates?)\s+/i;

export function parseDiagramPrompt(input: string | CompileDiagramInput): DiagramModel {
  const prompt = typeof input === "string" ? input : input.prompt;
  const explicitIntent = typeof input === "string" ? undefined : input.layoutIntent;
  const themeName = typeof input === "string" ? "technical" : input.themeName ?? "technical";
  const layoutIntent = explicitIntent ?? inferLayoutIntent(prompt);
  const parts = stripIntentPrefix(prompt, layoutIntent).split(edgePattern).map((part) => part.trim()).filter(Boolean);
  const parsedEdges = parseMixedEdges(parts);
  const labels = parsedEdges.length > 0 ? uniqueLabels(parsedEdges) : fallbackLabels(parts);
  const edges = parsedEdges.length > 0 ? parsedEdges : sequentialEdges(labels);
  const nodes = labels.map((label, order) => nodeFromLabel(label, order, layoutIntent));
  const nodeIds = new Map(nodes.map((node) => [node.label.toLowerCase(), node.id]));
  const resolvedEdges = edges.flatMap((edge) => {
    const sourceId = nodeIds.get(edge.sourceLabel.toLowerCase());
    const targetId = nodeIds.get(edge.targetLabel.toLowerCase());
    return sourceId && targetId ? [{ id: `edge-${edge.order}`, sourceId, targetId, label: edge.verb, verb: edge.verb, order: edge.order }] : [];
  });

  return {
    nodes,
    edges: resolvedEdges,
    groups: buckets(nodes, "groupId").map(([id, bucket]) => ({ id, label: title(id), nodeIds: bucket.map((node) => node.id) })),
    lanes: buckets(nodes, "laneId").map(([id, bucket]) => ({ id, label: title(id), nodeIds: bucket.map((node) => node.id) })),
    clusters: buckets(nodes, "clusterId").map(([id, bucket]) => ({ id, label: title(id), nodeIds: bucket.map((node) => node.id) })),
    annotations: [{ id: "annotation-main", label: `${title(layoutIntent)} diagram generated from ${nodes.length} entities`, nodeIds: nodes.slice(0, 3).map((node) => node.id) }],
    layoutIntent,
    themeName
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
  return { id: `node-${order}`, label, kind, groupId, laneId: laneFromKind(kind), clusterId: groupId, order };
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
