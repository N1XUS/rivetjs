// Copied from @rivetjs/docs-kit/routes/CLAUDE.md. Do not edit.
# @rivetjs/docs-kit/routes
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Site routes shared by every docs site. `tools/content/generate.ts` copies each file to the same path under `<app>/src/routes/` (header `// Copied from @rivetjs/docs-kit/routes/…. Do not edit.`); the copies are gitignored.

## Layout
- `search.tsx`: `/search/`: no-JS target of the search button, `?q=` opens the dialog (cdk Modal, `../search/dialog.tsx`), lists every page.
- `examples/index.tsx`: `/examples/` gallery grouped by first tag (tag `live` / `code only`). `examples/[id].tsx`: one page per example (`entries(…)`). `examples/[id]/frame/index.tsx` + `[...path].tsx`: the example frame pages (`/examples/<id>/frame/…`, `../components/frame.tsx`): one dynamic route pair for every live example, rendered without the docs chrome or router.
- `api/index.tsx`: `/api/` packages → entry points → symbols. `api/[...symbol].tsx`: one page per entry point and export. Pages render inside the app layout's `SiteFrame` (top bar, no side nav for `/api/` and `/examples/`); `api/[...symbol].tsx` brings its own export list (`.api-layout` = `.side-column` + `.main-column`; links = `symbol.href` from `symbolsOf(entry)`, current page by `symbol.key`: case-clash URLs carry a suffix, so never build `entry.href + name`).

## Rules / invariants
- Import kit modules by package path (`@rivetjs/docs-kit/...`), never relative: files run from the app's `src/routes/`.
- Not type-checked by `tsc -p libs/docs-kit` (excluded); checked in each app (its `.rivet/routes.d.ts` types `PageProps`). Run `nx run docs:typecheck` after edits.
- Edit here, never the copies in apps (regenerated on every content build).
- Adding a route: also add its path to the `known` set / link check in `../tools/content/generate.ts` if content links to it, and to the apps' `.gitignore`.
