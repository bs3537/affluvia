#!/usr/bin/env bash
set -euo pipefail

# Search this repo using Zoekt, defaulting to ~/.zoekt.
# Usage: scripts/zoekt-search.sh [zoekt options] QUERY

INDEX_DIR="${ZOEK_INDEX_DIR:-$HOME/.zoekt}"

# Locate zoekt
if command -v zoekt >/dev/null 2>&1; then
  ZK=$(command -v zoekt)
elif [ -x "$HOME/go/bin/zoekt" ]; then
  ZK="$HOME/go/bin/zoekt"
else
  echo "zoekt binary not found. Install with:"
  echo "  go install github.com/sourcegraph/zoekt/cmd/zoekt@latest"
  exit 1
fi

# If no args, print help
if [ $# -eq 0 ]; then
  "$ZK" -h
  exit 0
fi

# Ensure index exists (best effort)
if ! ls "$INDEX_DIR"/*.zoekt >/dev/null 2>&1; then
  echo "No Zoekt shards found in $INDEX_DIR. Building index..." >&2
  "$(dirname "$0")/zoekt-index.sh"
fi

# Derive repo name for filtering (e.g., github.com/org/repo)
derive_repo_name() {
  local url
  if url=$(git remote get-url origin 2>/dev/null); then
    :
  else
    echo ""; return
  fi
  # Normalize git URL to host/org/repo
  url=${url%.git}
  url=${url#git@}
  url=${url#ssh://}
  url=${url#https://}
  url=${url#http://}
  url=${url/:/\/}
  echo "$url"
}

REPO_NAME=$(derive_repo_name)

# Separate options (leading -args) from query parts
OPTS=()
QUERY_PARTS=()
for arg in "$@"; do
  if [[ "$arg" == -* && ${#QUERY_PARTS[@]} -eq 0 ]]; then
    OPTS+=("$arg")
  else
    QUERY_PARTS+=("$arg")
  fi
done

# Build query string and inject repo filter if missing
QUERY="${QUERY_PARTS[*]}"
if [[ -n "$REPO_NAME" && "$QUERY" != *"repo:"* ]]; then
  QUERY="repo:^${REPO_NAME}$ ${QUERY}"
fi

# Call zoekt with options (if any) and the final query
if [ ${#OPTS[@]} -gt 0 ]; then
  "$ZK" -index_dir "$INDEX_DIR" "${OPTS[@]}" "$QUERY"
else
  "$ZK" -index_dir "$INDEX_DIR" "$QUERY"
fi
