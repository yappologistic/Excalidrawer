import { describe, expect, it } from "vitest";
import { createSceneFromPrompt, validateSceneQuality } from "../src/scene.js";
import { compileDiagram, parseDiagramPrompt, scoreDiagramScene } from "../src/diagram-compiler.js";
import { layoutIntents, themeNames } from "../src/diagram-model.js";

const complexPrompt =
  "frontend calls API, API writes Postgres, worker consumes queue, queue retries failed jobs, auth service issues token, metrics collector observes API, alert manager notifies on failures, admin dashboard reads metrics";

describe("diagram compiler", () => {
  it("parses prompts into a controllable diagram IR", () => {
    const model = parseDiagramPrompt(complexPrompt);

    expect(model.nodes.length).toBeGreaterThanOrEqual(8);
    expect(model.edges.length).toBeGreaterThanOrEqual(7);
    expect(model.groups.length).toBeGreaterThanOrEqual(2);
    expect(model.lanes.length).toBeGreaterThanOrEqual(2);
    expect(model.clusters.length).toBeGreaterThanOrEqual(2);
    expect(model.annotations.length).toBeGreaterThanOrEqual(1);
    expect(model.layoutIntent).toBe("architecture");
    expect(model.edges.map((edge) => edge.verb)).toContain("writes");
  });

  it("strips explicit layout prefixes case-insensitively", () => {
    const model = parseDiagramPrompt("Architecture: frontend calls API");

    expect(model.layoutIntent).toBe("architecture");
    expect(model.nodes.map((node) => node.label)).toEqual(["frontend", "API"]);
  });

  it("does not normalize compiler-triggered weak prompts into empty valid scenes", () => {
    const commaScene = createSceneFromPrompt("alpha to beta, beta to gamma");
    const topicScene = createSceneFromPrompt("flow: quarterly roadmap");
    const mixedScene = createSceneFromPrompt("flow: alpha to beta then gamma");
    const mixedLabels = mixedScene.elements.filter((element) => element.type === "text").map((element) => element.originalText);
    const mixedArrows = mixedScene.elements.filter((element) => element.type === "arrow");

    expect(commaScene.elements.length).toBeGreaterThan(0);
    expect(topicScene.elements.length).toBeGreaterThan(0);
    expect(mixedLabels).toEqual(["alpha", "beta", "gamma"]);
    expect(mixedArrows).toHaveLength(2);
    expect(validateSceneQuality(commaScene).ok).toBe(true);
    expect(validateSceneQuality(topicScene).ok).toBe(true);
    expect(validateSceneQuality(mixedScene).ok).toBe(true);
  });

  it("supports every layout intent with polished valid scenes", () => {
    for (const layoutIntent of layoutIntents) {
      const scene = compileDiagram({
        prompt: `${layoutIntent}: ${complexPrompt}`,
        layoutIntent,
        themeName: "technical"
      });
      const rectangles = scene.elements.filter((element) => element.type === "rectangle");
      const arrows = scene.elements.filter((element) => element.type === "arrow");

      expect(rectangles.length, layoutIntent).toBeGreaterThanOrEqual(8);
      expect(arrows.length, layoutIntent).toBeGreaterThanOrEqual(7);
      expect(validateSceneQuality(scene).ok, layoutIntent).toBe(true);
      expect(scoreDiagramScene(scene).ok, layoutIntent).toBe(true);
    }
  });

  it("applies reusable themes without breaking layout quality", () => {
    for (const themeName of themeNames) {
      const scene = compileDiagram({ prompt: complexPrompt, layoutIntent: "architecture", themeName });
      const fills = new Set(
        scene.elements.filter((element) => element.type === "rectangle").map((element) => element.backgroundColor)
      );

      expect(fills.size, themeName).toBeGreaterThan(1);
      expect(validateSceneQuality(scene).ok, themeName).toBe(true);
    }
  });

  it("fails closed when a scored scene contains arrows over labels", () => {
    const scene = createSceneFromPrompt("alpha to beta then gamma");
    const arrow = scene.elements.find((element) => element.type === "arrow");
    const label = scene.elements.find((element) => element.type === "text");
    if (!arrow || !label) throw new Error("expected generated arrow and label");
    arrow.startBinding = null;
    arrow.endBinding = null;
    arrow.x = label.x - 10;
    arrow.y = label.y + label.height / 2;
    arrow.width = label.width + 20;
    arrow.height = 0;
    arrow.points = [
      [0, 0],
      [arrow.width, 0]
    ];

    const score = scoreDiagramScene(scene);

    expect(score.ok).toBe(false);
    expect(score.issues.join("\n")).toContain("crosses visible content");
  });
});
