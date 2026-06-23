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
python C:/Users/LENOVO/.codex/skills/.system/skill-creator/scripts/quick_validate.py plugin/skills/excalidrawer
npm pack --dry-run
```

Manual QA scenarios used for this repository are recorded under `.omo/ulw-loop/evidence/` during local development and intentionally ignored by Git.

## Package Behavior

`prepare` runs `npm run build`, so GitHub-based NPX installs build `dist/` before executing the `excalidrawer` bin. The package tarball includes `dist/`, `docs/`, `plugin/`, `README.md`, and `LICENSE`.

## Export Boundary

The project intentionally does not claim pixel-identical browser rendering. Official Excalidraw export utilities depend on browser DOM/canvas APIs. Excalidrawer creates canonical `.excalidraw` JSON and deterministic review SVG/PNG artifacts in Node.
