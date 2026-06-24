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

Returns a scene summary including `excalidrawerReview`, renderer metadata, and layout hints when present.

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

Returns validation status. Validation includes both Excalidraw JSON shape and deterministic scene quality checks for visible overlaps, cramped spacing, canvas bounds, text readability, centered container text, arrow bindings, visible arrowheads, and arrow routes that avoid visible content. Valid and invalid responses include `excalidrawerReview` when the scene was produced by the compiler.

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

Export refuses scenes that fail validation or quality checks, so agents do not return review artifacts from visibly broken boards. SVG exports include `data-excalidrawer-*` attributes for primitives, route groups, semantic decorations, subdiagrams, legends, review notes, renderer metadata, node kinds, and edge types. For visual QA, serve exported SVGs over localhost and inspect browser DOM geometry for marker definitions, text containment, and arrow-content intersections.
