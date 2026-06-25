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
const pluginSourcePath = "./.codex/plugins/excalidrawer";

export async function installPlugin(options: InstallOptions = {}): Promise<InstallResult> {
  const paths = resolveInstallPaths(options);
  await mkdir(path.dirname(paths.pluginDir), { recursive: true });
  await rm(paths.pluginDir, { recursive: true, force: true });
  await cp(path.join(packageRoot(), "plugin"), paths.pluginDir, { recursive: true });
  await writeInstalledMcpConfig(paths.pluginDir);
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
  for (const relativePath of [
    path.join(".codex-plugin", "plugin.json"),
    ".mcp.json",
    path.join("skills", "excalidrawer", "SKILL.md"),
    path.join("skills", "excalidrawer", "agents", "openai.yaml"),
    path.join("skills", "excalidrawer", "references", "excalidraw-format.md")
  ]) {
    if (!(await exists(path.join(paths.pluginDir, relativePath)))) {
      issues.push(`Plugin directory is missing ${relativePath.replaceAll("\\", "/")}`);
    }
  }
  const marketplace = await readMarketplaceForCheck(paths.marketplacePath, issues);
  const entry = marketplace?.plugins.find((candidate) => candidate.name === pluginName);
  if (!entry) {
    issues.push("Marketplace entry is missing");
  } else if (entry.source.path !== pluginSourcePath) {
    issues.push(`Marketplace entry source.path must be ${pluginSourcePath}`);
  }
  return { ok: issues.length === 0, issues };
}

function resolveInstallPaths(options: InstallOptions): InstallResult {
  const agentsHome = options.agentsHome ?? defaultAgentsHome();
  const marketplaceRoot = path.dirname(agentsHome);
  return {
    pluginDir: path.join(marketplaceRoot, ".codex", "plugins", pluginName),
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
    source: { source: "local", path: pluginSourcePath },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Productivity"
  });
  await mkdir(path.dirname(marketplacePath), { recursive: true });
  await writeFile(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");
}

async function readMarketplace(marketplacePath: string): Promise<Marketplace | null> {
  if (!(await exists(marketplacePath))) return null;
  try {
    return normalizeMarketplace(JSON.parse(await readFile(marketplacePath, "utf8")));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Marketplace file is invalid JSON: ${marketplacePath}`);
    throw error;
  }
}

async function readMarketplaceForCheck(marketplacePath: string, issues: string[]): Promise<Marketplace | null> {
  try {
    return await readMarketplace(marketplacePath);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Marketplace file is invalid JSON:")) {
      issues.push(error.message);
      return null;
    }
    throw error;
  }
}

function normalizeMarketplace(value: unknown): Marketplace {
  if (!isRecord(value)) {
    return { name: "personal", interface: { displayName: "Personal" }, plugins: [] };
  }
  return {
    name: typeof value.name === "string" ? value.name : "personal",
    interface: normalizeInterface(value.interface),
    plugins: Array.isArray(value.plugins) ? value.plugins.filter(isMarketplacePlugin) : []
  };
}

function normalizeInterface(value: unknown): { displayName: string } {
  if (!isRecord(value) || typeof value.displayName !== "string") return { displayName: "Personal" };
  return { displayName: value.displayName };
}

function isMarketplacePlugin(value: unknown): value is Marketplace["plugins"][number] {
  if (!isRecord(value) || typeof value.name !== "string" || !isRecord(value.source) || !isRecord(value.policy)) return false;
  return (
    value.source.source === "local" &&
    typeof value.source.path === "string" &&
    value.policy.installation === "AVAILABLE" &&
    value.policy.authentication === "ON_INSTALL" &&
    typeof value.category === "string"
  );
}

async function writeInstalledMcpConfig(pluginDir: string): Promise<void> {
  const config = {
    mcpServers: {
      excalidrawer: {
        command: process.execPath,
        args: [path.join(packageRoot(), "dist", "cli.js"), "mcp"]
      }
    }
  };
  await writeFile(path.join(pluginDir, ".mcp.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
