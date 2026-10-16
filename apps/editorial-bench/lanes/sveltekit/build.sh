#!/usr/bin/env bash
# SvelteKit lane. Usage: build.sh <abs fixture dir fixture/content/n<N>> → dist/
set -euo pipefail
cd "$(dirname "$0")"
export EDITORIAL_CONTENT="$1"
rm -rf dist .svelte-kit static && mkdir -p static/img
cp ../../fixture/site.css static/site.css
cp ../../fixture/assets/*.jpg static/img/
node node_modules/vite/bin/vite.js build
