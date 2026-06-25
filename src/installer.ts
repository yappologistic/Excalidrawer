import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultAgentsHome, packageRoot } from "./paths.js";
import { packageVersion } from "./version.js";

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
  } else if (!isExcalidrawerMarketplacePlugin(entry) || entry.source.path !== pluginSourcePath) {
    issues.push(`Marketplace entry source.path must be ${pluginSourcePath}`);
  }
  await validateInstalledMcpConfig(paths.pluginDir, issues);
  await validatePluginManifest(paths.pluginDir, issues);
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

type Marketplace = Record<string, unknown> & {
  name: string;
  interface: MarketplaceInterface;
  plugins: MarketplacePlugin[];
};

type MarketplaceInterface = Record<string, unknown> & {
  displayName: string;
};

type MarketplacePlugin = Record<string, unknown> & {
  name: string;
  source?: unknown;
};

type ExcalidrawerMarketplacePlugin = MarketplacePlugin & {
  source: { source: "local"; path: string };
};

function hasPluginName(value: unknown): value is MarketplacePlugin {
  return isRecord(value) && typeof value.name === "string";
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
    ...value,
    name: typeof value.name === "string" ? value.name : "personal",
    interface: normalizeInterface(value.interface),
    plugins: Array.isArray(value.plugins) ? value.plugins.filter(hasPluginName) : []
  };
}

function normalizeInterface(value: unknown): MarketplaceInterface {
  if (!isRecord(value)) return { displayName: "Personal" };
  return { ...value, displayName: typeof value.displayName === "string" ? value.displayName : "Personal" };
}

function isExcalidrawerMarketplacePlugin(value: MarketplacePlugin): value is ExcalidrawerMarketplacePlugin {
  return isRecord(value.source) && value.source.source === "local" && typeof value.source.path === "string";
}

async function writeInstalledMcpConfig(pluginDir: string): Promise<void> {
  const config = {
    excalidrawer: {
      command: process.execPath,
      args: [path.join(packageRoot(), "dist", "cli.js"), "mcp"]
    }
  };
  await writeFile(path.join(pluginDir, ".mcp.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function validateInstalledMcpConfig(pluginDir: string, issues: string[]): Promise<void> {
  const configPath = path.join(pluginDir, ".mcp.json");
  const value = await readJsonForCheck(configPath, "Installed .mcp.json", issues);
  if (!isRecord(value) || !isRecord(value.excalidrawer)) {
    issues.push("Installed .mcp.json must define excalidrawer server");
    return;
  }
  const server = value.excalidrawer;
  if (server.command !== process.execPath) {
    issues.push("Installed .mcp.json command must be the current Node executable");
  }
  const expectedArgs = [path.join(packageRoot(), "dist", "cli.js"), "mcp"];
  if (!isStringArray(server.args) || server.args.length !== expectedArgs.length || server.args.some((arg, index) => arg !== expectedArgs[index])) {
    issues.push("Installed .mcp.json args must launch dist/cli.js mcp");
  }
}

async function validatePluginManifest(pluginDir: string, issues: string[]): Promise<void> {
  const manifestPath = path.join(pluginDir, ".codex-plugin", "plugin.json");
  const value = await readJsonForCheck(manifestPath, "Plugin manifest", issues);
  if (!isRecord(value)) {
    issues.push("Plugin manifest must be a JSON object");
    return;
  }
  if (value.name !== pluginName) {
    issues.push(`Plugin manifest name must be ${pluginName}`);
  }
  if (value.version !== await packageVersion()) {
    issues.push("Plugin manifest version must match package.json");
  }
  if (value.skills !== "./skills/") {
    issues.push("Plugin manifest skills must be ./skills/");
  }
  if (value.mcpServers !== "./.mcp.json") {
    issues.push("Plugin manifest mcpServers must be ./.mcp.json");
  }
}

async function readJsonForCheck(filePath: string, label: string, issues: string[]): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      issues.push(`${label} is invalid JSON: ${filePath}`);
      return null;
    }
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
