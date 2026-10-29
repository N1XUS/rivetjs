# paginated-list

The "Paginated list from the URL" recipe as a runnable app: 240 books in memory, search, sort, page size and page number all in the URL. Every link and the search form work with JavaScript off; with it, the page is `live`, so Rivet updates the list in place (rows keyed by id, focus and scroll kept) instead of rendering the page again.

## Run

From the repository root, install dependencies once with `npm ci`, then:

```sh
cd examples/paginated-list
npm run build
npm start                # http://127.0.0.1:3000
```

Dev: `npm run dev`. Check types and Rivet diagnostics: `npm run check`. Set `PORT` / `HOST` to change the production address. The example resolves packages from the root installation; it is not a separate npm workspace yet.

## What it shows

- `src/server/books.server.ts`: deterministic data + `pageOf(query)` (filter, sort, slice). Server-only: never reaches the browser.
- `src/routes/index.tsx`:
  - `load` reads `q` / `sort` / `dir` / `per` / `page` from the URL, validates each, and redirects (`redirect()`) an invalid or out-of-range page to the canonical URL (`?page=99` → last page).
  - `hrefFor(query, patch)`: every link is the same query with a change; defaults are left out, so URLs stay short.
  - `export const live = true` + `LivePageProps`: `data` is an accessor, refreshed in place on same-page navigations.
  - Sortable headers (`aria-sort`), rows-per-page links, Previous / Next with `rel`, page links with gaps (constant length: no layout jump), the `@rivetjs/ui` Pagination look on plain `<a>` links.
  - Search: a GET form; `onSubmit` calls `navigate()` so a search also updates in place.
- `vite.config.ts`: `clientRouter: true` (links route in place).

## Test

From the repo root: `npx playwright install chromium`, then `npx vitest run --project examples --maxWorkers=1`. The suite builds and boots the production app on port 4471; checks canonical redirects, filtered / sorted / paged HTML, the data endpoint and bootstrap script assets (40 KB budget); and uses Chromium to check cold pagination, browser back/forward, page size and search without replacing the page. CI installs Chromium with its system dependencies.

Versions verified 2026-10-29: Node 26.5 (Node >= 24 required), Vite 8.3.2, Tailwind CSS 4.3.3.
