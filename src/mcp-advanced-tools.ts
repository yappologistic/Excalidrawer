import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { StructuredImportFormat } from "./advanced-tools.js";
import {
  createRendererHarness,
  createSceneFromPrompt,
  diffScenes,
  exportLibraryPack,
  importStructuredDiagram,
  listDiagramRecipes,
  readScene,
  readSceneJson,
  repairScene,
  runBrowserDoctor,
  runVisualRegression,
  runVisualRegressionGallery,
  sceneFromRecipe,
  assertScene,
  writeScene
} from "./scene.js";
import { text } from "./mcp-common.js";

export function registerAdvancedTools(server: McpServer): void {
  server.registerTool("import_structured_scene", structuredImportSchema(), async ({ format, inPath, outPath }) => {
    const imported = importStructuredDiagram({ format: format as StructuredImportFormat, source: await readFile(inPath, "utf8") });
    await writeScene(outPath, createSceneFromPrompt(imported.prompt));
    return text(JSON.stringify({ outPath, format: imported.format, entities: imported.entities, relationships: imported.relationships }));
  });

  server.registerTool("create_recipe_scene", recipeSchema(), async ({ name, outPath }) => {
    if (!name) return text(JSON.stringify({ recipes: listDiagramRecipes() }));
    if (!outPath) throw new Error("outPath is required when name is provided");
    await writeScene(outPath, sceneFromRecipe(name));
    return text(`recipe ${name} created ${outPath}`);
  });

  server.registerTool("repair_scene", repairSchema(), async ({ path, outPath }) => {
    const result = repairScene(assertScene(await readSceneJson(path)));
    const target = outPath ?? path;
    await writeScene(target, result.scene);
    return text(JSON.stringify({ ok: result.ok, outPath: target, actions: result.actions }));
  });

  server.registerTool("diff_scenes", diffSchema(), async ({ beforePath, afterPath, outPath }) => {
    const diff = diffScenes(await readScene(beforePath), await readScene(afterPath));
    if (outPath) await writeJson(outPath, diff);
    return text(JSON.stringify(diff));
  });

  server.registerTool("export_library_pack", librarySchema(), async ({ outPath }) => {
    const pack = exportLibraryPack();
    await writeJson(outPath, pack);
    return text(JSON.stringify({ outPath, items: pack.libraryItems.length }));
  });

  server.registerTool("create_renderer_harness", harnessSchema(), async ({ path: scenePath, outPath }) => {
    const harness = createRendererHarness(await readScene(scenePath));
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, harness.html, "utf8");
    return text(JSON.stringify({ outPath, report: harness.report }));
  });

  server.registerTool("run_visual_regression", visualRegressionSchema(), async ({ path: scenePath, name, baselineHash, outPath }) => {
    const result = scenePath
      ? runVisualRegression([{ name: name ?? "scene", scene: await readScene(scenePath), baselineHash }])
      : runVisualRegressionGallery();
    if (outPath) await writeJson(outPath, result);
    return text(JSON.stringify(result));
  });

  server.registerTool("doctor_browser", doctorSchema(), async ({ path: scenePath, outPath }) => {
    const result = await runBrowserDoctor(await readScene(scenePath));
    if (outPath) await writeJson(outPath, result);
    return text(JSON.stringify(result));
  });
}

function structuredImportSchema() {
  return {
    description: "Import Mermaid, PlantUML, Graphviz DOT, OpenAPI, Terraform, Docker Compose, Kubernetes, or package dependency text into a polished Excalidraw scene.",
    inputSchema: { format: z.enum(["mermaid", "plantuml", "dot", "openapi", "terraform", "docker-compose", "kubernetes", "package-deps"]), inPath: z.string(), outPath: z.string() }
  };
}

function recipeSchema() {
  return { description: "Create a named diagram recipe scene, or list available recipes when name is omitted.", inputSchema: { name: z.string().optional(), outPath: z.string().optional() } };
}

function repairSchema() {
  return { description: "Repair a structurally valid but visually invalid Excalidraw scene by rebuilding a cleaner layout from visible labels.", inputSchema: { path: z.string(), outPath: z.string().optional() } };
}

function diffSchema() {
  return { description: "Compare two .excalidraw files by labels, layout movement, and element-count delta.", inputSchema: { beforePath: z.string(), afterPath: z.string(), outPath: z.string().optional() } };
}

function librarySchema() {
  return { description: "Export reusable Excalidraw library items for common architecture components.", inputSchema: { outPath: z.string() } };
}

function harnessSchema() {
  return { description: "Create a safe HTML browser harness for visual QA without unpinned remote executable scripts.", inputSchema: { path: z.string(), outPath: z.string() } };
}

function visualRegressionSchema() {
  return { description: "Hash SVG exports for visual-regression gallery checks and optionally write a report.", inputSchema: { path: z.string().optional(), name: z.string().optional(), baselineHash: z.string().optional(), outPath: z.string().optional() } };
}

function doctorSchema() {
  return { description: "Run Excalidrawer browser-readiness diagnostics for local preview inputs, SVG DOM geometry, and runtime availability.", inputSchema: { path: z.string(), outPath: z.string().optional() } };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
