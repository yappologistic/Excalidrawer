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

```bash
excalidrawer read diagram.excalidraw
```

Prints a JSON summary with path, type, version, source, and element count.

```bash
excalidrawer edit diagram.excalidraw --add-text "<note>"
```

Adds a text note while preserving existing scene elements.

```bash
excalidrawer validate diagram.excalidraw
```

Validates the scene shape and visual layout quality. It exits nonzero on malformed data, overlapped elements, cramped spacing, canvas bounds that are too large for review, or text boxes that are too small for their labels.

```bash
excalidrawer export diagram.excalidraw --format svg --out diagram.svg
excalidrawer export diagram.excalidraw --format png --out diagram.png
```

Exports deterministic review artifacts. SVG includes readable labels; PNG includes layout and text-marker placement. Export refuses visibly invalid scenes, and the `.excalidraw` file remains canonical.

## Lifecycle Commands

```bash
excalidrawer install
excalidrawer check
excalidrawer reinstall
excalidrawer uninstall
```

The lifecycle commands use `AGENTS_HOME` when set, which makes them testable without touching a real Codex installation.
