import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ExcalidrawScene } from "./scene-types.js";
import { assertSceneQuality } from "./scene-quality.js";
import { assertScene } from "./scene-validation.js";

export async function readScene(filePath: string): Promise<ExcalidrawScene> {
  return assertSceneQuality(assertScene(await readSceneJson(filePath)));
}

export async function readSceneJson(filePath: string): Promise<unknown> {
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  return parsed;
}

export async function writeScene(filePath: string, scene: ExcalidrawScene): Promise<void> {
  assertScene(scene);
  assertSceneQuality(scene);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(scene, null, 2)}\n`, "utf8");
}
