# Partial renders: forms in overlays (lane PARTIAL-RENDER)

Status 2026-10-08: implemented (router `live` pages + forms `onSubmit` result). Ruling below; options (b) as the no-JS half, (c) HTML fragments rejected for v1.

## Problem

- Form inside an open overlay (cdk Drawer / Modal / Popover, ui Drawer / Modal) posts to a route action.
- Wanted: no reload, overlay + page state kept, only the affected part updates; no JS = working PE POST.
- Baseline (HEAD `6127d31d`, fixture `libs/forms/tests/drawer-app` without `live`, measured `measure.ts`):
  - Enhanced submit already fetches (no reload); issues stay in the open drawer (7 DOM mutations, 278 B answer).
  - Success: forms `revalidate(fresh)` → router `rerun` → page component re-rendered. Page-local signals reset (`Clicked 2` → `Clicked 0`), the drawer's open signal recreated `false`.
  - Bug found: on the resumed page the old overlay portal stays in `body` and `inert` stays on `header` + page `section` → page unusable after a successful submit (see Open issues 1).
  - Same-URL redirect (PRG to the form's page): `follow()` → `navigate(sameURL)` = no-op → list stale.
  - `onSubmit` resolved `void`: no way to close the overlay on success only.

## Options

| | (a) fetch submit + revalidation | (b) routable overlays | (c) partial renders (server HTML fragment + own resume state) |
|---|---|---|---|
| What | keep enhanced fetch; make same-URL revalidation update data in place instead of re-rendering the page | overlay state in the URL (`?new`, `/customers/new` child route); server renders it open | action answers HTML for one region + a resume-state delta; client swaps + merges |
| Page state on success | kept (with in-place data) | lost unless the page persists across search changes | kept outside the fragment; inside: fresh copies |
| Bytes / submit | JSON data (≈ 0.4 KB here) | data or document | HTML + state delta (≥ data, usually 2–5×) |
| Server CPU | loaders only | loaders + page render | loaders + region render |
| No JS | needs a server-side open state | native (the URL is the state) | needs (b) anyway |
| Runtime cost | small, router-only | Router persistence across search changes (top Router keys on href) | large: resume id base offsets, table `t0` / chunk index dedupe, implicit-marker stride resets, `kill` / parent mapping of replaced regions in dom-resume, contexts / signals captured inside the fragment disconnected from live page signals (an overlay's close button inside the fragment gets a fresh `open` copy) |

## Ruling

- **(c)-semantics on (a) transport: "live pages"**, plus **(b) for the no-JS half**. HTML fragments rejected for v1: fine-grained signals already know which DOM depends on the data; shipping HTML re-does that work on the server, costs more bytes, and needs resume-state merging (id collisions, nested regions) for no visible gain. Revisit only for data that is too big to ship as JSON but cheap as HTML (not seen yet). Measured: [Live pages vs region partials](#live-pages-vs-region-partials-measured-2026-10-08).
- Opt-in per page: `export const live = true`. Not automatic: a page that destructures values out of `data` at setup would silently show stale data (snapshot), so the change of `data` type must be explicit.
- Live page props: `LivePageProps<D, P>` = `{ data: () => PageData<D>; params; url }` — accessor like `LayoutProps.data` (consistent, destructure-safe, cheapest on resume: bindings capture the signal directly; a live-props getter would go through `_rProps` recipe + member boxes).
- Same-URL revalidation of the shown live page updates `data` + reran layouts in one `batch`; no page re-render. Forms single flight unchanged on the wire.
- `onSubmit(def, form, event)` → `Promise<boolean> | undefined`: `true` once the server accepted the submit and the page is fresh; the overlay closes from app code: `onSubmit={async (e) => (await onSubmit(def, form, e)) && open.set(false)}`.
- PRG to the shown URL revalidates (`follow()`), on live pages in place.

## API

```tsx
export const live = true;
export const serverLoad = ({ url }: RequestEvent) => ({ customers: list(), creating: url.searchParams.has("new") });
export const serverActions = { customer: action(customerForm, (v) => (taken(v.email) ? invalid({ email: "Taken" }) : void add(v))) };
export default function Customers({ data }: LivePageProps<typeof serverLoad>) {
  const result = actionResult("customer");
  const open = signal(data().creating || (result?.status ?? 0) >= 400); // no JS: ?new + failed POST
  const form = createForm(customerForm, { result });
  // <For each={data().customers} by={(c) => c.id}>…  <Modal isDismissable isOpen={open}>…
  // <form action="?/customer" onSubmit={async (e) => (await onSubmit(customerForm, form, e)) && open.set(false)}>
}
```

## Design details

- **Response shape:** unchanged. Enhanced POST (`accept: application/json`, `x-rivet-revalidate: 1`) → success `{ action, data, head?, deps? }` (resume-format encoded), failure `{ action }` + status, redirect `{ redirect, status }`. No new endpoint, no HTML.
- **Errors:** validation / `invalid()` → issues written to the form store, overlay open, focus on first invalid field (`focusOnInvalid`); `onSubmit` → `false`. Network / 5xx → form issue (`errors.network` / `errors.server`), `false`. Loader failure during an in-place refresh → regular rerun (route error view).
- **Redirect:** other URL → `navigate()` (await commit, then `true`); shown URL (`pathname + search`, no hash) → `revalidate()` (live: in place, one data request); other origin / outside base → document load.
- **Focus:** in-place refresh moves nothing; the overlay's own focus restore runs when the app closes it. No route announcer, no scroll.
- **Streaming:** single-flight answer is JSON (no streaming). `Async` boundaries inside a live page re-run only if they read `data()`.
- **CSRF / security order:** unchanged (handler: CSRF → body limit → onRequest → guards → headers → action → loaders). The in-place refresh is the same single-flight request; plain `invalidate()` is the same GET data request as before.
- **Resume ids / nested regions:** no new ids, no state merge. The slot `_live(source)` (`{ m, s, u, d, n }`) is an App-level object captured by the `rivet:go` handler; `s` is the same table entry as the page's `data` prop → a cold resumed page refreshes without re-creating the page component; bindings reading `data()` re-run (chunks load after the answer). Layout data via existing `_refreshed`.
- **Concurrency / abort:** forms abort an older submit (`state.submit`); `_serveLive` generation counter `n` drops older answers; a navigation started meanwhile (`_current()`) or a URL change wins; a refresh is never applied to another page (`slot.u` vs `location`).
- **History:** none (same entry). Search-only navigations (`?new` links with JS, back / forward between them) keep a live page (open issue 4: single-level and nested layout levels); apps may still open overlays from signals with JS and use the URL for no-JS only (`data-rivet-prefetch="none"` on the link).
- **No-JS fallback:** (b) — `?new` renders the overlay open on the server (cdk overlays server-render their portal content); a failed POST re-renders with the overlay open (`actionResult(name)?.status >= 400`) and echoed values; success renders it closed (the action URL drops the search: `url.search = ""` before loaders).
- **Zero-cost:** `client/live.ts` reached only from the generated App when some page is live (server/static modes), independently of navigate/forms usage; `index.ts` gains export aliases only (`_perform`, `_dropPrefetch`, re-exports). Codegen of apps without a live page byte-identical (checked against HEAD codegen for ssr-bench, forms app, router fixtures, playground, docs). ssr-bench lane bundles contain no live code.

## Measurements (Chromium, localhost, production build, `libs/forms/tests/drawer-app/measure.ts`)

| Submit | Requests (body bytes) | DOM mutations (list / layout / other) | Page state | Overlay |
|---|---|---|---|---|
| JS invalid (cold, chunks) | transport 816 + enhance 943 + POST 278 | 0 / 0 / 7 | kept | open, issue shown |
| JS valid, before (HEAD) | POST 425 + Layout chunk 74 | 40 total | reset (re-render) | leaked: page left `inert` |
| JS valid, live (cold) | POST 425 + Layout chunk 74 | 20 / 2 / 80 | kept | closed by app |
| JS valid, live (warm) | POST 482 | 6 / 3 / 105 | kept | closed by app |
| no JS invalid | document 6.5 KB (400) | full page | lost | open (server) |
| no JS valid | document 4.3 KB | full page | lost | closed |

- Bytes: single-flight answer 0.4–0.5 KB vs 4.3–6.5 KB document (uncompressed): ~10×. e2e asserts answer < document / 4.
- Time click → updated list: 58–73 ms JS vs 63–68 ms document on localhost (no latency; the document path also re-parses, re-resumes and loses state). "other" = overlay close (portal removal, `inert` removal outside, form reset).
- Cold list: adopted server rows were re-created on the first fresh list (new item objects); since round 3 a row whose fresh item equals the server item in data is kept (cold valid submit 3 / 50 / 200 rows: 51 / 240 / 840 → 39 / 40 / 40 mutations, all outside the list; first server row node kept). Warm updates keyed (one row added).

## Live pages vs region partials (measured 2026-10-08)

Question (coordinator): the user asked for partial renders (server renders only the drawer region, client merges). Why live pages instead, and would region partials add value?

Per valid submit, cold resumed page, drawer open, list of N customers (Chromium, localhost, production build; scratch script over `drawer-app`):

| N | single-flight answer (JSON) | `?_rivet=data` alone | list region HTML (server markup) | page resume state | document | requests after the answer | DOM mutations | click → list updated |
|---|---|---|---|---|---|---|---|---|
| 3 | 495 B | 352 B | 236 B | 3.1 KB | 10.0 KB | 1 (Layout chunk 74 B) | 51 | 58 ms |
| 50 | 3.9 KB | 3.8 KB | 3.4 KB | 6.9 KB | 16.9 KB | 1 (74 B) | 240 | 55 ms |
| 200 | 15.2 KB | 15.1 KB | 13.8 KB | 19.7 KB | 40.1 KB | 1 (74 B) | 840 | 62 ms |

- What the answer carries: `{ action, data, head?, deps? }` — every loader of the route reran (root layout total + the page's list), nothing else (no markup, no state). It is the page's data, not just the drawer's: the drawer has no data of its own; the list is what changed.
- A region partial would ship the list's HTML (≈ 0.9× the JSON) **plus** its resume state delta (≈ 84 B per row here: `(19.7 − 3.1) KB / 197 rows`) → ≈ 30 KB at 200 rows vs 15.2 KB JSON: ~2× the bytes, for the same server loaders + a render.
- DOM work: the cold first refresh re-creates the adopted server rows (new item objects → 4 mutations per row, 840 at 200); later refreshes are keyed (6 / 3 / 105 warm, Measurements). A partial swap would replace the same rows (fewer mutation records, same node creation) and then need resume-state merging (ids, regions, table refs) before anything inside is interactive.
- Extra chunks: the only post-answer request is the root layout's binding chunk (74 B, 1 round trip, then cached). Every binding that reads `data()` is a small symbol chunk; nothing the client "cannot render" without heavy code.
- Page state: live pages keep every page-local signal and the open overlay by construction; a partial must re-create its region (fresh signals inside: an overlay's close button inside the fragment gets a fresh `open` copy) — the opposite of the user's goal.

Ruling: no region partials now — on these numbers they cost ~2× bytes and break state survival for a 74 B / 1 RTT saving on cold pages. Where they could win (revisit with a measurement first, explicit opt-in API, e.g. a `partial` export on a component, 0 B unused):
- regions whose client rendering needs big component chunks not loaded yet (server-only markdown / syntax highlighting / large i18n catalogs): HTML once vs chunk KBs;
- data much larger than its markup (aggregations rendered to a small summary).
Cheaper follow-ups instead: ~~preload the data-reading binding chunks on form intent~~ done (open issue 5); ~~adopt server rows by `by` key on the first fresh list~~ done (data-equal items keep the row: 840 → 40 mutations at 200 rows).

## Tests

- `libs/router/tests/live.test.ts`: scan flag (`live` alone ≠ inline; `false` ignored; layouts ignored), codegen wiring with/without navigate + byte-identity for apps without live pages, in-place refresh from fresh data (no navigation), other URL → regular path, concurrent refreshes (newest wins).
- `libs/router/tests/live-native-ssr.test.ts`: isolated production builds with native links, no navigate/forms imports, and explicit navigate false/true; HTTP GETs return 200 and correct accessor-backed loader data; real native-link clicks update the page while retaining its draft and DOM identity.
- `libs/forms/tests/drawer.test.ts` (Chromium): JS submit no reload; issue keeps drawer open + focus; success → list + layout total update, drawer closed, counter kept, nothing `inert`; warm second add; answer vs document bytes; no-JS `?new` + 400 re-render + success.
- Docs: `apps/docs/content/guides/forms/forms-in-overlays.md` + example `apps/docs/examples/drawer-form` (server mode: the docs build does not run its steps in Chromium; the forms e2e covers the same flow).

## Open issues / follow-ups

1. ~~**Overlay leak on page re-render (non-live pages)**~~ fixed (runtime, 2026-10-08):
   - Symptom: resumed page, overlay opened client-side, then `invalidate()` (non-live page), a client navigation away or the back button → overlay portal, `inert` on the page and the scroll lock stayed.
   - Root cause: resume attribution, not cdk. The Router's route content renders inside an awaited `Async` (route load), i.e. in the server traversal after the Router site's read. `recorder.region` was null by then, so every record of the page (bindings, the Modal anchor's `resolveOverlay` region, effects) encoded with parent `-1` (page root) instead of the Router region `0`. The browser's re-creation of region 0 (`dead.add(0)`, `owners.get(0).dispose()`) never reached them; the overlay content, re-created under `ownerOf(-1)` = resume root, kept `modalOverlay`'s cleanup (overlay stack, `preventScroll`, `ariaHideOutside` inert) alive.
   - Fix: `server-async.ts` `Async` asks a resume hook (`_onAsyncContent`) for an `enter` wrapper at construction and renders its content through it; `server-resume.ts` sets `recorder.region` to a `held` logical scope (`id: null`) under the constructing read's region. Records encode with that region as parent; `held` acts as the page root for rows, branches, client-only mounts and streaming → HTML unchanged.
   - Cost: `/server` 0 B (hook folded away without server-resume), `/server-resume` +24 B min; state bytes unchanged (parent ids change value only).
   - Tests: `libs/runtime/tests/resume-async-region.test.ts`; `libs/forms/tests/drawer.test.ts` × {cdk Modal, cdk Popover, ui Drawer, ui Sheet} × {non-live revalidation, client navigation away, back button} — no `[inert]`, no dialog, empty portals, no scroll lock (7/12 fail without the fix; the back-button cases pass either way since that page is client-rendered).
2. ~~`stale` stayed set after an in-place full revalidation~~ fixed: `_refreshed` clears it (the next navigation keeps layouts again).
3. Kit component head / `applyRouteHead` not re-applied in place (static `head.title` is).
4. ~~Live pages across search-only navigations~~ done for single-level apps (2026-10-08): top Router keyed on the live slot's `k` (`_liveRouter`), location sync effect `_armLive` skips search-only changes of the shown live page and refreshes it in place (one data request, `_inPlace()` ends the navigation). e2e: `?new` link, back, forward keep `Clicked 1`, 1 data request each, page still live after. Nested layout levels done too (2026-10-08): `_sync(…, inPlace)` hook → `_liveLevels` keeps every level key and refreshes in place (e2e `libs/router/tests/live-nested.test.ts`: link, back / forward, revalidation after a search keep the page + layout nodes and state, one data request with `_rivet_keep=/,/shop`, layout `url()` follows; `/client` entry +337 B min).
5. ~~Cold first refresh loads the binding chunks after the answer~~ done (2026-10-08): `_liveIntent` on focusin / pointerdown inside a form warms them through the resume runtime's `rivet.warm` hook (0 script requests after the answer, e2e; 150 ms RTT / 200 KB/s: click → list + layout updated p50 513 → 374 ms, 5 runs each).
6. ~~PRG shortcut~~ done (2026-10-08): an action `redirect()` back to the page's own path (no query / fragment) answers `{ redirect, status, data, head?, deps? }` to an enhanced submit with `x-rivet-revalidate` (handler `backHere`); forms `follow(to, answer)` revalidates from it — one request instead of POST + data GET (tests: router `actions.test.ts`, `live.test.ts` follow). A redirect to the same path with another query still navigates (one data request; on a live page in place).
