import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import packageJson from "../package.json" with { type: "json" };
import { createSceneFromPrompt } from "../src/scene.js";
import { execaNode } from "./helpers/execa-node.js";
import { describe, expect, it } from "vitest";

describe("CLI", () => {
  it("prints help and package version explicitly", async () => {
    const help = await execaNode("dist/cli.js", ["--help"]);
    const version = await execaNode("dist/cli.js", ["--version"]);

    expect(help.stdout).toContain("excalidrawer");
    expect(help.stdout).toContain("visual-regression");
    expect(help.stderr).toBe("");
    expect(version.stdout.trim()).toBe(packageJson.version);
    expect(version.stderr).toBe("");
  });

  it("creates, edits, validates, and exports a scene", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-cli-"));
    try {
      const scenePath = path.join(dir, "diagram.excalidraw");
      const svgPath = path.join(dir, "diagram.svg");

      await execaNode("dist/cli.js", ["create", "--prompt", "client calls API", "--out", scenePath]);
      await execaNode("dist/cli.js", ["edit", scenePath, "--add-text", "cache"]);
      const validate = await execaNode("dist/cli.js", ["validate", scenePath]);
      await execaNode("dist/cli.js", ["export", scenePath, "--format", "svg", "--out", svgPath]);

      expect(validate.stdout).toContain("valid");
      expect(await readFile(svgPath, "utf8")).toContain("cache");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails validation when a scene has visibly overlapped elements", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-cli-quality-"));
    try {
      const scenePath = path.join(dir, "bad.excalidraw");
      const scene = createSceneFromPrompt("client calls API");
      const [first, second] = scene.elements.filter((element) => element.customData?.excalidrawer?.role === "node-shape");
      if (!first || !second) throw new Error("expected generated scene elements");
      const dx = first.x - second.x;
      const dy = first.y - second.y;
      second.x = first.x;
      second.y = first.y;
      second.width = first.width;
      second.height = first.height;
      for (const element of scene.elements.filter((element) => element.containerId === second.id)) {
        element.x += dx;
        element.y += dy;
      }
      await writeFile(scenePath, `${JSON.stringify(scene, null, 2)}\n`, "utf8");

      const validate = await execaNode("dist/cli.js", ["validate", scenePath], { allowFailure: true });

      expect(validate.exitCode).toBe(1);
      expect(validate.stderr).toContain("quality");
      expect(validate.stderr).toContain("overlap");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns JSON for structurally invalid validation failures", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-cli-invalid-"));
    try {
      const scenePath = path.join(dir, "bad-shape.excalidraw");
      await writeFile(scenePath, JSON.stringify({ type: "excalidraw", elements: "bad" }), "utf8");

      const validate = await execaNode("dist/cli.js", ["validate", scenePath], { allowFailure: true });

      expect(validate.exitCode).toBe(1);
      expect(JSON.parse(validate.stderr)).toMatchObject({ ok: false, status: "invalid shape" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("drives the install lifecycle with restart guidance", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-cli-install-"));
    try {
      const env = { AGENTS_HOME: path.join(dir, "agents") };

      const install = await execaNode("dist/cli.js", ["install"], { env });
      const check = await execaNode("dist/cli.js", ["check"], { env });
      const uninstall = await execaNode("dist/cli.js", ["uninstall"], { env });
      const missing = await execaNode("dist/cli.js", ["check"], { env, allowFailure: true });

      expect(install.stdout).toContain("Restart Codex");
      expect(install.stdout).toContain("start a new thread");
      expect(check.stdout).toContain("excalidrawer install is valid");
      expect(uninstall.stdout).toContain("uninstalled excalidrawer");
      expect(missing.exitCode).toBe(1);
      expect(missing.stderr).toContain("Plugin directory is missing");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runs gallery verification from the CLI", async () => {
    const result = await execaNode("dist/cli.js", ["gallery"]);

    expect(result.stdout).toContain("gallery valid");
  });

  it("exposes advanced diagram review metadata through read and validate", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-cli-review-"));
    try {
      const scenePath = path.join(dir, "review.excalidraw");
      await execaNode("dist/cli.js", [
        "create",
        "--prompt",
        "architecture detailed: external users cross trust boundary to API, API publishes event bus, API writes Postgres in data zone, expand API internals, put databases at bottom, mark API critical and PII",
        "--out",
        scenePath
      ]);

      const read = await execaNode("dist/cli.js", ["read", scenePath]);
      const validate = await execaNode("dist/cli.js", ["validate", scenePath]);

      expect(JSON.parse(read.stdout)).toMatchObject({ excalidrawerReview: { status: "pass" } });
      expect(JSON.parse(validate.stdout)).toMatchObject({ ok: true, excalidrawerReview: { status: "pass" } });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("exposes next-generation complexity metadata through read and validate", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-cli-nextgen-"));
    try {
      const scenePath = path.join(dir, "nextgen.excalidraw");
      await execaNode("dist/cli.js", [
        "create",
        "--prompt",
        "domain: ecommerce pattern: strangler migration profile: spacious preset: boardroom import: yaml detail: deep architecture detailed: buyer calls storefront, storefront calls checkout API, checkout API writes orders database, checkout API publishes payment event bus, fulfillment worker consumes payment event bus",
        "--out",
        scenePath
      ]);

      const read = JSON.parse((await execaNode("dist/cli.js", ["read", scenePath])).stdout);
      const validate = JSON.parse((await execaNode("dist/cli.js", ["validate", scenePath])).stdout);

      expect(read).toMatchObject({
        excalidrawerDomainPack: { name: "ecommerce" },
        excalidrawerLayoutProfile: { name: "spacious" },
        excalidrawerStylePreset: { name: "boardroom" },
        excalidrawerImportedSource: { format: "yaml" },
        excalidrawerGoldenFixture: { name: "architecture-ecommerce-spacious" }
      });
      expect(validate).toMatchObject({
        ok: true,
        excalidrawerReview: {
          domainPack: "ecommerce",
          stylePreset: "boardroom",
          goldenFixture: "architecture-ecommerce-spacious"
        }
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
