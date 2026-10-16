#!/usr/bin/env bash
# Eleventy lane. Usage: build.sh <abs fixture dir fixture/content/n<N>> → dist/
# The articles are copied into src/articles (Eleventy builds what is in its input dir).
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist src/articles src/_data/site.json
mkdir -p src/articles
cp "$1/site.json" src/_data/site.json
cp "$1"/content/articles/*.md src/articles/ 2>/dev/null || find "$1/content/articles" -name '*.md' -exec cp {} src/articles/ +
cat > src/articles/articles.11tydata.js <<'JS'
export default { layout: "article.njk", permalink: (data) => `/articles/${data.slug}/`, eleventyComputed: { pageTitle: (data) => data.title, pageDescription: (data) => data.description } };
JS
node node_modules/@11ty/eleventy/cmd.cjs --quiet
