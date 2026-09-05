#!/usr/bin/env bash
# Unpack coke-music-art.zip into this game public/ tree.
# Expected zip: Faceback.cam repo root (../../coke-music-art.zip from games/coke-music).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIP=""
for c in "${COKE_MUSIC_ART_ZIP:-}" "$ROOT/../../coke-music-art.zip" "$ROOT/../coke-music-art.zip" "$ROOT/coke-music-art.zip" "/workspace/faceback-coke/coke-music-art.zip"; do
  if [ -n "$c" ] && [ -f "$c" ]; then ZIP="$c"; break; fi
done
if [ -z "$ZIP" ]; then
  echo "Could not find coke-music-art.zip. Set COKE_MUSIC_ART_ZIP or place it at the Faceback.cam repo root." >&2
  exit 1
fi
echo "Extracting $ZIP -> $ROOT/"
unzip -o "$ZIP" -d "$ROOT"
if [ -d "$ROOT/public/art" ]; then
  echo "Art ready at $ROOT/public/art"
elif [ -d "$ROOT/art" ]; then
  mkdir -p "$ROOT/public"
  cp -a "$ROOT/art" "$ROOT/public/"
  echo "Art copied to $ROOT/public/art"
else
  echo "Warning: unzipped but public/art not found. Inspect $ROOT" >&2
fi
