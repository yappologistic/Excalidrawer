import type { ExcalidrawScene } from "./scene-types.js";
import type { LayoutIntent } from "./diagram-model.js";
import { compileDiagram, scoreDiagramScene } from "./diagram-compiler.js";
import { diagramTemplates } from "./diagram-templates.js";
import { renderSvg } from "./scene-render.js";

export type GalleryCase = {
  readonly name: string;
  readonly layoutIntent: LayoutIntent;
  readonly prompt: string;
};

export type GalleryCaseResult = GalleryCase & {
  readonly excalidrawOk: boolean;
  readonly svgOk: boolean;
  readonly issues: readonly string[];
  readonly scene: ExcalidrawScene;
};

export type GalleryVerificationResult = {
  readonly ok: boolean;
  readonly cases: readonly GalleryCaseResult[];
};

export const goldenFixtureCases: readonly GalleryCase[] = [
  {
    name: "architecture-ecommerce-spacious",
    layoutIntent: "architecture",
    prompt:
      "domain: ecommerce pattern: strangler migration profile: spacious preset: boardroom import: yaml detail: deep architecture detailed: buyer calls storefront, storefront calls checkout API, checkout API writes orders database, checkout API publishes payment event bus, fulfillment worker consumes payment event bus, warehouse service reads orders database, support dashboard reads metrics, mark checkout API critical and PII, expand API internals, put databases at bottom"
  }
];

export const galleryCases: readonly GalleryCase[] = [
  ...Object.values(diagramTemplates).map((template) => ({
  name: template.name,
  layoutIntent: template.layoutIntent,
  prompt: template.prompt
  })),
  ...goldenFixtureCases
];

export async function runGalleryVerification(cases: readonly GalleryCase[] = galleryCases): Promise<GalleryVerificationResult> {
  const results = cases.map((galleryCase) => {
    const template = diagramTemplates[galleryCase.name as keyof typeof diagramTemplates] ?? diagramTemplates[galleryCase.layoutIntent];
    const scene = compileDiagram({
      prompt: galleryCase.prompt,
      layoutIntent: galleryCase.layoutIntent,
      themeName: template.themeName,
      templateName: template.name,
      complexityMode: template.complexityMode
    });
    const score = scoreDiagramScene(scene);
    const svg = renderSvg(scene);
    const svgOk =
      svg.includes("<svg") &&
      svg.includes("data-excalidrawer-role=\"node-shape\"") &&
      svg.includes("data-excalidrawer-role=\"edge-label\"") &&
      svg.includes("data-excalidrawer-role=\"icon\"");
    return { ...galleryCase, scene, excalidrawOk: score.ok, svgOk, issues: svgOk ? score.issues : [...score.issues, "SVG missing semantic export metadata"] };
  });
  return { ok: results.every((result) => result.excalidrawOk && result.svgOk), cases: results };
}
