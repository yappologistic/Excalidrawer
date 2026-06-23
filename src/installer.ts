import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultAgentsHome, packageRoot } from "./paths.js";

export interface InstallOptions {
  agentsHome?: string;
}

export interface InstallResult {
  pluginDir: string;
  marketplacePath: string;
}

const pluginName = "excalidrawer";

export async function installPlugin(options: InstallOptions = {}): Promise<InstallResult> {
  const paths = resolveInstallPaths(options);
  await mkdir(path.dirname(paths.pluginDir), { recursive: true });
  await rm(paths.pluginDir, { recursive: true, force: true });
  await cp(path.join(packageRoot(), "plugin"), paths.pluginDir, { recursive: true });
  await writeMarketplace(paths.marketplacePath);
  return paths;
}

export async function reinstallPlugin(options: InstallOptions = {}): Promise<InstallResult> {
  await uninstallPlugin(options);
  return installPlugin(options);
}

export async function uninstallPlugin(options: InstallOptions = {}): Promise<void> {
  const paths = resolveInstallPaths(options);
  await rm(paths.pluginDir, { recursive: true, force: true });
  const marketplace = await readMarketplace(paths.marketplacePath);
  if (marketplace) {
    marketplace.plugins = marketplace.plugins.filter((entry) => entry.name !== pluginName);
    await mkdir(path.dirname(paths.marketplacePath), { recursive: true });
    await writeFile(paths.marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");
  }
}

export async function checkInstall(options: InstallOptions = {}): Promise<{ ok: boolean; issues: string[] }> {
  const paths = resolveInstallPaths(options);
  const issues: string[] = [];
  if (!(await exists(path.join(paths.pluginDir, ".codex-plugin", "plugin.json")))) {
    issues.push("Plugin directory is missing .codex-plugin/plugin.json");
  }
  const marketplace = await readMarketplace(paths.marketplacePath);
  const entry = marketplace?.plugins.find((candidate) => candidate.name === pluginName);
  if (!entry) {
    issues.push("Marketplace entry is missing");
  } else if (entry.source.path !== "./plugins/excalidrawer") {
    issues.push("Marketplace entry source.path must be ./plugins/excalidrawer");
  }
  return { ok: issues.length === 0, issues };
}

function resolveInstallPaths(options: InstallOptions): InstallResult {
  const agentsHome = options.agentsHome ?? defaultAgentsHome();
  const marketplaceRoot = path.dirname(agentsHome);
  return {
    pluginDir: path.join(marketplaceRoot, "plugins", pluginName),
    marketplacePath: path.join(agentsHome, "plugins", "marketplace.json")
  };
}

interface Marketplace {
  name: string;
  interface: { displayName: string };
  plugins: Array<{
    name: string;
    source: { source: "local"; path: string };
    policy: { installation: "AVAILABLE"; authentication: "ON_INSTALL" };
    category: string;
  }>;
}

async function writeMarketplace(marketplacePath: string): Promise<void> {
  const marketplace = (await readMarketplace(marketplacePath)) ?? {
    name: "personal",
    interface: { displayName: "Personal" },
    plugins: []
  };
  marketplace.plugins = marketplace.plugins.filter((entry) => entry.name !== pluginName);
  marketplace.plugins.push({
    name: pluginName,
    source: { source: "local", path: "./plugins/excalidrawer" },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Productivity"
  });
  await mkdir(path.dirname(marketplacePath), { recursive: true });
  await writeFile(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");
}

async function readMarketplace(marketplacePath: string): Promise<Marketplace | null> {
  if (!(await exists(marketplacePath))) return null;
  return JSON.parse(await readFile(marketplacePath, "utf8")) as Marketplace;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
