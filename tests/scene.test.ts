import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSceneQuality,
  createSceneFromPrompt,
  editScene,
  exportScene,
  readScene,
  validateSceneQuality,
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
      expect(validateSceneQuality(scene).ok).toBe(true);

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

  it("rejects visibly overlapped scene content", () => {
    const scene = createSceneFromPrompt("client calls API");
    const [first, second] = scene.elements;
    if (!first || !second) throw new Error("expected generated scene elements");
    second.x = first.x;
    second.y = first.y;
    second.width = first.width;
    second.height = first.height;

    const result = validateSceneQuality(scene);

    expect(result.ok).toBe(false);
    expect(result.issues.join("\n")).toContain("overlap");
    expect(() => assertSceneQuality(scene)).toThrow(/Scene quality check failed/);
  });

  it("places added notes without colliding with existing elements", () => {
    const scene = createSceneFromPrompt("client calls API");

    const edited = editScene(scene, { addText: "Cache retry policy" });

    expect(validateSceneQuality(edited).ok).toBe(true);
  });

  it("allows large section containers around child elements", () => {
    const scene = createSceneFromPrompt("client calls API");
    const [first] = scene.elements;
    if (!first) throw new Error("expected generated scene elements");
    scene.elements.unshift({
      ...first,
      id: "section-container",
      x: first.x - 30,
      y: first.y - 30,
      width: 720,
      height: 180,
      backgroundColor: "#f8fafc"
    });

    expect(validateSceneQuality(scene).ok).toBe(true);
  });

  it("exports multiline text with SVG tspans", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-multiline-"));
    try {
      const svgPath = path.join(dir, "multiline.svg");
      const scene = editScene(createSceneFromPrompt("client calls API"), {
        addText: "first line\nsecond line"
      });

      await exportScene(scene, svgPath, "svg");

      expect(await readFile(svgPath, "utf8")).toContain("<tspan");
      expect(validateSceneQuality(scene).ok).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
