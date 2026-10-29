# examples/paginated-list

- Recipe `apps/docs/content/recipes/paginated-list-from-url.md` as an app; keep both in step (query parsing, canonical redirect, `hrefFor`).
- Data only in `src/server/books.server.ts` (240 generated books, no I/O); `pageOf` returns `{ items, total, pages }` (`pages` ≥ 1).
- URL state: `q` (≤ 80 chars), `sort` (title | author | year | rating), `dir` (asc | desc), `per` (10 | 20 | 50), `page` (integer ≥ 1). Defaults omitted from links; invalid / past-the-end page → `redirect` to the canonical href.
- Live page: `export const live = true` needs the client router (`clientRouter: true`) AND `navigate` usage (router codegen only wires live pages when `navigate` is detected): the search form's `navigate()` call provides it. Without it `data` is a plain object and `data()` throws during SSR.
- Pagination look: `@rivetjs/ui/styles/out/pagination.css` imported in `src/styles.css` (plain links, no ui component import → per-component CSS not pulled in otherwise).
- Previous/Next use `pagination__link--nav` (auto width for icon + text); content wraps on narrow screens so labels never overlap page numbers. Desktop pagination uses its content width beside the rows-per-page links.
- `tests/app.test.ts` builds into `dist/` and binds port 4471.
- The suite includes Chromium cold Next, history back/forward, page-size and search flows; a marker on `main` and document requests verify that live updates keep the page. Install Chromium before running it (CI examples job does so).
- All icons, including pagination gaps, use lucide through `Icon`. Run/check commands and exact dependency pins are documented in the README/package manifest.
