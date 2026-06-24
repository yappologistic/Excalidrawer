#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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
        excalidrawerLayoutHints: scene.appState.excalidrawerLayoutHints ?? []
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
        { ok: false, status: "invalid quality", issues: quality.issues, excalidrawerReview: assertScene(parsed).appState.excalidrawerReview ?? null },
        null,
        2
      )
    );
    return 1;
  }
  console.log(JSON.stringify({ ok: true, status: "valid", path: filePath, excalidrawerReview: assertScene(parsed).appState.excalidrawerReview ?? null }, null, 2));
  return 0;
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
  install | reinstall | check | uninstall
  mcp
`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main();
}
