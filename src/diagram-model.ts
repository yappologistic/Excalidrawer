export const layoutIntents = ["flow", "architecture", "sequence", "mindmap", "data-flow", "state-machine", "swimlane", "incident-response"] as const;
export type LayoutIntent = (typeof layoutIntents)[number];

export const themeNames = ["technical", "executive", "handdrawn", "minimal", "system-architecture", "incident-response"] as const;
export type ThemeName = (typeof themeNames)[number];

export type DiagramNodeKind = "actor" | "service" | "database" | "queue" | "process" | "state" | "metric" | "alert";
export type SemanticShape = "actor" | "service" | "database" | "queue" | "process" | "state" | "metric" | "alert";
export type EdgeType = "sync" | "async" | "query" | "event" | "alert" | "return" | "control";
export type ComplexityMode = "compact" | "balanced" | "detailed";
export type TemplateName = LayoutIntent | "system-architecture";

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
};

export type DiagramEdge = {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly label: string;
  readonly verb: string;
  readonly edgeType: EdgeType;
  readonly order: number;
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

export type DiagramModel = {
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
  readonly groups: readonly DiagramGroup[];
  readonly lanes: readonly DiagramLane[];
  readonly clusters: readonly DiagramCluster[];
  readonly annotations: readonly DiagramAnnotation[];
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
