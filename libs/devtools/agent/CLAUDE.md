# @rivetjs/devtools/agent

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

In-page agent: installs the devtools hook before app modules run, keeps the page model, draws the overlay, serves the panel (docked iframe over `MessageChannel`, pop-out over `BroadcastChannel("rivet-devtools:<session>")`).

## Entry point

- `index.ts` — `start()` (idempotent per page; called on import): hook install, session (`session.ts`), transport (pop-out channel opened once the claim settled; console warning when a panel's hello `v` ≠ `VERSION`), request handling, Vite hot events, error capture (window errors / rejections, hook `a11y` + `error.island` = RV2149 framework-island hydration recovery from `@rivetjs/bridge/adapter` `islandRecovered`, listed with the island root as element), `rivet:devtools-inspect` dispatch for resumed pages.

## Layout

- `hook.ts` — `createHook(level, now, edit)`: event sink for dev façades; forwards to `hook.on` (level 0: rare events only — hot, error, hmr, resume, route); retains nothing.
- `session.ts` — `claimSession({ stored, save, listen })`: tab session from sessionStorage, claimed on `BroadcastChannel(CLAIMS)`; a holder answers a newcomer's claim with `taken` → the newcomer (duplicated tab / `window.open` copy) regenerates; `listen(id)` after `CLAIM_WAIT` (100 ms), again on a late collision.
- `requests.ts` — `dispatch(handlers, message, respond, failed)`: one panel request → response of the same `r`, or `error.request` (handler threw / unknown type).
- `model.ts` — ids (weak), mount roots, components, signal / node metadata, owner-graph queries (`_debug` walks), update counts, context provider/consumer maps. Causes: pending writes filtered by the run's upstream signals; cleared in a microtask after the writing task, or one MessageChannel task later after `event.defer` (reactivity dev `_dispatch` emits it for trusted mouse clicks, whose flush may run one task later). Self time: nested `node.run` ms subtracted from the outer run (`hook.current` at report time = outer).
- `preview.ts` — depth-1 value previews, lazy `inspect` via handles (LRU). `brandOf` (internal-slot brand checks via intrinsic getters, cross-realm; Promise: `instanceof` or `Symbol.toStringTag` data property; Error: `Error.isError`) and `isPlain` (`Object.prototype` of any realm) — never `instanceof` for built-ins. `jsonSafe` refuses sparse arrays.
- `edit.ts` — `value.edit`: typed leaf sets, paths through object/array/Map/Set, container add/remove; copies copyable containers (kinds from `brandOf` / `isPlain`, so other realms' too), mutates class instances in place.
- `source.ts` — V8 / SpiderMonkey stack parsing, framework-frame skip, inline source-map (VLQ) lookup; maps cached per module with `?t=` stripped (refetch on a newer stamp), `MAX_MAPS` 50 LRU; cross-origin frames never fetched.
- `overlay.ts` — shadow-root host: dock button, drawer + iframe, highlight box, update flashes, picker; `describeElement` (`<tag id class>`, a11y entries). `rectOf` spans: both ends inclusive (v1 comment markers have no box; DOM v2 `spanOf` = the output's first / last node); `model.ts` `componentAt` likewise (same start → narrower end wins: a v2 component returning its child's node).
- `perf.ts` — Performance tab bookkeeping: CLS, long frames, interactions, frequent runs, chunk loads; fed by observers / `reflow.ts` / model (fakes in tests).
- `reflow.ts` — forced-reflow prototype patch (off by default; enabled from Performance tab); `domSpecs` = browser targets.
- `libs.ts` — router / i18n / forms panes via those libraries' dev describers + `<base>__rivet/i18n.json`; never imports the libraries.

## Rules / invariants

- Never import app or framework runtime code; read only via hook events and `_debug` views.
- Never throw into the page; report as `agent` errors.
- Never invoke user getters in previews; hold page objects only as long as the page does.
- Overlay: no inline `<style>`, no HTML parsing (CSP / Trusted Types).
- Wire shapes live in `../protocol.ts` — update panel (`../ui/`) in the same change.

## Gotchas

- Overrides need `hook.edit` set before app code (agent does it); recording hooks in tests leave façades transparent.
- `source.ts` `FRAMEWORK` regex and `perf.ts` `OWN` regex match the path `/devtools/agent/` — renaming this folder breaks framework-frame skipping.
- Only `import type` from `@rivetjs/reactivity/debug`; no runtime imports from framework packages.
- Reflow detection misses code that cached DOM prototype methods before the patch.
- Tests: `../tests/{hook,model,preview,source,edit,context,causes,perf,requests,session}.test.ts` drive these modules in Node with fakes.
- `hook.stacks` is set on first panel connect and never reset on close (30-frame `Error` per created primitive after that) — reset-on-close is a pending user decision (review C16).

## See also

- [../CLAUDE.md](../CLAUDE.md) · [docs/guides/devtools.md](../../../docs/guides/devtools.md) "How it works"
