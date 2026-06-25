import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkInstall,
  installPlugin,
  reinstallPlugin,
  uninstallPlugin
} from "../src/installer.js";

describe("installer", () => {
  it("installs, checks, reinstalls, and uninstalls the Codex plugin", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-install-"));
    try {
      const agentsHome = path.join(dir, "agents");

      const installed = await installPlugin({ agentsHome });
      expect(installed.pluginDir).toBe(path.join(dir, ".codex", "plugins", "excalidrawer"));
      const installedMcp = JSON.parse(await readFile(path.join(installed.pluginDir, ".mcp.json"), "utf8"));
      expect(installedMcp.mcpServers.excalidrawer.command).toBe(process.execPath);
      expect(installedMcp.mcpServers.excalidrawer.args).toEqual([path.resolve("dist/cli.js"), "mcp"]);

      const check = await checkInstall({ agentsHome });
      expect(check.ok).toBe(true);
      expect(check.issues).toEqual([]);

      await reinstallPlugin({ agentsHome });
      const marketplace = JSON.parse(
        await readFile(path.join(agentsHome, "plugins", "marketplace.json"), "utf8")
      );
      expect(marketplace.plugins).toHaveLength(1);
      expect(marketplace.plugins[0].name).toBe("excalidrawer");
      expect(marketplace.plugins[0].source.path).toBe("./.codex/plugins/excalidrawer");

      await uninstallPlugin({ agentsHome });
      const uninstalled = await checkInstall({ agentsHome });
      expect(uninstalled.ok).toBe(false);
      expect(uninstalled.issues.join("\n")).toContain("Plugin directory is missing");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("preserves unrelated marketplace entries and detects missing plugin runtime files", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-install-"));
    try {
      const agentsHome = path.join(dir, "agents");
      const marketplacePath = path.join(agentsHome, "plugins", "marketplace.json");
      await mkdir(path.dirname(marketplacePath), { recursive: true });
      await writeFile(
        marketplacePath,
        `${JSON.stringify({
          name: "personal",
          interface: { displayName: "Personal" },
          workspaceMetadata: { owner: "local-user", channel: "stable" },
          plugins: [
            {
              name: "other-tool",
              source: { source: "local", path: "./.codex/plugins/other-tool" },
              policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
              category: "Productivity"
            },
            {
              name: "remote-helper",
              source: { source: "github", repository: "example/remote-helper", ref: "main" },
              policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
              category: "Automation"
            },
            {
              name: "string-source",
              source: "./plugins/string-source",
              policy: { installation: "REQUIRED", authentication: "NONE" },
              category: "Utility"
            }
          ]
        }, null, 2)}\n`,
        "utf8"
      );

      const installed = await installPlugin({ agentsHome });
      const marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));
      expect(marketplace.workspaceMetadata).toEqual({ owner: "local-user", channel: "stable" });
      expect(marketplace.plugins.map((entry) => entry.name)).toEqual(["other-tool", "remote-helper", "string-source", "excalidrawer"]);
      expect(marketplace.plugins.find((entry) => entry.name === "remote-helper")).toMatchObject({
        source: { source: "github", repository: "example/remote-helper", ref: "main" },
        category: "Automation"
      });
      expect(marketplace.plugins.find((entry) => entry.name === "string-source")).toMatchObject({
        source: "./plugins/string-source",
        policy: { installation: "REQUIRED", authentication: "NONE" }
      });

      await rm(path.join(installed.pluginDir, ".mcp.json"), { force: true });
      const missingMcp = await checkInstall({ agentsHome });

      expect(missingMcp.ok).toBe(false);
      expect(missingMcp.issues).toContain("Plugin directory is missing .mcp.json");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("detects tampered installed MCP config and plugin manifest content", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-install-"));
    try {
      const agentsHome = path.join(dir, "agents");
      const installed = await installPlugin({ agentsHome });
      await writeFile(
        path.join(installed.pluginDir, ".mcp.json"),
        `${JSON.stringify({ mcpServers: { excalidrawer: { command: "node", args: ["bad.js"] } } }, null, 2)}\n`,
        "utf8"
      );
      const manifestPath = path.join(installed.pluginDir, ".codex-plugin", "plugin.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      manifest.version = "0.0.0";
      manifest.skills = "skills/";
      manifest.mcpServers = ".mcp.json";
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

      const check = await checkInstall({ agentsHome });

      expect(check.ok).toBe(false);
      expect(check.issues.join("\n")).toContain("Installed .mcp.json command must be the current Node executable");
      expect(check.issues.join("\n")).toContain("Installed .mcp.json args must launch dist/cli.js mcp");
      expect(check.issues.join("\n")).toContain("Plugin manifest version must match package.json");
      expect(check.issues.join("\n")).toContain("Plugin manifest skills must be ./skills/");
      expect(check.issues.join("\n")).toContain("Plugin manifest mcpServers must be ./.mcp.json");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports corrupt marketplace JSON as an install check issue", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "excalidrawer-install-"));
    try {
      const agentsHome = path.join(dir, "agents");
      const marketplacePath = path.join(agentsHome, "plugins", "marketplace.json");
      await mkdir(path.dirname(marketplacePath), { recursive: true });
      await writeFile(marketplacePath, "{not valid json", "utf8");

      const check = await checkInstall({ agentsHome });

      expect(check.ok).toBe(false);
      expect(check.issues.join("\n")).toContain("Marketplace file is invalid JSON");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
