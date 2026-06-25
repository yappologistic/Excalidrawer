export const layoutIntents = ["flow", "architecture", "sequence", "mindmap", "data-flow", "state-machine", "swimlane", "incident-response"] as const;
export type LayoutIntent = (typeof layoutIntents)[number];

export const diagramFamilies = [
  "flowchart",
  "architecture-c4",
  "sequence",
  "state-machine",
  "swimlane",
  "data-flow",
  "uml-class",
  "uml-use-case",
  "uml-activity",
  "bpmn-process",
  "network",
  "org-chart",
  "timeline",
  "dependency-graph",
  "mindmap",
  "incident-response",
  "threat-model"
] as const;
export type DiagramFamily = (typeof diagramFamilies)[number];

export const themeNames = ["technical", "executive", "handdrawn", "minimal", "system-architecture", "incident-response"] as const;
export type ThemeName = (typeof themeNames)[number];

export type DiagramNodeKind = "actor" | "service" | "database" | "queue" | "process" | "state" | "metric" | "alert";
export type SemanticShape = "actor" | "service" | "database" | "queue" | "process" | "state" | "metric" | "alert";
export type EdgeType = "sync" | "async" | "query" | "event" | "alert" | "return" | "control";
export type ConnectorSemantic =
  | "control-flow"
  | "sync-call"
  | "async-event"
  | "data-flow"
  | "association"
  | "sequence-flow"
  | "network-link"
  | "reports-to"
  | "dependency"
  | "timeline-link"
  | "threat-flow";
export type ComplexityMode = "compact" | "balanced" | "detailed";
export type TemplateName = LayoutIntent | "system-architecture";
export type NodeDecoration = "critical" | "pii";
export type PrimitiveType = "trust-boundary" | "event-bus" | "deployment-zone";
export type LayoutHintKind = "database-bottom" | "group-cloud";
export type DiagramPatternName = "strangler-migration" | "event-driven" | "service-blueprint";
export type DomainPackName = "generic" | "ecommerce" | "saas" | "data-platform" | "incident";
export type LayoutProfileName = "compact" | "balanced" | "spacious";
export type StylePresetName = "default" | "boardroom" | "deep-work" | "review-ready";
export type ImportedSourceFormat = "none" | "json" | "yaml" | "mermaid" | "csv";
export type ProgressiveDetailLevel = "overview" | "standard" | "deep";
export type DiagramPortSide = "top" | "right" | "bottom" | "left";

export type DiagramNode = {
  readonly id: string;
  readonly label: string;
  readonly kind: DiagramNodeKind;
  readonly semanticShape: SemanticShape;
  readonly iconKey: string;
  readonly groupId: string;
  readonly laneId: string;
  readonly clusterId: string;
  readonly order: number;
  readonly decorations: readonly NodeDecoration[];
  readonly notationRole: string;
  readonly compartments: readonly string[];
  readonly containerId?: string;
};

export type DiagramEdge = {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly label: string;
  readonly verb: string;
  readonly edgeType: EdgeType;
  readonly routeGroup: string;
  readonly order: number;
  readonly connectorSemantic: ConnectorSemantic;
  readonly notationRole: string;
};

export type DiagramGroup = {
  readonly id: string;
  readonly label: string;
  readonly nodeIds: readonly string[];
};

export type DiagramLane = {
  readonly id: string;
  readonly label: string;
  readonly nodeIds: readonly string[];
};

export type DiagramCluster = {
  readonly id: string;
  readonly label: string;
  readonly nodeIds: readonly string[];
};

export type DiagramAnnotation = {
  readonly id: string;
  readonly label: string;
  readonly nodeIds: readonly string[];
};

export type DiagramPrimitive = {
  readonly id: string;
  readonly primitiveType: PrimitiveType;
  readonly label: string;
  readonly nodeIds: readonly string[];
};

export type DiagramLayoutHint = {
  readonly id: string;
  readonly kind: LayoutHintKind;
  readonly label: string;
};

export type DiagramSubdiagram = {
  readonly id: string;
  readonly parentNodeId: string;
  readonly label: string;
};

export type VisualGrammar = {
  readonly rendererKey: string;
  readonly legendItems: readonly VisualLegendItem[];
};

export type VisualLegendItem = {
  readonly edgeType: EdgeType;
  readonly label: string;
};

export type DiagramReview = {
  readonly status: "pass" | "warn" | "fail";
  readonly score: number;
  readonly issues: readonly string[];
  readonly suggestions: readonly string[];
  readonly notes: readonly string[];
};

export type DiagramPattern = {
  readonly id: string;
  readonly name: DiagramPatternName;
  readonly label: string;
  readonly nodeIds: readonly string[];
};

export type DomainPack = {
  readonly name: DomainPackName;
  readonly label: string;
  readonly vocabulary: readonly string[];
};

export type LayoutProfile = {
  readonly name: LayoutProfileName;
  readonly label: string;
  readonly spacingMultiplier: number;
};

export type StylePreset = {
  readonly name: StylePresetName;
  readonly label: string;
  readonly tone: "technical" | "executive" | "operational";
};

export type ImportedSource = {
  readonly format: ImportedSourceFormat;
  readonly label: string;
};

export type ProgressiveDetail = {
  readonly level: ProgressiveDetailLevel;
  readonly revealOrder: readonly string[];
};

export type DiagramCriticCheck = {
  readonly id: string;
  readonly status: "pass" | "warn" | "fail";
  readonly message: string;
};

export type DiagramCritic = {
  readonly score: number;
  readonly checks: readonly DiagramCriticCheck[];
};

export type CompoundComponent = {
  readonly id: string;
  readonly kind: "service-with-database" | "async-worker" | "actor-entrypoint";
  readonly label: string;
  readonly nodeIds: readonly string[];
};

export type DiagramPort = {
  readonly id: string;
  readonly nodeId: string;
  readonly side: DiagramPortSide;
  readonly label: string;
};

export type DiagramAnchor = {
  readonly id: string;
  readonly nodeId: string;
  readonly portId: string;
  readonly kind: "edge-anchor";
};

export type GoldenFixture = {
  readonly name: string;
  readonly description: string;
};

export type DiagramModel = {
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
  readonly groups: readonly DiagramGroup[];
  readonly lanes: readonly DiagramLane[];
  readonly clusters: readonly DiagramCluster[];
  readonly annotations: readonly DiagramAnnotation[];
  readonly primitives: readonly DiagramPrimitive[];
  readonly layoutHints: readonly DiagramLayoutHint[];
  readonly subdiagrams: readonly DiagramSubdiagram[];
  readonly patterns: readonly DiagramPattern[];
  readonly domainPack: DomainPack;
  readonly layoutProfile: LayoutProfile;
  readonly stylePreset: StylePreset;
  readonly importedSource?: ImportedSource;
  readonly progressiveDetail: ProgressiveDetail;
  readonly critic: DiagramCritic;
  readonly compoundComponents: readonly CompoundComponent[];
  readonly ports: readonly DiagramPort[];
  readonly anchors: readonly DiagramAnchor[];
  readonly goldenFixture: GoldenFixture;
  readonly visualGrammar: VisualGrammar;
  readonly review: DiagramReview;
  readonly diagramFamily: DiagramFamily;
  readonly strictness: "strict";
  readonly unsupported: readonly string[];
  readonly layoutIntent: LayoutIntent;
  readonly themeName: ThemeName;
  readonly templateName: TemplateName;
  readonly complexityMode: ComplexityMode;
};

export type CompileDiagramInput = {
  readonly prompt: string;
  readonly layoutIntent?: LayoutIntent;
  readonly themeName?: ThemeName;
  readonly templateName?: TemplateName;
  readonly complexityMode?: ComplexityMode;
};
