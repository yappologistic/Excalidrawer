import type { BrowserDoctorCheck, BrowserDoctorResult, RendererHarness } from "./advanced-types.js";
import type { ExcalidrawScene } from "./scene-types.js";
import { renderSvg } from "./scene-render.js";
import { validateSceneQuality } from "./scene-quality.js";

export function createRendererHarness(scene: ExcalidrawScene): RendererHarness {
  const sceneData = JSON.stringify({ elements: scene.elements, appState: scene.appState, files: scene.files }).replaceAll("</", "<\\/");
  const svg = renderSvg(scene).replaceAll("</script", "<\\/script");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Excalidrawer Renderer Harness</title>
  <style>html,body{margin:0;font-family:system-ui,sans-serif;background:#fff}.status{position:sticky;top:0;z-index:2;background:white;border-bottom:1px solid #cbd5e1;padding:8px 12px}.stage{padding:16px}</style>
</head>
<body>
  <div class="status" data-harness-status>Static SVG preview loaded; no remote executable runtime used</div>
  <main class="stage" data-excalidrawer-harness data-runtime-mode="static-svg">${svg}</main>
  <script type="application/json" id="excalidrawer-scene">${sceneData}</script>
</body>
</html>`;
  return { html, report: harnessReport(scene) };
}

export async function runBrowserDoctor(scene: ExcalidrawScene): Promise<BrowserDoctorResult> {
  const quality = validateSceneQuality(scene);
  const svg = renderSvg(scene);
  const harness = createRendererHarness(scene);
  const checks: readonly BrowserDoctorCheck[] = [
    localPreviewCheck(harness.html),
    svgGeometryCheck(quality.ok, quality.issues, svg),
    browserRuntimeCheck(harness.report.runtimeMode)
  ];
  return { ok: checks.every((check) => check.status !== "fail"), checks };
}

function harnessReport(scene: ExcalidrawScene): RendererHarness["report"] {
  return {
    elementCount: scene.elements.length,
    arrowCount: scene.elements.filter((element) => element.type === "arrow").length,
    textCount: scene.elements.filter((element) => element.type === "text").length,
    runtimeMode: "static-svg"
  };
}

function localPreviewCheck(html: string): BrowserDoctorCheck {
  const ok = html.includes("data-excalidrawer-harness") && html.includes("<svg");
  return {
    id: "local-preview",
    status: ok ? "pass" : "fail",
    message: ok ? "Generated a self-contained localhost/file-safe SVG preview harness" : "Harness HTML is missing preview markup"
  };
}

function svgGeometryCheck(qualityOk: boolean, issues: readonly string[], svg: string): BrowserDoctorCheck {
  const metadataOk = svg.includes("<svg") && svg.includes("data-excalidrawer-role");
  const ok = qualityOk && metadataOk;
  return {
    id: "svg-geometry",
    status: ok ? "pass" : "fail",
    message: ok ? "SVG geometry passed deterministic quality checks" : [...issues, metadataOk ? "" : "SVG semantic metadata is missing"].filter(Boolean).join("; ")
  };
}

function browserRuntimeCheck(runtimeMode: RendererHarness["report"]["runtimeMode"]): BrowserDoctorCheck {
  return {
    id: "browser-runtime",
    status: runtimeMode === "external-excalidraw-runtime" ? "pass" : "warn",
    message:
      runtimeMode === "external-excalidraw-runtime"
        ? "Local Excalidraw runtime rendered the scene"
        : "Packaged harness avoids unpinned remote scripts; use Codex Browser on the static SVG harness or provide a vetted local Excalidraw runtime for runtime-specific QA"
  };
}
