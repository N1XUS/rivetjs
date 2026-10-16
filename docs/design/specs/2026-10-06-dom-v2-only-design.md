# DOM v2 as the only DOM target (delete v1)

Date: 2026-10-06. Status: **phase e landed 2026-10-07 (lane V2-DEL): DOM v1 deleted** — compiler v1 lowering + `domV2` option gone (`report_dom` / `check_dom` keep the diagnostics; RV9001 net), runtime v1 core (`template` / `component` / `bind*` / ranges / `_interop` / v1 adoption) gone, structural components on DOM values (`Output` for Async / Suspense / ErrorBoundary), `RIVET_TEST_DOM` / `compiler-parity-dom` retired (row regressions kept as `libs/compiler/tests/dom-rows.test.ts`). Earlier: phases a–d landed (V2-I18N, V2-DEV, V2-RESUME 2026-10-07). Q4 resolved 2026-10-07 (lane V2-Q4): bind-once handlers + RV1016 error (`compile/handlers.rs`). Open: unified event dispatcher (R3). Originally proposed by lane V2SPEC. Decision (user, 2026-10-06): DOM v2 becomes the only DOM compile target; v1 lowering + runtime paths are deleted.

## 0. Where we are (measured)

- v2 runs only when `v2_active()` (`libs/compiler/rust/src/compile/dom_v2.rs:180-182`: `dom_v2 && !server && resumed.is_none() && !dev && !i18n`) and, per native tree, `v2_supported()` (`dom_v2.rs:185-275`); else `lower_dom` (`compile.rs:2762`).
- Who passes `domV2: true`: `vite.ts:373` (`!serve && !server`), `images/plugin.ts:66`, `rust/src/lib.rs:298` (`check`), `scripts/zero-cost/{dev-leaks,packages-hashes}.mjs`, `apps/dom-bench/build.ts:56`. Default `false`: `lib.rs:153`, `compileSymbolModule` forces `false` (`index.ts:232`), `libs/testing/vite.ts:44` (`rivetTest()`), `libs/runtime/testing-register.ts` (register hook), dev server (`serve`).
- **Real apps are ~all v1 today.** Resume mode wins: `vite.ts:319` `isResumable` = listed modules + every source-package (`@rivetjs/cdk`) module; router apps resume every route module by default (`libs/router/build/vite.ts`). landing (all components listed), playground, docs, cdk-docs, `templates/starter-static` → client chunks are v1 + v1 symbol chunks. v2 only reaches non-resumable client modules (dom-bench, krausest, CSR templates). Client-side navigation in router apps also renders v1 (route modules compile in resume mode).
- Per-tree fallbacks if resume were off (compile with `domV2: true`, no resume; v1 tree = `__rivetSpecN` in output; scratch script `SCRATCH/v2spec/measure.ts`; reason heuristics on spec HTML + setup ABI calls):

| Group | modules / with JSX | v2 templates | v1 trees (modules) | reasons (trees) |
|---|---|---|---|---|
| libs/cdk | 193 / 116 | 381 | 14 (6) | `<template>` 8 (viewport, drag-placeholder, drag-preview), hidden-select inserted options 3, `prop:` 1 (checkbox), dynamic textarea 1 (text-area), `window:` event 1 (viewport) |
| apps/landing | 45 / 35 | 56 | 2 (1) | `SelectField` select with inserted options |
| apps/playground | 13 / 11 | 20 | 4 (3) | `model:` 2, `r:slot` 1, slot fallback 1 |
| router/forms/kit/i18n | 4 / 4 | 17 | 1 (1) | `kit/icon.tsx` SVG `<title>{…}</title>` |
| docs-kit + docs + cdk-docs (+examples) | 1014 / 976 | 9144 | 17 (12) | `model:` 7, inserted options 3, dynamic textarea 2, `r:slot` 1 |
| benches + templates | 29 / 16 | 28 | 3 (3) | `model:` 1 (resume-bench rivet lane), `<title>` 2 (qwik lanes, not ours) |

  - Fallback is rare per tree (≈0.4%), but in resume mode it is 100%. The work is resume + dev + tests, not lowering.
- Runtime bytes (esbuild bundle + brotli 11, approximation; real numbers via `npm run size-report`): v2 ABI + `_for`/`_show` + `mount` 17.4 kB min / 6.4 kB br; + `Suspense`/`Async`/`ErrorBoundary`/`lazyComponent`/`Portal`/`Dynamic` 31.1 / 10.9 (pulls the v1 range core: `rivet:start` boundaries, `wrap`, `template`); v1 ABI set 26.6 / 9.1; `createResume` alone 30.2 / 11.1 (pulls v1 core via `bindChild`/`bindAttribute`/`bindModel`/`_adopt*`).
- Compiled module code (sum of per-module esbuild-minified output, not bundled, import aliases unminified): cdk v1 713 kB / 153.5 kB br, v2 661 / 154.6, resume-mode v1 742 / 160.1; landing v1 86.1 / 18.3, v2 78.3 / 18.9; playground 15.1 / 3.8 vs 13.6 / 4.0. → code bytes ≈ neutral (−7..−11% min, +1..+5% br before bundle renaming); the byte win is runtime, the speed win is creation (below).
- dom-bench (plan `docs/design/plans/2026-10-05-beat-everyone.md`): v1→v2 mount 5k 437→78 ms, update100 5k 44→20 ms, heap 82→27 MiB, nodes 890k→450k. Resume scoreboard LOSE: slow click 4.50 ms, slow filter 12.6 ms (Solid 3.8 / 11.2) — filter re-creates a v1 row region.

## 1. Inventory

### 1.1 v1-only lowering (compiler) — v2 gate → v1 impl → plan

| Feature | v2 bails at | v1 impl | v1 runtime ABI (`dom.ts`) | v2 plan |
|---|---|---|---|---|
| `select value=` / `defaultValue`, select with inserted options/optgroups, `option` outside literal select | `dom_v2.rs:194-196`, `static_control` 278-313 | `compile.rs:2853-2866` (deferred), 2924-2934 | `bindSelectValue` 1242, `_selectValue` 1237 | `_selectValue(el, read, model?)` in new `dom-v2-controls.ts`; deferred after children (statement order already post-children in `walk_v2`); options via `_insert` |
| dynamic `textarea` / leading-newline textarea / `title` (HTML RCDATA) | 188, 194, `static_control` | 2977-3006, `rcdata_parts` 2730 | `bindRCData` 1012 | `_rcdata(el, parts)`: Text node per part + `value` sync for textarea; diag "children must be scalar" moves to v2 |
| SVG `<title>` (kit `Icon`) | 188 (`title` always) | walk_dom | template | in SVG namespace `title` is a normal element → plain v2 lowering |
| `model:value` / `model:checked` | 214 | 2923-2934, `validate_model` 1870 | `bindModel` 1281 | `_model(el, kind, signal)` (IME composition, type checks) in `dom-v2-controls.ts`; select → `_selectValue(el, s, s)` |
| `prop:x` | 214 | 2913-2922, `prop_literal_ok` 1907 | `bindProp` 1233, `_setProp` 1216 | `_prop(el, name, v)` = `_setProp`; dynamic → `_fx` |
| `r:slot` attribute | 214 | `slot_attr` 1365 | — (slots.rs lowering) | lower `slot_attr` output as a v2 child value; `<slot>` element (`lower_slot` 1373) already value-level |
| global events `window:on*` / `document:on*` | 214 | 2878-2887 | `clientEvent` 1844 | emit `clientEvent(host, type, fn)` from v2 (public API, stays) |
| `<template>` | 188 | walk_dom | template | static `<template>` (no dynamic descendants) → template HTML; dynamic inside → diagnostic (round-2 C14, server-only today) |
| `<script>` / `<style>` | 188 | diag 2803 | — | diag owned by v2 |
| `math` / MathML tags | 188-190 | walk_dom ns `mathml` | template ctx | `_tpl` flag 2 already exists (`dom-v2.ts:37`); add MathML walk namespace |
| `foreignObject` | 188 | walk_dom | template | SVG template, children walk `html` (already coded at `dom_v2.rs:735`) |
| `tr` directly in `table`, text in table structure | 247-255 | 3014 diag | wrappers in `parsed` 470-478 | `tr` in `table`: insert implied `tbody` in template HTML (parser does) + walk through it; text → diag |
| parser-repaired nesting | **old rule** 200-204 (`form` in form, `p` > div/section/p/table/ul/ol/h1-3, table in table) | `html::parser_repaired` 2817 (C6) | — | call `html::parser_repaired` from `v2_supported`/`walk_v2` and diag (see bug B2) |
| literal handlers `onClick="x"` | 223 | 2874 diag (C14) | — | diag owned by v2 |
| unknown events, unsafe attr names, bad literal attr values | 223, 229-236 | 2880-2961 diags | — | diags owned by v2 (today v2 bails so v1 reports) |
| spread children `{...xs}` | 244 | diag 3036 | — | diag owned by v2 (`fragment_v2` already diags) |
| i18n `t()` in children / attributes | `v2_active` (`!i18n`) | `static_child_dom` 3679, `dom_message` 3710, `dom_child` 3702, `static_attribute` 3887 (`AttrSink::Dom`) | `bindChild` | v2 twins writing into `Build` (static text → template, params → `_insert`); §2.5 — **done** (V2-I18N, 2026-10-07: `compile/dom_v2_i18n.rs`) |
| dev compile | `v2_active` (`!dev`) | — (`dev` only adds i18n missing-key warning, `compile.rs:3538`) | — | drop gate; §2.4 |
| resume compile | `v2_active` (`resumed.is_none()`) | whole module v1 | `template`, `bindChild`, `component` | §2.3 |

- Component calls: v1 `component(C, () => props)` (`compile.rs:1648-1651`, `dom.ts:585`) vs v2 `_c`/`_cp` (`dom_v2.rs:785-841`). Structural: v2 `_for`, `_show`/`_switch`/`_match` twins; `Suspense`/`Async`/`ErrorBoundary`/`Portal`/`Dynamic`/`Provider`/`Island`/`Router`/`lazyComponent`/`clientOnly` still v1 components (`dom.ts:589-1780`, `dom-suspense.ts`, `dom-router.ts:2`).
- Fragments: v2 `fragment_v2` (`dom_v2.rs:755`) vs v1 `child_expressions` (`compile.rs:1710`); dispatch `compile.rs:1454`.
- Dispatch points in `compile.rs` (off-limits file): 1454 (fragment), 1646-1647 (component), 1655-1659 (native tree), import emission 903-935 (v1 ABI imported wholesale), ABI list 47-50.

### 1.2 v1 runtime ABI (compiler contract) and hand-written users

- `compile.rs:47` `ABI` DOM names: `component`, `bindRCData`, `bindChild`, `bindText`, `bindAttribute`, `bindEvent`, `bindModel`, `bindRef`, `clientEvent`, `spreadAttributes`, `bindSelectValue`, `bindProp` (+ `template` via `template_name`); `omitted`/`spreadChildren`/`_refValue` are server-only. `compile.rs:51` `RESUME_ABI` (`_r*`) is server-only (`server-resume.ts`) — unaffected.
- `resume.rs` symbol imports from `@rivetjs/runtime/dom`: `spreadAttributes` (resumed spread, `resume.rs:1962`), `bindAttribute` (`dom_helpers`, 1968), `_setProp` / `_resumeSelect` (element sites 629/637/1975), `_slot` (1965); `_bindClass`/`_bindStyle` from `style.ts` (738/751, target-neutral).
- `dom.ts` exports (v1 core): `template` 557, `component` 585, `Provider` 589, `Async` 613, `ErrorBoundary` 780, `lazyComponent` 806, `clientOnly` 840, `bindChild` 858, `bindText` 971, `bindRCData` 1012, `bindAttribute` 1067, `spreadAttributes` 1123, `bindEvent` 1185, `bindProp` 1233, `bindSelectValue` 1242, `bindModel` 1281, `For` 1393, `Show` 1683, `Match` 1702, `Switch` 1708, `Dynamic` 1746, `Portal` 1775, `bindRef` 1816; internals `_ranges` 117, `_interop` 123 (v1⇄v2 bridge), `_dom` 605, `_adopt` 1365, `_adoptBranch` 1544, `_serverBranch` 1564, `_adoptState` 1569, `_withNode` 1882, `_keepLive` 1066, `_resumeSelect` 1271; v2 re-export 1786-1808.
- Hand-written v1 users: `image-dom.ts:1,20,23` (`template(spec)` for `Picture`/`ImagePreload`), `dom-suspense.ts:5` (`_dom`, `_ranges`), `dom-router.ts:2,5` (`Async`, `DOMRange`), `hot.ts:13,57-81` (`_ranges`), `dom-resume.ts:7` (+ uses 260, 309, 312, 326, 413, 624, 722), `dev/dom.ts` (wraps `component` 168, `mount` 268, `bindChild` 299, `bindText` 307, `bindAttribute` 313, `spreadAttributes` 343, `bindRCData` 381; `_ranges` 52/193/214), `testing.ts:4` (`mount` only — fine).

### 1.3 Resume dependencies (client)

- Resumed DOM module = creation code only (region re-creation imports its locals; client navigation renders it). Symbols (`compileSymbolModule`) = v1 (`index.ts:232`). Server output unchanged by this project.
- `dom-resume.ts` activation (`activate` 243-350): text sites → own `bindText` 399 (upgrades to v1 `bindChild` on non-primitive, 413); regions `#` → `bindChild(range, read)` between server markers (309/312) under `_withNode(range.start)` (v1 construction context: doc/namespace); rows → `_adopt(rows, …)` consumed by the first v1 `For` (`dom.ts:1365`, `For` 1393 reads `adopting`); branches → `_adoptBranch` + `_serverBranch` checked against v1 `construction` identity (1544-1567); region locals → `_adoptState` (1569, also `construction`-keyed); attrs → `bindAttribute(target, name, read, 1)` (326; `resumed` flag + `_keepLive` form-state guard 582); model → `bindModel` (624); `clientEvent` (722); spreads → symbol calls v1 `spreadAttributes` with the server-rendered baseline.
- Events: loader (`resume-loader.ts:276`) listens at document capture and replays cold events; v1 re-created nodes use direct listeners; v2 re-created nodes would use document-bubble delegation (`dom-v2.ts:184-215`) — mixed-tree order / `stopPropagation` semantics untested (risk R3).

### 1.4 Dev, HMR, devtools, tests, i18n

- Dev façade `runtime/dev/dom.ts` (development condition) wraps only v1: component owners + `comp.mount { owner, fn, span }` (168-222), binding re-run reports, props-snapshot warning (`snapshot` via `_trackReads`), value guards naming the component (`guard`, `locate`), a11y start. v2 ABI passes through unwrapped → in a v2 dev build the devtools tree, update flashes and component-named errors disappear.
- `hot.ts` (dev HMR): wrapper renders impl in a region; detaches DOM ranges received through props via `_ranges` (57-81).
- devtools agent (`libs/devtools/agent/model.ts:44-45,296-303,449,966-975`): component spans `{start,end}` nodes from `comp.mount`; works with any node pair.
- Tests: all `.tsx` in vitest compile v1 (`rivetTest()` `libs/testing/vite.ts:44`, register hook `testing-register.ts`). 54 cdk `*.test.tsx` + most cdk `.test.ts` import `.tsx` components; 52 test files (26 in cdk) assert v1 shape (`rivet:s…` / `<!--rivet` markers). 16 test files already compile with `domV2: true` explicitly.
- i18n: `staticCalls` → `static_setup` sets `self.i18n` (`compile.rs:3070`) → whole module v1. 2 docs example modules use `t()` today.
- Oracle corpus (`libs/compiler/oracle/corpus.jsonl`): 56 dom v1 + 26 dom+resume + 3 dom+v2 + 40 default-target cases → ≥82 re-records at the flip.

### 1.5 Library code relying on v1 behaviour

- cdk trees falling back (above): `scrolling/viewport.tsx` (`<template>` anchors, `window:` event), `drag-drop/drag-{placeholder,preview}.tsx` (`<template>` + `template()` render fn), `select/hidden-select.tsx` (inserted options), `checkbox/index.tsx` (`prop:indeterminate`), `text-area/index.tsx` (dynamic textarea). kit `icon.tsx` (SVG title). landing `SelectField.tsx`. docs-kit `search/dialog.tsx` (`model:`).
- Owner-per-component assumptions (v1 `component` = own root; v2 `_c` = parent scope): `getOwner()`-guarded cleanups in cdk `disclosure/index.tsx:199,223`, `state/toast.ts:75`, `data/async-list.tsx:327`, `portal/portal-outlet.ts:84,194-215` (`runWithOwner(owner, mount)`); forms dev hooks `forms/dev.ts:93`, `autosave-dev.ts:42` (attribute forms to the component owner — needs dev `_c` owners). Already the prod behaviour for non-resumed builds; untested because tests run v1.
- `portal-outlet.ts:196-198` collects `rootNodes` skipping comments (v1 boundaries) — fine on v2 (fewer comments).

### 1.6 Known v1 ↔ v2 parity differences

| Id | Difference | State |
|---|---|---|
| C1 | boolean attrs `0`/`""`/`NaN` | fixed both sides (runtime `write` `dom-v2.ts:113-140`, literal fold `dom_v2.rs:585`; `tests/dom-v2-parity.test.ts`) |
| C15a | `_for` duplicate key vs kept prefix/suffix | fixed (`dom-v2.ts` `_for`) |
| C15b | `class` + `className` on one element: server keeps first, v2 applies last (`_cls` after template class) | open → compiler diagnostic (all targets) |
| P1 | **event handler expression**: v1 `bindEvent(el, t, () => expr)` re-selects the handler reactively (`onClick={s() ? a : b}` switches); v2 `_on`/`_listen` evaluate once | **done** (V2-Q4, 2026-10-07): bind-once (Solid), RV1016 **error** for a call (`getHandler()`, not `f.bind(…)`) or a `?:` / `&&` / `\|\|` / `??` evaluating a call; member reads / identifiers / call-free conditionals not warned; language-core quick fix `(event) => (…)?.(event)`; `events.test.ts`, `apps/docs` events guide "Handlers bind once" |
| B1 | **bug**: v2 `_listen(el, type, undefined)` (`onFocus={props.onFocus}` with the prop unset; non-delegated types) registers a listener that throws `Cannot read properties of undefined (reading 'call')` on every event (`dom-v2.ts:217-222`; reproduced with happy-dom). v1 skips null handlers | **done** (V2A, 2026-10-06): unset → nothing bound, non-function → `TypeError` at bind time; `tests/dom-v2.test.ts`, `libs/compiler/tests/dom-v2-namespace.test.ts` |
| B2 | **bug**: v2 uses the old parser-repair rule (`dom_v2.rs:200-204`): `<p><nav>`, `<ul><li><li>`, `<a><a>` lower through v2 with no diagnostic (template content silently truncated / walk hits `null`); `<p><button><div>`, `<table>` inside `<td>` needlessly fall back. Only the server compile (`compile.rs:2235`) catches the first group, so CSR builds ship it | fix now (call `html::parser_repaired`) |
| B3 | JSX in an expression child of `<svg>` (`<svg>{x && <a href/>}</svg>`, `<title>`, `<style>`) lowers as an HTML root in v2 (`lower_dom_v2` starts at `"html"`); today masked because those trees fall back to v1, whose inherited construction context parses them as SVG | **done** (V2A, 2026-10-06): lexical namespace + `_tplNs` for ambiguous roots, §2.1; `libs/compiler/tests/dom-v2-namespace.test.ts` |
| P2 | components: v1 own owner + 2 comments + fragment; v2 none (`onCleanup` → nearest scope, `getOwner()` identity differs, no devtools node) | accepted contract (Q5) |
| P3 | imperative edits of compiled DOM untracked in v2 (Solid contract) | accepted contract (Q6) |
| P4 | delegated events: handler order vs native `addEventListener` on ancestors (native ancestor runs before a delegated descendant), `currentTarget` emulated, `disabled` skip, real `stopPropagation` | document; parity test |
| P5 | spreads: v2 one effect per element, whole-object re-diff; v1 `spreadAttributes` key diff (same result; tested `dom-v2-spread.test.ts`) | ok |
| P6 | static expressions written once in v2 (identifiers get a runtime `typeof` accessor check); v1 binds every expression as an effect — same observable result for non-signal values | ok |
| P7 | DOM shape: v1 `<!--rivet:sN-->` ranges and template boundaries; v2 `<!>` markers only before later static siblings | tests rewrite (Q9) |

## 2. Target architecture

### 2.1 Compiler: one DOM lowering

- `v2_active()` → `!self.server` (all DOM compiles, incl. resume / dev / i18n); `v2_supported()` becomes a validator that reports diagnostics (no fallback). After phase e: `lower_dom`, `walk_dom`, `DomTemplate`, `dom_class`/`dom_style`/`dom_child`/`dom_message`/`static_child_dom`/`AttrSink::Dom`, v1 `ABI` DOM names and the `domV2` option are gone.
- New modules (keep `dom_v2.rs` < ~1k lines): `compile/dom_v2_controls.rs` (select/option/textarea/title/model/prop), `compile/dom_v2_check.rs` (diagnostics ported from `walk_dom`, `html::parser_repaired`), `compile/dom_v2_i18n.rs`. Rust child modules see `compile.rs` private items (`use super::*`), so no `compile.rs` edits until phase e.
- Lexical namespace (B3): `walk_v2` passes the current namespace to `self.lower()` of expression/component children; roots in `"svg"` get `_tpl` flag 1, `"mathml"` flag 2. Roots whose tag exists in both HTML and SVG (`a`, `title`, `style`, `script`, `font`) with no lexical context get flag 8, emitted as `_tplNs(html)`: picks the parse variant from the insertion parent (`_interop.p`, set by `_insert` reads and restored by `_for` around rows) per clone; each variant parsed once per document. Own export so `_tpl` carries no namespace pick (as landed).
- Controls lower after children (deferred statements list in `Build`, like v1 `deferred`).
- `<template>`: static only; `tr` in `table`: template HTML gets the implied `<tbody>` and the walk includes it.

### 2.2 Runtime: `dom.ts` = v2

- `dom.ts` keeps: `mount`/`render` (already v2 root path), `ref`, `clientEffect`, `clientEvent`, `_slot`, `Island`, re-exports of `dom-v2.ts`; v1 `template`/`component`/`bind*`/`spreadAttributes`/ranges/`_interop`/`parsed`/`templateTargets`/`wrap`/`boundary`/`move` deleted.
- Structural components ported to v2 values (Node | Node[] | accessor) with `_rootIn` owners and two empty Text anchors (the `_for` row technique), no WeakMap spans: `Async`, `Suspense` (`dom-suspense.ts`), `ErrorBoundary`, `Provider`, `Portal`, `Dynamic`, `lazyComponent`, `clientOnly`, `Router` (`dom-router.ts`). Public names / props unchanged; the compiler keeps calling them through `_c`/`_cp` (or twins like `_show`). `For`/`Show`/`Switch`/`Match` public exports become the v2 implementations (twins renamed or aliased).
- Pay-per-use: controls in `dom-v2-controls.ts`, spreads stay in `dom-v2-spread.ts`, adoption in `dom-adopt.ts` (resume only), Suspense stays self-installing.
- `DOMRange` type → removed (or alias, Q2); `DOMValue` stays.

### 2.3 Resume on v2

- Principle (unchanged semantics): server HTML is never re-built to resume — bindings attach to server nodes (ids / comment markers); only a region re-created on its first signal change runs creation code, now v2 (`_tpl` clones). Adopted rows / branches / region state keep their server nodes and values.
- Region primitive `_region(start, end, read)` (in `dom-adopt.ts`): an `_insert` slot whose `current` is seeded with the server nodes between the markers, parent = `start.parentNode`, marker = `end`; first run replaces non-adopted nodes; reconcile keeps adopted row/branch nodes by identity (no move). Replaces `bindChild(range)` at `dom-resume.ts:309/312/413`. Namespace: v2 templates carry their own (§2.1); `_withNode` goes.
- Rows: `_for` gets an adoption hook — a module slot in `dom-adopt.ts` (`take()` consumed by the first `_for` created during the region read, like v1 `For` 1393-1396); an adopted row = its server node run (start..end markers inclusive) as a `Node[]` value with an owner root and no item signal until first read (`_for` already creates item signals lazily). Unchanged-key rows survive; others `dispose()` (= `kill(row)`).
- Branches: `_show`/`_switch` consult `dom-adopt.ts` `branch` slot; "direct" = created while `getOwner()` is the region binding's owner (replaces v1 `construction` identity; server records a branch spec only when the region root is structural, so components nesting a Show cannot steal it). `_serverBranch()` keeps its contract (`Show`-using stateful components, e.g. `<Transition>`).
- `_adoptState`: same algorithm, keyed by owner instead of `construction`.
- Attr / text / model / spread / element sites: `_attrWrite` in an effect that skips the first run when the value equals the server value and honours `_keepLive` (form state typed before boot); text sites keep `dom-resume` `bindText`, upgrading to `_region`; `model` → `_model` (+ `_selectValue` for select, replacing `_resumeSelect`); spreads → `_spread(el, read, flags, rendered)` (baseline = server attributes, same as v1 `spreadAttributes` `rendered` arg); `prop:` element sites → `_prop`.
- Symbol modules: `compileSymbolModule` compiles v2 (`index.ts:232` drops `domV2: false`). Shape:
  - `import { _tpl, _c, _insert, _fx, _cls, _show } from "@rivetjs/runtime/dom"; const T0 = _tpl("<p>big "); export const Counter$4 = (n, v) => () => _c(_show, { when: () => n() > 2, children: () => { const e = T0(); _fx(() => _cls(e, v())); _insert(e, () => n(), null); return e; } });`
  - `resume.rs` helper imports switch to v2 names (1962 `spreadAttributes` → `_spread`, 1968 `bindAttribute` → `_attrWrite`, 629/637 → `_prop`/`_selectValue`); captures / ids / `_rFn` / ref cells / lazy-children thunks unchanged (target-neutral analysis). Symbol ids must not renumber (no new sites) → resume corpus cases re-record code only.
- Events (R3): one dispatcher. dom-resume registers resumed element handlers as `$$type` (+ `$$o`) on server elements and lets the v2 document dispatcher walk; the loader's capture listener only queues cold events until the runtime is up, then replays through the same walk. Parity test: nested resumed / re-created / native-listener ancestors with `stopPropagation`, `preventDefault`, `currentTarget`.
- Not in scope: "claim" hydration of a re-created region (walk server DOM instead of cloning) — Q7.

### 2.4 Dev mode on v2

- Compiler: dev = prod lowering (`vite.ts:373` drops `!serve`; `dev` flag keeps only i18n warnings). Optional dev-only extra arg on `_c`/`_cp` (source location) — not needed for v1 parity (v1 had none).
- Façade `dev/dom.ts` wraps v2 ABI: `_c`/`_cp` → child owner per component (`_rootIn` under the current owner, disposed with it) + `comp.mount { owner, fn, props, spanOf: () => first/last node }`; `_cp` → `snapshot()` props warning; writers (`_t`, `_insert`, `_attrWrite`, `_cls`, `_spread`, `_model`, …) report binding updates (they know element + name) and run `guard()` (component-named errors); `_fx` passthrough; structural hides (`comp.hide`) for `_for`/`_show`/… Production unaffected (development condition only; zero-cost `dev leaks` gate).
- HMR `hot.ts`: wrapper returns an accessor `() => current()(props)` inserted by `_insert` (a reactive region); signal adoption by creation order unchanged (`hot-reactivity.ts`); props Nodes (eager children) are plain Nodes owned by the parent → re-inserted, no `_ranges` detach. Dev resume fallback flow (spec 2026-10-04) unchanged.
- devtools: spans from `spanOf`; overlay/picker logic (`model.ts:966-975`) works on node pairs; update flashes from writer reports.

### 2.5 i18n on v2

- `dom_v2_i18n.rs`: in `walk_v2` child classification, a static call (`static_call`) → message parts: static text appended to `Child::Text` (escaped into the template), params / plural / select / number / date parts → `Child::Value` (accessor when `dynamic`); prefix lookups → value. Attribute static calls → template attribute text when fully static, else `_attrValue`/`_fx(_attrWrite)`. Diagnostics shared with v1 helpers (`message`, `prefix_value`).
- Test: `libs/compiler/tests/i18n.test.ts` gains v2 cases; `libs/i18n` tests run DOM v2.
- Done 2026-10-07 (V2-I18N): as above plus tag markup inline in the parent template (`Child::Markup`), tagged plural / select cases and rich value positions as own `_tpl` (`case_template_v2`, called from `compile.rs` `case_template`; several nodes → node array, re-insertable), static-argument `t()` not dynamic in fragments / component props. Tests `libs/compiler/tests/i18n-v2.test.ts` (shape + v1 ⇄ v2 parity), `libs/i18n/tests/vite.test.ts` (dev transform is v2). Bench (Chromium, 1000 rows): params/plural/tags row mount 9.4 → 3.9 ms, 10 updates 15.4 → 11.6 ms, dispose 2.4 → 0.2 ms; tagged-plural row mount 7.8 → 3.4 ms, updates 61.5 → 33.5 ms; bundle 21.8 → 14.4 kB min.

### 2.6 Testing on v2

- `rivetTest()` and the register hook compile what production compiles (no option). happy-dom supports `<template>` parsing, `cloneNode`, `composedPath`; delegated events work with `@rivetjs/testing` user-event (document listeners).
- `@rivetjs/testing` gets `normalizedHTML(el)` (strips `<!---->` / `<!>` anchors) — tests assert DOM content, not marker shape. 52 marker-asserting files rewritten once.

## 3. Migration phases (each shippable alone; gates = typecheck + scoped vitest + `compiler:parity` + `scripts/zero-cost/check.sh` + `npm run size-report -- --check` unless noted)

### (a) Parity harness

- What: `libs/compiler/tests/v2-parity/` (vitest project `compiler-parity-dom`): for every oracle corpus DOM case + every repo `.tsx` (cdk, kit, router, forms, landing, playground, docs-kit, examples, templates) compile v1 and v2, mount both in happy-dom (and a browser subset under `*.browser.test.ts`), then compare `normalizedHTML` after mount, after each signal in a scripted mutation list (signals discovered by exporting module-level signals / component props fixtures), after synthetic events (click/input/keydown on every element with a handler), and owner disposal (no leaked listeners/effects via `_debug`). Skip-list with reasons; trees v2 cannot lower yet are reported, not failed.
- Also: B1 + B2 fixes + tests land here (tiny, independent).
- Files: new test dir + `libs/testing` normalize helper; `dom-v2.ts:217` guard; `dom_v2.rs:200` → `html::parser_repaired`.
- Risk: low (tests only + 2 bug fixes). B2 may surface RV1005 in CSR-only code (intended).
- Perf: none (B2 fix may move a few trees from v1 to v2: false positives).
- Gate extra: harness green on all trees v2 lowers today; diff list for the rest is the phase (b) worklist.

### (b) Close lowering gaps

- What: §1.1 rows: controls (`dom_v2_controls.rs` + `dom-v2-controls.ts`), `prop:`, `model:`, `r:slot`, global events, static `<template>`, SVG `title`, MathML, `foreignObject`, `tr` in table, lexical namespace + flag 8 (B3), diagnostics owned by v2 (`dom_v2_check.rs`), C15b diagnostic. P1 per Q4.
- Measure: fallback count per reason (script of §0) → 0 for non-resume; cdk checkbox/text-area/select/viewport, landing SelectField in production v2.
- Files: `compile/dom_v2.rs`, new `compile/dom_v2_{controls,check}.rs`, `runtime/dom-v2.ts` (flag 8, `_listen`), new `runtime/dom-v2-controls.ts`, compiler tests `dom-v2-*.test.ts`, runtime tests `dom-v2-controls*.test.ts` (incl. browser IME/select tests ported from v1 `bindModel`/`bindSelectValue` suites).
- Risk: medium (form controls, IME, select multiple, MutationObserver option re-apply).
- Perf: dom-bench unaffected; size-report: v2 apps using controls pay `dom-v2-controls.ts` only; expect controls module < v1 equivalents (no `captureContext`).
- Corpus: only `dom+v2` cases may change (3); oracle otherwise identical.

### (c) Dev, tests, i18n on v2

- What: `v2_active` drops `!dev` and `!i18n`; `vite.ts:373` drops `!serve`; `rivetTest()` / register compile `domV2: true`; dev façade wraps v2 (§2.4); `hot.ts` on v2; i18n twins (§2.5); test suites migrate to `normalizedHTML`. Resumed modules still v1 here.
- Files: `compile/dom_v2.rs` (gate), `compile/dom_v2_i18n.rs`, `libs/compiler/vite.ts`, `libs/testing/vite.ts`, `runtime/testing-register.ts`, `runtime/dev/dom.ts`, `runtime/hot.ts`, devtools tests, every marker-asserting test file.
- Risk: high in volume (all cdk suites now exercise v2: owner/cleanup timing P2, delegated events P4, P1). Gate: full `nx run-many -t test`, browser projects, devtools tests, `tests/dev-facade.test.ts` (export set), dev resume e2e.
- Perf: dev server parity only; test runtime should drop (v2 mount ~5×) — record full test wall time before/after.
- Done 2026-10-07 (V2-DEV, minus i18n twins): façade `dev/dom.ts` wraps `_c` / `_cp` (dev-only owner per component, `spanOf`), writers, `_spread`; devtools agent reads spans inclusively; `hot.ts` unchanged (its accessor wrapper already re-renders inside the v2 `_insert`; `tests/hot-v2.test.ts`); `vite.ts` / `images/plugin.ts` drop `!serve`; test hooks default v2.
- Expected: real bugs in cdk under v2 (they ship to CSR users today) — budget for fixes.

### (d) Resume on v2 (largest)

- d1 runtime: `dom-adopt.ts` (`_region`, row/branch/state slots), `_for`/`_show`/`_switch` adoption hooks, `_model`/`_selectValue`/`_prop`/`_spread(rendered)` resume entry points, unified event dispatch (§2.3), `dom-resume.ts` switched off v1 imports.
- d2 compiler: `v2_active` drops `resumed.is_none()`; `compileSymbolModule` v2; `resume.rs` helper import names; corpus `dom+resume` 26 cases re-recorded (code only, symbol ids identical — assert).
- Files: `runtime/dom-resume.ts`, new `runtime/dom-adopt.ts`, `runtime/dom-v2.ts` (hook calls only), `runtime/dom-v2-spread.ts`, `compile/dom_v2.rs` (gate), `resume.rs` (imports), `libs/compiler/index.ts`, resume tests (31 `resume-*.test.ts` + `tests/resume/harness.ts`), router e2e, `apps/resume-bench`.
- Risk: highest — adoption identity (rows/branches), focus keep (`dom-resume.ts` keep-by-id), form state `_keepLive`, cold-event replay order, providers re-provided around re-creation, islands/lazy chunks, dev resume HMR fallback.
- Tests: all resume suites on v2; new mixed-tree event-order browser test; drift diagnostics (`DEV.hint` "drift") still fire; adopted-row identity assertions (`resume-adoption-ranges.test.ts`, `resume-keys-browser.test.ts`).
- Perf (bench lock): `node apps/resume-bench/run.ts --build --lanes rivet,solid-stable --conditions slow --repeats 10` (click, filter, hoverClick, navigate, scrollClick); real resumed playground interaction (counter click, list filter, `resume-demo.tsx` model input) with a Playwright trace; landing first interaction. Expected: filter 12.6 → ~9–11 ms (re-created rows on v2 mount path), click 4.5 → ~4.0 ms (smaller resume chunk: no v1 core, est. −2..−3 kB br on `createResume`), navigate unchanged-to-better (client navigation renders v2). Must beat Solid 3.8 / 11.2 to flip the scoreboard rows.
- Landed (2026-10-07, V2-RESUME):
  - Runtime: `dom-adopt.ts` `_region(start, end, read, rows, branch, state)` = seeded `_insert` (seed re-collected after the first read: reads can move server nodes, e.g. cdk Tree / Table); `dom-v2.ts` `_adoption` hooks (`_for` adopts rows, re-creates on item change / index change when the server row read its index; `branches()` starts from the adopted branch); `_regionState` + `_serverBranch` keyed by owner ("direct" = only provide / catchError owners between); `_spread(el, value, flags, rendered)` resumed baseline + keep-live + `_takeover`; `_resumeSelect` moved to `dom-v2-controls.ts`.
  - Compiler: `v2_active = dom_v2 && !server`; `_compileSymbolModule` defaults `domV2: true`; `resume.rs` spread → `_spread(el, read, flags, names)`, styled attr → `_attrValue`; resumed tail no longer re-exports package imports (`For`); 13 corpus cases re-recorded (code only, symbol ids identical).
  - Not done: unified event dispatcher (R3, loader capture walk unchanged; event order = v1); v1 adoption internals (`_adopt`, `_adoptBranch`, `_adoptState`, `_withNode`, `_keepLive`, v1 `_takeover`, `spreadAttributes` rendered path) dead until phase e.
  - Measured resume-bench rivet slow (paint p50 ms, before → after): click 32.2 → 32.8, keyClick 13.9 → 9.0, tapClick 31.4 → 31.3, filter 72.4 → 73.1 (20 repeats; range 54–104), navigate ~68–72 → 65.1. Same-session A/B (clean archives 040312bf vs 26e8b81d, alternated, slow): click 33.0 / 32.3 vs 33.0 / 31.7, keyClick 8.5 / 10.7 vs 8.0 / 8.9 (20 repeats; ranges overlap) — no change; the keyClick gain vs the brief baseline was cross-session drift. Size: resume pages +0.6–1.0 kB br (playground +4.3 kB br, incl. user WIP layout) while v1 and v2 DOM both ship — phase e removes v1.

### (e) Flip default, delete v1

- What: remove `domV2` plumbing (option accepted + ignored or error, Q3); delete `lower_dom`/`walk_dom`/`DomTemplate`/v1 helpers and v1 DOM ABI names in `compile.rs` (needs authorization, Q1); delete v1 runtime (`dom.ts` v1 core, `_interop`, `_ranges` users), port structural components (§2.2), `image-dom.ts` on `_tpl`; update every CLAUDE.md (compiler, compiler/rust, runtime, runtime/dev, testing, devtools, root Gotchas line on DOM v2), `docs/guides/resumability.md`, `docs/guides/testing.md`, `docs/guides/vite-integration.md`.
- Files: `compile.rs` (1454, 1646-1651, 1655-1659, 903-935, 47-50, 491-?, 2148-2215, 2730-3060, 3679-3760, 3887-…), `lib.rs`, `index.ts`, `vite.ts`, `images/plugin.ts`, `runtime/dom.ts`, `dom-suspense.ts`, `dom-router.ts`, `image-dom.ts`, `dev/dom.ts`, scripts using `domV2`, `apps/dom-bench/build.ts` override.
- Risk: medium (mechanical, but public export surface — Q2). Corpus: all remaining DOM cases re-recorded (≥56 + default-target DOM ones); zero-cost `--update` with stated intended delta.
- Expected: `dom.ts` ~1.9k → ~0.5k lines; compiler wasm smaller (v1 walk ~1.2k Rust lines); runtime: router/Suspense apps −2..−3 kB br (v1 range core gone; esbuild approx §0).

### (f) Verification

- zero-cost (runtime + lanes + dev leaks + corpus), size-report (runtime/router/kit/compiler), dom-bench + krausest (no regression; krausest already v2), resume-bench (above), ssr-bench lanes (server untouched — hashes identical), docs + cdk-docs builds, templates build, playground + landing real interaction (Playwright), devtools e2e, scoreboard regenerate.

## 4. Lanes (parallel; one owner per file)

| Lane | Phases | Owns | Must not touch |
|---|---|---|---|
| V2-HARNESS | a | `libs/compiler/tests/v2-parity/**`, `libs/testing` normalize helper, vitest project entry | compiler/runtime sources |
| V2-CMP | a (B2), b, c (gate) | `compile/dom_v2.rs`, new `compile/dom_v2_{controls,check}.rs`, `html.rs` (read-only use), compiler `dom-v2-*` tests, wasm build lock | `compile.rs`, `resume.rs` |
| V2-I18N | c | new `compile/dom_v2_i18n.rs`, `libs/compiler/tests/i18n*.test.ts`, `libs/i18n/tests` | `dom_v2.rs` (asks V2-CMP for the 2 call sites) |
| V2-RT | a (B1), b, e (structural ports) | `runtime/dom-v2.ts`, `dom-v2-spread.ts`, new `dom-v2-controls.ts`, `dom-suspense.ts`, `dom-router.ts`, `image-dom.ts`, `dom.ts` | `dom-resume.ts`, `dev/**` |
| V2-RESUME | d | `runtime/dom-resume.ts`, new `runtime/dom-adopt.ts`, `resume-loader*.ts` (dispatch), `resume.rs` (helper imports), `libs/compiler/index.ts` `compileSymbolModule`, resume tests | `dom-v2.ts` except agreed hook call lines (V2-RT reviews) |
| V2-DEV | c | `runtime/dev/**`, `runtime/hot.ts`, `libs/devtools/**`, `libs/compiler/vite.ts` (serve gate), `libs/testing/vite.ts`, `testing-register.ts` | compiler Rust |
| V2-TESTS | c | marker-asserting test files in `libs/*/tests` (52), cdk fixes surfaced by v2 (`libs/cdk/**`, coordinated with cdk owners) | runtime/compiler sources |
| V2-DEL | e | `compile.rs` (authorized deletions only), `lib.rs`, oracle re-record, zero-cost baselines, CLAUDE.md sweep | — (runs alone, after b–d merged) |
| BENCH | a–f | `apps/*-bench` runs, scoreboard, `locks/bench` | sources |

- Order: a → (b ∥ c-dev ∥ c-tests ∥ d1) → c gate flip → d2 → e → f. d1 can start on the harness immediately (runtime only, testable with hand-lowered v2 symbol code).

## 5. Open questions (need the user)

1. **`compile.rs` edits for phase e** (delete v1 lowering, dispatch lines 1454/1646/1655, import emission 903-935, ABI list 47-50; ~1.2k lines removed, no new logic). Rec: authorize deletion-only edits in phase e, one lane (V2-DEL), reviewed diff.
2. **Public surface of `@rivetjs/runtime/dom`**: v1 ABI exports (`template`, `component`, `bindChild`, `bindText`, `bindAttribute`, `bindEvent`, `bindModel`, `bindRCData`, `bindProp`, `bindSelectValue`, `spreadAttributes`, `bindRef`, types `TemplateSpec`/`SlotTarget`/`RangeTarget`/`DOMRange`) are compiler ABI, undocumented in `apps/docs/content`. Rule says exports stay stable. Rec: remove them (not user API); keep `DOMRange` as a deprecated type alias of `DOMValue` for one release.
3. **`domV2` compile option** after the flip. Rec: accept and ignore `true`, throw a clear error on `false` (one release), then remove.
4. **Event handler semantics (P1)**: v1 re-selects handlers reactively; v2 evaluates the handler expression once (Solid semantics). Rec: keep v2 (static), document "wrap in an arrow for dynamic dispatch"; dynamic-looking handler expressions that are *conditionals over calls* (`s() ? a : b`) get an RV diagnostic suggesting `(e) => (s() ? a : b)(e)`. Alternative: `_fx(() => _on(…))` for `dynamic()` handlers — costs an effect per `onX={props.onX}` (cdk-heavy).
5. **Component owner contract (P2)**: no owner per component in production (already true for v2 builds); dev façade adds owners for devtools only. Rec: accept as the permanent contract; document `onCleanup` scoping.
6. **Imperative-DOM contract (P3)** becomes universal (dev, tests, resumed pages). Rec: accept.
7. **Re-created regions**: keep replace-on-first-change (v1 semantics) vs add a "claim" walk that reuses server nodes when structure matches (keeps focus/scroll/selection, more code). Rec: keep replace now; revisit after resume-bench numbers.
8. **Dev on v2 immediately** (dev = prod lowering; loses nothing once the façade wraps v2) vs a temporary v1 dev path. Rec: v2 in dev (no v1 left to keep).
9. **Test assertions on v1 markers** (52 files): rewrite to `normalizedHTML` once. Rec: yes.
10. **Ambiguous SVG/HTML roots (B3)**: runtime flag 8 (`_tpl` picks namespace from the insertion parent) vs compile-time-only (lexical) + RV diagnostic for component-returned bare `<a>`/`<title>` meant for SVG. Rec: lexical + flag 8 (no user-visible restriction; cost only on those roots).
11. **Order vs current priorities** (2026-10-06: cdk freeze → core hardening → landing → playground). Rec: phases a–b now as core hardening (B1/B2/B3 are live prod bugs); c–e after landing ships, since d touches every resumed page.

## Decisions (2026-10-06)

User rule: Rivet is experimental — breaking changes allowed, no deprecation aliases / transition releases until real users exist. Applied to the open questions:

- Q1 compile.rs deletion edits in phase e: yes (orchestrator applies compile.rs edits; user "Edit compile if needed").
- Q2 v1 compiler internals in `@rivetjs/runtime/dom`: removed outright, no `DOMRange` alias.
- Q3 `domV2` option: removed in phase e (no ignore/error release).
- Q4 event handlers: static (evaluated once, like Solid) + diagnostic for conditional handler expressions. Resolved 2026-10-07 (user): no runtime resolver; RV1016 error forces handlers to be functions / plain references.
- Q5 no owner per component: accepted (dev adds owners for devtools only).
- Q6 untracked imperative edits as the rule everywhere: accepted.
- Q7 re-created resumed regions: replace server DOM for now.
- Q8 dev on v2 immediately: yes. Q9 rewrite marker-asserting tests to a normalized-HTML helper: yes. Q10 compile-time namespace + `_tpl` flag: yes.
- Q11 timing: phases a–b now (lanes V2A, V2B); c–e after the landing ships.
