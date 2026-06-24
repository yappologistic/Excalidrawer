import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSceneFromPrompt } from "../src/scene.js";
import { execaNode } from "./helpers/execa-node.js";
import { describe, expect, it } from "vitest";

describe("CLI", () => {
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
      const [first, second] = scene.elements;
      if (!first || !second) throw new Error("expected generated scene elements");
      second.x = first.x;
      second.y = first.y;
      second.width = first.width;
      second.height = first.height;
      await writeFile(scenePath, `${JSON.stringify(scene, null, 2)}\n`, "utf8");

      const validate = await execaNode("dist/cli.js", ["validate", scenePath], { allowFailure: true });

      expect(validate.exitCode).toBe(1);
      expect(validate.stderr).toContain("quality");
      expect(validate.stderr).toContain("overlap");
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
});
