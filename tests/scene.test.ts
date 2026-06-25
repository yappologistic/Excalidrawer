import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ExcalidrawElement,
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

  it("rejects saved scene envelopes with malformed element internals", () => {
    const scene = createSceneFromPrompt("client calls API then worker");
    const [firstElement] = scene.elements;
    const arrow = scene.elements.find((element) => element.type === "arrow");
    if (!firstElement || !arrow) throw new Error("expected generated scene elements");

    const missingSource = validateScene({ ...scene, source: undefined });
    const unknownElementType = validateScene({ ...scene, elements: [{ ...firstElement, type: "not-an-excalidraw-type" }] });
    const officialElementTypes = validateScene({
      ...scene,
      elements: [
        { ...firstElement, id: "image-element", type: "image" },
        { ...firstElement, id: "freedraw-element", type: "freedraw" },
        { ...firstElement, id: "frame-element", type: "frame" },
        { ...firstElement, id: "magicframe-element", type: "magicframe" },
        { ...firstElement, id: "iframe-element", type: "iframe" },
        { ...firstElement, id: "embeddable-element", type: "embeddable" }
      ]
    });
    const skipBinding = validateScene({
      ...scene,
      elements: [{ ...arrow, startBinding: { elementId: arrow.startBinding?.elementId, fixedPoint: [0.5, 0.5], mode: "skip" } }]
    });
    const malformedPoints = validateScene({ ...scene, elements: [{ ...arrow, points: [[0, "bad"]] }] });
    const malformedBinding = validateScene({
      ...scene,
      elements: [{ ...arrow, startBinding: { elementId: arrow.startBinding?.elementId, fixedPoint: [0.5], mode: "orbit" } }]
    });
    const malformedFile = validateScene({
      ...scene,
      files: { "image-1": { id: "different-id", dataURL: "data:image/png;base64,abc", mimeType: 42, created: "today" } }
    });

    expect(missingSource.issues).toContain("Scene source must be a string");
    expect(unknownElementType.issues).toContain("Element 0.type must be a supported Excalidraw element type");
    expect(officialElementTypes.ok).toBe(true);
    expect(skipBinding.ok).toBe(true);
    expect(malformedPoints.issues).toContain("Element 0.points[0] must be a numeric point tuple");
    expect(malformedBinding.issues).toContain("Element 0.startBinding.fixedPoint must be a numeric point tuple");
    expect(malformedFile.issues).toContain("File image-1.id must match its files key");
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

  it("creates polished multi-step diagrams with centered text and bound arrows", () => {
    const scene = createSceneFromPrompt(
      "Browser client to MCP server then scene factory then quality validator then SVG exporter then reviewer"
    );
    const nodes = scene.elements.filter((element) => element.type === "rectangle");
    const labels = scene.elements.filter((element) => element.type === "text");
    const arrows = scene.elements.filter((element) => element.type === "arrow");

    expect(nodes.length).toBeGreaterThanOrEqual(5);
    expect(labels).toHaveLength(nodes.length);
    expect(arrows).toHaveLength(nodes.length - 1);
    expect(validateSceneQuality(scene).ok).toBe(true);

    for (const label of labels) {
      const container = nodes.find((node) => node.id === label.containerId);
      expect(container).toBeDefined();
      expect(label.textAlign).toBe("center");
      expect(label.verticalAlign).toBe("middle");
      if (!container) continue;
      expect(label.x).toBeGreaterThanOrEqual(container.x);
      expect(label.y).toBeGreaterThanOrEqual(container.y);
      expect(label.x + label.width).toBeLessThanOrEqual(container.x + container.width);
      expect(label.y + label.height).toBeLessThanOrEqual(container.y + container.height);
    }

    for (const arrow of arrows) {
      expect(arrow.points?.[0]).toEqual([0, 0]);
      expect(arrow.points?.length).toBeGreaterThanOrEqual(2);
      expect(arrow.startBinding?.elementId).toBeTruthy();
      expect(arrow.endBinding?.elementId).toBeTruthy();
      expect(arrow.endArrowhead).toBe("arrow");
      const startNode = nodes.find((node) => node.id === arrow.startBinding?.elementId);
      const endNode = nodes.find((node) => node.id === arrow.endBinding?.elementId);
      expect(startNode?.boundElements?.some((bound) => bound.id === arrow.id && bound.type === "arrow")).toBe(true);
      expect(endNode?.boundElements?.some((bound) => bound.id === arrow.id && bound.type === "arrow")).toBe(true);
    }
  });

  it("exports SVG arrows with marker definitions and centered labels", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-arrows-"));
    try {
      const svgPath = path.join(dir, "arrows.svg");
      const scene = createSceneFromPrompt("Client requests auth then API calls worker then database returns retry queue");

      await exportScene(scene, svgPath, "svg");

      const svg = await readFile(svgPath, "utf8");
      expect(svg).toContain("<marker id=\"arrowhead\"");
      expect(svg).toContain("marker-end=\"url(#arrowhead)\"");
      expect(svg).toContain("text-anchor=\"middle\"");
      expect(svg).toContain("dominant-baseline=\"middle\"");
      expect(svg).toContain("<polyline");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects arrows that cross visible content", () => {
    const scene = createSceneFromPrompt("alpha to beta then gamma");
    const arrow = scene.elements.find((element) => element.type === "arrow");
    const target = scene.elements.find((element) => element.type === "text");
    if (!arrow || !target) throw new Error("expected generated arrows and labels");
    arrow.startBinding = null;
    arrow.endBinding = null;
    arrow.x = target.x - 30;
    arrow.y = target.y + target.height / 2;
    arrow.width = target.width + 60;
    arrow.height = 0;
    arrow.points = [
      [0, 0],
      [arrow.width, 0]
    ];

    const result = validateSceneQuality(scene);

    expect(result.ok).toBe(false);
    expect(result.issues.join("\n")).toContain("crosses visible content");
  });

  it("rejects arrows with missing bindings, missing arrowheads, or unregistered endpoints", () => {
    const scene = createSceneFromPrompt("client calls API");
    const arrow = scene.elements.find((element) => element.type === "arrow");
    if (!arrow?.endBinding?.elementId) throw new Error("expected generated bound arrow");
    const endpoint = scene.elements.find((element) => element.id === arrow.endBinding?.elementId);
    if (!endpoint) throw new Error("expected generated endpoint");
    arrow.startBinding = null;
    arrow.endArrowhead = null;
    endpoint.boundElements = [];

    const result = validateSceneQuality(scene);

    expect(result.ok).toBe(false);
    expect(result.issues.join("\n")).toContain("missing start binding");
    expect(result.issues.join("\n")).toContain("visible arrowhead");
    expect(result.issues.join("\n")).toContain("not registered on bound element");
  });

  it("rejects container labels that overflow or drift away from the container center", () => {
    const scene = createSceneFromPrompt("client calls API");
    const label = scene.elements.find((element) => element.type === "text" && element.containerId);
    const container = scene.elements.find((element) => element.id === label?.containerId);
    if (!label || !container) throw new Error("expected generated label and container");
    label.x = container.x + container.width + 30;

    const result = validateSceneQuality(scene);

    expect(result.ok).toBe(false);
    expect(result.issues.join("\n")).toContain("overflows its container");
    expect(result.issues.join("\n")).toContain("not centered in container");
  });

  it("rejects strict family scenes with missing notation roles", () => {
    const scene = createSceneFromPrompt("UML class diagram for User, Order, User places Order");
    const stripped = {
      ...scene,
      elements: scene.elements.map((element) => ({
        ...element,
        customData: element.customData?.excalidrawer?.notationRole === "class-compartment" ? undefined : element.customData
      }))
    };

    const result = validateSceneQuality(stripped);

    expect(result.ok).toBe(false);
    expect(result.issues.join("\n")).toContain("missing notation role class-compartment");
  });

  it("keeps multilingual labels inside generated containers", () => {
    const scene = createSceneFromPrompt(
      "복잡한 아키텍처 요청을 분석하는 에이전트 to 검증기와 렌더러가 긴 한국어 라벨을 처리 then 최종 SVG 검토"
    );
    const result = validateSceneQuality(scene);
    const textElements = scene.elements.filter((element): element is ExcalidrawElement => element.type === "text");

    expect(result.ok).toBe(true);
    expect(textElements.every((element) => element.textAlign === "center")).toBe(true);
    expect(textElements.every((element) => (element.width ?? 0) >= 180)).toBe(true);
  });
});
