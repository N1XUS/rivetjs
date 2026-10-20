# editorial-bench lane: rivet

- Versions: `@rivetjs/*` from this workspace (commit recorded in `results/results.json`), Vite 8.3.2 (repo root), `marked` 18.1.0 (pinned here).
- `build.sh <fixture dir>`: `vite build` + `vite build --ssr` + `prerender.js` (`@rivetjs/router/static` `prerenderBuild`) → site root `dist/client/`. `build.sh <fixture dir> server`: node adapter build → `dist-dynamic/` (rivet-dynamic lane, `serve-dynamic.js`, port `$PORT`).
- File routes `src/routes/` (`index`, `page/[n]`, `articles/[slug]`, `tags/[tag]`, `authors/[author]`): `load(…)` + `entries(…)`, `rivetRouter({ mode: "static" })`.
- Markdown: `marked.lexer` in `src/content.ts` (server only) → compact token tree → `components/Markdown.tsx` JSX (Rivet has no raw-HTML sink; recipe `apps/docs/content/recipes/markdown-blog.md`).
- Defaults kept: the static adapter writes `_data.json` per page and every page carries the resume loader + client router (no zero-JS mode exists).
