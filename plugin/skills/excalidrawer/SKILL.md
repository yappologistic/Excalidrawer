---
name: excalidrawer
description: Create, edit, validate, and export Excalidraw diagrams through the Excalidrawer MCP tools or CLI. Use when Codex needs to produce .excalidraw scene files, modify existing Excalidraw JSON, turn a natural-language architecture/process sketch into diagram elements, or export a scene to SVG/PNG for review.
---

# Excalidrawer

Use Excalidrawer when the user asks for Excalidraw diagrams, whiteboard-style architecture sketches, process maps, or edits to `.excalidraw` files.

## Workflow

1. Prefer MCP tools when available:
   - `create_scene` for new `.excalidraw` files from a prompt.
   - `import_structured_scene` for Mermaid, PlantUML, Graphviz DOT, OpenAPI, Terraform, Docker Compose, Kubernetes, or package dependency input.
   - `create_recipe_scene` for named recipes and standard diagram families.
   - `edit_scene` for small additive changes to an existing scene.
   - `validate_scene` before handing a scene back.
   - `repair_scene` when validation returns layout quality issues.
   - `export_scene` when the user needs SVG or PNG review artifacts.
   - `create_renderer_harness` for safe Browser visual QA.
   - `run_visual_regression` for golden-gallery checks.
   - `doctor_browser` when Browser/Chrome visual QA is fragile.
2. If MCP tools are unavailable, use the `excalidrawer` CLI from the installed package:
   - `excalidrawer create --prompt "<diagram>" --out diagram.excalidraw`
   - `excalidrawer import --format mermaid --in diagram.mmd --out diagram.excalidraw`
   - `excalidrawer recipe c4-container --out diagram.excalidraw`
   - `excalidrawer edit diagram.excalidraw --add-text "<note>"`
   - `excalidrawer validate diagram.excalidraw`
   - `excalidrawer repair broken.excalidraw --out repaired.excalidraw`
   - `excalidrawer export diagram.excalidraw --format svg --out diagram.svg`
   - `excalidrawer harness diagram.excalidraw --out harness.html`
   - `excalidrawer visual-regression diagram.excalidraw --out visual-report.json`
   - `excalidrawer visual-regression gallery --out visual-gallery.json`
   - `excalidrawer doctor browser --scene diagram.excalidraw --out doctor.json`
   - `excalidrawer gallery` to verify the built-in multi-layout gallery.
3. Keep `.excalidraw` JSON as the source of truth. Treat SVG/PNG exports as review artifacts.
4. Validate a scene after every write and before final response.
5. Treat validation failures as blockers. The validator checks JSON shape and visual layout quality, including overlapped elements, cramped spacing, unreadable text boxes, uncentered container labels, malformed arrow bindings, missing arrowheads, and arrows crossing visible content.
6. For complex diagrams, export SVG and verify it in the in-Codex browser through a localhost URL. Check that text remains inside boxes, arrowheads render, typed edge labels are readable, semantic node shapes are visible, and arrows do not cover labels or unrelated boxes.
7. For visual QA, generate a harness and load it through the in-Codex Browser or Chrome. The packaged harness is self-contained and avoids unpinned remote executable scripts; runtime-specific Excalidraw checks require a separately vetted local runtime.
8. When Browser/Chrome QA fails because of tooling, run `doctor_browser` or `excalidrawer doctor browser` and report runtime warnings separately from diagram quality failures.
9. When editing a user-provided scene, preserve existing elements unless the user explicitly asks to replace them.

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

The compiler builds a Diagram IR first: nodes, typed edges, groups, lanes, clusters, annotations, primitives, subdiagrams, layout hints, visual grammar, review metadata, layout intent, template name, and complexity mode. It then applies a theme, renders semantic shapes, adds text-based icon markers, labels typed arrows, routes arrows through orthogonal corridors, scores the scene, and retries where appropriate before failing closed. Do not return a scene when validation reports arrows crossing labels, text outside boxes, unreadable text, or excessive canvas bounds.

For advanced diagrams, use prompt hints directly: trust boundaries, event buses, deployment/data zones, `expand <node> internals`, `put databases at bottom`, `group cloud services together`, and semantic badges such as `mark API critical and PII`. The SVG export should expose primitives, route groups, route lanes, semantic decorations, subdiagrams, legends, review notes, renderer metadata, node kinds, and edge types as `data-excalidrawer-*` attributes.

For more complex diagrams, use next-generation prompt directives when the user wants more than boxes and arrows:

- `domain: ecommerce|saas|data|incident`
- `pattern: strangler migration|event-driven|service blueprint`
- `profile: compact|balanced|spacious`
- `preset: boardroom|deep-work|review-ready`
- `import: json|yaml|mermaid|csv`
- `detail: overview|standard|deep`

These produce reusable pattern notes, domain-pack metadata, layout profile metadata, style preset metadata, imported-source provenance, progressive detail, compound components, ports/anchors, critic checks, and a named golden fixture. Prefer side-panel review cards for these helper surfaces so they do not cover main diagram nodes, labels, or arrows.

Available themes are `technical`, `executive`, `handdrawn`, `minimal`, `system-architecture`, and `incident-response`. Use the default `technical` theme unless the user requests a different tone.

Use templates when the user asks for a standard diagram family. Built-in templates cover `flow`, `architecture`, `sequence`, `mindmap`, `data-flow`, `state-machine`, `swimlane`, `incident-response`, and `system-architecture`. The gallery also includes the `architecture-ecommerce-spacious` golden fixture. Complexity modes are `compact`, `balanced`, and `detailed`.

Use recipes when the user asks for a known diagram shape rather than free-form generation. Available recipes are `c4-container`, `incident-timeline`, `service-map`, `data-lineage`, `deployment-topology`, `queue-worker-system`, and `auth-flow`.

Use the icon vocabulary for common system concepts. Current built-ins are database, queue, API, worker, browser, cloud, cache, lock, and alert. Icons are represented with Excalidraw-compatible primitives/text instead of external images so scenes remain portable.

## Output Rules

- Write generated diagrams to a clear path ending in `.excalidraw`.
- Export SVG for lightweight review unless the user asks for PNG.
- State both the source scene path and exported artifact path.
- If validation reports an overlap, cramped spacing, or unreadable text, revise the scene before returning it.
- Prefer `repair_scene`/`excalidrawer repair` for structurally valid scenes that fail visual quality checks, then validate again.
- If browser inspection shows overflowing labels, missing markers, or arrows crossing content, revise the scene before returning it.
- Use `diff_scenes`/`excalidrawer diff` when comparing two generated versions or checking a repair changed only the intended diagram content.
- Use `export_library_pack`/`excalidrawer library` when the user wants reusable components for manual Excalidraw editing.
- Do not claim Excalidraw renderer parity for PNG/SVG exports; the built-in Node exporter is deterministic and reviewable, while the `.excalidraw` file remains the canonical Excalidraw artifact.

## References

Read `references/excalidraw-format.md` when you need schema details, export caveats, or installation behavior.
