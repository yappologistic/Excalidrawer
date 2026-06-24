#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StructuredImportFormat } from "./advanced-tools.js";
import {
  createRendererHarness,
  diffScenes,
  explainSceneQuality,
  exportLibraryPack,
  importStructuredDiagram,
  listDiagramRecipes,
  repairScene,
  runBrowserDoctor,
  runVisualRegression,
  sceneFromRecipe
} from "./advanced-tools.js";
import {
  checkInstall,
  installPlugin,
  reinstallPlugin,
  uninstallPlugin
} from "./installer.js";
import { runGalleryVerification } from "./diagram-gallery.js";
import {
  createSceneFromPrompt,
  editScene,
  exportScene,
  readScene,
  readSceneJson,
  assertScene,
  validateScene,
  validateSceneQuality,
  writeScene
} from "./scene.js";

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...args] = argv;
  try {
    switch (command) {
      case "create":
        return await createCommand(args);
      case "edit":
        return await editCommand(args);
      case "read":
        return await readCommand(args);
      case "validate":
        return await validateCommand(args);
      case "export":
        return await exportCommand(args);
      case "gallery":
        return await galleryCommand();
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
      case "install":
        return await installCommand();
      case "reinstall":
        return await reinstallCommand();
      case "check":
        return await checkCommand();
      case "uninstall":
        return await uninstallCommand();
      case "mcp":
        await import("./mcp-server.js");
        return 0;
      default:
        printHelp();
        return command ? 1 : 0;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function value(args: string[], name: string, fallback?: string): string {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing ${name}`);
  }
  return args[index + 1];
}

async function createCommand(args: string[]): Promise<number> {
  const prompt = value(args, "--prompt");
  const out = value(args, "--out");
  await writeScene(out, createSceneFromPrompt(prompt));
  console.log(`created ${out}`);
  return 0;
}

async function editCommand(args: string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) throw new Error("Missing scene path");
  const addText = value(args, "--add-text");
  const scene = editScene(await readScene(filePath), { addText });
  await writeScene(filePath, scene);
  console.log(`edited ${filePath}`);
  return 0;
}

async function readCommand(args: string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) throw new Error("Missing scene path");
  const scene = await readScene(filePath);
  console.log(
    JSON.stringify(
      {
        path: filePath,
        type: scene.type,
        version: scene.version,
        elements: scene.elements.length,
        source: scene.source,
        excalidrawerReview: scene.appState.excalidrawerReview ?? null,
        excalidrawerRenderer: scene.appState.excalidrawerRenderer ?? null,
        excalidrawerLayoutHints: scene.appState.excalidrawerLayoutHints ?? [],
        excalidrawerLayoutProfile: scene.appState.excalidrawerLayoutProfile ?? null,
        excalidrawerDomainPack: scene.appState.excalidrawerDomainPack ?? null,
        excalidrawerStylePreset: scene.appState.excalidrawerStylePreset ?? null,
        excalidrawerImportedSource: scene.appState.excalidrawerImportedSource ?? null,
        excalidrawerProgressiveDetail: scene.appState.excalidrawerProgressiveDetail ?? null,
        excalidrawerGoldenFixture: scene.appState.excalidrawerGoldenFixture ?? null
      },
      null,
      2
    )
  );
  return 0;
}

async function validateCommand(args: string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) throw new Error("Missing scene path");
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  const result = validateScene(parsed);
  if (!result.ok) {
    console.error(`invalid: ${result.issues.join("; ")}`);
    return 1;
  }
  const quality = validateSceneQuality(assertScene(parsed));
  if (!quality.ok) {
    console.error(
      JSON.stringify(
        { ok: false, status: "invalid quality", issues: quality.issues, qualitySummary: explainSceneQuality(assertScene(parsed)), ...sceneSummary(assertScene(parsed)) },
        null,
        2
      )
    );
    return 1;
  }
  console.log(JSON.stringify({ ok: true, status: "valid", path: filePath, qualitySummary: explainSceneQuality(assertScene(parsed)), ...sceneSummary(assertScene(parsed)) }, null, 2));
  return 0;
}

function sceneSummary(scene: ReturnType<typeof assertScene>): Record<string, unknown> {
  return {
    excalidrawerReview: scene.appState.excalidrawerReview ?? null,
    excalidrawerRenderer: scene.appState.excalidrawerRenderer ?? null,
    excalidrawerLayoutHints: scene.appState.excalidrawerLayoutHints ?? [],
    excalidrawerLayoutProfile: scene.appState.excalidrawerLayoutProfile ?? null,
    excalidrawerDomainPack: scene.appState.excalidrawerDomainPack ?? null,
    excalidrawerStylePreset: scene.appState.excalidrawerStylePreset ?? null,
    excalidrawerImportedSource: scene.appState.excalidrawerImportedSource ?? null,
    excalidrawerProgressiveDetail: scene.appState.excalidrawerProgressiveDetail ?? null,
    excalidrawerGoldenFixture: scene.appState.excalidrawerGoldenFixture ?? null
  };
}

async function exportCommand(args: string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) throw new Error("Missing scene path");
  const format = value(args, "--format") as "svg" | "png";
  if (format !== "svg" && format !== "png") throw new Error("--format must be svg or png");
  const out = value(args, "--out");
  await exportScene(await readScene(filePath), out, format);
  console.log(`exported ${out}`);
  return 0;
}

async function galleryCommand(): Promise<number> {
  const result = await runGalleryVerification();
  if (!result.ok) {
    for (const entry of result.cases.filter((candidate) => !candidate.excalidrawOk || !candidate.svgOk)) {
      console.error(`${entry.name}: ${entry.issues.join("; ")}`);
    }
    return 1;
  }
  console.log(`gallery valid ${result.cases.length} cases`);
  return 0;
}

async function importCommand(args: string[]): Promise<number> {
  const format = value(args, "--format") as StructuredImportFormat;
  const input = value(args, "--in");
  const out = value(args, "--out");
  const imported = importStructuredDiagram({ format, source: await readFile(input, "utf8") });
  await writeScene(out, createSceneFromPrompt(imported.prompt));
  console.log(JSON.stringify({ imported: out, format: imported.format, entities: imported.entities.length, relationships: imported.relationships.length }, null, 2));
  return 0;
}

async function recipeCommand(args: string[]): Promise<number> {
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

async function repairCommand(args: string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) throw new Error("Missing scene path");
  const out = value(args, "--out", filePath);
  const result = repairScene(assertScene(await readSceneJson(filePath)));
  await writeScene(out, result.scene);
  console.log(JSON.stringify({ ok: result.ok, out, actions: result.actions }, null, 2));
  return result.ok ? 0 : 1;
}

async function diffCommand(args: string[]): Promise<number> {
  const before = args[0];
  const after = args[1];
  if (!before || !after) throw new Error("Missing scene paths");
  const out = value(args, "--out");
  const diff = diffScenes(await readScene(before), await readScene(after));
  await writeJson(out, diff);
  console.log(`diff wrote ${out}`);
  return 0;
}

async function libraryCommand(args: string[]): Promise<number> {
  const out = value(args, "--out");
  await writeJson(out, exportLibraryPack());
  console.log(`library wrote ${out}`);
  return 0;
}

async function harnessCommand(args: string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) throw new Error("Missing scene path");
  const out = value(args, "--out");
  const harness = createRendererHarness(await readScene(filePath));
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, harness.html, "utf8");
  console.log(JSON.stringify({ out, ...harness.report }, null, 2));
  return 0;
}

async function visualRegressionCommand(args: string[]): Promise<number> {
  const filePath = args[0];
  if (!filePath) throw new Error("Missing scene path");
  const out = value(args, "--out");
  const result = runVisualRegression([{ name: path.basename(filePath), scene: await readScene(filePath) }]);
  await writeJson(out, result);
  console.log(`visual regression wrote ${out}`);
  return result.ok ? 0 : 1;
}

async function doctorCommand(args: string[]): Promise<number> {
  const target = args[0];
  if (target !== "browser") throw new Error("Only doctor browser is supported");
  const scenePath = value(args, "--scene");
  const out = value(args, "--out");
  const result = await runBrowserDoctor(await readScene(scenePath));
  await writeJson(out, result);
  console.log(`doctor wrote ${out}`);
  return result.ok ? 0 : 1;
}

async function installCommand(): Promise<number> {
  const result = await installPlugin();
  console.log(`installed ${result.pluginDir}`);
  console.log(`marketplace ${result.marketplacePath}`);
  return 0;
}

async function reinstallCommand(): Promise<number> {
  const result = await reinstallPlugin();
  console.log(`reinstalled ${result.pluginDir}`);
  console.log(`marketplace ${result.marketplacePath}`);
  return 0;
}

async function checkCommand(): Promise<number> {
  const result = await checkInstall();
  if (!result.ok) {
    console.error(result.issues.join("\n"));
    return 1;
  }
  console.log("excalidrawer install is valid");
  return 0;
}

async function uninstallCommand(): Promise<number> {
  await uninstallPlugin();
  console.log("uninstalled excalidrawer");
  return 0;
}

function printHelp(): void {
  console.log(`excalidrawer

Commands:
  create --prompt <text> --out <file.excalidraw>
  edit <file.excalidraw> --add-text <text>
  read <file.excalidraw>
  validate <file.excalidraw>
  export <file.excalidraw> --format svg|png --out <file>
  gallery
  import --format mermaid|plantuml|dot|openapi|terraform|docker-compose|kubernetes|package-deps --in <file> --out <file.excalidraw>
  recipe <name> --out <file.excalidraw>
  repair <file.excalidraw> --out <file.excalidraw>
  diff <before.excalidraw> <after.excalidraw> --out <diff.json>
  library --out <pack.excalidrawlib>
  harness <file.excalidraw> --out <harness.html>
  visual-regression <file.excalidraw> --out <report.json>
  doctor browser --scene <file.excalidraw> --out <report.json>
  install | reinstall | check | uninstall
  mcp
`);
}

async function writeJson(filePath: string, valueToWrite: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(valueToWrite, null, 2)}\n`, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main();
}
