import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { StructuredImportFormat } from "./advanced-tools.js";
import {
  createRendererHarness,
  createSceneFromPrompt,
  diffScenes,
  editScene,
  explainSceneQuality,
  exportScene,
  exportLibraryPack,
  assertScene,
  importStructuredDiagram,
  listDiagramRecipes,
  readSceneJson,
  readScene,
  repairScene,
  runBrowserDoctor,
  runVisualRegression,
  sceneFromRecipe,
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

server.registerTool(
  "import_structured_scene",
  {
    description: "Import Mermaid, PlantUML, Graphviz DOT, OpenAPI, Terraform, Docker Compose, Kubernetes, or package dependency text into a polished Excalidraw scene.",
    inputSchema: {
      format: z.enum(["mermaid", "plantuml", "dot", "openapi", "terraform", "docker-compose", "kubernetes", "package-deps"]),
      inPath: z.string(),
      outPath: z.string()
    }
  },
  async ({ format, inPath, outPath }) => {
    const imported = importStructuredDiagram({ format: format as StructuredImportFormat, source: await readFile(inPath, "utf8") });
    await writeScene(outPath, createSceneFromPrompt(imported.prompt));
    return text(JSON.stringify({ outPath, format: imported.format, entities: imported.entities, relationships: imported.relationships }));
  }
);

server.registerTool(
  "create_recipe_scene",
  {
    description: "Create a named diagram recipe scene, or list available recipes when name is omitted.",
    inputSchema: {
      name: z.string().optional(),
      outPath: z.string().optional()
    }
  },
  async ({ name, outPath }) => {
    if (!name) return text(JSON.stringify({ recipes: listDiagramRecipes() }));
    if (!outPath) throw new Error("outPath is required when name is provided");
    await writeScene(outPath, sceneFromRecipe(name));
    return text(`recipe ${name} created ${outPath}`);
  }
);

server.registerTool(
  "repair_scene",
  {
    description: "Repair a structurally valid but visually invalid Excalidraw scene by rebuilding a cleaner layout from visible labels.",
    inputSchema: {
      path: z.string(),
      outPath: z.string().optional()
    }
  },
  async ({ path, outPath }) => {
    const result = repairScene(assertScene(await readSceneJson(path)));
    const target = outPath ?? path;
    await writeScene(target, result.scene);
    return text(JSON.stringify({ ok: result.ok, outPath: target, actions: result.actions }));
  }
);

server.registerTool(
  "diff_scenes",
  {
    description: "Compare two .excalidraw files by labels, layout movement, and element-count delta.",
    inputSchema: {
      beforePath: z.string(),
      afterPath: z.string(),
      outPath: z.string().optional()
    }
  },
  async ({ beforePath, afterPath, outPath }) => {
    const diff = diffScenes(await readScene(beforePath), await readScene(afterPath));
    if (outPath) await writeJson(outPath, diff);
    return text(JSON.stringify(diff));
  }
);

server.registerTool(
  "export_library_pack",
  {
    description: "Export reusable Excalidraw library items for common architecture components.",
    inputSchema: {
      outPath: z.string()
    }
  },
  async ({ outPath }) => {
    const pack = exportLibraryPack();
    await writeJson(outPath, pack);
    return text(JSON.stringify({ outPath, items: pack.libraryItems.length }));
  }
);

server.registerTool(
  "create_renderer_harness",
  {
    description: "Create an HTML browser harness that loads a scene into the actual Excalidraw React runtime for visual QA.",
    inputSchema: {
      path: z.string(),
      outPath: z.string()
    }
  },
  async ({ path, outPath }) => {
    const harness = createRendererHarness(await readScene(path));
    await mkdir(pathModule.dirname(outPath), { recursive: true });
    await writeFile(outPath, harness.html, "utf8");
    return text(JSON.stringify({ outPath, report: harness.report }));
  }
);

server.registerTool(
  "run_visual_regression",
  {
    description: "Hash SVG exports for visual-regression gallery checks and optionally write a report.",
    inputSchema: {
      path: z.string(),
      name: z.string().optional(),
      baselineHash: z.string().optional(),
      outPath: z.string().optional()
    }
  },
  async ({ path, name, baselineHash, outPath }) => {
    const result = runVisualRegression([{ name: name ?? "scene", scene: await readScene(path), baselineHash }]);
    if (outPath) await writeJson(outPath, result);
    return text(JSON.stringify(result));
  }
);

server.registerTool(
  "doctor_browser",
  {
    description: "Run Excalidrawer browser-readiness diagnostics for local preview inputs, SVG DOM geometry, and Browser/Chrome automation readiness.",
    inputSchema: {
      path: z.string(),
      outPath: z.string().optional()
    }
  },
  async ({ path, outPath }) => {
    const result = await runBrowserDoctor(await readScene(path));
    if (outPath) await writeJson(outPath, result);
    return text(JSON.stringify(result));
  }
);

function text(value: string) {
  return {
    content: [{ type: "text" as const, text: value }]
  };
}

const pathModule = path;

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

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
