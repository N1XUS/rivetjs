#!/usr/bin/env bash
# Next lane build → .next (served by `next start`). Own install: `npm ci --workspaces=false --ignore-scripts` here.
set -euo pipefail
cd "$(dirname "$0")"
[ -e node_modules/next/package.json ] || { echo "bridge-demo next lane: not installed (npm ci --workspaces=false --ignore-scripts in apps/bridge-demo/next)" >&2; exit 3; }
export NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
rm -rf .next
node node_modules/next/dist/bin/next build > build.log 2>&1 || { tail -40 build.log; exit 1; }
