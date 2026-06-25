import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSceneFromPrompt, validateSceneQuality } from "../src/scene.js";
import { execaNode } from "./helpers/execa-node.js";
import {
  createRendererHarness,
  diffScenes,
  explainSceneQuality,
  exportLibraryPack,
  iconVocabulary,
  importStructuredDiagram,
  listDiagramRecipes,
  repairScene,
  runBrowserDoctor,
  runVisualRegression,
  runVisualRegressionGallery
} from "../src/advanced-tools.js";

describe("advanced Excalidrawer tools", () => {
  it("imports structured sources, recipes, icons, repairs, diffs, libraries, harnesses, regressions, and browser diagnostics", async () => {
    const mermaid = importStructuredDiagram({
      format: "mermaid",
      source: "flowchart LR\n  Client[Client] --> API[API]\n  API --> DB[(Postgres)]"
    });
    const plantuml = importStructuredDiagram({
      format: "plantuml",
      source: "@startuml\nactor User\nUser -> API: login\nAPI -> DB: query\n@enduml"
    });
    const dot = importStructuredDiagram({ format: "dot", source: "digraph { Browser -> API; API -> Queue; }" });
    const openapi = importStructuredDiagram({ format: "openapi", source: "openapi: 3.0.0\npaths:\n  /orders:\n    get: {}" });
    const terraform = importStructuredDiagram({ format: "terraform", source: "resource \"aws_lambda_function\" \"worker\" {}\nresource \"aws_sqs_queue\" \"jobs\" {}" });
    const compose = importStructuredDiagram({ format: "docker-compose", source: "services:\n  api:\n  db:" });
    const kubernetes = importStructuredDiagram({ format: "kubernetes", source: "kind: Deployment\nmetadata:\n  name: api\n---\nkind: Service\nmetadata:\n  name: api" });
    const packageDeps = importStructuredDiagram({ format: "package-deps", source: JSON.stringify({ dependencies: { react: "^19.0.0", zod: "^3.0.0" } }) });

    expect([mermaid, plantuml, dot, openapi, terraform, compose, kubernetes, packageDeps].map((item) => item.format)).toEqual([
      "mermaid",
      "plantuml",
      "dot",
      "openapi",
      "terraform",
      "docker-compose",
      "kubernetes",
      "package-deps"
    ]);
    expect(mermaid.prompt).toContain("Client calls API");
    expect(mermaid.diagramFamily).toBe("flowchart");
    expect(plantuml.diagramFamily).toBe("sequence");
    expect(dot.diagramFamily).toBe("dependency-graph");
    expect(openapi.diagramFamily).toBe("architecture-c4");
    expect(terraform.diagramFamily).toBe("network");
    expect(compose.diagramFamily).toBe("network");
    expect(kubernetes.diagramFamily).toBe("network");
    expect(packageDeps.diagramFamily).toBe("dependency-graph");
    expect(mermaid.prompt).not.toContain("Client -");
    expect(openapi.prompt).toContain("/orders");
    expect(terraform.prompt).toContain("aws_lambda_function");

    const recipes = listDiagramRecipes();
    expect(recipes.map((recipe) => recipe.name)).toEqual(
      expect.arrayContaining(["c4-container", "incident-timeline", "service-map", "data-lineage", "deployment-topology", "queue-worker-system", "auth-flow"])
    );

    expect(iconVocabulary.map((icon) => icon.key)).toEqual(
      expect.arrayContaining(["database", "queue", "api", "worker", "browser", "cloud", "cache", "lock", "alert"])
    );

    const bad = createSceneFromPrompt("client calls API");
    const [first, second] = bad.elements.filter((element) => element.customData?.excalidrawer?.role === "node-shape");
    if (!first || !second) throw new Error("expected generated elements");
    const dx = first.x - second.x;
    const dy = first.y - second.y;
    second.x = first.x;
    second.y = first.y;
    for (const element of bad.elements.filter((element) => element.containerId === second.id)) {
      element.x += dx;
      element.y += dy;
    }
    const explanation = explainSceneQuality(bad);
    expect(explanation.ok).toBe(false);
    expect(explanation.summary).toContain("overlap");
    expect(explanation.repairActions.length).toBeGreaterThan(0);
    expect(validateSceneQuality(repairScene(bad).scene).ok).toBe(true);

    const before = createSceneFromPrompt("client calls API");
    const after = createSceneFromPrompt("client calls API, API writes Postgres");
    const diff = diffScenes(before, after);
    expect(diff.addedLabels).toContain("Postgres");
    expect(diff.summary).toContain("added");

    const library = exportLibraryPack();
    expect(library.type).toBe("excalidrawlib");
    expect(library.libraryItems.map((item) => item.name)).toEqual(expect.arrayContaining(["API service", "queue", "database", "trust boundary"]));

    const harness = createRendererHarness(after);
    expect(harness.html).toContain("data-excalidrawer-harness");
    expect(harness.html).not.toContain("https://esm.sh");
    expect(harness.html).toContain("does not run the Excalidraw browser runtime");
    expect(harness.report.runtimeMode).toBe("static-svg");
    expect(harness.report.elementCount).toBeGreaterThan(0);

    const regression = runVisualRegression([{ name: "service-map", scene: after }]);
    expect(regression.ok).toBe(true);
    expect(regression.cases[0]).toMatchObject({ name: "service-map", changed: false });
    expect(regression.cases[0]?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(runVisualRegression([{ name: "service-map", scene: after, baselineHash: regression.cases[0]?.hash }]).ok).toBe(true);
    expect(runVisualRegression([{ name: "service-map", scene: before, baselineHash: regression.cases[0]?.hash }])).toMatchObject({
      ok: false,
      cases: [expect.objectContaining({ changed: true })]
    });
    expect(runVisualRegressionGallery().cases.length).toBeGreaterThanOrEqual(7);

    const doctor = await runBrowserDoctor(after);
    expect(doctor.ok).toBe(true);
    expect(doctor.checks.map((check) => check.id)).toEqual(expect.arrayContaining(["local-preview", "svg-geometry", "browser-runtime"]));
    expect(doctor.checks.find((check) => check.id === "browser-runtime")).toMatchObject({
      status: "warn",
      message: expect.stringContaining("Static SVG harness does not prove browser-runtime parity")
    });
  });

  it("drives the advanced tools through the CLI", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-advanced-cli-"));
    try {
      const input = path.join(dir, "diagram.mmd");
      const singleEdgeInput = path.join(dir, "single-edge.mmd");
      const imported = path.join(dir, "imported.excalidraw");
      const singleEdgeImported = path.join(dir, "single-edge.excalidraw");
      const recipe = path.join(dir, "recipe.excalidraw");
      const repaired = path.join(dir, "repaired.excalidraw");
      const diffPath = path.join(dir, "diff.json");
      const libraryPath = path.join(dir, "pack.excalidrawlib");
      const harnessPath = path.join(dir, "harness.html");
      const regressionPath = path.join(dir, "regression.json");
      const regressionMismatchPath = path.join(dir, "regression-mismatch.json");
      const galleryRegressionPath = path.join(dir, "regression-gallery.json");
      const doctorPath = path.join(dir, "doctor.json");
      const singleEdgeDoctorPath = path.join(dir, "single-edge-doctor.json");
      await writeFile(input, "flowchart LR\n  Browser --> API\n  API --> Queue", "utf8");
      await writeFile(singleEdgeInput, "flowchart LR\n  A --> B", "utf8");

      await execaNode("dist/cli.js", ["import", "--format", "mermaid", "--in", input, "--out", imported]);
      const importedScene = JSON.parse(await readFile(imported, "utf8")) as { readonly elements: readonly { readonly type?: string; readonly text?: string }[] };
      const importedLabels = importedScene.elements.filter((element) => element.type === "text").map((element) => element.text);
      expect(importedLabels).toEqual(expect.arrayContaining(["Browser", "API", "Queue"]));
      expect(importedLabels).not.toContain("architecture detailed: Browser");
      await execaNode("dist/cli.js", ["import", "--format", "mermaid", "--in", singleEdgeInput, "--out", singleEdgeImported]);
      await execaNode("dist/cli.js", ["doctor", "browser", "--scene", singleEdgeImported, "--out", singleEdgeDoctorPath]);
      const singleEdgeScene = JSON.parse(await readFile(singleEdgeImported, "utf8")) as { readonly elements: readonly { readonly type?: string; readonly text?: string }[] };
      const singleEdgeLabels = singleEdgeScene.elements.filter((element) => element.type === "text").map((element) => element.text);
      expect(singleEdgeLabels).toEqual(expect.arrayContaining(["A", "B"]));
      expect(singleEdgeLabels).not.toContain("architecture detailed: A");
      expect(singleEdgeLabels).not.toContain("architecture: A");
      expect(JSON.parse(await readFile(singleEdgeDoctorPath, "utf8")).checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "svg-geometry", status: "pass" }),
          expect.objectContaining({ id: "browser-runtime", status: "warn" })
        ])
      );
      await execaNode("dist/cli.js", ["recipe", "c4-container", "--out", recipe]);
      const bad = createSceneFromPrompt("client calls API");
      const [first, second] = bad.elements.filter((element) => element.customData?.excalidrawer?.role === "node-shape");
      if (!first || !second) throw new Error("expected generated elements");
      const dx = first.x - second.x;
      const dy = first.y - second.y;
      second.x = first.x;
      second.y = first.y;
      for (const element of bad.elements.filter((element) => element.containerId === second.id)) {
        element.x += dx;
        element.y += dy;
      }
      await writeFile(repaired, `${JSON.stringify(bad, null, 2)}\n`, "utf8");
      const validation = await execaNode("dist/cli.js", ["validate", repaired], { allowFailure: true });
      expect(validation.stderr).toContain("repairActions");
      await execaNode("dist/cli.js", ["repair", repaired, "--out", repaired]);
      await execaNode("dist/cli.js", ["diff", imported, recipe, "--out", diffPath]);
      await execaNode("dist/cli.js", ["library", "--out", libraryPath]);
      await execaNode("dist/cli.js", ["harness", recipe, "--out", harnessPath]);
      await execaNode("dist/cli.js", ["visual-regression", recipe, "--out", regressionPath]);
      const regressionMismatch = await execaNode(
        "dist/cli.js",
        ["visual-regression", recipe, "--baseline-hash", "not-the-current-hash", "--out", regressionMismatchPath],
        { allowFailure: true }
      );
      await execaNode("dist/cli.js", ["visual-regression", "gallery", "--out", galleryRegressionPath]);
      await execaNode("dist/cli.js", ["doctor", "browser", "--scene", recipe, "--out", doctorPath]);

      expect(JSON.parse(await readFile(diffPath, "utf8")).summary).toContain("changed");
      expect(JSON.parse(await readFile(libraryPath, "utf8")).type).toBe("excalidrawlib");
      const harnessHtml = await readFile(harnessPath, "utf8");
      expect(harnessHtml).toContain("data-excalidrawer-harness");
      expect(harnessHtml).not.toContain("https://esm.sh");
      expect(JSON.parse(await readFile(regressionPath, "utf8")).ok).toBe(true);
      expect(regressionMismatch.exitCode).toBe(1);
      expect(JSON.parse(await readFile(regressionMismatchPath, "utf8"))).toMatchObject({
        ok: false,
        cases: [expect.objectContaining({ changed: true })]
      });
      expect(JSON.parse(await readFile(galleryRegressionPath, "utf8")).cases.length).toBeGreaterThanOrEqual(7);
      expect(JSON.parse(await readFile(doctorPath, "utf8")).ok).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
