#!/usr/bin/env bash
set -euo pipefail

# Index this repo with Zoekt into ~/.zoekt (or $ZOEK_INDEX_DIR)

INDEX_DIR="${ZOEK_INDEX_DIR:-$HOME/.zoekt}"

# Resolve repo root
if REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  :
else
  REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
fi

# Locate zoekt-git-index
if command -v zoekt-git-index >/dev/null 2>&1; then
  ZGI=$(command -v zoekt-git-index)
elif [ -x "$HOME/go/bin/zoekt-git-index" ]; then
  ZGI="$HOME/go/bin/zoekt-git-index"
else
  echo "zoekt-git-index not found. Install with:"
  echo "  go install github.com/sourcegraph/zoekt/cmd/zoekt-git-index@latest"
  exit 1
fi

mkdir -p "$INDEX_DIR"
echo "Indexing repo: $REPO_ROOT"
echo "Index dir:    $INDEX_DIR"

"$ZGI" -index "$INDEX_DIR" "$REPO_ROOT"
echo "Zoekt indexing complete."

