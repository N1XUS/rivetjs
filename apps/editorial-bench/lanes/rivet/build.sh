#!/usr/bin/env bash
# Rivet lane: static prerender. Usage: build.sh <abs fixture dir fixture/content/n<N>> [static|server]
# static → dist/client (site root); server → dist-dynamic/{client,server} (rivet-dynamic lane, nothing prerendered).
set -euo pipefail
cd "$(dirname "$0")"
export EDITORIAL_CONTENT="$1"
MODE="${2:-static}"
VITE=../../../../node_modules/vite/bin/vite.js
rm -rf public .rivet && mkdir -p public/img
cp ../../fixture/site.css public/site.css
cp ../../fixture/assets/*.jpg public/img/
if [ "$MODE" = server ]; then
  rm -rf dist-dynamic
  EDITORIAL_MODE=server node "$VITE" build --outDir dist-dynamic/client
  EDITORIAL_MODE=server node "$VITE" build --ssr --outDir dist-dynamic/server
else
  rm -rf dist
  node "$VITE" build
  node "$VITE" build --ssr
  node prerender.js
fi
