import type { StructuredImportInput, StructuredImportResult } from "./advanced-types.js";
import { assertNever, cleanLabel, unique } from "./advanced-shared.js";

export function importStructuredDiagram(input: StructuredImportInput): StructuredImportResult {
  const entities = entitiesFor(input);
  const relationships = relationshipsFor(input, entities);
  return {
    format: input.format,
    prompt: relationships.length > 0 ? `architecture: ${relationships.join(", ")}` : `architecture: ${entities.join(" to ")}`,
    entities,
    relationships
  };
}

function entitiesFor(input: StructuredImportInput): readonly string[] {
  switch (input.format) {
    case "mermaid":
      return unique(mermaidPairs(input.source).flatMap((pair) => [pair.source, pair.target]));
    case "plantuml":
      return unique([...input.source.matchAll(/([A-Za-z][\w -]*)\s*->\s*([A-Za-z][\w -]*)/g)].flatMap((match) => [match[1] ?? "", match[2] ?? ""]));
    case "dot":
      return unique([...input.source.matchAll(/([A-Za-z][\w -]*)\s*->\s*([A-Za-z][\w -]*)/g)].flatMap((match) => [match[1] ?? "", match[2] ?? ""]));
    case "openapi":
      return unique(["client", ...[...input.source.matchAll(/^\s*(\/[\w/{}-]+)/gm)].map((match) => match[1] ?? "endpoint"), "API"]);
    case "terraform":
      return unique([...input.source.matchAll(/resource\s+"([^"]+)"\s+"([^"]+)"/g)].map((match) => cleanLabel(`${match[1]} ${match[2]}`)));
    case "docker-compose":
      return unique([...input.source.matchAll(/^\s{2}([\w-]+):\s*$/gm)].map((match) => cleanLabel(match[1] ?? "")));
    case "kubernetes":
      return unique([...input.source.matchAll(/^\s*name:\s*([\w-]+)/gm)].map((match) => cleanLabel(match[1] ?? "")));
    case "package-deps":
      return packageDependencyEntities(input.source);
    default:
      return assertNever(input.format);
  }
}

function relationshipsFor(input: StructuredImportInput, entities: readonly string[]): readonly string[] {
  if (input.format === "mermaid") return mermaidPairs(input.source).map((pair) => `${pair.source} calls ${pair.target}`);
  if (input.format === "plantuml") {
    return [...input.source.matchAll(/([A-Za-z][\w -]*)\s*->\s*([A-Za-z][\w -]*)/g)].map((match) => `${cleanLabel(match[1] ?? "")} calls ${cleanLabel(match[2] ?? "")}`);
  }
  if (input.format === "dot") {
    return [...input.source.matchAll(/([A-Za-z][\w -]*)\s*->\s*([A-Za-z][\w -]*)/g)].map((match) => `${cleanLabel(match[1] ?? "")} calls ${cleanLabel(match[2] ?? "")}`);
  }
  return entities.slice(0, -1).map((entity, index) => `${entity} calls ${entities[index + 1] ?? "target"}`);
}

function mermaidPairs(source: string): readonly { readonly source: string; readonly target: string }[] {
  return source
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^\s*([A-Za-z][\w -]*)(?:\[[^\]]*\]|\([^)]*\))?\s*-+>+\s*([A-Za-z][\w -]*)/);
      return match ? [{ source: cleanLabel(match[1] ?? ""), target: cleanLabel(match[2] ?? "") }] : [];
    });
}

function packageDependencyEntities(source: string): readonly string[] {
  try {
    const parsed = JSON.parse(source) as { readonly dependencies?: Record<string, string>; readonly devDependencies?: Record<string, string> };
    return unique(["package", ...Object.keys(parsed.dependencies ?? {}), ...Object.keys(parsed.devDependencies ?? {})]);
  } catch {
    return unique(source.split(/\r?\n/).map((line) => line.split(":")[0]?.trim() ?? "").filter(Boolean));
  }
}
