# libs/devtools/ui — DevTools panel

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Panel app (a Rivet app, own realm: docked iframe at `<base>__rivet/devtools/` or pop-out window). Not exported; built by `../build.ts` into `../dist/ui/`, served by `../server.ts`.

## Layout

- `index.html` → `main.tsx` — shell: tabs, dock / pop-out / close, connection + resume-mode notices, stale-build banner (`store.stale`).
- `link.ts` — panel side of the protocol: `MessagePort` (docked) or `BroadcastChannel` (`#<session>`); requests resolve by `r`, reject on `error.request` or after `REQUEST_TIMEOUT` (late responses dropped). `onConnect(welcome)` gets the agent's `v`.
- `store.ts` — panel signals + actions talking to the agent. `stale`: welcome `v` ≠ `VERSION` (panel stops) or `./__build` hash ≠ baked `__RIVET_DEVTOOLS_BUILD__`. Tree view state: `keyed(source)` (O(1) per selection change; `isSelected`), `countOf(id)` (per-id count signals, no Map copy per `dom.update`), `perfReasons` (id → reasons index), `collapsed` / `treeFilter` / `flattenTree` / `treeRows`, `windowRange` (`ROW` 20 px, `WINDOW` 500, `OVERSCAN` 20).
- `components.tsx` — Components tab (flat keyed tree list: collapse toggles, name filter, windowed past 500 rows; picker, owner details, why-updated, overrides). Tree rows have a fixed height (`.tree-rows .row`, 20 px) — windowing math depends on it.
- `signals.tsx` — Signals tab (search, deps up / observers down).
- `contexts.tsx` — Contexts tab (providers, consumers, in-place signal edits).
- `framework.tsx` — Router / i18n / Forms panes.
- `perf.tsx` — Performance tab (component table: Self = default sort, Total = inclusive).
- `logs.tsx` — Updates, HMR, Errors (a11y entries: rule badge, element, component link, hover → `error.highlight`).
- `main.tsx` also shows the **N dropped** badge (`dropped` events, store `dropped`).
- `parts.tsx` — shared views: node names, value trees + edits, source links, signal rows.
- `icon.tsx` — `Icon` (lucide icon node → SVG element via lucide `createElement`).
- `styles.css` — all panel styles.

## Rules / invariants

- Icons: never invent SVG paths, never UTF symbols (`×` `▾` `▸` `⚠` …) as icons — `<Icon icon={X} />` from `./icon.tsx` with lucide imports. Icon-only buttons need `aria-label`.
- Wire types only from `../protocol.ts`; never import agent code (different realm).
- After edits: `node libs/devtools/build.ts` before running e2e tests.

## See also

- [../CLAUDE.md](../CLAUDE.md) · [docs/guides/devtools.md](../../../docs/guides/devtools.md) "Panels"
