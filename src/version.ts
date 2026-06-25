import { readFile } from "node:fs/promises";

let cachedPackageVersion: string | undefined;

export async function packageVersion(): Promise<string> {
  if (cachedPackageVersion !== undefined) return cachedPackageVersion;
  const metadata = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  if (!isPackageMetadata(metadata)) {
    throw new Error("package.json must contain a string version");
  }
  cachedPackageVersion = metadata.version;
  return cachedPackageVersion;
}

function isPackageMetadata(value: unknown): value is { readonly version: string } {
  return isRecord(value) && typeof value.version === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
