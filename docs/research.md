# Research Notes

## Codex Plugin Shape

Official Codex docs describe plugins as the installable distribution unit for reusable workflows. A plugin root has `.codex-plugin/plugin.json`, can bundle `skills/`, and can point at MCP configuration through `.mcp.json`. Local marketplace entries use JSON catalogs and `source.path` values such as `./plugins/<name>` relative to the marketplace root. Sources: [Build plugins](https://developers.openai.com/codex/plugins/build), [Plugins](https://developers.openai.com/codex/plugins), [Skills](https://developers.openai.com/codex/skills), [MCP](https://developers.openai.com/codex/mcp).

## Skill Shape

Skills are `SKILL.md` files with `name` and `description` frontmatter plus optional `references/`, `scripts/`, `assets/`, and `agents/openai.yaml`. Codex uses progressive disclosure: metadata first, full skill body only when the skill triggers.

## Excalidraw Format

Excalidraw documents local scene files as plaintext JSON with `type`, `version`, `source`, `elements`, `appState`, and `files`. The canonical `.excalidraw` scene remains the source of truth for this plugin. Source: [Excalidraw JSON Schema](https://docs.excalidraw.com/docs/codebase/json-schema).

## Export Caveat

Excalidraw export utilities include `exportToCanvas`, `exportToBlob`, `exportToSvg`, and clipboard export. The implementation expects DOM/canvas APIs for browser rendering, so Excalidrawer ships a deterministic Node SVG/PNG exporter for review artifacts instead of promising pixel-identical official renderer output. SVG carries readable labels; PNG carries layout and text-marker placement. Sources: [Export utilities](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export), [Restore utilities](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/restore).
