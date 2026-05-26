#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$ROOT/agents"
CLAUDE_DIR="$ROOT/.claude/agents"
ANTIGRAVITY_DIR="$ROOT/.antigravity/agents"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Missing source directory: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$CLAUDE_DIR" "$ANTIGRAVITY_DIR"

for source in "$SOURCE_DIR"/*.md; do
  name="$(basename "$source")"

  cp "$source" "$CLAUDE_DIR/$name"
  cp "$source" "$ANTIGRAVITY_DIR/$name"

  if [[ "$name" == "tidy.md" ]]; then
    cp "$source" "$ROOT/tidy.md"
  fi
done

echo "Synced agent files from agents/."
