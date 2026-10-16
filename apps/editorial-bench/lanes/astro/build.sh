#!/usr/bin/env bash
# Astro lane. Usage: build.sh <abs fixture dir fixture/content/n<N>> → dist/
set -euo pipefail
cd "$(dirname "$0")"
export EDITORIAL_CONTENT="$1" ASTRO_TELEMETRY_DISABLED=1
rm -rf dist .astro node_modules/.astro public && mkdir -p public/img
cp ../../fixture/site.css public/site.css
cp ../../fixture/assets/*.jpg public/img/
node node_modules/astro/bin/astro.mjs build --silent
