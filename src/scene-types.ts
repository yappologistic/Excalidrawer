export type ExcalidrawElementType = "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "text";

export interface ExcalidrawerCustomData {
  excalidrawer?: {
    role?: string;
    nodeKind?: string;
    semanticShape?: string;
    iconKey?: string;
    edgeType?: string;
    templateName?: string;
    complexityMode?: string;
  };
}

export interface ExcalidrawBoundElement {
  id: string;
  type: "arrow" | "text";
}

export interface ExcalidrawBinding {
  elementId: string;
  fixedPoint: [number, number];
  mode: "inside" | "orbit";
}

export interface ExcalidrawElement {
  id: string;
  type: ExcalidrawElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  roundness: null | { type: number };
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: ExcalidrawBoundElement[] | null;
  updated: number;
  link: null;
  locked: boolean;
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  baseline?: number;
  containerId?: string | null;
  originalText?: string;
  lineHeight?: number;
  points?: Array<[number, number]>;
  startBinding?: ExcalidrawBinding | null;
  endBinding?: ExcalidrawBinding | null;
  startArrowhead?: null | string;
  endArrowhead?: null | string;
  customData?: ExcalidrawerCustomData;
}

export interface ExcalidrawScene {
  type: "excalidraw";
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  issues: string[];
}
