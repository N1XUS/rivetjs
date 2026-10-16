#!/usr/bin/env bash
# Next.js lane build → .next (served by `next start`). No own install: node_modules = a symlink to
# apps/editorial-bench/lanes/next/node_modules (created here when missing; run that lane's `npm ci` first).
set -euo pipefail
cd "$(dirname "$0")"
EDITORIAL=../../../editorial-bench/lanes/next/node_modules
[ -e node_modules ] || [ ! -e "$EDITORIAL/next/package.json" ] || ln -sfn "$EDITORIAL" node_modules
[ -e node_modules/next/package.json ] || { echo "island-bench next lane: not installed (npm ci --workspaces=false in apps/editorial-bench/lanes/next; this lane links its node_modules)" >&2; exit 1; }
export NEXT_TELEMETRY_DISABLED=1
mkdir -p public
cp ../../site.css public/site.css
rm -rf .next
node node_modules/next/dist/bin/next build > build.log 2>&1 || { tail -40 build.log; exit 1; }
