# Excalidrawer Reference

## Scene Format

An `.excalidraw` file is plaintext JSON with:

- `type: "excalidraw"`
- `version: number`
- `source: string`
- `elements: []`
- `appState: {}`
- `files: {}`

Excalidrawer performs strict enough validation for tool use: top-level shape, element array, and required element coordinates/IDs/types.

## Export Behavior

Excalidraw's official export helpers rely on browser DOM/canvas primitives for exact rendering. Excalidrawer therefore keeps `.excalidraw` JSON as the canonical output and provides deterministic Node-generated exports for review. Use SVG to inspect readable centered labels, routed arrows, and arrowhead markers. Use PNG to inspect layout, arrow routes, and text-marker placement, not readable text or pixel-identical Excalidraw rendering.

Generated arrows should use normalized local `points` starting at `[0,0]`, `startBinding` and `endBinding` objects that reference their endpoint elements, and a visible `endArrowhead`. Text labels inside boxes should have `containerId`, `textAlign: "center"`, and `verticalAlign: "middle"`.

Advanced compiler output still uses standard Excalidraw element types. Primitives, legends, subdiagrams, badges, review notes, renderer names, route groups, route lanes, edge types, node kinds, and semantic shapes are stored in element `customData.excalidrawer` and emitted as `data-excalidrawer-*` attributes in SVG exports. Compiler-created scenes also include `appState.excalidrawerReview` so CLI and MCP validation can report review status, renderer spec, grammar summary, and optimizer attempts without reparsing the prompt.

## Install Behavior

The CLI install flow writes a personal marketplace at `~/.agents/plugins/marketplace.json` and installs the plugin source under `~/.codex/plugins/excalidrawer`, matching Codex personal local marketplace guidance where `source.path` is `./.codex/plugins/excalidrawer`.
