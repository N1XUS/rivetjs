# CDK + ARIA — implementation status, decisions, queued compiler work (2026-10-04)

Follows [2026-10-03 design](2026-10-03-cdk-and-aria-design.md). Reference: [docs/guides/aria.md](../../guides/aria.md). Branch `feat-cdk-aria`.

## Prerequisites (R1–R7) — status

| # | Need | Status | Notes |
| --- | --- | --- | --- |
| R1 | Spread attributes | landed earlier (G16): native-element spread, accessors ok | spread `on*` handlers are not resumable (server error) → library wires explicit `onX={(e) => fn(state, e)}`; bags (`merge`) carry attributes only |
| R2 | Symbols for functions in object literals / returns / prop positions | **missing (Rust)** | workaround: behaviour modules export plain functions, components call them from inline JSX handlers; caller callbacks via hoisted `const f = () => …` (`{f}` symbol) |
| R3 | Safe styles (`style:--x`, style objects) | **missing (Rust, G10)** | workaround: CSSOM writes from JS (position fallback, announcer); `.rv-sr` class for visually hidden |
| R4 | `createId` | done (`@rivetjs/runtime/id`, `rv`/`rvc` prefixes, `withIdScope`) | 1,847 B entry, 0 B when not imported |
| R5 | Loader cold-key hints | done (`data-rk`); pay-per-use: `LOADER_KEYS` (+61 B brotli) only on pages with a recorded keydown handler, other pages ship the old-size `LOADER` | plus: delegated listeners non-passive except touch/wheel/scroll (found by ComboBox; +10 B server-resume) |
| R6 | Library compilation | done (`"rivet": {"source": true}`, ids `<pkg>/<path>#Name$n`, auto resume-module discovery) | |
| R7 | `_rKind` registration | not needed | all state = signals + JSON + Sets |
| — | `Portal` | done (DOM: owned host on `mount ?? body`; server: nothing) | spec said "SSR in place": changed, see open questions |
| — | onToggle / onClose events (G9) | avoided | menus/popovers use `popovertarget` + click/keydown; dialogs use invokers + `<form method=dialog>` |

## What shipped
- `@rivetjs/cdk`: id, platform, bidi, keys, a11y, announcer, focus, focus-scope, collections, overlay, position, interactions, clipboard, base.css. Not yet: observers, layout, scrolling (virtual list), text-field, drag-drop.
- `@rivetjs/aria`: Button, ToggleButton, Checkbox, Switch, RadioGroup, TextField, TextArea, Disclosure, Dialog, Popover, ListBox, Tabs, MenuTrigger, ComboBox + state factories + behaviour modules + base/theme/tailwind CSS. Not yet: Select, Tooltip, Slider, Toast, CheckboxGroup, Link, Grid/Tree/Table, DatePicker.
- Dev a11y checks in the runtime dev facade (7 rules, below).
- Tests: cdk unit (11), aria browser (8 keyboard suites + 2 axe suites), runtime (passive delegation, dev a11y, Portal/id, cold keys, source packages).

## Decisions (with rationale vs other frameworks)
- **Data-driven collections + render slots** (`items` + `children={(item) => …}`), not compound children.
  - React Aria / Kobalte (Solid) collect `<Item>` children through context/collection builders; Rivet evaluates component element children before the parent, so context-based compound APIs are impossible without lazy children (queued). Data items also serialize trivially and keep the resumed collection = server DOM.
- **DOM as collection**: handlers query rendered `[role=option]` + `data-key`; no item model in resume state.
  - Qwik-style: state must be small; Radix / Melt (Svelte) keep JS-side registries that must hydrate. Here nothing hydrates, so the server DOM is the single source of truth.
- **Native first**: `<dialog>` + invokers, `popover`, `<details name>`, native inputs, CSS anchor positioning.
  - Remix/React Router "progressive enhancement" ethos: forms, disclosures, dialogs (with invokers), popovers work with zero JS. JS fallbacks (invoker polyfill click, lazy 2 KB positioning engine) load only where features are missing.
- **Behaviour = functions, not attribute bags with handlers** (until R2): `listBoxKeyDown(state, event)` etc. Next.js / React hooks return handler bags; that requires function serialization in arbitrary positions (R2).
- **Delegated listeners non-passive** (runtime fix): only scroll-blocking types stay passive. Qwik's delegated listeners are likewise non-passive for non-scroll events; the passive default silently broke `preventDefault` in resumed mousedown/input handlers.
- **Cold keys via `data-rk`**: alternative (load widget chunks eagerly on focus) costs bytes on every focus; the hint costs 61 B per page, only on pages with keydown handlers, and works before any chunk.
- **Automatic first-match activation in ComboBox** (APG "list autocomplete with automatic selection"): Enter commits what the visitor sees highlighted; React Aria's default (no auto-focus) needs an extra ArrowDown.
- **Dev a11y checks at run time in the dev facade**, like Svelte's compile-time a11y warnings + eslint-plugin-jsx-a11y, but on rendered DOM (catches spread/dynamic attributes and ids); zero production cost by export condition, not by flag.
- **axe-core** as devDependency (4.13.0, already in the lockfile transitively) used directly via `addScriptTag` (no `@axe-core/playwright` wrapper needed).

## Byte costs (story app production build, brotli)
- Until `load`: 0 B of library JS (Playwright-asserted). After it, the framework preload plan: Tabs / ListBox / ComboBox chunks (per-item bindings) prefetch at idle / when visible; Button, Menu, Dialog, Popover, form fields on intent.
- Measured JS fetched for the first interaction of each story (brotli; includes the story page's own resume chunk and its client route module; excludes the shared runtime ≈ 18.5 KB = dom + resume entry + reactivity + router navigation + App/Layout):

| Story / widget | JS (brotli) | of which `position` fallback (dead where anchor positioning exists) |
| --- | --- | --- |
| Button / ToggleButton (`/buttons`) | 1.0 KB | — |
| Tabs | 4.3 KB | — |
| ListBox | 4.6 KB | — |
| MenuTrigger | 5.6 KB | 0.7 KB |
| ComboBox | 5.5 KB | 0.7 KB |
| Dialog | 1.7 KB | 0.7 KB |
| Popover | 1.8 KB | 0.7 KB |
| Checkbox + Switch + RadioGroup + TextField (`/forms`) | 3.0 KB | — |

- Runtime entries: `@rivetjs/runtime/dom` 27,567 → 27,567 (dev a11y is dev-only), server-resume 39,834 → 39,844 (+10).

## Compiler work (queued — Rust not allowed in this task)
1. Done (G26, [resumable functions](../../guides/resumability.md#resumable-functions-r2)): **R2 symbol extraction** for function expressions in object literals, `return` values and component-prop positions (incl. source packages) → behaviour bags with handlers, `onChange`-style props as inline arrows.
2. Done (G26): **Spread `on*` resumable**: record spread handler values as `{f}` symbols when they come from R2 symbols; today: server error.
3. **R3 / G10 safe styles** (done in G10): custom properties via the object form only, `style={{ "--rv-x": v }}` (`style:--rv-x` is not valid TSX); `style:prop={v}` for standard properties; escape values, refuse `url(` / `expression(`; then drop CSSOM fallbacks for custom properties.
4. **Lazy children for library compound components**: thunk element children of components imported from source packages (like `Show` / `Match` today) so `<Tabs><Tab/></Tabs>` can register through context.
5. Done (G26; root cause: component elements outside a native element had no site, so nothing captured the const): **Fragment-rooted components lose const-arrow wrapping**: a component returning `<>…</>` compiles `const onAction = (k) => …` without `__rivetR_fn(...)` → `capture #1 function is not serializable` when passed to a region site; same code under `<section>` works. Repro (resume, server target): `function E() { const last = signal(""); const onAction = (k) => last.set(k); return <><MenuTrigger label="x" items={[]} onAction={onAction} /><p>{last()}</p></>; }` → `onAction = (key) => …` (unwrapped); with `<section>` → `onAction = __rivetR_fn("a.tsx#E$0", …, [last])`.
6. **`model:value` on `<textarea>`, inputs with dynamic `type`, and `model:checked` on radio** (today `value={sig()}` + `onInput`).
7. **Event allowlist**: `onToggle`, `onBeforeToggle`, `onClose`, `onCancel` (G9) → popover/dialog open-state signals without click heuristics.
8. **`prop:indeterminate`** (DOM property binding) for tri-state checkboxes.
9. **Feature-gated lazy import hint**: an `import()` the build must not prefetch (`/* @rivet-prefetch: none */` or `lazy: "never"` per specifier) — `position.ts` is prefetched after interaction even where anchor positioning makes it dead (~0.7 KB brotli).
10. **Handler-free invokers**: let a component declare a click handler as "fallback only" (`onClick:fallback`) so the loader skips chunk loading when `command`/`popovertarget` are supported (Dialog/Popover currently load ~0.5 KB on click for a no-op).
11. **Compile-time a11y lint** (dev diagnostics, warnings not errors; static markup only — run-time checks cover dynamic values). Exact texts:

| Rule | Trigger (static JSX) | Diagnostic |
| --- | --- | --- |
| `img-alt` | `<img>` without `alt`, not `role="presentation"`/`"none"`, no spread | `<img> has no alt attribute — describe the image (alt="…"), or mark it decorative with alt="".` |
| `click-events` | `onClick` on a non-interactive intrinsic (not `button` `a[href]` `input` `select` `textarea` `summary` `option` `label` `details` `dialog` `video` `audio`) without widget `role` + `tabIndex` + `onKeyDown`/`onKeyUp` | `onClick on <{tag}>, which is not focusable or keyboard-operable — use a <button> (or <a href>), or add {missing}.` (`missing` ⊂ `role="button"`, `tabIndex={0}`, `an onKeyDown handler for Enter / Space`) |
| `tabindex-positive` | literal `tabIndex` > 0 | `tabIndex={{n}} on <{tag}> — a positive tabindex reorders the page's tab sequence; use 0 (or -1 for programmatic focus) and DOM order.` |
| `label-control` | `<label>` without `for`/`htmlFor` and without a nested labelable element (input/select/textarea/button/meter/output/progress or a component — components suppress the rule) | `<label> is not associated with a control — nest the input inside it, or set for="<control id>".` |
| `accessible-name` | `<button>` / `<a href>` / element with role `button` `link` `menuitem` `tab` `checkbox` `switch` `radio` `option` whose children are statically empty and without `aria-label` / `aria-labelledby` / `title` | `<{tag}> has no accessible name — add text content, aria-label or aria-labelledby.` |
| `aria-idref` | literal idref attribute (`aria-labelledby` `aria-describedby` `aria-controls` `aria-owns` `aria-activedescendant` `aria-errormessage` `aria-details`, `for`) naming an id no literal `id` in the module declares | `{attr}="{value}" points at no element with id "{id}" in this module — render the referenced element, or fix the id (createId() keeps ids unique).` (hint-level: the id may come from another module) |
| `duplicate-id` | two literal equal `id`s in one component | `duplicate id "{id}" in <{Component}> — ids must be unique in the document; generate them with createId().` |
| `aria-role` | literal `role` not in WAI-ARIA 1.2 concrete roles | `role="{role}" is not a WAI-ARIA role — use one of the concrete roles (button, dialog, listbox, …) or remove it.` |
| `aria-attr` | `aria-*` attribute not in ARIA 1.2 | `{attr} is not an ARIA attribute — check the spelling (aria-labelledby, aria-describedby, …).` |
| `no-autofocus-outside-dialog` | `autoFocus` outside a `<dialog>` / popover subtree | `autoFocus on <{tag}> outside a dialog moves focus on page load — screen reader users lose their place; focus in response to an action instead.` |

## Open questions (two readings → choice made)
- `Portal` on the server: design said "render in place"; implemented "render nothing" (in-place server HTML would be moved by the browser and break resume adoption). Revisit if SEO-relevant portal content appears.
- Router-level automatic `withIdScope` per request: decided 2026-10-08 — `@rivetjs/router/server` `render.ts` opens `withIdScope("rv", …)` around every page render (deterministic ids: reproducible HTML / ETags, docs-kit incremental prerender); outside a scope the server counter is `rvs` + n (process-wide).
- ~~Callback props require `const` locals in an element-rooted component (R2 + fragment bug)~~ resolved by G26: inline arrows and fragment roots resume.
- Resolved (coordinator): dev a11y checks on resumed dev pages start at load from the generated `entry.dev.tsx` (`@rivetjs/runtime/dev/a11y`, production resolution = no-op stub).
- Cross-browser lanes (Firefox, WebKit) and forced fallback lanes (`_setSupports("anchor", false)` etc.) are not in CI yet: add Playwright projects (needs browser downloads) or keep Chromium-only?
- `TextArea` server HTML carries a redundant `value=""` attribute (value binding on `<textarea>`); harmless, goes away with `model:value` on textarea (queued 6).
