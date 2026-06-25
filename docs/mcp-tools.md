# MCP Tools

The stdio server starts with:

```bash
npx -y github:yappologistic/Excalidrawer mcp
```

The committed plugin manifest points Codex at `plugin/.mcp.json`, which launches that command for marketplace installs. The `excalidrawer install` personal installer rewrites the installed `.mcp.json` to launch the current local `dist/cli.js`, avoiding local/remote drift during development.

## `create_scene`

Input:

```json
{
  "prompt": "browser sends requests to API",
  "outPath": "diagram.excalidraw"
}
```

Creates an Excalidraw scene file.

## `read_scene`

Input:

```json
{
  "path": "diagram.excalidraw"
}
```

Returns a scene summary including `excalidrawerReview`, renderer metadata, layout hints, and next-generation metadata when present: domain pack, layout profile, style preset, imported source, progressive detail, and golden fixture.

## `edit_scene`

Input:

```json
{
  "path": "diagram.excalidraw",
  "addText": "retry queue"
}
```

Adds a text element and writes the file back.

## `validate_scene`

Input:

```json
{
  "path": "diagram.excalidraw"
}
```

Returns validation status. Validation includes both Excalidraw JSON shape and deterministic scene quality checks for visible overlaps, cramped spacing, canvas bounds, text readability, centered container text, arrow bindings, visible arrowheads, and arrow routes that avoid visible content. Valid and invalid responses include `excalidrawerReview` and next-generation metadata when the scene was produced by the compiler.
Responses also include `qualitySummary`, which explains issues in user-facing language and includes repair actions such as widening text containers, increasing spacing, or rerouting arrows.

## `export_scene`

Input:

```json
{
  "path": "diagram.excalidraw",
  "outPath": "diagram.svg",
  "format": "svg"
}
```

`format` can be `svg` or `png`.

Export refuses scenes that fail validation or quality checks, so agents do not return review artifacts from visibly broken boards. SVG exports include `data-excalidrawer-*` attributes for primitives, route groups, route lanes, semantic decorations, subdiagrams, legends, review notes, renderer metadata, node kinds, edge types, patterns, domain packs, layout profiles, style presets, detail levels, critic checks, compound components, ports, anchors, and golden fixtures. For visual QA, serve exported SVGs over localhost and inspect browser DOM geometry for marker definitions, text containment, and arrow-content intersections.

## `import_structured_scene`

Input:

```json
{
  "format": "mermaid",
  "inPath": "diagram.mmd",
  "outPath": "imported.excalidraw"
}
```

`format` can be `mermaid`, `plantuml`, `dot`, `openapi`, `terraform`, `docker-compose`, `kubernetes`, or `package-deps`. The tool extracts entities and relationships, compiles them through Excalidrawer, and writes a validated scene.

## `create_recipe_scene`

Input:

```json
{
  "name": "c4-container",
  "outPath": "c4.excalidraw"
}
```

Omit `name` to list recipes. Current recipes are `c4-container`, `incident-timeline`, `service-map`, `data-lineage`, `deployment-topology`, `queue-worker-system`, and `auth-flow`.

## `repair_scene`

Input:

```json
{
  "path": "broken.excalidraw",
  "outPath": "repaired.excalidraw"
}
```

Reads structurally valid scene JSON even when visual quality fails, rebuilds a clean layout from visible labels, and writes only a scene that passes quality validation.

## `diff_scenes`

Input:

```json
{
  "beforePath": "before.excalidraw",
  "afterPath": "after.excalidraw",
  "outPath": "diff.json"
}
```

Returns added labels, removed labels, changed positions, element delta, and a compact summary. `outPath` is optional.

## `export_library_pack`

Input:

```json
{
  "outPath": "components.excalidrawlib"
}
```

Writes reusable Excalidraw library items for common components such as API service, queue, database, trust boundary, worker, browser, cache, and alert.

## `create_renderer_harness`

Input:

```json
{
  "path": "diagram.excalidraw",
  "outPath": "harness.html"
}
```

Creates a self-contained HTML/SVG browser harness with embedded scene JSON and no unpinned remote executable scripts. Use it for in-Codex Browser or Chrome visual QA. Runtime-specific Excalidraw binding/font checks require a separately vetted local runtime.

## `run_visual_regression`

Input:

```json
{
  "path": "diagram.excalidraw",
  "name": "service-map",
  "baselineHash": "optional-previous-hash",
  "outPath": "visual-report.json"
}
```

Hashes deterministic SVG output and reports whether a baseline changed. Omit `path` to run the curated recipe gallery. `baselineHash` and `outPath` are optional.

## `doctor_browser`

Input:

```json
{
  "path": "diagram.excalidraw",
  "outPath": "doctor.json"
}
```

Reports local-preview readiness, SVG geometry readiness, and runtime availability. It fails on bad scene geometry and warns when the packaged safe harness is being used without a vetted local Excalidraw runtime.
