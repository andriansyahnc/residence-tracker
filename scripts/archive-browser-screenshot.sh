#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   archive-browser-screenshot.sh <temp-filename> [dest-under-snapshots]
#   archive-browser-screenshot.sh                    # latest png -> snapshots/<timestamp>-<name>.png
#
# Examples:
#   archive-browser-screenshot.sh prd-login.png prd/6.4-login.png
#   archive-browser-screenshot.sh rfc-auth-sign-in.png rfc/auth-sign-in.png

SRC_DIR="${TMPDIR:-/tmp}/cursor/screenshots"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST_ROOT="$APP_DIR/snapshots"

temp_name="${1:-}"
dest_rel="${2:-}"

if [[ -n "$temp_name" ]]; then
  src="$SRC_DIR/$temp_name"
  if [[ ! -f "$src" ]]; then
    echo "Screenshot not found: $src" >&2
    exit 1
  fi
else
  src="$(ls -t "$SRC_DIR"/*.png 2>/dev/null | head -1 || true)"
  if [[ -z "$src" ]]; then
    echo "No PNG screenshots in $SRC_DIR" >&2
    exit 1
  fi
  temp_name="$(basename "$src")"
fi

if [[ -n "$dest_rel" ]]; then
  dest="$DEST_ROOT/$dest_rel"
else
  stamp="$(date +%Y-%m-%d-%H%M%S)"
  dest="$DEST_ROOT/${stamp}-${temp_name}"
fi

mkdir -p "$(dirname "$dest")"
cp "$src" "$dest"
echo "$dest"
