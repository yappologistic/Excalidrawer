import path from "node:path";
import { fileURLToPath } from "node:url";

export function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.basename(here) === "src" || path.basename(here) === "dist"
    ? path.dirname(here)
    : here;
}

export function defaultAgentsHome(): string {
  return process.env.AGENTS_HOME ?? path.join(homeDir(), ".agents");
}

function homeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? process.cwd();
}
