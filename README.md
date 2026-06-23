# Excalidrawer

Excalidrawer is a Codex plugin and MCP server for creating, editing, validating, and exporting Excalidraw scene files.

## Install

### Codex marketplace

Add the repository marketplace source:

```bash
codex plugin marketplace add yappologistic/Excalidrawer --ref main
codex plugin marketplace list
```

Restart Codex, open **Plugins**, choose the **Excalidrawer** marketplace source, and install **Excalidrawer**. The committed marketplace catalog lives at `.agents/plugins/marketplace.json` and points Codex at the plugin bundle in `./plugin`.

### NPX personal install

```bash
npx github:yappologistic/Excalidrawer install
```

The installer copies the plugin bundle to `~/plugins/excalidrawer` and writes a personal marketplace entry at `~/.agents/plugins/marketplace.json`. Restart Codex after installation, then install `excalidrawer` from the personal marketplace in the plugin directory.

Useful lifecycle commands:

```bash
npx github:yappologistic/Excalidrawer check
npx github:yappologistic/Excalidrawer reinstall
npx github:yappologistic/Excalidrawer uninstall
```

`reinstall` is the command to use after pulling updates. Start a new Codex thread after reinstalling so new skill and MCP metadata are loaded.

## CLI Usage

```bash
excalidrawer create --prompt "client calls API and API queues work" --out diagram.excalidraw
excalidrawer edit diagram.excalidraw --add-text "retry failed jobs"
excalidrawer read diagram.excalidraw
excalidrawer validate diagram.excalidraw
excalidrawer export diagram.excalidraw --format svg --out diagram.svg
excalidrawer export diagram.excalidraw --format png --out diagram.png
```

## MCP Tools

The plugin exposes a stdio MCP server through `npx -y github:yappologistic/Excalidrawer mcp`.

Tools:

- `create_scene`: create an `.excalidraw` file from a prompt.
- `edit_scene`: add text to an existing scene.
- `read_scene`: summarize an existing scene.
- `validate_scene`: validate scene JSON.
- `export_scene`: export SVG or PNG review artifacts.

## Development

```bash
npm install
npm run build
npm test
```

## Quality Gate

Scene validation now checks more than JSON shape. Generated, edited, and exported scenes must pass deterministic layout checks for visible overlap, cramped spacing, canvas bounds, and text boxes that are too small for their labels. The CLI and MCP `validate` commands report these issues before a scene is returned.

The `.excalidraw` JSON file is the source of truth. SVG exports include readable labels. PNG exports include layout and text-marker placement. Both are deterministic Node-generated review artifacts because Excalidraw's official browser renderer depends on DOM and canvas APIs.

## Troubleshooting

- `check` reports missing plugin files: run `reinstall`, restart Codex, and open a new thread.
- The plugin is not visible in Codex after marketplace install: run `codex plugin marketplace list`, confirm `Excalidrawer` is listed, then restart Codex.
- The plugin is not visible after NPX install: confirm `~/.agents/plugins/marketplace.json` contains an `excalidrawer` entry and restart Codex.
- `npx github:yappologistic/Excalidrawer ...` fails during install: confirm Git and Node 20+ are available.
- PNG/SVG output does not exactly match Excalidraw's browser renderer: use the `.excalidraw` file as canonical and open it in Excalidraw for exact rendering.
