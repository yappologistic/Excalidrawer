import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("repository marketplace", () => {
  it("keeps the Codex plugin manifest version aligned with the package", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    const pluginJson = JSON.parse(await readFile(path.join("plugin", ".codex-plugin", "plugin.json"), "utf8"));

    expect(pluginJson.name).toBe(packageJson.name);
    expect(pluginJson.version).toBe(packageJson.version);
  });

  it("exposes the plugin through the documented Codex marketplace file", async () => {
    const marketplacePath = path.join(".agents", "plugins", "marketplace.json");
    const marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));

    expect(marketplace.name).toBe("excalidrawer");
    expect(marketplace.interface.displayName).toBe("Excalidrawer");
    expect(marketplace.plugins).toHaveLength(1);

    const [entry] = marketplace.plugins;
    expect(entry).toMatchObject({
      name: "excalidrawer",
      source: {
        source: "local",
        path: "./plugin"
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL"
      },
      category: "Productivity"
    });
  });
});
