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

Returns a scene summary.

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

Returns validation status.

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
