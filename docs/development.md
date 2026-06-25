# Development

## Requirements

- Node.js 20 or newer
- npm
- Git

## Setup

```bash
npm install
npm run build
npm test
```

## Verification

```bash
npm run check
npm pack --dry-run --json
node dist/cli.js visual-regression gallery --out visual-gallery.json
node dist/cli.js create --prompt "client calls API, API writes database" --out doctor.excalidraw
node dist/cli.js doctor browser --scene doctor.excalidraw --out doctor.json
```

Focused compiler verification:

```bash
npm test -- tests/compiler.test.ts
```

The compiler tests cover Diagram IR extraction, every supported layout intent, every reusable theme, quality scoring, and fail-closed detection for arrows over labels.

Marketplace readiness checks:

```bash
codex plugin marketplace add yappologistic/Excalidrawer --ref main
codex plugin marketplace list
```

Manual QA scenarios used for this repository are recorded under `.omo/ulw-loop/evidence/` during local development and intentionally ignored by Git.

## Package Behavior

`prepare` runs `npm run build`, so GitHub-based NPX installs build `dist/` before executing the `excalidrawer` bin. The package tarball includes `dist/`, Markdown docs, `docs/assets/`, `plugin/`, `README.md`, and `LICENSE`.

## Export Boundary

The project intentionally does not claim pixel-identical browser rendering. Official Excalidraw export utilities depend on browser DOM/canvas APIs. Excalidrawer creates canonical `.excalidraw` JSON and deterministic review SVG/PNG artifacts in Node. The static harness does not run the Excalidraw browser runtime. Static SVG harness does not prove browser-runtime parity; use a vetted local Excalidraw runtime for runtime-specific QA.
