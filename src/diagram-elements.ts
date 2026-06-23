import type { ExcalidrawBinding, ExcalidrawElement, ExcalidrawElementType, ExcalidrawScene } from "./scene-types.js";
import type { ThemeName } from "./diagram-model.js";
import { themes } from "./diagram-themes.js";
import { measureTextHeight } from "./scene-quality.js";

let elementId = 0;

export function resetElementIds(): void {
  elementId = 0;
}

export function baseElement(
  type: ExcalidrawElementType,
  x: number,
  y: number,
  width: number,
  height: number,
  themeName: ThemeName,
  overrides: Partial<ExcalidrawElement> = {}
): ExcalidrawElement {
  elementId += 1;
  const theme = themes[themeName];
  return {
    id: `excalidrawer-compiler-${elementId}`,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: theme.stroke,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: theme.strokeWidth,
    strokeStyle: "solid",
    roughness: theme.roughness,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 5000 + elementId,
    version: 1,
    versionNonce: 6000 + elementId,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    ...overrides
  };
}

export function freeText(
  value: string,
  x: number,
  y: number,
  width: number,
  themeName: ThemeName,
  overrides: Partial<ExcalidrawElement> = {}
): ExcalidrawElement {
  const fontSize = overrides.fontSize ?? themes[themeName].fontSize;
  return {
    ...baseElement("text", x, y, width, measureTextHeight(value, width, fontSize), themeName, { backgroundColor: "transparent" }),
    text: value,
    originalText: value,
    fontSize,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    baseline: Math.max(12, fontSize - 2),
    containerId: null,
    lineHeight: 1.25,
    ...overrides
  };
}

export function binding(elementIdValue: string, fixedPoint: [number, number]): ExcalidrawBinding {
  return { elementId: elementIdValue, fixedPoint, mode: "orbit" };
}

export function scene(elements: readonly ExcalidrawElement[]): ExcalidrawScene {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://github.com/yappologistic/Excalidrawer",
    elements: [...elements],
    appState: { gridSize: null, viewBackgroundColor: "#ffffff", exportBackground: true, exportWithDarkMode: false, exportEmbedScene: false },
    files: {}
  };
}
