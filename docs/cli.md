# CLI Reference

Run locally after `npm run build`:

```bash
node dist/cli.js <command>
```

Run as an installed or NPX package:

```bash
excalidrawer <command>
npx github:yappologistic/Excalidrawer <command>
```

## Scene Commands

```bash
excalidrawer create --prompt "<diagram prompt>" --out diagram.excalidraw
```

Creates a valid `.excalidraw` JSON scene from a natural-language prompt.

Complex prompts can select a compiler intent with a prefix:

```bash
excalidrawer create --prompt "architecture: frontend calls API, API writes Postgres, worker consumes queue" --out architecture.excalidraw
```

Supported intents are `flow`, `architecture`, `sequence`, `mindmap`, `data-flow`, `state-machine`, `swimlane`, and `incident-response`. Compiler prompts are parsed into a Diagram IR with nodes, typed edges, groups, lanes, clusters, annotations, primitives, subdiagrams, layout hints, visual grammar, review metadata, and layout intent before Excalidraw elements are rendered.

Advanced prompt features include trust boundaries, event buses, deployment/data zones, `expand <node> internals` subdiagrams, `put databases at bottom` layout hints, auto-legends, semantic badges such as `critical` and `PII`, and stable typed-edge route groups/route lanes.

Next-generation prompt features are available through explicit directives:

```bash
excalidrawer create --prompt "domain: ecommerce pattern: strangler migration profile: spacious preset: boardroom import: yaml detail: deep architecture detailed: buyer calls storefront, storefront calls checkout API, checkout API writes orders database, checkout API publishes payment event bus" --out ecommerce.excalidraw
```

These directives add reusable patterns, domain packs, layout profiles, style presets, imported-source provenance, progressive-detail metadata, compound components, ports/anchors, critic checks, and a named golden fixture to the Diagram IR. Explicit next-generation prompts also render side-panel review cards and port markers that stay outside the main content and route lanes.

```bash
excalidrawer read diagram.excalidraw
```

Prints a JSON summary with path, type, version, source, element count, `excalidrawerReview`, renderer metadata, layout hints, and next-generation metadata when present. Compiler review metadata includes renderer spec, grammar summary, optimizer attempts, selected attempt, pattern names, domain pack, layout profile, style preset, imported source, progressive detail level, critic checks, compound components, and golden fixture.

```bash
excalidrawer edit diagram.excalidraw --add-text "<note>"
```

Adds a text note while preserving existing scene elements.

```bash
excalidrawer validate diagram.excalidraw
```

Validates the scene shape and visual layout quality. It exits nonzero on malformed data, overlapped elements, cramped spacing, canvas bounds that are too large for review, text boxes that are too small for their labels, uncentered container text, malformed arrow bindings, missing arrowheads, or arrows crossing visible content. Output is JSON and includes `excalidrawerReview` plus next-generation metadata when present.

```bash
excalidrawer export diagram.excalidraw --format svg --out diagram.svg
excalidrawer export diagram.excalidraw --format png --out diagram.png
```

Exports deterministic review artifacts. SVG includes readable centered labels, routed arrow polylines, and a defined arrowhead marker. PNG includes layout, arrow routes, and text-marker placement. Export refuses visibly invalid scenes, and the `.excalidraw` file remains canonical.

## Advanced Commands

```bash
excalidrawer import --format mermaid --in diagram.mmd --out imported.excalidraw
```

Imports structured sources into a prompt-backed polished scene. Supported formats are `mermaid`, `plantuml`, `dot`, `openapi`, `terraform`, `docker-compose`, `kubernetes`, and `package-deps`.

```bash
excalidrawer recipe c4-container --out c4.excalidraw
```

Creates a named recipe. Built-in recipes are `c4-container`, `incident-timeline`, `service-map`, `data-lineage`, `deployment-topology`, `queue-worker-system`, and `auth-flow`. Running `recipe` with no name prints the catalog.

```bash
excalidrawer repair broken.excalidraw --out repaired.excalidraw
```

Repairs a structurally valid but visually invalid scene. `repair` intentionally bypasses the quality gate while reading the input, then writes only if the rebuilt scene passes quality checks.

```bash
excalidrawer diff before.excalidraw after.excalidraw --out diff.json
```

Compares added labels, removed labels, layout movement, and element-count delta.

```bash
excalidrawer library --out components.excalidrawlib
```

Exports reusable Excalidraw library items for common components such as API service, queue, database, worker, browser, cache, alert, and trust boundary.

```bash
excalidrawer harness diagram.excalidraw --out harness.html
```

Writes a browser harness that imports React and `@excalidraw/excalidraw`, then loads the generated scene as `initialData`. Serve this file through localhost and inspect it with the in-Codex Browser or Chrome automation for renderer-specific issues.

```bash
excalidrawer visual-regression diagram.excalidraw --out visual-report.json
```

Hashes deterministic SVG output for golden-gallery regression checks. Pass the previous hash as a future baseline through the API/MCP layer when you need changed/unchanged reporting.

```bash
excalidrawer doctor browser --scene diagram.excalidraw --out doctor.json
```

Checks local preview readiness, SVG DOM geometry inputs, and Browser/Chrome automation readiness. It separates browser-tool failures from scene-quality failures so bad diagrams fail closed and browser infrastructure problems are reported precisely.

## Lifecycle Commands

```bash
excalidrawer install
excalidrawer check
excalidrawer reinstall
excalidrawer uninstall
```

The lifecycle commands use `AGENTS_HOME` when set, which makes them testable without touching a real Codex installation.
