# Examples

| Example                                  | What                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [`sqlite-local`](sqlite-local)           | Bookmarks on `node:sqlite`: search, tag filter, keyset pagination, forms that work with JavaScript off, JSON import / export.    |
| [`paginated-list`](paginated-list)       | Books catalogue: URL search/sort/page size/pagination, canonical redirects, live updates and browser history.                    |
| [`forms-in-overlays`](forms-in-overlays) | Contacts: create drawer, edit modal, delete confirmation, shared validation, live list/layout updates and JavaScript-off forms.  |
| [`operations`](operations)               | Synthetic SQLite app: tenant/session policy, checkout, concurrent editing, browser journeys, transport cleanup and stress tests. |

Run one: `cd examples/sqlite-local && npx vite build && npx vite build --ssr && node serve.ts`.

Install dependencies with `npm ci` at the repository root first. Each example's README has its run and check commands. To test all examples, install Chromium (`npx playwright install chromium`) and run `npx vitest run --project examples --maxWorkers=1` from the root. No external services are required.
