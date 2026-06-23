import { mkdtemp, readFile, rm } from "node:fs/promises";
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
      expect(installed.pluginDir.endsWith(path.join("plugins", "excalidrawer"))).toBe(true);

      const check = await checkInstall({ agentsHome });
      expect(check.ok).toBe(true);
      expect(check.issues).toEqual([]);

      await reinstallPlugin({ agentsHome });
      const marketplace = JSON.parse(
        await readFile(path.join(agentsHome, "plugins", "marketplace.json"), "utf8")
      );
      expect(marketplace.plugins).toHaveLength(1);
      expect(marketplace.plugins[0].name).toBe("excalidrawer");

      await uninstallPlugin({ agentsHome });
      const uninstalled = await checkInstall({ agentsHome });
      expect(uninstalled.ok).toBe(false);
      expect(uninstalled.issues.join("\n")).toContain("Plugin directory is missing");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
