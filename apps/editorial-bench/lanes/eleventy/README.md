# editorial-bench lane: eleventy

- Versions: `@11ty/eleventy` 3.1.6, `marked` 18.1.0.
- `build.sh <fixture dir>`: copies the articles into `src/articles/` (+ `articles.11tydata.js`), `site.json` into `src/_data/`, runs Eleventy → `dist/`.
- Nunjucks layouts; Markdown library replaced by `marked.parse` (`setLibrary("md")`), `markdownTemplateEngine: false`; index pagination (20), tag/author pages via pagination over `site.tags` / `site.authors`.
