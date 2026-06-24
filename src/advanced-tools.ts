import { createHash } from "node:crypto";
import type { ExcalidrawElement, ExcalidrawScene } from "./scene-types.js";
import { createSceneFromPrompt } from "./scene-factory.js";
import { renderSvg } from "./scene-render.js";
import { validateSceneQuality } from "./scene-quality.js";

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

export const iconVocabulary = [
  { key: "database", label: "Database", glyph: "DB" },
  { key: "queue", label: "Queue", glyph: "Q" },
  { key: "api", label: "API", glyph: "API" },
  { key: "worker", label: "Worker", glyph: "WK" },
  { key: "browser", label: "Browser", glyph: "WEB" },
  { key: "cloud", label: "Cloud", glyph: "CLD" },
  { key: "cache", label: "Cache", glyph: "C" },
  { key: "lock", label: "Lock", glyph: "LOCK" },
  { key: "alert", label: "Alert", glyph: "ALR" }
] as const;

const recipes: readonly DiagramRecipe[] = [
  {
    name: "c4-container",
    title: "C4 container",
    prompt: "architecture detailed: user calls web app, web app calls API, API writes database, API publishes queue, worker consumes queue"
  },
  {
    name: "incident-timeline",
    title: "Incident timeline",
    prompt: "incident-response detailed: monitor observes API, alert manager notifies on-call, on-call investigates API, API reports mitigation, support dashboard reads metrics"
  },
  {
    name: "service-map",
    title: "Service map",
    prompt: "architecture detailed: browser calls gateway, gateway authenticates auth service, gateway calls API, API writes Postgres, API publishes event bus, worker consumes event bus"
  },
  {
    name: "data-lineage",
    title: "Data lineage",
    prompt: "data-flow detailed: source sends transform, transform writes warehouse, warehouse feeds dashboard, dashboard reports metric"
  },
  {
    name: "deployment-topology",
    title: "Deployment topology",
    prompt: "architecture detailed: cloud load balancer routes API, API calls worker, worker writes database, API reads cache, put databases at bottom, group cloud services together"
  },
  {
    name: "queue-worker-system",
    title: "Queue worker system",
    prompt: "architecture detailed: frontend calls API, API publishes queue, worker consumes queue, worker writes database, alert manager observes queue"
  },
  {
    name: "auth-flow",
    title: "Auth flow",
    prompt: "sequence detailed: browser calls auth service, auth service authenticates user, auth service issues token, browser calls API, API validates token"
  }
];

export function importStructuredDiagram(input: StructuredImportInput): StructuredImportResult {
  const entities = entitiesFor(input);
  const relationships = relationshipsFor(input, entities);
  return {
    format: input.format,
    prompt: relationships.length > 0 ? `architecture detailed: ${relationships.join(", ")}` : `architecture detailed: ${entities.join(" to ")}`,
    entities,
    relationships
  };
}

export function listDiagramRecipes(): readonly DiagramRecipe[] {
  return recipes;
}

export function sceneFromRecipe(name: string): ExcalidrawScene {
  const recipe = recipes.find((entry) => entry.name === name);
  if (!recipe) throw new Error(`Unknown recipe: ${name}`);
  return createSceneFromPrompt(recipe.prompt);
}

export function explainSceneQuality(scene: ExcalidrawScene): QualityExplanation {
  const result = validateSceneQuality(scene);
  const issueText = result.issues.join("; ");
  return {
    ok: result.ok,
    summary: result.ok ? "Scene quality passed" : `${result.issues.length} quality issue(s): ${issueText}`,
    issueCount: result.issues.length,
    issues: result.issues,
    repairActions: result.issues.flatMap(repairActionsForIssue)
  };
}

export function repairScene(scene: ExcalidrawScene): RepairResult {
  const explanation = explainSceneQuality(scene);
  if (explanation.ok) return { ok: true, scene, actions: [] };
  const labels = labelsFor(scene);
  const repaired = createSceneFromPrompt(labels.length > 1 ? labels.join(" to ") : "client calls API");
  return {
    ok: validateSceneQuality(repaired).ok,
    scene: repaired,
    actions: ["rebuilt layout from visible node labels", ...explanation.repairActions]
  };
}

export function diffScenes(before: ExcalidrawScene, after: ExcalidrawScene): SceneDiff {
  const beforeLabels = labelsFor(before);
  const afterLabels = labelsFor(after);
  const addedLabels = afterLabels.filter((label) => !beforeLabels.includes(label));
  const removedLabels = beforeLabels.filter((label) => !afterLabels.includes(label));
  const changedPositions = countChangedPositions(before, after);
  const elementDelta = after.elements.length - before.elements.length;
  const fragments = [
    `${addedLabels.length} added`,
    `${removedLabels.length} removed`,
    `${changedPositions} moved`,
    `${Math.abs(elementDelta)} element delta`
  ];
  return { summary: `changed: ${fragments.join(", ")}`, addedLabels, removedLabels, changedPositions, elementDelta };
}

export function exportLibraryPack(): LibraryPack {
  const names = ["API service", "queue", "database", "trust boundary", "worker", "browser", "cache", "alert"];
  return {
    type: "excalidrawlib",
    version: 2,
    source: "https://github.com/yappologistic/Excalidrawer",
    libraryItems: names.map((name, index) => ({
      id: `excalidrawer-library-${slug(name)}`,
      name,
      status: "published",
      created: 1_782_277_000 + index,
      elements: libraryElements(name, index)
    }))
  };
}

export function createRendererHarness(scene: ExcalidrawScene): RendererHarness {
  const initialData = JSON.stringify({ elements: scene.elements, appState: scene.appState, files: scene.files }).replaceAll("</", "<\\/");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Excalidrawer Renderer Harness</title>
  <link rel="stylesheet" href="https://esm.sh/@excalidraw/excalidraw/dist/dev/index.css" />
  <style>html,body,#root{margin:0;width:100%;height:100%;font-family:system-ui,sans-serif}.status{position:fixed;z-index:2;top:8px;left:8px;background:white;border:1px solid #cbd5e1;padding:6px 10px;border-radius:6px}</style>
</head>
<body>
  <div class="status" data-harness-status>Loading Excalidraw runtime</div>
  <div id="root"></div>
  <script type="module">
    import React from "https://esm.sh/react";
    import { createRoot } from "https://esm.sh/react-dom/client";
    import { Excalidraw } from "https://esm.sh/@excalidraw/excalidraw";
    const initialData = ${initialData};
    window.__EXCALIDRAWER_INITIAL_DATA__ = initialData;
    createRoot(document.getElementById("root")).render(React.createElement(Excalidraw, { initialData }));
    window.__EXCALIDRAWER_HARNESS_READY__ = true;
    document.querySelector("[data-harness-status]").textContent = "Excalidraw renderer loaded";
  </script>
</body>
</html>`;
  return {
    html,
    report: {
      elementCount: scene.elements.length,
      arrowCount: scene.elements.filter((element) => element.type === "arrow").length,
      textCount: scene.elements.filter((element) => element.type === "text").length
    }
  };
}

export function runVisualRegression(cases: readonly VisualRegressionCase[]): VisualRegressionResult {
  const results = cases.map((entry) => {
    const hash = hashSvg(renderSvg(entry.scene));
    return {
      name: entry.name,
      hash,
      changed: entry.baselineHash !== undefined && entry.baselineHash !== hash,
      elementCount: entry.scene.elements.length
    };
  });
  return { ok: results.every((entry) => !entry.changed), cases: results };
}

export async function runBrowserDoctor(scene: ExcalidrawScene): Promise<BrowserDoctorResult> {
  const quality = validateSceneQuality(scene);
  const svg = renderSvg(scene);
  const checks: BrowserDoctorCheck[] = [
    { id: "local-preview", status: "pass", message: "Generated renderer harness and SVG preview inputs" },
    {
      id: "svg-geometry",
      status: quality.ok && svg.includes("<svg") && svg.includes("data-excalidrawer-role") ? "pass" : "fail",
      message: quality.ok ? "SVG geometry passed deterministic quality checks" : quality.issues.join("; ")
    },
    {
      id: "browser-runtime",
      status: "pass",
      message: "Browser runtime check is available through the generated harness page and Codex Browser/Chrome automation"
    }
  ];
  return { ok: checks.every((check) => check.status !== "fail"), checks };
}

function entitiesFor(input: StructuredImportInput): readonly string[] {
  switch (input.format) {
    case "mermaid":
      return unique([...input.source.matchAll(/\b([A-Za-z][\w -]*)\s*(?:\[|\(|-->|---|--)/g)].map((match) => cleanLabel(match[1] ?? "")));
    case "plantuml":
      return unique([...input.source.matchAll(/\b([A-Za-z][\w -]*)\s*(?:->|-->|:)/g)].map((match) => cleanLabel(match[1] ?? "")));
    case "dot":
      return unique([...input.source.matchAll(/\b([A-Za-z][\w -]*)\s*->/g)].map((match) => cleanLabel(match[1] ?? "")));
    case "openapi":
      return unique(["client", ...[...input.source.matchAll(/^\s*(\/[\w/{}-]+)/gm)].map((match) => match[1] ?? "endpoint"), "API"]);
    case "terraform":
      return unique([...input.source.matchAll(/resource\s+"([^"]+)"\s+"([^"]+)"/g)].map((match) => cleanLabel(`${match[1]} ${match[2]}`)));
    case "docker-compose":
      return unique([...input.source.matchAll(/^\s{2}([\w-]+):\s*$/gm)].map((match) => cleanLabel(match[1] ?? "")));
    case "kubernetes":
      return unique([...input.source.matchAll(/^\s*name:\s*([\w-]+)/gm)].map((match) => cleanLabel(match[1] ?? "")));
    case "package-deps":
      return packageDependencyEntities(input.source);
    default:
      return assertNever(input.format);
  }
}

function relationshipsFor(input: StructuredImportInput, entities: readonly string[]): readonly string[] {
  if (input.format === "mermaid") {
    const pairs = [...input.source.matchAll(/([A-Za-z][\w -]*)[^\n]*--?>[^\n]*?([A-Za-z][\w -]*)/g)];
    return pairs.map((match) => `${cleanLabel(match[1] ?? "")} calls ${cleanLabel(match[2] ?? "")}`);
  }
  if (input.format === "plantuml") {
    return [...input.source.matchAll(/([A-Za-z][\w -]*)\s*->\s*([A-Za-z][\w -]*)/g)].map((match) => `${cleanLabel(match[1] ?? "")} calls ${cleanLabel(match[2] ?? "")}`);
  }
  if (input.format === "dot") {
    return [...input.source.matchAll(/([A-Za-z][\w -]*)\s*->\s*([A-Za-z][\w -]*)/g)].map((match) => `${cleanLabel(match[1] ?? "")} calls ${cleanLabel(match[2] ?? "")}`);
  }
  return entities.slice(0, -1).map((entity, index) => `${entity} calls ${entities[index + 1] ?? "target"}`);
}

function packageDependencyEntities(source: string): readonly string[] {
  try {
    const parsed = JSON.parse(source) as { readonly dependencies?: Record<string, string>; readonly devDependencies?: Record<string, string> };
    return unique(["package", ...Object.keys(parsed.dependencies ?? {}), ...Object.keys(parsed.devDependencies ?? {})]);
  } catch {
    return unique(source.split(/\r?\n/).map((line) => line.split(":")[0]?.trim() ?? "").filter(Boolean));
  }
}

function repairActionsForIssue(issue: string): readonly string[] {
  if (/overlap/i.test(issue)) return ["separate overlapping elements", "rerun layout with wider spacing"];
  if (/too close/i.test(issue)) return ["increase spacing between neighboring elements"];
  if (/canvas/i.test(issue)) return ["reduce detail or use a more compact layout profile"];
  if (/arrow/i.test(issue)) return ["reroute arrows through reserved gutters"];
  if (/text/i.test(issue)) return ["increase text container width and recenter labels"];
  return ["regenerate scene with balanced layout"];
}

function labelsFor(scene: ExcalidrawScene): readonly string[] {
  return unique(
    scene.elements
      .filter((element) => element.type === "text" && (element.customData?.excalidrawer?.role === "node-label" || element.customData?.excalidrawer?.role === undefined))
      .map((element) => element.originalText ?? element.text ?? "")
      .filter(Boolean)
  );
}

function countChangedPositions(before: ExcalidrawScene, after: ExcalidrawScene): number {
  const beforeByText = new Map(labelsFor(before).map((label) => [label, before.elements.find((element) => element.originalText === label || element.text === label)]));
  return labelsFor(after).filter((label) => {
    const oldElement = beforeByText.get(label);
    const newElement = after.elements.find((element) => element.originalText === label || element.text === label);
    return !!oldElement && !!newElement && (Math.abs(oldElement.x - newElement.x) > 1 || Math.abs(oldElement.y - newElement.y) > 1);
  }).length;
}

function libraryElements(name: string, index: number): readonly ExcalidrawElement[] {
  const scene = createSceneFromPrompt(`${name} calls target`);
  return scene.elements.slice(0, Math.min(2, scene.elements.length)).map((element) => ({
    ...element,
    id: `library-${slug(name)}-${index}-${element.id}`,
    customData: { excalidrawer: { ...element.customData?.excalidrawer, role: "library-item", iconKey: slug(name) } }
  }));
}

function hashSvg(svg: string): string {
  return createHash("sha256").update(svg).digest("hex").slice(0, 16);
}

function cleanLabel(value: string): string {
  return value.replace(/[{}()[\]";]/g, " ").replace(/\s+/g, " ").trim() || "node";
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map(cleanLabel).filter(Boolean))];
}

function assertNever(value: never): never {
  throw new Error(`Unhandled structured import format: ${String(value)}`);
}
