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

Advanced prompt features include trust boundaries, event buses, deployment/data zones, `expand <node> internals` subdiagrams, `put databases at bottom` layout hints, auto-legends, semantic badges such as `critical` and `PII`, and stable typed-edge route groups.

```bash
excalidrawer read diagram.excalidraw
```

Prints a JSON summary with path, type, version, source, element count, `excalidrawerReview`, renderer metadata, and layout hints when present.

```bash
excalidrawer edit diagram.excalidraw --add-text "<note>"
```

Adds a text note while preserving existing scene elements.

```bash
excalidrawer validate diagram.excalidraw
```

Validates the scene shape and visual layout quality. It exits nonzero on malformed data, overlapped elements, cramped spacing, canvas bounds that are too large for review, text boxes that are too small for their labels, uncentered container text, malformed arrow bindings, missing arrowheads, or arrows crossing visible content. Output is JSON and includes `excalidrawerReview` when present.

```bash
excalidrawer export diagram.excalidraw --format svg --out diagram.svg
excalidrawer export diagram.excalidraw --format png --out diagram.png
```

Exports deterministic review artifacts. SVG includes readable centered labels, routed arrow polylines, and a defined arrowhead marker. PNG includes layout, arrow routes, and text-marker placement. Export refuses visibly invalid scenes, and the `.excalidraw` file remains canonical.

## Lifecycle Commands

```bash
excalidrawer install
excalidrawer check
excalidrawer reinstall
excalidrawer uninstall
```

The lifecycle commands use `AGENTS_HOME` when set, which makes them testable without touching a real Codex installation.
