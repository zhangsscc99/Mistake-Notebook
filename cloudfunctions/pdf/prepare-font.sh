#!/bin/sh
# Bundle a Chinese-capable TTF for PDF export (required on macOS dev machines).
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$DIR/ArialUnicode.ttf"
mkdir -p "$DIR"

if [ -f "$TARGET" ]; then
  echo "Font already exists: $TARGET"
  exit 0
fi

if [ -f "/System/Library/Fonts/Supplemental/Arial Unicode.ttf" ]; then
  cp "/System/Library/Fonts/Supplemental/Arial Unicode.ttf" "$TARGET"
  echo "Copied Arial Unicode.ttf"
  exit 0
fi

echo "Please place a Chinese TTF at: $TARGET" >&2
exit 1
