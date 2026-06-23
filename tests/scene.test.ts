import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createSceneFromPrompt,
  editScene,
  exportScene,
  readScene,
  validateScene,
  writeScene
} from "../src/scene.js";

describe("scene operations", () => {
  it("creates, edits, validates, and exports an Excalidraw scene", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-scene-"));
    try {
      const scenePath = path.join(dir, "system.excalidraw");
      const svgPath = path.join(dir, "system.svg");
      const pngPath = path.join(dir, "system.png");

      const scene = createSceneFromPrompt("API gateway sends requests to worker");
      expect(scene.type).toBe("excalidraw");
      expect(scene.elements.length).toBeGreaterThanOrEqual(3);
      expect(validateScene(scene).ok).toBe(true);

      await writeScene(scenePath, scene);
      const edited = editScene(await readScene(scenePath), {
        addText: "Retries failed jobs",
        x: 80,
        y: 260
      });
      await writeScene(scenePath, edited);

      await exportScene(edited, svgPath, "svg");
      await exportScene(edited, pngPath, "png");

      const svg = await readFile(svgPath, "utf8");
      const png = await readFile(pngPath);
      expect(svg).toContain("<svg");
      expect(svg).toContain("Retries failed jobs");
      expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(png.length).toBeGreaterThan(1000);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects malformed scene data", () => {
    expect(validateScene({ type: "not-excalidraw", elements: [] }).ok).toBe(false);
    expect(validateScene({ type: "excalidraw", elements: "bad" }).ok).toBe(false);
  });
});
