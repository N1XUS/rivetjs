# @rivetjs/runtime/dev

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Development-condition façades. Production resolution never reaches `on.ts`, `dom.ts`, `a11y.ts`, `where.ts`, `flag-on.ts` (0 B, hash-pinned by `scripts/zero-cost/runtime.txt`).

## Entry points

| Resolution | File | What |
|---|---|---|
| `#dev` (package `imports`) `development` | `on.ts` | `DEV` toolkit: `emit` (devtools hook `Symbol.for("rivet.devtools")`), `hint(message, key)` (HINTS: function, drift, manifest, lazy, adopt), `selector(match)` (clientEvent `match`: invalid CSS selector → `SyntaxError` at registration; called by the dev `dom.ts` `clientEvent` wrapper), `locate()` (the `Symbol.for("rivet.locate")` hook's text — browser component chain from `where.ts`, dev server app frame from compiler `vite.ts`), `unsafeUrl` / `unsafeStyle` / `classObject` one-shot warnings, `adopt(boundary, first)` (a boundary that did not adopt its server markup: one `console.warn` naming it) |
| `#dev` default | `off.ts` | `export const DEV = false` (+ `DevTools` type) |
| `@rivetjs/runtime/dom` `development` | `dom.ts` | `export * from "../dom.ts"` + wrapped `mount`, `clientEvent` (`DEV.selector` on `match`) and the DOM ABI (spec 2026-10-06 §2.4): `_c` / `_cp` (`component2`: own owner per component via `_rootIn` under the current owner — dev only, prod v2 has none (Q5); the component map doubles as `_adoption.dev` (`dom-v2.ts`), so resume adoption's `direct` check (`dom-adopt.ts`) sees through these owners as through production's none; props built under it; accessor outputs (hot wrapper renders, `_show` branches) read through `_scoped` under the component owner so what they render stays under the component in the owner tree — else the devtools tree flattened (App / Router / Layout siblings); `_cp` snapshot warning; `comp.mount { owner, fn, props, spanOf }`, `spanOf` = first / last connected node of the output, traced through `guard`'s accessor wrappers (`latest`) and fragment roots (`fragments`); a disposed parent scope → plain base call), writers `_t` / `_insert` / `_textValue` (child `guard`, component-named errors), `_attrWrite` / `_attrValue` / `_cls` / `_className` (`attrCheck`: unsafe-URL + class-object warnings), `_attrSet` / `_setAttr`, `_rcdata`, `_spread` (`urlKeys`; 4th arg always `null`), `_on` / `_listen` (a11y `noteEvent`; `_spread` handlers are not). Per-run writers (called inside their `_fx`) report `dom.update` from the 2nd write of an (element, kind, name) (`wrote`); accessor ones through `reported`. Not wrapped: `_model`, `_select`, `_setProp`, `_for`, `_ref`, `_tpl*`, `_fx`, `_scoped`. Reports owners + DOM spans and binding re-runs to the devtools hook; warns once when a props expression reads a signal; runtime errors name the nearest component / attribute / value type; starts the a11y audit |
| (internal, imported by `dom.ts` / `a11y.ts`) | `where.ts` | Where a dev warning comes from (DIAG-VERBOSE): `components` (owner → component fn; `dom.ts` `component2` fills it, doubles as `_adoption.dev`), `hidden` (built-ins left out of chains), `nameOf` / `label` (declared name + `file:line:col` from compiler dev `sourceStamps`, `Symbol.for("rivet.sources")`; sees through hot wrappers), `chain(owner)` (`<A> (src/a.tsx:3:17) ← <B> (…)`, ≤ 4, innermost first), `noteNode` (first owner that inserted a node; `dom.ts` `guard`), `cssPath`, `locateElement(el)` (`\n  in <chain>` or `\n  in server-rendered HTML of /path (resume site data-r="N") — no client component rendered it`, + `\n  element: <css path>`), `DOCS` (a11y / warnings docs anchors in `apps/docs/content/guides/tooling/dev-server-and-hot-reload.md`). Installs the browser `Symbol.for("rivet.locate")` (`in <chain>` of `getOwner()`), read by cdk `utils/dev-on.ts` `devWhere`, reactivity `dev.ts`, `on.ts`. |
| `@rivetjs/runtime/dev` `development` / default (+ types) | `flag-on.ts` / `flag-off.ts` | public `DEV: boolean` for app code (`true` / `false`); production builds through the compiler plugin resolve `flag-off.ts` whatever the conditions (`libs/compiler/vite.ts` `resolveId`); typed `boolean` on both sides so user code type-checks both branches. Tests `tests/dev-build.test.ts`, compiler `tests/vite-dev-flag.test.ts` |
| `@rivetjs/runtime/dev/a11y` `development` | `a11y.ts` | one-pass document audit + MutationObserver follow-up; warns once per element (`Rivet a11y [rule]: …` + `where.ts` `locateElement` lines + `docs:` link), emits `a11y { rule, element, message, where }`; `accessible-name` counts a wrapping `<label>`'s text for labelable controls (docs code-switch false positive); opt out `<html data-rivet-a11y="off">`; `label-control` accepts a `for`-less label whose id an `aria-labelledby` references (React Aria group labels: Slider, RadioGroup) |
| `@rivetjs/runtime/dev/a11y` default | `a11y-off.ts` | same exports (`noteEvent`, `checkElement`, `checkTree`, `start`), all no-ops — parity enforced by `scripts/zero-cost/condition-parity.mjs` |

## Rules

- `DEV` is used as `DEV ? DEV.x(…) : …` / `if (DEV)` so production folds every call away; never call `DEV.x` unguarded, never import `./on.ts` directly from shipped code (only `#dev` and this folder).
- Façades stay transparent: same export set as the base (`tests/dev-facade.test.ts`), no laziness / flush-order changes, inert without a devtools hook (`tests/dev-diagnostics.test.ts`, `tests/dev-a11y.test.ts`, `tests/dev-build.test.ts` run under both `runtime` and `runtime-dev` projects; the `production (default resolution)` tests only under `runtime`).
- `lazyComponent` / `clientOnly`: the loaded component renders through `component2` (own owner, reported like a compiled `_c` call; dom.ts's own `_c` has no owner), the loading wrapper is hidden.
- Structural built-ins hidden from the component tree via `comp.hide` on install (`ChunkGroup`, `Provider`, `Suspense`, `_for` / `_show` / `_switch` / `_match` = `For` / `Show` / `Switch` / `Match`; `Async` / `ErrorBoundary` / `Dynamic` / `Portal` stay visible) — add new built-ins to that list.
- Dev warnings name their origin (DIAG-VERBOSE): component-scoped `dom.ts` warnings append `at(owner)` (chain + `docs:`) / `where(owner)`; never print a bare message a user cannot trace. Docs: `apps/docs/content/guides/tooling/dev-server-and-hot-reload.md` "Warnings and errors" / "Accessibility warnings" (anchor names are in `where.ts` `DOCS`).
- Façade coverage: `tests/dev-facade.test.ts`, `tests/dev-diagnostics.test.ts`, `tests/url.test.ts` (DOM cases).
- a11y rules here cover runtime-created markup; compile-time versions for static markup are queued (`../../../docs/guides/aria.md`). Rule names are part of the devtools contract.


## Commands

```sh
npx vitest run --project runtime-dev libs/runtime/tests/dev-*.test.ts
node --conditions=development …                                  # resolves these files
```

## Gotchas

- Browsers have no package `imports` resolution: browser test harnesses rewrite `"#dev"` to `/dev/off.ts` (`tests/resume/harness.ts`).
- `click-events` skips composite widgets (`COMPOSITE_ROLES`: listbox / grid / treegrid / tree / menu / menubar / tablist / radiogroup / toolbar): their delegated `onClick` serves keyboard-operable children (COMBOBOX-DEV 2026-10-08).
- `aria-idref` / `aria-labelledby` / `-describedby` / `-controls` dangling refs are judged once the document settles (`settleIdrefs`: 100 ms debounce after the last mutation batch, at most 2 s): cdk slot ids drop one microtask after mount and popover content mounts in a later chunk; a ref still dangling then warns (COMBOBOX-DEV 2026-10-08).
