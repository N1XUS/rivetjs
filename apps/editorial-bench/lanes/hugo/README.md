# editorial-bench lane: hugo

- Versions: `hugo-extended` 0.167.0 npm wrapper (binary from the official gohugoio release, SHA-256 verified by its install script; run `node node_modules/hugo-extended/postinstall.js` once after `npm ci` when install scripts are disabled).
- `build.sh <fixture dir>`: `hugo --contentDir <fixture>/content` → `dist/`. Taxonomies `tags` + `authorslug` (permalinks `/tags/:slug/`, `/authors/:slug/`), home paginated by 20 (`/page/N/`; Hugo also writes a `/page/1/` alias redirect).
- Markdown: Goldmark (Hugo's only renderer) — highlighting, typographer and heading ids off for output parity with marked. RSS, sitemap, robots, 404, section and taxonomy-list pages disabled.
