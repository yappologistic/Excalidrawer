import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { packageVersion } from "../src/version.js";
import { describe, expect, it } from "vitest";

describe("package release metadata", () => {
  it("keeps package, plugin, and MCP versions aligned", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    const pluginManifest = JSON.parse(await readFile("plugin/.codex-plugin/plugin.json", "utf8"));

    expect(pluginManifest.version).toBe(packageJson.version);
    await expect(packageVersion()).resolves.toBe(packageJson.version);
  });

  it("packs the runtime, plugin bundle, docs, and README assets", async () => {
    const pack = await npmPackDryRun();
    const files = pack.files.map((file) => file.path);

    expect(files).toEqual(expect.arrayContaining([
      "package.json",
      "README.md",
      "dist/cli.js",
      "plugin/.codex-plugin/plugin.json",
      "plugin/.mcp.json",
      "plugin/skills/excalidrawer/SKILL.md",
      "docs/cli.md",
      "docs/development.md",
      "docs/mcp-tools.md",
      "docs/assets/excalidrawer-readme-hero.png"
    ]));
  });
});

type PackFile = {
  readonly path: string;
};

type PackResult = {
  readonly files: readonly PackFile[];
};

async function npmPackDryRun(): Promise<PackResult> {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("npm_execpath is required to run npm pack in tests");
  const child = spawn(process.execPath, [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts"], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", resolve);
  });
  if (exitCode !== 0) throw new Error(`npm pack failed with ${exitCode}\n${stdout}\n${stderr}`);
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed) || !isPackResult(parsed[0])) throw new Error("npm pack did not return package metadata");
  return parsed[0];
}

function isPackResult(value: unknown): value is PackResult {
  if (!isRecord(value) || !Array.isArray(value.files)) return false;
  return value.files.every((file) => isRecord(file) && typeof file.path === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
