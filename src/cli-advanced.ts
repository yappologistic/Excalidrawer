import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StructuredImportFormat } from "./advanced-tools.js";
import {
  createRendererHarness,
  diffScenes,
  exportLibraryPack,
  importStructuredDiagram,
  listDiagramRecipes,
  repairScene,
  runBrowserDoctor,
  runVisualRegression,
  runVisualRegressionGallery,
  sceneFromRecipe
} from "./advanced-tools.js";
import { createSceneFromPrompt, readScene, readSceneJson, assertScene, writeScene } from "./scene.js";

export async function advancedCommand(command: string, args: readonly string[]): Promise<number | undefined> {
  switch (command) {
    case "import":
      return await importCommand(args);
    case "recipe":
      return await recipeCommand(args);
    case "repair":
      return await repairCommand(args);
    case "diff":
      return await diffCommand(args);
    case "library":
      return await libraryCommand(args);
    case "harness":
      return await harnessCommand(args);
    case "visual-regression":
      return await visualRegressionCommand(args);
    case "doctor":
      return await doctorCommand(args);
    default:
      return undefined;
  }
}

async function importCommand(args: readonly string[]): Promise<number> {
  const format = value(args, "--format") as StructuredImportFormat;
  const imported = importStructuredDiagram({ format, source: await readFile(value(args, "--in"), "utf8") });
  const out = value(args, "--out");
  await writeScene(out, createSceneFromPrompt(imported.prompt));
  console.log(JSON.stringify({ imported: out, format: imported.format, entities: imported.entities.length, relationships: imported.relationships.length }, null, 2));
  return 0;
}

async function recipeCommand(args: readonly string[]): Promise<number> {
  const name = args[0];
  if (!name) {
    console.log(JSON.stringify({ recipes: listDiagramRecipes() }, null, 2));
    return 0;
  }
  const out = value(args, "--out");
  await writeScene(out, sceneFromRecipe(name));
  console.log(`recipe ${name} created ${out}`);
  return 0;
}

async function repairCommand(args: readonly string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) throw new Error("Missing scene path");
  const out = value(args, "--out", filePath);
  const result = repairScene(assertScene(await readSceneJson(filePath)));
  await writeScene(out, result.scene);
  console.log(JSON.stringify({ ok: result.ok, out, actions: result.actions }, null, 2));
  return result.ok ? 0 : 1;
}

async function diffCommand(args: readonly string[]): Promise<number> {
  const before = args[0];
  const after = args[1];
  if (!before || !after) throw new Error("Missing scene paths");
  const diff = diffScenes(await readScene(before), await readScene(after));
  const out = value(args, "--out");
  await writeJson(out, diff);
  console.log(`diff wrote ${out}`);
  return 0;
}

async function libraryCommand(args: readonly string[]): Promise<number> {
  const out = value(args, "--out");
  await writeJson(out, exportLibraryPack());
  console.log(`library wrote ${out}`);
  return 0;
}

async function harnessCommand(args: readonly string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) throw new Error("Missing scene path");
  const out = value(args, "--out");
  const harness = createRendererHarness(await readScene(filePath));
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, harness.html, "utf8");
  console.log(JSON.stringify({ out, ...harness.report }, null, 2));
  return 0;
}

async function visualRegressionCommand(args: readonly string[]): Promise<number> {
  const filePath = args[0];
  if (filePath === "gallery") {
    const out = value(args, "--out");
    const result = runVisualRegressionGallery();
    await writeJson(out, result);
    console.log(`visual regression gallery wrote ${out}`);
    return result.ok ? 0 : 1;
  }
  if (!filePath) throw new Error("Missing scene path");
  const out = value(args, "--out");
  const result = runVisualRegression([{ name: path.basename(filePath), scene: await readScene(filePath) }]);
  await writeJson(out, result);
  console.log(`visual regression wrote ${out}`);
  return result.ok ? 0 : 1;
}

async function doctorCommand(args: readonly string[]): Promise<number> {
  if (args[0] !== "browser") throw new Error("Only doctor browser is supported");
  const result = await runBrowserDoctor(await readScene(value(args, "--scene")));
  const out = value(args, "--out");
  await writeJson(out, result);
  console.log(`doctor wrote ${out}`);
  return result.ok ? 0 : 1;
}

function value(args: readonly string[], name: string, fallback?: string): string {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing ${name}`);
  }
  return args[index + 1] ?? "";
}

async function writeJson(filePath: string, valueToWrite: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(valueToWrite, null, 2)}\n`, "utf8");
}
