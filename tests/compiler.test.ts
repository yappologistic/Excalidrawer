import { describe, expect, it } from "vitest";
import { createSceneFromPrompt, renderSvg, validateSceneQuality } from "../src/scene.js";
import { compileDiagram, parseDiagramPrompt, scoreDiagramScene } from "../src/diagram-compiler.js";
import { layoutIntents, themeNames } from "../src/diagram-model.js";
import { galleryCases, runGalleryVerification } from "../src/diagram-gallery.js";
import { diagramTemplates } from "../src/diagram-templates.js";

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
    const mixedLabels = mixedScene.elements
      .filter((element) => element.type === "text" && element.customData?.excalidrawer?.role === "node-label")
      .map((element) => element.originalText);
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

  it("extracts semantic shapes, icons, typed arrows, templates, and complexity into the IR", () => {
    const model = parseDiagramPrompt({
      prompt: "incident-response: client reports outage, alert manager notifies on-call, on-call investigates API, API reads Postgres, worker consumes queue",
      layoutIntent: "incident-response",
      themeName: "incident-response",
      templateName: "incident-response",
      complexityMode: "detailed"
    });

    expect(model.layoutIntent).toBe("incident-response");
    expect(model.templateName).toBe("incident-response");
    expect(model.complexityMode).toBe("detailed");
    expect(model.nodes.map((node) => node.semanticShape)).toEqual(
      expect.arrayContaining(["actor", "alert", "service", "database", "queue"])
    );
    expect(model.nodes.every((node) => node.iconKey.length > 0)).toBe(true);
    expect(model.edges.map((edge) => edge.edgeType)).toEqual(expect.arrayContaining(["alert", "query", "async"]));
    expect(model.annotations.length).toBeGreaterThanOrEqual(2);
  });

  it("renders complex diagrams with semantic shapes, icons, edge labels, typed arrows, and callouts", () => {
    const scene = compileDiagram({
      prompt: complexPrompt,
      layoutIntent: "architecture",
      themeName: "system-architecture",
      templateName: "system-architecture",
      complexityMode: "detailed"
    });
    const semanticShapes = scene.elements.filter((element) => element.customData?.excalidrawer?.role === "node-shape");
    const icons = scene.elements.filter((element) => element.customData?.excalidrawer?.role === "icon");
    const edgeLabels = scene.elements.filter((element) => element.customData?.excalidrawer?.role === "edge-label");
    const callouts = scene.elements.filter((element) => element.customData?.excalidrawer?.role === "annotation");
    const typedArrows = scene.elements.filter((element) => element.type === "arrow" && element.customData?.excalidrawer?.edgeType);

    expect(semanticShapes.some((element) => element.type === "ellipse" || element.type === "diamond")).toBe(true);
    expect(icons.length).toBeGreaterThanOrEqual(semanticShapes.length);
    expect(edgeLabels.length).toBeGreaterThanOrEqual(typedArrows.length);
    expect(callouts.length).toBeGreaterThanOrEqual(1);
    expect(typedArrows.map((element) => element.strokeStyle)).toContain("dashed");
    expect(validateSceneQuality(scene).ok).toBe(true);

    const svg = renderSvg(scene);
    expect(svg).toContain("data-excalidrawer-role=\"icon\"");
    expect(svg).toContain("data-excalidrawer-edge-type=");
  });

  it("publishes templates and verifies gallery cases through the quality gate", async () => {
    expect(Object.keys(diagramTemplates)).toEqual(expect.arrayContaining([...layoutIntents]));
    expect(galleryCases.length).toBeGreaterThanOrEqual(layoutIntents.length);

    const result = await runGalleryVerification();

    expect(result.ok).toBe(true);
    expect(result.cases.map((entry) => entry.layoutIntent)).toEqual(expect.arrayContaining([...layoutIntents]));
    expect(result.cases.every((entry) => entry.excalidrawOk && entry.svgOk)).toBe(true);
  });

  it("keeps compact architecture prompts readable instead of failing from cramped spacing", () => {
    const scene = compileDiagram(
      "compact architecture: frontend calls API, API writes Postgres, API publishes queue, worker consumes queue"
    );

    expect(scoreDiagramScene(scene).ok).toBe(true);
  });

  it("routes dense architecture arrows without covering lower-row content", () => {
    const scene = compileDiagram(
      "architecture: browser calls gateway, gateway authenticates user, API calls worker, API writes Postgres, API publishes queue, worker consumes queue, API observes metrics collector, alert manager notifies on-call, admin dashboard reads metrics"
    );

    expect(validateSceneQuality(scene).ok).toBe(true);
    expect(scoreDiagramScene(scene).ok).toBe(true);
  });

  it("renders custom hub-and-spoke mindmaps without routing arrows through sibling nodes", () => {
    const scene = compileDiagram(
      "mindmap: platform idea to reliability, platform idea to observability, platform idea to delivery, platform idea to security, platform idea to cost"
    );

    expect(scoreDiagramScene(scene).ok).toBe(true);
  });
});
