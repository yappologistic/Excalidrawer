import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
});
