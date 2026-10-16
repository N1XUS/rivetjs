#!/usr/bin/env bash
# Astro + Preact lane build → dist/ (dist/server/entry.mjs = standalone node server). Needs this lane's own install
# (`npm ci --workspaces=false --ignore-scripts` here; pins in package.json, lockfile written by the first install).
set -euo pipefail
cd "$(dirname "$0")"
[ -e node_modules/astro/package.json ] || { echo "not installed: run npm install --workspaces=false --ignore-scripts in apps/island-bench/lanes/astro-preact (pins in package.json; commit the lockfile it writes)" >&2; exit 3; }
mkdir -p public
cp ../../site.css public/site.css
rm -rf dist
ASTRO_TELEMETRY_DISABLED=1 node node_modules/astro/bin/astro.mjs build > build.log 2>&1 || { tail -40 build.log; exit 1; }
