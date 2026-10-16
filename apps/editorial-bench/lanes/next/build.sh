#!/usr/bin/env bash
# Next.js lane. Usage: build.sh <abs fixture dir fixture/content/n<N>> → dist/ (static export)
set -euo pipefail
cd "$(dirname "$0")"
export EDITORIAL_CONTENT="$1" NEXT_TELEMETRY_DISABLED=1
rm -rf dist out .next public && mkdir -p public/img
cp ../../fixture/site.css public/site.css
cp ../../fixture/assets/*.jpg public/img/
node node_modules/next/dist/bin/next build > build.log 2>&1 || { tail -40 build.log; exit 1; }
# output: "export" writes the site to out/ (.next holds the build cache, removed before every build).
mv out dist
