# Browser snapshots

Screenshots from Cursor’s browser MCP tool are written to a temp folder first:

```
$TMPDIR/cursor/screenshots/
```

This directory holds archived browser captures for the residence-tracker repo.

**Index:** see [docs/ui-snapshots.md](../docs/ui-snapshots.md) for PRD/RFC mapping.

## Layout

```
snapshots/
├── prd/     # PRD §6.4 screens
└── rfc/     # RFC auth + UX shell
```

## Archive after a browser test

From `residence-tracker/`:

```bash
pnpm screenshot:archive
# or with explicit temp + dest paths:
bash scripts/archive-browser-screenshot.sh cap-login.png prd/6.4-login.png
```

Files land under `snapshots/` using the destination path you provide.

## For agents

After `browser_take_screenshot`, run the archive script with PRD/RFC filenames so artifacts stay in the repo. Capture at least the screens listed in `docs/ui-snapshots.md`.
