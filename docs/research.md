# Research Notes

## Codex Plugin Shape

Official Codex docs describe plugins as the installable distribution unit for reusable workflows. A plugin root has `.codex-plugin/plugin.json`, can bundle `skills/`, and can point at MCP configuration through `.mcp.json`. Local marketplace entries use JSON catalogs and `source.path` values such as `./plugins/<name>` relative to the marketplace root. Sources: [Build plugins](https://developers.openai.com/codex/plugins/build), [Plugins](https://developers.openai.com/codex/plugins), [Skills](https://developers.openai.com/codex/skills), [MCP](https://developers.openai.com/codex/mcp).

## Skill Shape

Skills are `SKILL.md` files with `name` and `description` frontmatter plus optional `references/`, `scripts/`, `assets/`, and `agents/openai.yaml`. Codex uses progressive disclosure: metadata first, full skill body only when the skill triggers.

## Excalidraw Format

Excalidraw documents local scene files as plaintext JSON with `type`, `version`, `source`, `elements`, `appState`, and `files`. The canonical `.excalidraw` scene remains the source of truth for this plugin. Source: [Excalidraw JSON Schema](https://docs.excalidraw.com/docs/codebase/json-schema).

## Export Caveat

Excalidraw export utilities include `exportToCanvas`, `exportToBlob`, `exportToSvg`, and clipboard export. The implementation expects DOM/canvas APIs for browser rendering, so Excalidrawer ships a deterministic Node SVG/PNG exporter for review artifacts instead of promising pixel-identical official renderer output. SVG carries readable labels; PNG carries layout and text-marker placement. Sources: [Export utilities](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export), [Restore utilities](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/restore).

## Arrow And Text Quality

The current Excalidraw source models arrows and lines as linear elements with normalized local `points`, nullable `startBinding` and `endBinding`, and arrowhead fields. Bound text actions set `textAlign: "center"` and `verticalAlign: "middle"` for container labels. Excalidrawer follows those conventions for generated diagrams and validates that arrows are bound, normalized, visibly headed, and routed away from labels or unrelated content. Sources: [linear element type](https://github.com/excalidraw/excalidraw/blob/0642e72cfa2d9a71198200e52f37399384610ee3/packages/element/src/types.ts#L333-L341), [bound text centering](https://github.com/excalidraw/excalidraw/blob/0642e72cfa2d9a71198200e52f37399384610ee3/packages/excalidraw/actions/actionBoundText.tsx#L156-L163), [programmatic arrow bindings](https://docs.excalidraw.com/docs/%40excalidraw/excalidraw/api/excalidraw-element-skeleton).
