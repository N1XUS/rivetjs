#!/usr/bin/env bash
# Hugo lane. Usage: build.sh <abs fixture dir fixture/content/n<N>> → dist/
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist static data resources && mkdir -p static/img data
cp ../../fixture/site.css static/site.css
cp ../../fixture/assets/*.jpg static/img/
cp "$1/site.json" data/site.json
./node_modules/hugo-extended/bin/hugo --quiet --contentDir "$1/content" --destination dist --cleanDestinationDir
