import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { explainSceneQuality } from "./advanced-tools.js";
import { registerAdvancedTools } from "./mcp-advanced-tools.js";
import { text } from "./mcp-common.js";
import {
  createSceneFromPrompt,
  editScene,
  exportScene,
  assertScene,
  readSceneJson,
  readScene,
  validateScene,
  validateSceneQuality,
  writeScene
} from "./scene.js";

const server = new McpServer(
  {
    name: "excalidrawer",
    version: "0.1.9"
  },
  {
    instructions:
      "Use Excalidrawer tools for .excalidraw scene files. Create scenes from prompts, edit existing scene JSON, validate before returning paths, and export SVG/PNG artifacts for review."
  }
);

server.registerTool(
  "create_scene",
  {
    description: "Create an Excalidraw scene JSON file from a short diagram prompt.",
    inputSchema: {
      prompt: z.string(),
      outPath: z.string()
    }
  },
  async ({ prompt, outPath }) => {
    await writeScene(outPath, createSceneFromPrompt(prompt));
    return text(`created ${outPath}`);
  }
);

server.registerTool(
  "edit_scene",
  {
    description: "Add a text note to an existing Excalidraw scene file.",
    inputSchema: {
      path: z.string(),
      addText: z.string()
    }
  },
  async ({ path, addText }) => {
    await writeScene(path, editScene(await readScene(path), { addText }));
    return text(`edited ${path}`);
  }
);

server.registerTool(
  "read_scene",
  {
    description: "Read a summary of an existing Excalidraw scene file.",
    inputSchema: {
      path: z.string()
    }
  },
  async ({ path }) => {
    const scene = await readScene(path);
    return text(
      JSON.stringify({
        path,
        type: scene.type,
        version: scene.version,
        elements: scene.elements.length,
        source: scene.source,
        ...sceneSummary(scene)
      })
    );
  }
);

server.registerTool(
  "validate_scene",
  {
    description: "Validate an Excalidraw scene file.",
    inputSchema: {
      path: z.string()
    }
  },
  async ({ path }) => {
    const parsed = await readSceneJson(path);
    const shape = validateScene(parsed);
    if (!shape.ok) return text(JSON.stringify(shape));
    const scene = assertScene(parsed);
    const quality = validateSceneQuality(scene);
    return text(JSON.stringify({ ...quality, qualitySummary: explainSceneQuality(scene), ...sceneSummary(scene) }));
  }
);

server.registerTool(
  "export_scene",
  {
    description: "Export an Excalidraw scene file to SVG or PNG.",
    inputSchema: {
      path: z.string(),
      outPath: z.string(),
      format: z.enum(["svg", "png"])
    }
  },
  async ({ path, outPath, format }) => {
    await exportScene(await readScene(path), outPath, format);
    return text(`exported ${outPath}`);
  }
);

registerAdvancedTools(server);

function sceneSummary(scene: ReturnType<typeof assertScene>): Record<string, unknown> {
  return {
    excalidrawerReview: scene.appState.excalidrawerReview ?? null,
    excalidrawerRenderer: scene.appState.excalidrawerRenderer ?? null,
    excalidrawerLayoutHints: scene.appState.excalidrawerLayoutHints ?? [],
    excalidrawerLayoutProfile: scene.appState.excalidrawerLayoutProfile ?? null,
    excalidrawerDomainPack: scene.appState.excalidrawerDomainPack ?? null,
    excalidrawerStylePreset: scene.appState.excalidrawerStylePreset ?? null,
    excalidrawerImportedSource: scene.appState.excalidrawerImportedSource ?? null,
    excalidrawerProgressiveDetail: scene.appState.excalidrawerProgressiveDetail ?? null,
    excalidrawerGoldenFixture: scene.appState.excalidrawerGoldenFixture ?? null
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
