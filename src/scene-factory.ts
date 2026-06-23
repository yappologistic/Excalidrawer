import { ExcalidrawElement, ExcalidrawElementType, ExcalidrawScene } from "./scene-types.js";

let idCounter = 0;

export function createSceneFromPrompt(prompt: string): ExcalidrawScene {
  const labels = prompt
    .split(/\s+(?:to|->|then|and|sends?|calls?|requests?)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const primary = labels.length >= 2 ? labels.slice(0, 3) : promptWords(prompt);
  const elements: ExcalidrawElement[] = [];
  const y = 120;

  primary.forEach((label, index) => {
    const x = 80 + index * 250;
    elements.push(rectangle(x, y, 170, 90));
    elements.push(text(label, x + 18, y + 34, 134));
    if (index > 0) {
      elements.push(arrow(80 + (index - 1) * 250 + 180, y + 45, 70, 0));
    }
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
    result.elements.push(text(edit.addText, edit.x ?? 80, edit.y ?? 80, Math.max(160, edit.addText.length * 9)));
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
  return {
    ...baseElement("text", x, y, width, 25, { backgroundColor: "transparent" }),
    text: value,
    originalText: value,
    fontSize: 20,
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
