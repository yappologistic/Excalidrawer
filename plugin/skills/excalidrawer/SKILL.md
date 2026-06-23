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
3. Keep `.excalidraw` JSON as the source of truth. Treat SVG/PNG exports as review artifacts.
4. Validate a scene after every write and before final response.
5. When editing a user-provided scene, preserve existing elements unless the user explicitly asks to replace them.

## Output Rules

- Write generated diagrams to a clear path ending in `.excalidraw`.
- Export SVG for lightweight review unless the user asks for PNG.
- State both the source scene path and exported artifact path.
- Do not claim Excalidraw renderer parity for PNG/SVG exports; the built-in Node exporter is deterministic and reviewable, while the `.excalidraw` file remains the canonical Excalidraw artifact.

## References

Read `references/excalidraw-format.md` when you need schema details, export caveats, or installation behavior.
