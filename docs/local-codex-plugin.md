# Local Codex Plugin Install

Excalidrawer packages the Codex plugin under `plugin/` in this repository. The CLI installer copies that folder into the personal local plugin area and writes a marketplace entry.

Default paths:

- Plugin source: `~/plugins/excalidrawer`
- Marketplace: `~/.agents/plugins/marketplace.json`

The marketplace entry uses:

```json
{
  "name": "excalidrawer",
  "source": {
    "source": "local",
    "path": "./plugins/excalidrawer"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Productivity"
}
```

`source.path` is relative to the marketplace root, so the default personal marketplace resolves `./plugins/excalidrawer` to `~/plugins/excalidrawer`.

## Isolated Testing

Use `AGENTS_HOME` to test without touching real local Codex state:

```bash
AGENTS_HOME=/tmp/agents/.agents node dist/cli.js install
AGENTS_HOME=/tmp/agents/.agents node dist/cli.js check
AGENTS_HOME=/tmp/agents/.agents node dist/cli.js uninstall
```

On Windows PowerShell, set the variable with `$env:AGENTS_HOME`.
