import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import { ExcalidrawElement, ExcalidrawScene } from "./scene-types.js";
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
  const body = scene.elements
    .filter((element) => !element.isDeleted)
    .map((element) => svgElement(element))
    .join("\n  ");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}" role="img">`,
    "  <title>Excalidrawer export</title>",
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
  for (const element of scene.elements) {
    if (element.isDeleted) continue;
    if (element.type === "text") {
      drawTextMarkers(png, element, bounds);
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
  if (element.type === "text") {
    const fontSize = element.fontSize ?? 20;
    const lineHeight = element.lineHeight ?? 1.25;
    const lines = (element.text ?? "").split(/\r?\n/);
    const tspans = lines
      .map((line, index) => `<tspan x="${element.x}" dy="${index === 0 ? 0 : fontSize * lineHeight}">${escapeXml(line)}</tspan>`)
      .join("");
    return `<text x="${element.x}" y="${element.y + fontSize}" font-family="Virgil, Segoe UI, sans-serif" font-size="${fontSize}" fill="${stroke}">${tspans}</text>`;
  }
  if (element.type === "arrow" || element.type === "line") {
    const endX = element.x + element.width;
    const endY = element.y + element.height;
    return `<line x1="${element.x}" y1="${element.y}" x2="${endX}" y2="${endY}" stroke="${stroke}" stroke-width="${element.strokeWidth}" marker-end="url(#arrow)"/>`;
  }
  if (element.type === "ellipse") {
    return `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${element.strokeWidth}"/>`;
  }
  return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${element.strokeWidth}"/>`;
}

function sceneBounds(scene: ExcalidrawScene): { minX: number; minY: number; width: number; height: number } {
  const active = scene.elements.filter((element) => !element.isDeleted);
  if (active.length === 0) return { minX: 0, minY: 0, width: 640, height: 360 };
  const minX = Math.min(...active.map((element) => element.x)) - 40;
  const minY = Math.min(...active.map((element) => element.y)) - 40;
  const maxX = Math.max(...active.map((element) => element.x + Math.max(element.width, 1))) + 40;
  const maxY = Math.max(...active.map((element) => element.y + Math.max(element.height, 1))) + 40;
  return {
    minX,
    minY,
    width: Math.max(320, Math.ceil(maxX - minX)),
    height: Math.max(200, Math.ceil(maxY - minY))
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
