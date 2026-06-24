import type { ExcalidrawElement, ExcalidrawScene } from "./scene-types.js";

export type StructuredImportFormat =
  | "mermaid"
  | "plantuml"
  | "dot"
  | "openapi"
  | "terraform"
  | "docker-compose"
  | "kubernetes"
  | "package-deps";

export type StructuredImportInput = {
  readonly format: StructuredImportFormat;
  readonly source: string;
};

export type StructuredImportResult = {
  readonly format: StructuredImportFormat;
  readonly prompt: string;
  readonly entities: readonly string[];
  readonly relationships: readonly string[];
};

export type DiagramRecipe = {
  readonly name: string;
  readonly title: string;
  readonly prompt: string;
};

export type QualityExplanation = {
  readonly ok: boolean;
  readonly summary: string;
  readonly issueCount: number;
  readonly issues: readonly string[];
  readonly repairActions: readonly string[];
};

export type RepairResult = {
  readonly ok: boolean;
  readonly scene: ExcalidrawScene;
  readonly actions: readonly string[];
};

export type SceneDiff = {
  readonly summary: string;
  readonly addedLabels: readonly string[];
  readonly removedLabels: readonly string[];
  readonly changedPositions: number;
  readonly elementDelta: number;
};

export type LibraryPack = {
  readonly type: "excalidrawlib";
  readonly version: 2;
  readonly source: string;
  readonly libraryItems: readonly LibraryItem[];
};

export type LibraryItem = {
  readonly id: string;
  readonly name: string;
  readonly status: "published" | "unpublished";
  readonly created: number;
  readonly elements: readonly ExcalidrawElement[];
};

export type RendererHarness = {
  readonly html: string;
  readonly report: {
    readonly elementCount: number;
    readonly arrowCount: number;
    readonly textCount: number;
    readonly runtimeMode: "static-svg" | "external-excalidraw-runtime";
  };
};

export type VisualRegressionResult = {
  readonly ok: boolean;
  readonly cases: readonly VisualRegressionCaseResult[];
};

export type VisualRegressionCase = {
  readonly name: string;
  readonly scene: ExcalidrawScene;
  readonly baselineHash?: string;
};

export type VisualRegressionCaseResult = {
  readonly name: string;
  readonly hash: string;
  readonly changed: boolean;
  readonly elementCount: number;
};

export type BrowserDoctorResult = {
  readonly ok: boolean;
  readonly checks: readonly BrowserDoctorCheck[];
};

export type BrowserDoctorCheck = {
  readonly id: "local-preview" | "svg-geometry" | "browser-runtime";
  readonly status: "pass" | "warn" | "fail";
  readonly message: string;
};
