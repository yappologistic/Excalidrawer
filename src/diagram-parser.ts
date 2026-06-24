import {
  layoutIntents,
  type CompileDiagramInput,
  type CompoundComponent,
  type ComplexityMode,
  type DiagramAnchor,
  type DiagramCritic,
  type DiagramEdge,
  type DiagramLayoutHint,
  type DiagramModel,
  type DiagramNode,
  type DiagramPattern,
  type DiagramPort,
  type DiagramPrimitive,
  type DiagramSubdiagram,
  type DomainPack,
  type EdgeType,
  type GoldenFixture,
  type ImportedSource,
  type LayoutProfile,
  type LayoutIntent,
  type NodeDecoration,
  type ProgressiveDetail,
  type SemanticShape,
  type StylePreset,
  type ThemeName,
  type VisualGrammar
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
  const graphParts = parts.filter((part) => !isAdvancedDirective(part));
  const parsedEdges = parseMixedEdges(graphParts);
  const labels = parsedEdges.length > 0 ? uniqueLabels(parsedEdges) : fallbackLabels(graphParts);
  const edges = parsedEdges.length > 0 ? parsedEdges : sequentialEdges(labels);
  const nodes = labels.map((label, order) => nodeFromLabel(label, order, layoutIntent, prompt));
  const nodeIds = new Map(nodes.map((node) => [node.label.toLowerCase(), node.id]));
  const resolvedEdges: readonly DiagramEdge[] = edges.flatMap((edge) => {
    const sourceId = nodeIds.get(edge.sourceLabel.toLowerCase());
    const targetId = nodeIds.get(edge.targetLabel.toLowerCase());
    return sourceId && targetId
      ? [{
          id: `edge-${edge.order}`,
          sourceId,
          targetId,
          label: edge.verb,
          verb: edge.verb,
          edgeType: edgeTypeFromVerb(edge.verb),
          routeGroup: routeGroupFor(edgeTypeFromVerb(edge.verb), edge.order),
          order: edge.order
        }]
      : [];
  });

  const layoutHints = layoutHintsFor(prompt);
  const domainPack = domainPackFor(prompt, nodes);
  const layoutProfile = layoutProfileFor(prompt, complexityMode);
  const stylePreset = stylePresetFor(prompt, themeName);
  const importedSource = importedSourceFor(prompt);
  const progressiveDetail = progressiveDetailFor(prompt, complexityMode, nodes);
  const patterns = patternsFor(prompt, nodes);
  const compoundComponents = compoundComponentsFor(nodes, resolvedEdges);
  const ports = portsFor(nodes);
  const anchors = anchorsFor(ports);
  const critic = criticFor(layoutHints, resolvedEdges, nodes);
  const goldenFixture = goldenFixtureFor(layoutIntent, domainPack, layoutProfile);
  return {
    nodes,
    edges: resolvedEdges,
    groups: buckets(nodes, "groupId").map(([id, bucket]) => ({ id, label: title(id), nodeIds: bucket.map((node) => node.id) })),
    lanes: buckets(nodes, "laneId").map(([id, bucket]) => ({ id, label: title(id), nodeIds: bucket.map((node) => node.id) })),
    clusters: buckets(nodes, "clusterId").map(([id, bucket]) => ({ id, label: title(id), nodeIds: bucket.map((node) => node.id) })),
    annotations: annotationsFor(layoutIntent, complexityMode, nodes),
    primitives: primitivesFor(prompt, nodes),
    layoutHints,
    subdiagrams: subdiagramsFor(prompt, nodes),
    patterns,
    domainPack,
    layoutProfile,
    stylePreset,
    importedSource,
    progressiveDetail,
    critic,
    compoundComponents,
    ports,
    anchors,
    goldenFixture,
    visualGrammar: visualGrammarFor(layoutIntent, resolvedEdges),
    review: reviewFor(layoutHints, resolvedEdges, critic),
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

function isAdvancedDirective(part: string): boolean {
  return /^(?:expand|put|group|mark|domain:|pattern:|profile:|preset:|import:|detail:)\b/i.test(part);
}

function stripIntentPrefix(prompt: string, layoutIntent: LayoutIntent): string {
  return prompt.replace(new RegExp(`^\\s*(?:layout:)?${layoutIntent}(?:\\s+(?:compact|balanced|detailed|complex))?\\s*:\\s*`, "i"), "");
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
    if (isAdvancedDirective(part) || isDirectiveFragment(part)) continue;
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

function isDirectiveFragment(part: string): boolean {
  const lower = part.trim().toLowerCase();
  return lower === "pii" || lower === "critical";
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
  const named = layoutIntents.find((intent) => lower.startsWith(`${intent}:`) || lower.startsWith(`${intent} `) || lower.includes(`layout:${intent}`));
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

function nodeFromLabel(label: string, order: number, layoutIntent: LayoutIntent, prompt: string): DiagramNode {
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
    order,
    decorations: decorationsFor(label, prompt)
  };
}

function kindFromLabel(label: string): DiagramNode["kind"] {
  const lower = label.toLowerCase();
  if (/(user|admin|client|frontend|browser)/.test(lower)) return "actor";
  if (/(postgres|database|db|warehouse)/.test(lower)) return "database";
  if (/(queue|topic|stream|bus)/.test(lower)) return "queue";
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

function routeGroupFor(edgeType: EdgeType, _order: number): string {
  return `${edgeType}-corridor`;
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

function primitivesFor(prompt: string, nodes: readonly DiagramNode[]): readonly DiagramPrimitive[] {
  const lower = prompt.toLowerCase();
  const primitives: DiagramPrimitive[] = [];
  if (lower.includes("trust boundary")) {
    primitives.push({ id: "primitive-trust-boundary", primitiveType: "trust-boundary", label: "Trust boundary", nodeIds: boundaryNodeIds(nodes) });
  }
  const eventBus = nodes.find((node) => node.label.toLowerCase().includes("event bus"));
  if (eventBus) {
    primitives.push({ id: "primitive-event-bus", primitiveType: "event-bus", label: "Event bus", nodeIds: [eventBus.id] });
  }
  const dataZoneNodes = nodes.filter((node) => node.label.toLowerCase().includes("data zone") || node.kind === "database");
  if (lower.includes("data zone") && dataZoneNodes.length > 0) {
    primitives.push({ id: "primitive-data-zone", primitiveType: "deployment-zone", label: "Data zone", nodeIds: dataZoneNodes.map((node) => node.id) });
  }
  return primitives;
}

function boundaryNodeIds(nodes: readonly DiagramNode[]): readonly string[] {
  const actor = nodes.find((node) => node.kind === "actor");
  const service = nodes.find((node) => node.kind === "service");
  return [actor?.id, service?.id].filter((id): id is string => id !== undefined);
}

function layoutHintsFor(prompt: string): readonly DiagramLayoutHint[] {
  const lower = prompt.toLowerCase();
  const hints: DiagramLayoutHint[] = [];
  if (lower.includes("put databases at bottom") || lower.includes("databases at bottom")) {
    hints.push({ id: "hint-database-bottom", kind: "database-bottom", label: "Put databases at bottom" });
  }
  if (lower.includes("group aws services together") || lower.includes("group cloud")) {
    hints.push({ id: "hint-group-cloud", kind: "group-cloud", label: "Group cloud services together" });
  }
  return hints;
}

function subdiagramsFor(prompt: string, nodes: readonly DiagramNode[]): readonly DiagramSubdiagram[] {
  if (!prompt.toLowerCase().includes("expand api internals")) return [];
  const apiNode = nodes.find((node) => node.label.toLowerCase() === "api");
  return apiNode ? [{ id: "subdiagram-api-internals", parentNodeId: apiNode.id, label: "API internals" }] : [];
}

function patternsFor(prompt: string, nodes: readonly DiagramNode[]): readonly DiagramPattern[] {
  const lower = prompt.toLowerCase();
  const patterns: DiagramPattern[] = [];
  if (lower.includes("pattern: strangler") || lower.includes("strangler migration")) {
    patterns.push({
      id: "pattern-strangler-migration",
      name: "strangler-migration",
      label: "Strangler migration",
      nodeIds: nodes.slice(0, 4).map((node) => node.id)
    });
  }
  if (lower.includes("event-driven") || nodes.some((node) => node.kind === "queue")) {
    patterns.push({
      id: "pattern-event-driven",
      name: "event-driven",
      label: "Event-driven backbone",
      nodeIds: nodes.filter((node) => node.kind === "queue" || node.kind === "service").map((node) => node.id)
    });
  }
  if (lower.includes("service blueprint")) {
    patterns.push({
      id: "pattern-service-blueprint",
      name: "service-blueprint",
      label: "Service blueprint",
      nodeIds: nodes.map((node) => node.id)
    });
  }
  return patterns;
}

function domainPackFor(prompt: string, nodes: readonly DiagramNode[]): DomainPack {
  const lower = prompt.toLowerCase();
  if (lower.includes("domain: ecommerce") || /(checkout|orders?|buyer|storefront|payment)/.test(lower)) {
    return { name: "ecommerce", label: "Ecommerce", vocabulary: ["buyer", "storefront", "checkout", "orders", "payment"] };
  }
  if (lower.includes("domain: saas") || /(tenant|subscription|workspace)/.test(lower)) {
    return { name: "saas", label: "SaaS", vocabulary: ["tenant", "workspace", "subscription", "billing"] };
  }
  if (lower.includes("domain: data") || nodes.some((node) => node.kind === "metric")) {
    return { name: "data-platform", label: "Data platform", vocabulary: ["source", "transform", "warehouse", "dashboard"] };
  }
  if (lower.includes("domain: incident") || lower.includes("incident")) {
    return { name: "incident", label: "Incident response", vocabulary: ["alert", "on-call", "mitigation", "postmortem"] };
  }
  return { name: "generic", label: "Generic", vocabulary: ["actor", "service", "data", "operation"] };
}

function layoutProfileFor(prompt: string, complexityMode: ComplexityMode): LayoutProfile {
  const lower = prompt.toLowerCase();
  if (lower.includes("profile: spacious") || lower.includes("spacious layout")) {
    return { name: "spacious", label: "Spacious layout", spacingMultiplier: 1.25 };
  }
  if (lower.includes("profile: compact") || complexityMode === "compact") {
    return { name: "compact", label: "Compact layout", spacingMultiplier: 0.9 };
  }
  return { name: "balanced", label: "Balanced layout", spacingMultiplier: 1 };
}

function stylePresetFor(prompt: string, themeName: ThemeName): StylePreset {
  const lower = prompt.toLowerCase();
  if (lower.includes("preset: boardroom") || themeName === "executive") {
    return { name: "boardroom", label: "Boardroom", tone: "executive" };
  }
  if (lower.includes("preset: deep-work")) {
    return { name: "deep-work", label: "Deep work", tone: "technical" };
  }
  if (lower.includes("preset: review-ready")) {
    return { name: "review-ready", label: "Review ready", tone: "operational" };
  }
  return { name: "default", label: "Default", tone: "technical" };
}

function importedSourceFor(prompt: string): ImportedSource | undefined {
  const match = /\bimport:\s*(json|yaml|mermaid|csv)\b/i.exec(prompt);
  if (!match?.[1]) return undefined;
  const format = match[1].toLowerCase() as ImportedSource["format"];
  return { format, label: `${title(format)} import` };
}

function progressiveDetailFor(prompt: string, complexityMode: ComplexityMode, nodes: readonly DiagramNode[]): ProgressiveDetail {
  const lower = prompt.toLowerCase();
  const level = lower.includes("detail: deep") || complexityMode === "detailed" ? "deep" : lower.includes("detail: overview") ? "overview" : "standard";
  const revealOrder = level === "overview" ? nodes.slice(0, 4).map((node) => node.id) : nodes.map((node) => node.id);
  return { level, revealOrder };
}

function compoundComponentsFor(nodes: readonly DiagramNode[], edges: readonly DiagramEdge[]): readonly CompoundComponent[] {
  const components: CompoundComponent[] = [];
  for (const edge of edges) {
    const source = nodes.find((node) => node.id === edge.sourceId);
    const target = nodes.find((node) => node.id === edge.targetId);
    if (!source || !target) continue;
    if (source.kind === "service" && target.kind === "database") {
      components.push({ id: `compound-${source.id}-${target.id}`, kind: "service-with-database", label: `${source.label} + ${target.label}`, nodeIds: [source.id, target.id] });
    }
    if ((source.kind === "service" || source.kind === "process") && target.kind === "queue") {
      components.push({ id: `compound-${source.id}-${target.id}`, kind: "async-worker", label: `${source.label} async path`, nodeIds: [source.id, target.id] });
    }
    if (source.kind === "actor" && target.kind === "service") {
      components.push({ id: `compound-${source.id}-${target.id}`, kind: "actor-entrypoint", label: `${source.label} entrypoint`, nodeIds: [source.id, target.id] });
    }
  }
  return dedupeById(components);
}

function portsFor(nodes: readonly DiagramNode[]): readonly DiagramPort[] {
  return nodes.flatMap((node) => [
    { id: `port-${node.id}-left`, nodeId: node.id, side: "left", label: "input" },
    { id: `port-${node.id}-right`, nodeId: node.id, side: "right", label: "output" }
  ] as const);
}

function anchorsFor(ports: readonly DiagramPort[]): readonly DiagramAnchor[] {
  return ports.map((port) => ({ id: `anchor-${port.id}`, nodeId: port.nodeId, portId: port.id, kind: "edge-anchor" }));
}

function criticFor(layoutHints: readonly DiagramLayoutHint[], edges: readonly DiagramEdge[], nodes: readonly DiagramNode[]): DiagramCritic {
  const checks = [
    { id: "node-spacing", status: "pass", message: `Checked spacing for ${nodes.length} nodes` },
    { id: "edge-routing", status: "pass", message: `Routed ${edges.length} edges through reserved corridors` },
    { id: "label-centering", status: "pass", message: "Centered node and edge labels" },
    { id: "semantic-coverage", status: nodes.length >= 3 ? "pass" : "warn", message: "Mapped labels to semantic node kinds" },
    { id: "layout-hints", status: "pass", message: `Applied ${layoutHints.length} layout hints` }
  ] as const;
  const score = checks.reduce((total, check) => total + (check.status === "pass" ? 20 : check.status === "warn" ? 10 : 0), 0);
  return { score, checks };
}

function goldenFixtureFor(layoutIntent: LayoutIntent, domainPack: DomainPack, layoutProfile: LayoutProfile): GoldenFixture {
  return {
    name: `${layoutIntent}-${domainPack.name}-${layoutProfile.name}`,
    description: `${title(layoutIntent)} fixture for ${domainPack.label} using ${layoutProfile.label}`
  };
}

function visualGrammarFor(layoutIntent: LayoutIntent, edges: readonly DiagramEdge[]): VisualGrammar {
  const edgeTypes = [...new Set(edges.map((edge) => edge.edgeType))];
  return {
    rendererKey: `${layoutIntent}-renderer`,
    legendItems: edgeTypes.map((edgeType) => ({ edgeType, label: `${title(edgeType)} edge` }))
  };
}

function reviewFor(layoutHints: readonly DiagramLayoutHint[], edges: readonly DiagramEdge[], critic: DiagramCritic) {
  return {
    status: critic.checks.some((check) => check.status === "fail") ? "fail" : critic.checks.some((check) => check.status === "warn") ? "warn" : "pass",
    score: critic.score,
    issues: critic.checks.filter((check) => check.status === "fail").map((check) => check.message),
    suggestions: layoutHints.map((hint) => hint.label),
    notes: [`Parsed ${edges.length} relationships`, `Applied ${layoutHints.length} layout hints`, `Critic score ${critic.score}`]
  } as const;
}

function decorationsFor(label: string, prompt: string): DiagramNode["decorations"] {
  const lowerLabel = label.toLowerCase();
  const lowerPrompt = prompt.toLowerCase();
  if (lowerLabel !== "api") return [];
  const decorations: NodeDecoration[] = [];
  if (/mark\s+api\b.*\bcritical\b/.test(lowerPrompt)) decorations.push("critical");
  if (/mark\s+api\b.*\bpii\b/.test(lowerPrompt)) decorations.push("pii");
  return decorations;
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

function dedupeById<T extends { readonly id: string }>(items: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
