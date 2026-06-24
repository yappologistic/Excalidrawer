# MCP Tools

The stdio server starts with:

```bash
npx -y github:yappologistic/Excalidrawer mcp
```

The plugin manifest points Codex at `plugin/.mcp.json`, which launches that command.

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
