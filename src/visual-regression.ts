import { createHash } from "node:crypto";
import type { VisualRegressionCase, VisualRegressionResult } from "./advanced-types.js";
import { listDiagramRecipes, sceneFromRecipe } from "./diagram-recipes-advanced.js";
import { renderSvg } from "./scene-render.js";

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

export function runVisualRegressionGallery(): VisualRegressionResult {
  return runVisualRegression(listDiagramRecipes().map((recipe) => ({ name: recipe.name, scene: sceneFromRecipe(recipe.name) })));
}

function hashSvg(svg: string): string {
  return createHash("sha256").update(svg).digest("hex");
}
