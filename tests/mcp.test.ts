import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createSceneFromPrompt } from "../src/scene.js";
import { describe, expect, it } from "vitest";

describe("MCP server", () => {
  it("lists tools and drives create/read/edit/export over stdio", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-mcp-"));
    const scenePath = path.join(dir, "mcp.excalidraw");
    const invalidPath = path.join(dir, "invalid.excalidraw");
    const crampedPath = path.join(dir, "cramped.excalidraw");
    const svgPath = path.join(dir, "mcp.svg");
    const client = new Client({ name: "excalidrawer-test", version: "0.1.1" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve("dist/cli.js"), "mcp"],
      cwd: process.cwd(),
      stderr: "pipe"
    });

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(["create_scene", "read_scene", "edit_scene", "validate_scene", "export_scene"])
      );

      await client.callTool({
        name: "create_scene",
        arguments: { prompt: "browser sends request to service", outPath: scenePath }
      });
      const read = await client.callTool({
        name: "read_scene",
        arguments: { path: scenePath }
      });
      await client.callTool({
        name: "edit_scene",
        arguments: { path: scenePath, addText: "mcp note" }
      });
      await client.callTool({
        name: "export_scene",
        arguments: { path: scenePath, outPath: svgPath, format: "svg" }
      });
      const advancedPath = path.join(dir, "advanced.excalidraw");
      await client.callTool({
        name: "create_scene",
        arguments: {
          prompt:
            "architecture detailed: external users cross trust boundary to API, API publishes event bus, API writes Postgres in data zone, expand API internals, put databases at bottom, mark API critical and PII",
          outPath: advancedPath
        }
      });
      const advancedRead = await client.callTool({
        name: "read_scene",
        arguments: { path: advancedPath }
      });
      const advancedValidate = await client.callTool({
        name: "validate_scene",
        arguments: { path: advancedPath }
      });
      const nextGenPath = path.join(dir, "nextgen.excalidraw");
      await client.callTool({
        name: "create_scene",
        arguments: {
          prompt:
            "domain: ecommerce pattern: strangler migration profile: spacious preset: boardroom import: yaml detail: deep architecture detailed: buyer calls storefront, storefront calls checkout API, checkout API writes orders database, checkout API publishes payment event bus",
          outPath: nextGenPath
        }
      });
      const nextGenValidate = await client.callTool({
        name: "validate_scene",
        arguments: { path: nextGenPath }
      });
      await writeFile(invalidPath, JSON.stringify({ type: "excalidraw", elements: "bad" }), "utf8");
      const invalid = await client.callTool({
        name: "validate_scene",
        arguments: { path: invalidPath }
      });
      const crampedScene = createSceneFromPrompt("client calls API");
      const [first, second] = crampedScene.elements;
      if (!first || !second) throw new Error("expected generated scene elements");
      second.x = first.x;
      second.y = first.y;
      second.width = first.width;
      second.height = first.height;
      await writeFile(crampedPath, JSON.stringify(crampedScene), "utf8");
      const cramped = await client.callTool({
        name: "validate_scene",
        arguments: { path: crampedPath }
      });

      expect(JSON.stringify(read.content)).toContain("elements");
      expect(JSON.stringify(advancedRead.content)).toContain("excalidrawerReview");
      const advancedValidateContent = advancedValidate.content[0];
      if (advancedValidateContent.type !== "text") throw new Error("Expected text content");
      expect(JSON.parse(advancedValidateContent.text)).toMatchObject({ ok: true, excalidrawerReview: { status: "pass" } });
      const nextGenValidateContent = nextGenValidate.content[0];
      if (nextGenValidateContent.type !== "text") throw new Error("Expected text content");
      expect(JSON.parse(nextGenValidateContent.text)).toMatchObject({
        ok: true,
        excalidrawerDomainPack: { name: "ecommerce" },
        excalidrawerLayoutProfile: { name: "spacious" },
        excalidrawerStylePreset: { name: "boardroom" },
        excalidrawerImportedSource: { format: "yaml" },
        excalidrawerReview: { goldenFixture: "architecture-ecommerce-spacious" }
      });
      const invalidContent = invalid.content[0];
      if (invalidContent.type !== "text") throw new Error("Expected text content");
      expect(JSON.parse(invalidContent.text)).toMatchObject({ ok: false });
      const crampedContent = cramped.content[0];
      if (crampedContent.type !== "text") throw new Error("Expected text content");
      expect(JSON.parse(crampedContent.text)).toMatchObject({ ok: false });
      expect(crampedContent.text).toContain("overlap");
      expect(await readFile(svgPath, "utf8")).toContain("mcp note");
    } finally {
      await client.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
