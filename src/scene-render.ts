import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import type { ExcalidrawElement, ExcalidrawScene } from "./scene-types.js";
import { absolutePoints, contentBounds, elementBox, type Point } from "./scene-geometry.js";
import { assertSceneQuality } from "./scene-quality.js";
import { assertScene } from "./scene-validation.js";

export async function exportScene(
  scene: ExcalidrawScene,
  outPath: string,
  format: "svg" | "png"
): Promise<void> {
  assertScene(scene);
  assertSceneQuality(scene);
  await mkdir(path.dirname(outPath), { recursive: true });
  if (format === "svg") {
    await writeFile(outPath, renderSvg(scene), "utf8");
    return;
  }
  await writeFile(outPath, PNG.sync.write(renderPng(scene)));
}

export function renderSvg(scene: ExcalidrawScene): string {
  const bounds = sceneBounds(scene);
  const active = scene.elements.filter((element) => !element.isDeleted);
  const body = renderOrder(active)
    .map((element) => svgElement(element))
    .join("\n  ");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}" role="img">`,
    "  <title>Excalidrawer export</title>",
    "  <defs>",
    "    <marker id=\"arrowhead\" viewBox=\"0 0 10 10\" refX=\"9\" refY=\"5\" markerWidth=\"8\" markerHeight=\"8\" orient=\"auto-start-reverse\">",
    "      <path d=\"M 0 0 L 10 5 L 0 10 z\" fill=\"#1e293b\"/>",
    "    </marker>",
    "  </defs>",
    "  <rect width=\"100%\" height=\"100%\" fill=\"#ffffff\"/>",
    `  ${body}`,
    "</svg>",
    ""
  ].join("\n");
}

function renderPng(scene: ExcalidrawScene): PNG {
  const bounds = sceneBounds(scene);
  const png = new PNG({ width: bounds.width, height: bounds.height });
  fillWhite(png);
  for (const element of renderOrder(scene.elements.filter((candidate) => !candidate.isDeleted))) {
    if (element.type === "text") {
      drawTextMarkers(png, element, bounds);
      continue;
    }
    if (element.type === "arrow" || element.type === "line") {
      drawPolyline(png, absolutePoints(element), bounds);
      continue;
    }
    drawRect(png, Math.round(element.x - bounds.minX), Math.round(element.y - bounds.minY), Math.round(element.width), Math.round(element.height));
  }
  return png;
}

function fillWhite(png: PNG): void {
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 255;
    png.data[i + 1] = 255;
    png.data[i + 2] = 255;
    png.data[i + 3] = 255;
  }
}

function drawTextMarkers(
  png: PNG,
  element: ExcalidrawElement,
  bounds: { minX: number; minY: number }
): void {
  const x = Math.round(element.x - bounds.minX);
  const y = Math.round(element.y - bounds.minY);
  const width = Math.min(Math.max((element.text ?? "").length * 7, 24), Math.max(24, png.width - x - 2));
  const height = Math.min(10, Math.max(1, png.height - y - 2));
  for (let py = Math.max(0, y); py < y + height; py += 2) {
    for (let px = Math.max(0, x); px < x + width; px += 2) {
      setPixel(png, px, py);
    }
  }
}

function drawPolyline(png: PNG, points: readonly Point[], bounds: { minX: number; minY: number }): void {
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) continue;
    drawLine(
      png,
      Math.round(start.x - bounds.minX),
      Math.round(start.y - bounds.minY),
      Math.round(end.x - bounds.minX),
      Math.round(end.y - bounds.minY)
    );
  }
}

function drawLine(png: PNG, x1: number, y1: number, x2: number, y2: number): void {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    setPixel(png, Math.round(x1 + (x2 - x1) * ratio), Math.round(y1 + (y2 - y1) * ratio));
  }
}

function drawRect(png: PNG, x: number, y: number, width: number, height: number): void {
  const x2 = Math.min(png.width - 1, x + width);
  const y2 = Math.min(png.height - 1, y + height);
  for (let px = Math.max(0, x); px <= x2; px += 1) {
    setPixel(png, px, Math.max(0, y));
    setPixel(png, px, y2);
  }
  for (let py = Math.max(0, y); py <= y2; py += 1) {
    setPixel(png, Math.max(0, x), py);
    setPixel(png, x2, py);
  }
}

function setPixel(png: PNG, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = 30;
  png.data[idx + 1] = 41;
  png.data[idx + 2] = 59;
  png.data[idx + 3] = 255;
}

function svgElement(element: ExcalidrawElement): string {
  const stroke = escapeXml(element.strokeColor);
  const fill = element.backgroundColor === "transparent" ? "none" : escapeXml(element.backgroundColor);
  const dataAttrs = customDataAttributes(element);
  const dash = element.strokeStyle === "dashed" ? " stroke-dasharray=\"10 8\"" : element.strokeStyle === "dotted" ? " stroke-dasharray=\"2 8\"" : "";
  if (element.type === "text") {
    const fontSize = element.fontSize ?? 20;
    const lineHeight = element.lineHeight ?? 1.25;
    const lines = wrappedTextLines(element.text ?? "", element.width, fontSize);
    const textAnchor = element.textAlign === "center" ? "middle" : element.textAlign === "right" ? "end" : "start";
    const textX =
      element.textAlign === "center" ? element.x + element.width / 2 : element.textAlign === "right" ? element.x + element.width : element.x;
    const lineOffset = fontSize * lineHeight;
    const textY =
      element.verticalAlign === "middle"
        ? element.y + element.height / 2 - ((lines.length - 1) * lineOffset) / 2
        : element.y + fontSize;
    const tspans = lines
      .map((line, index) => `<tspan x="${textX}" dy="${index === 0 ? 0 : lineOffset}">${escapeXml(line)}</tspan>`)
      .join("");
    return `<text x="${textX}" y="${textY}" font-family="Virgil, Segoe UI, sans-serif" font-size="${fontSize}" fill="${stroke}" text-anchor="${textAnchor}" dominant-baseline="middle" aria-label="${escapeXml(element.text ?? "")}"${dataAttrs}>${tspans}</text>`;
  }
  if (element.type === "arrow" || element.type === "line") {
    const points = absolutePoints(element).map((point) => `${point.x},${point.y}`).join(" ");
    const marker = element.type === "arrow" && element.endArrowhead ? " marker-end=\"url(#arrowhead)\"" : "";
    return `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="${element.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dash}${marker}${dataAttrs}/>`;
  }
  if (element.type === "ellipse") {
    return `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${element.strokeWidth}"${dash}${dataAttrs}/>`;
  }
  if (element.type === "diamond") {
    const points = [
      `${element.x + element.width / 2},${element.y}`,
      `${element.x + element.width},${element.y + element.height / 2}`,
      `${element.x + element.width / 2},${element.y + element.height}`,
      `${element.x},${element.y + element.height / 2}`
    ].join(" ");
    return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${element.strokeWidth}"${dash}${dataAttrs}/>`;
  }
  return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${element.strokeWidth}"${dash}${dataAttrs}/>`;
}

function customDataAttributes(element: ExcalidrawElement): string {
  const data = element.customData?.excalidrawer;
  if (!data) return "";
  const attrs = [
    ["data-excalidrawer-role", data.role],
    ["data-excalidrawer-edge-type", data.edgeType],
    ["data-excalidrawer-route-group", data.routeGroup],
    ["data-excalidrawer-primitive-type", data.primitiveType],
    ["data-excalidrawer-decoration", data.decoration],
    ["data-excalidrawer-subdiagram-id", data.subdiagramId],
    ["data-excalidrawer-legend-item", data.legendItem],
    ["data-excalidrawer-review-status", data.reviewStatus],
    ["data-excalidrawer-renderer", data.rendererKey],
    ["data-excalidrawer-node-kind", data.nodeKind],
    ["data-excalidrawer-semantic-shape", data.semanticShape],
    ["data-excalidrawer-icon-key", data.iconKey],
    ["data-excalidrawer-template", data.templateName],
    ["data-excalidrawer-complexity", data.complexityMode]
  ] as const;
  return attrs.flatMap(([name, value]) => (value ? [` ${name}="${escapeXml(value)}"`] : [])).join("");
}

function sceneBounds(scene: ExcalidrawScene): { minX: number; minY: number; width: number; height: number } {
  const active = scene.elements.filter((element) => !element.isDeleted).map(elementBox);
  if (active.length === 0) return { minX: 0, minY: 0, width: 640, height: 360 };
  const bounds = contentBounds(active);
  const minX = bounds.minX - 52;
  const minY = bounds.minY - 52;
  const maxX = bounds.maxX + 52;
  const maxY = bounds.maxY + 52;
  return {
    minX,
    minY,
    width: Math.max(320, Math.ceil(maxX - minX)),
    height: Math.max(200, Math.ceil(maxY - minY))
  };
}

function renderOrder(elements: readonly ExcalidrawElement[]): readonly ExcalidrawElement[] {
  const shapes = elements.filter((element) => element.type !== "arrow" && element.type !== "line" && element.type !== "text");
  const lines = elements.filter((element) => element.type === "arrow" || element.type === "line");
  const texts = elements.filter((element) => element.type === "text");
  return [...shapes, ...lines, ...texts];
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrappedTextLines(value: string, width: number, fontSize: number): readonly string[] {
  return value
    .split(/\r?\n/)
    .flatMap((line) => wrapLine(line.trim() || "Untitled", width, fontSize));
}

function wrapLine(line: string, width: number, fontSize: number): readonly string[] {
  const maxUnits = Math.max(4, Math.floor(width / (fontSize * 0.62)));
  if (visualUnits(line) <= maxUnits) return [line];
  const words = line.includes(" ") ? line.split(/\s+/) : Array.from(line);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const separator = current && line.includes(" ") ? " " : "";
    const candidate = `${current}${separator}${word}`;
    if (current && visualUnits(candidate) > maxUnits) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function visualUnits(value: string): number {
  return Array.from(value).reduce((total, char) => total + (char.charCodeAt(0) > 127 ? 1.7 : 1), 0);
}
