# Lazy resume state — design note (2026-10-12)

- Status: design note, lane SELECT-STATE (phase 3). Not implemented.
- Problem: a resumed cdk Select costs ~3.3 KB br of `rivet/state` per page (select-default), ComboBox ~4.4 KB, DatePicker ~5.6 KB. Each extra instance costs ~1 KB br.
- Finding (phases 1–2, `$S/perf/SELECT-STATE-report.md`): one hub, the select state object, is reached by every handler AND every binding. Narrowing captures can't fix this. Bounds on select-default (drop a root group, GC the table, brotli 11; base 3190 B):
  - drop all region provider lists: −0.3 %
  - drop all handler captures: −0.6 %
  - drop any single binding: 0
  - drop both regions: −22 %
  - drop all bindings: −30 %
- So −40 % or more is only possible by not shipping the component's state before interaction.

## Options

### (a) Fetch the state on intent from a server endpoint
- The HTML carries no table for the island, only a key. The loader fetches the state on intent (hover / focus / `preload="visible"`), as it does for chunks.
- What the key is:
  - The state is per render: request data, generated ids (`rv0-…`), signal values. So the key must be the render (`h` build hash + render id + island id), not the route.
  - Re-rendering on fetch (SSR twice) is unsafe: ids, time and data can differ from the HTML. The server would have to keep the encoded state of every render in a TTL store until the page is used or expires.
- Prerendered / static pages: possible as a sibling file (`page.state.json`, immutable, cacheable by hash). Static hosting works; per-request pages need the store.
- Concerns:
  - Cache: the response is private per render (`no-store`), or keyed by the hash for prerendered pages.
  - CSP: `connect-src` must allow the endpoint.
  - Memory: the store holds every render's state, whether or not it is ever used. Streamed segments add state later.
  - Failure: if the entry has expired, the page must reload (or re-create, as in (b)).
- Latency: one extra round trip before the first handler runs. Prefetch on visible / intent hides it on fast networks, not on a cold mobile tap (RTT 100–300 ms).
- Bytes: HTML −2.9 KB br per Select page. Total transfer is the same or higher, because the state is still downloaded once used. It only helps the HTML critical path (LCP / TTFB budget).

### (b) Re-create the component on the client from its root captures on first interaction
- The HTML carries, per island, a region entry with ONLY its captures (root props, ids) and no inner bindings or handlers. On the first intent event the runtime runs the component on the client, adopts the server nodes (dom-adopt: slots, lists, branches → no flicker, focus kept) and replays the queued event (the loader already queues events, holds cold events and replays in dispatch order).
- This is the existing mechanism with a new trigger. Resumed pages already re-create a component that has no own region on its first signal change (`_regionState` / `_serverBranch`, `docs/guides/resumability.md`). (b) triggers that re-creation from an intent event and stops shipping the inner state that re-creation would rebuild anyway.
- What must be in the HTML: the region's capture list (Function Bridge recipes: `{k:"props"}` live props, `_rFn` / `_rMod` functions, `_rMember` narrowed members, `_rCell`), the region id + markers, and the id seed so that `createId()` replays `rv0-…`. Dropped: inner `b` / `e` entries, the state hub, the provider lists of inner regions.
- Blocker: the capture list must serialize. A parts-form `<Select>` receives JSX children (Label / Trigger / Popover / ListBox), which can't be serialized. So the re-creation unit is the nearest enclosing region whose captures serialize: often the page component that writes the `<Select>` (ui-docs examples: `Default()` with no props → captures [] + module refs).
  - Compiler work: mark such components (`resume="recreate"` or a cdk-level annotation) so the server records one region there and skips inner recording (`_rUnrecorded` already suppresses recording for the cdk collection pass).
- Which components qualify: the first interaction must be a discrete event that can be replayed after a synchronous re-create, the state must be expensive, and the root captures must be cheap.
  - Yes: Select, ComboBox (focus / pointerdown / keydown), DatePicker, Menu / MenuTrigger, Popover triggers.
  - No: text fields (typing before the re-create would need text replay), sliders / drag (continuous pointer streams), anything whose server render reads request data that isn't captured (the client re-render would differ).
- Cost:
  - The dom chunks of the whole component, not just the handler chunks. Select's dom graph ≈ today's handler + binding chunks that `preload="visible"` already fetches (UI-COLD 2026-10-08), so the extra cost is mostly the CPU below.
  - One client render of the component at the first click. Estimate: low single-digit ms on desktop, about 4× that on throttled mobile. Not measured; a spike must measure it.
- Bytes (bound tables): select-default state 3313 → ~300–500 B br (props + ids + module refs), HTML −2.8…−3.0 KB br, about −85 %. ComboBox / DatePicker should scale the same way: 4.4 / 5.6 KB → < 0.6 KB each.

### (c) Keep as is
- 3.3–5.6 KB br state per widget page, zero first-click CPU (handlers run against shipped state). Click-to-interactive is chunk-bound (UI-COLD: ~120 ms slow first click after `preload="visible"`).

## Comparison
| | (a) state fetch | (b) re-create | (c) as is |
|---|---|---|---|
| HTML state, select-default | ~0.1 KB | ~0.3–0.5 KB | 3.3 KB |
| Total bytes once used | ≥ (c) | ≪ (c) | baseline |
| First-click extra | 1 RTT (prefetchable) | 1 client render (CPU) | 0 |
| Server memory / store | per-render TTL store | none | none |
| Static / prerender | sibling file | yes | yes |
| Correctness risk | expiry → reload | client render must equal server (ids, data in captures) | none |

## Recommendation
- (b), opt-in per component, spiked on cdk Select first:
  1. Compiler / runtime: `recreate` region at the nearest serializable boundary; no inner recording.
  2. Intent trigger (pointerdown / focus / keydown → sync re-create → replay).
  3. Parity check: client re-render == server HTML (dev assert on adopt mismatch).
  4. Measure select-default state br, resume-bench click-to-interactive (desktop + 4× CPU throttle), dom-bench mount of one Select.
  - Land it if click-to-interactive stays within +16 ms (one frame) on throttled mobile and state drops ≥ 40 %. Then ComboBox, DatePicker, Menu.
- (a) only as a later option for very large per-render state on dynamic pages (tables, dashboards), where a round trip is cheaper than either. Not for widgets.
- Until the spike lands, (c) stays the default. Phases 1–2 landed the safe encoding wins: 43f96f6f (−5 % raw / −2 % br) and b517706d (context tokens fix).

## Spike result (2026-10-12) — parked
- Scope tried (lane LAZY-STATE): opt-in on cdk Select / ComboBox. A closed popover's content ships no state; on first intent the client re-creates the popover subtree.
- Method: an upper bound with no code change (`$S/perf/LAZY-STATE/bound.ts`):
  - pages: real ui-docs frames (`check-examples`, HEAD);
  - drop the closed-popover regions' bindings, GC every table entry nothing else reaches (handlers, trigger / value bindings and names stay), brotli 11.

| page | state br | closed popovers lazy (bound) | Δ |
|---|---|---|---|
| showcase-dashboard / mail / chat / settings | 6541 / 8716 / 7912 / 6542 | same | 0 % (no Select / ComboBox / DatePicker on these pages) |
| select-default | 3386 | 3130 | −7.6 % |
| combo-box-default-selected-key | 4492 | 3636 | −19.1 % |

- Why −85 % did not hold:
  - The estimate assumed whole-component re-creation (option b). Scoped to the popover subtree, the select state hub stays reachable from the trigger handlers and the trigger / value bindings; only the popover's own closure goes (consistent with the bounds above: both regions −22 %, every binding −30 %).
  - The correctness cost stays high: the popover's captured providers, the listbox selection sync effect, exit-animation / focus state.
  - All of that for ≤ ~1 KB br per widget instance. Ruling: parked.
- Revisit when:
  - a real page is form-heavy (many Select / ComboBox / DatePicker instances);
  - the unit is whole-component re-creation at the nearest serializable enclosing region;
  - the bound for that page is measured first, before any code.
