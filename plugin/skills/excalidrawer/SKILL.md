---
name: excalidrawer
description: Create, edit, validate, and export Excalidraw diagrams through the Excalidrawer MCP tools or CLI. Use when Codex needs to produce .excalidraw scene files, modify existing Excalidraw JSON, turn a natural-language architecture/process sketch into diagram elements, or export a scene to SVG/PNG for review.
---

# Excalidrawer

Use Excalidrawer when the user asks for Excalidraw diagrams, whiteboard-style architecture sketches, process maps, or edits to `.excalidraw` files.

## Workflow

1. Prefer MCP tools when available:
   - `create_scene` for new `.excalidraw` files from a prompt.
   - `edit_scene` for small additive changes to an existing scene.
   - `validate_scene` before handing a scene back.
   - `export_scene` when the user needs SVG or PNG review artifacts.
2. If MCP tools are unavailable, use the `excalidrawer` CLI from the installed package:
   - `excalidrawer create --prompt "<diagram>" --out diagram.excalidraw`
   - `excalidrawer edit diagram.excalidraw --add-text "<note>"`
   - `excalidrawer validate diagram.excalidraw`
   - `excalidrawer export diagram.excalidraw --format svg --out diagram.svg`
   - `excalidrawer gallery` to verify the built-in multi-layout gallery.
3. Keep `.excalidraw` JSON as the source of truth. Treat SVG/PNG exports as review artifacts.
4. Validate a scene after every write and before final response.
5. Treat validation failures as blockers. The validator checks JSON shape and visual layout quality, including overlapped elements, cramped spacing, unreadable text boxes, uncentered container labels, malformed arrow bindings, missing arrowheads, and arrows crossing visible content.
6. For complex diagrams, export SVG and verify it in the in-Codex browser through a localhost URL. Check that text remains inside boxes, arrowheads render, typed edge labels are readable, semantic node shapes are visible, and arrows do not cover labels or unrelated boxes.
7. When editing a user-provided scene, preserve existing elements unless the user explicitly asks to replace them.

## Complex Diagram Compiler

For multi-entity prompts, prefer an explicit intent prefix when the user gives one or when the diagram type is clear:

- `flow`
- `architecture`
- `sequence`
- `mindmap`
- `data-flow`
- `state-machine`
- `swimlane`
- `incident-response`

The compiler builds a Diagram IR first: nodes, typed edges, groups, lanes, clusters, annotations, layout intent, template name, and complexity mode. It then applies a theme, renders semantic shapes, adds text-based icon markers, labels typed arrows, routes arrows through orthogonal corridors, scores the scene, and retries where appropriate before failing closed. Do not return a scene when validation reports arrows crossing labels, text outside boxes, unreadable text, or excessive canvas bounds.

Available themes are `technical`, `executive`, `handdrawn`, `minimal`, `system-architecture`, and `incident-response`. Use the default `technical` theme unless the user requests a different tone.

Use templates when the user asks for a standard diagram family. Built-in templates cover `flow`, `architecture`, `sequence`, `mindmap`, `data-flow`, `state-machine`, `swimlane`, `incident-response`, and `system-architecture`. Complexity modes are `compact`, `balanced`, and `detailed`.

## Output Rules

- Write generated diagrams to a clear path ending in `.excalidraw`.
- Export SVG for lightweight review unless the user asks for PNG.
- State both the source scene path and exported artifact path.
- If validation reports an overlap, cramped spacing, or unreadable text, revise the scene before returning it.
- If browser inspection shows overflowing labels, missing markers, or arrows crossing content, revise the scene before returning it.
- Do not claim Excalidraw renderer parity for PNG/SVG exports; the built-in Node exporter is deterministic and reviewable, while the `.excalidraw` file remains the canonical Excalidraw artifact.

## References

Read `references/excalidraw-format.md` when you need schema details, export caveats, or installation behavior.
