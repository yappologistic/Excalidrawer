import { ExcalidrawElement, ExcalidrawElementType, ExcalidrawScene } from "./scene-types.js";
import { findClearTextPlacement, measureTextHeight, recommendedTextWidth } from "./scene-quality.js";

let idCounter = 0;

export function createSceneFromPrompt(prompt: string): ExcalidrawScene {
  const labels = prompt
    .split(/\s+(?:to|->|then|and|sends?|calls?|requests?)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const primary = labels.length >= 2 ? labels.slice(0, 3) : promptWords(prompt);
  const elements: ExcalidrawElement[] = [];
  const y = 120;
  let x = 80;
  let previousRight = 0;

  primary.forEach((label, index) => {
    const nodeWidth = Math.max(190, recommendedTextWidth(label) + 36);
    const labelWidth = nodeWidth - 36;
    const labelHeight = measureTextHeight(label, labelWidth);
    const nodeHeight = Math.max(96, labelHeight + 48);
    if (index > 0) {
      elements.push(arrow(previousRight + 20, y + nodeHeight / 2, x - previousRight - 40, 0));
    }
    elements.push(rectangle(x, y, nodeWidth, nodeHeight));
    elements.push(text(label, x + 18, y + 24, labelWidth));
    previousRight = x + nodeWidth;
    x = previousRight + 100;
  });

  return {
    type: "excalidraw",
    version: 2,
    source: "https://github.com/yappologistic/Excalidrawer",
    elements,
    appState: {
      gridSize: null,
      viewBackgroundColor: "#ffffff",
      exportBackground: true,
      exportWithDarkMode: false,
      exportEmbedScene: false
    },
    files: {}
  };
}

export function editScene(
  scene: ExcalidrawScene,
  edit: { addText?: string; x?: number; y?: number }
): ExcalidrawScene {
  const result = cloneScene(scene);
  if (edit.addText) {
    const placement = findClearTextPlacement(result, edit.addText, {
      x: edit.x,
      y: edit.y,
      width: Math.max(160, edit.addText.length * 9)
    });
    result.elements.push(text(edit.addText, placement.x, placement.y, placement.width));
  }
  return result;
}

function rectangle(x: number, y: number, width: number, height: number): ExcalidrawElement {
  return baseElement("rectangle", x, y, width, height, {
    backgroundColor: "#e0f2fe",
    roundness: { type: 3 }
  });
}

function text(value: string, x: number, y: number, width: number): ExcalidrawElement {
  const fontSize = 20;
  const height = measureTextHeight(value, width, fontSize);
  return {
    ...baseElement("text", x, y, width, height, { backgroundColor: "transparent" }),
    text: value,
    originalText: value,
    fontSize,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    baseline: 18,
    containerId: null,
    lineHeight: 1.25
  };
}

function arrow(x: number, y: number, width: number, height: number): ExcalidrawElement {
  return {
    ...baseElement("arrow", x, y, width, height, { backgroundColor: "transparent" }),
    points: [
      [0, 0],
      [width, height]
    ],
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow"
  };
}

function baseElement(
  type: ExcalidrawElementType,
  x: number,
  y: number,
  width: number,
  height: number,
  overrides: Partial<ExcalidrawElement> = {}
): ExcalidrawElement {
  idCounter += 1;
  return {
    id: `excalidrawer-${Date.now().toString(36)}-${idCounter}`,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "#1e293b",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1000 + idCounter,
    version: 1,
    versionNonce: 2000 + idCounter,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    ...overrides
  };
}

function promptWords(prompt: string): string[] {
  const clean = prompt.trim() || "Untitled diagram";
  const words = clean.split(/\s+/);
  if (words.length <= 4) return [clean, "Review", "Ship"];
  return [words.slice(0, 3).join(" "), words.slice(3, 6).join(" "), words.slice(6, 9).join(" ") || "Done"];
}

function cloneScene(scene: ExcalidrawScene): ExcalidrawScene {
  return JSON.parse(JSON.stringify(scene)) as ExcalidrawScene;
}
