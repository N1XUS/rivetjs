# CDK + ARIA component infrastructure (design)

Date: 2026-10-03. Status: draft design, not implemented. Two new packages: `@rivetjs/cdk` (mechanisms, Angular CDK equivalent) and `@rivetjs/aria` (state → behaviour → unstyled components, React Spectrum layering). Shared styling contract (vanilla CSS + Tailwind).

References: [Angular CDK](https://material.angular.dev/cdk/categories), [react-stately](https://react-spectrum.adobe.com/react-stately/), [react-aria](https://react-spectrum.adobe.com/react-aria/), [react-aria-components styling](https://react-spectrum.adobe.com/react-aria/styling.html), [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/), [Popover API](https://developer.mozilla.org/docs/Web/API/Popover_API), [CSS anchor positioning](https://developer.mozilla.org/docs/Web/CSS/CSS_anchor_positioning), [invoker commands](https://developer.mozilla.org/docs/Web/API/Invoker_Commands_API).

Read before: [resumability.md](../../guides/resumability.md), [resumability design](2026-10-03-resumability-design.md), [i18n design](2026-10-03-i18n-design.md), `libs/runtime/{dom,server,server-resume,resume-format,jsx-runtime}.ts`, `libs/reactivity/index.ts`.

## Goals
- Accessible, APG-conformant primitives for Rivet apps; unstyled by default; vanilla CSS and Tailwind override with no specificity fights.
- Resumed pages stay **zero-JS until interaction**: no component runs in the browser; every library handler is a resume symbol loaded on intent/event.
- **Platform first**: use native elements/APIs (`<button>`, `<dialog>`, `popover`, `<details name>`, anchor positioning, invoker commands, `field-sizing`) so many interactions work before (or without) JS; JS only fills gaps.
- Zero cost for unused parts: subpath exports, `sideEffects: false`, no import-time globals, no compiler-output change for apps not using them (ssr-bench HTML byte-identical, Razor lead unchanged).
- SSR-stable unique ids without hydration.
- i18n: locale-aware formatting/collation, RTL, translated built-in strings — via [i18n design](2026-10-03-i18n-design.md), no catalog in the browser.

## Non-goals (v1)
- Styled design system (that is the kit, see [Coordination](#coordination)); only an optional minimal default theme.
- React-compat API names/semantics; RAC parity where it costs bytes for no Rivet benefit.
- Hydration-mode support (only resume + pure CSR `mount`).
- DatePicker/Calendar, ColorPicker, Tree, drag & drop, virtual Table before phase 4–5.
- Browsers outside Baseline 2024 (see [Browser baseline](#browser-baseline)).

## Constraints from the current codebase (verified)
| Fact | Source | Consequence |
|---|---|---|
| Spread attributes / spread children → compile diagnostic | `compile.rs` ("Spread attributes are not supported") | react-aria `{...mergeProps()}` model impossible today → prerequisite **R1** |
| `style` attribute rejected as unsafe (compiler + `template.ts` + `dom.ts`) | `UNSAFE_ATTRIBUTE_NAMES` | CSS custom properties (`--trigger-width`, slider fill) impossible → **R3** |
| `class?: string` only | `jsx-runtime.ts` `Global<E>` | class render-functions resolved in library, never in the attribute |
| Component props are eager plain values; only Provider children thunked | `compile.rs` props push | reactive inputs must be `Signal<T>` / accessors (`() => T`) |
| Resume format refuses functions/class instances; `{f}` symbols only for hoisted local `const f = () => …` / computeds | `resume-format.ts`, resumability.md | state = plain objects of signals + JSON data; actions = module-level functions; function-valued props need **R2** |
| Context tokens with `{ id }` serialize as `{x: id}` and need `createResume({ contexts })` | resumability design | internal aria contexts have **no id** → captured values serialize structurally |
| `k` custom table kinds exist but are internal (`router`, `const`) | `server-resume.ts` | no public kind needed if state stays plain (keep it that way) |
| No `useId`/`createId` anywhere | grep | **R4** |
| Vite plugin skips `node_modules` | `libs/compiler/vite.ts:87,274` | library `.tsx` must compile in app build → **R6** |
| Loader: cold non-link events load chunk then run with original event (async) | resumability.md Loader | cold `keydown` cannot `preventDefault` (arrow keys scroll page) → **R5** |
| `ClientWhen`, `clientEffect`, `clientEvent(window\|document\|ref\|"media:")`, `bindRef`, `model:value/checked` (no app chunk) | `dom.ts`, `server.ts` | observers/breakpoints/scroll built on these; no new client primitive needed |
| Router already moves focus to `<main>`/h1 and restores scroll | router design | cdk focus-restore does not duplicate route focus |

## Runtime / compiler prerequisites (phase 0, owned by runtime/compiler, not cdk/aria)
| Id | Feature | Shape | Resume | Zero-cost |
|---|---|---|---|---|
| R1 | Spread attributes on intrinsic + component elements | `<button {...bag} class={c}>`; later keys win; `on*` keys = events; `ref` key chains; unsafe names refused as today | server: dynamic attribute set recorded as one element entry; `on*` values must be symbol fns (`_rFn`-tagged) else render error `spread handler "onKeyDown" is not resumable` (dev: value path) | no spread → byte-identical |
| R2 | Symbol extraction for function expressions in object-literal properties, `return` values and component-prop positions inside resumable modules (incl. libraries) | `return { onKeyDown: (e) => moveFocus(state, e) }` → symbol with captures `[state]` | same `{f, a}` entries | only modules that reach a resumable slot |
| R3 | Safe styles | `style:--rv-x={v}` / `style:inset-inline-start={v}` directive and `style={{ "--x": v }}` object; values escaped, `url(`/`expression(` refused | attribute binding like `bindAttribute` | unused → none |
| R4 | `createId(prefix?)` | server: counter on render root (`renderCore` closure, like i18n `variant`), base36, `rv` + n; DOM creation: `rvc` + n; `createIdScope(prefix)` for multi-root pages | ids are strings → captured by value; no hydration ⇒ only uniqueness required, no match | not imported → none |
| R5 | Loader cold-key hints | `data-rk="ArrowDown ArrowUp Home End PageUp PageDown  "` (space = Space) on composite widgets: loader `preventDefault`s listed keys while chunk loads, then runs handler | ~60 B brotli in loader (budget 2,048, now 1,695) | absent attr → no work |
| R6 | Library compilation | Vite plugin compiles `.tsx` of packages declaring `"rivet": { "source": true }` in package.json even under `node_modules`; symbol id `<pkg>/<path>#Name$n` (stable across apps) | per-package symbols, chunked with the importing component (`component`/`island`/`route` unchanged) | — |
| R7 | (optional) public `_rKind` registration | only if a cdk model can't be plain data | — | — |

- R1+R2 gate the behaviour layer and attribute forwarding; components without user-attribute forwarding could ship before (allowlist props), not recommended.

## Package boundaries
```
@rivetjs/reactivity ← @rivetjs/runtime ← @rivetjs/cdk ← @rivetjs/aria (state ← behaviour ← components) ← kit / theme
                                           ↑ @rivetjs/i18n (optional peer: locale, dir, catalogs, Intl cache)
```
- `@rivetjs/cdk` (`libs/cdk`): mechanisms, no ARIA patterns. Subpaths: `./id` (re-export R4), `./platform`, `./bidi`, `./a11y`, `./focus`, `./collections`, `./overlay`, `./observers`, `./layout`, `./scrolling`, `./text-field`, `./clipboard`, `./drag-drop`. Deps: reactivity, runtime.
- `@rivetjs/aria` (`libs/aria`), one package, subpaths per layer **and** per component:
  - `./state/<name>` (≈ react-stately): pure signal state + action functions. Deps: reactivity, cdk/collections only. No DOM, no JSX → runs in Node tests, server, client.
  - `./<name>/behaviour` (≈ react-aria hooks): attribute-bag factories (R1) + handlers. Deps: state, cdk.
  - `./<name>` (≈ react-aria-components): unstyled compiled components.
  - `./theme.css`, `./tailwind.css`, `./locales/<locale>.json`.
- Angular CDK menu/dialog/listbox/table patterns → **aria**, not cdk (no duplicate implementations; cdk keeps key managers, overlay, selection model, collection that they use).
- Both packages: `"sideEffects": ["*.css"]`, `"rivet": { "source": true }`, `exports` only (no barrel `index` importing everything; a root `.` barrel exists for types only).

## Layer mapping (React Spectrum → Rivet)
| React Spectrum | Rivet | Idiom |
|---|---|---|
| `useToggleState(props)` → `{isSelected, setSelected, toggle}` | `createToggleState(opts)` → `{ selected: Signal<boolean>, disabled: () => boolean }` + `toggle(state)` | state = plain object of signals + JSON data; actions = **module-level functions** (imports ⇒ module refs, never captures, tree-shaken individually) |
| controlled/uncontrolled props | `value: Signal<T>` (two-way) \| `value: () => T` + `onChange` (read-only controlled) \| `defaultValue: T` (internal signal) | `controllable(value, defaultValue, onChange)` in cdk; `onChange` must be a symbol fn (R2) |
| `useButton(props, ref)` → `{buttonProps}` | `buttonBehaviour(state?, opts)` → `ButtonAttrs` bag spread with R1 | bag keys: aria/data attrs (accessors), `on*` symbol handlers, `ref` |
| `mergeProps` (chains handlers, merges class/style/id) | `merge(...bags)` in cdk: handlers chained, `class` concatenated, `style:` objects merged, last id wins + warning | pure, server-safe |
| hooks run every render | behaviour factories run **once on server**; their closures become symbols; never rerun on client | no rules-of-hooks |
| `<Button className={({isPressed}) => …}>` render props | `class={(s) => …}` on component; `s` = render state of accessors; resolved by library into the `class` attribute binding | function prop → symbol (R2) |
| RAC slots/contexts (`slot="title"`, `DialogContext`) | context (no `id`) provides part bags: ids, labelledby; compound parts `<Dialog.Title>` read it | named-slot placement → slots spec when available |
| `Collection` built from JSX children via fake DOM | **DOM-as-collection** (default): SSR DOM is the collection; key managers query `[role=option]` + `data-key`; data collection (`items` + render fn via `For`) for virtualized/async | no item model serialized for static lists |
| `useFocusVisible` global modality tracker | native `:focus-visible`; `el.matches(":focus-visible")` when a handler needs it | no global listeners before interaction |

### State serialization rules
- Serialized (needed to render on server or survive resume): selection (`Signal<Set<Key>>`), focused key, open/expanded, value, input text, disabled/readonly flags, orientation, collection items only when data-driven.
- Transient, **never serialized**: pointer start coords, press-in-progress, typeahead buffer + timer, drag session, measured sizes, timers. Live in module-level `WeakMap<stateObject | Element, …>` created on first event (state objects keep identity after decode: format interns by identity).
- Keys: `string | number` only (serializable, `data-key` attribute).
- Forbidden in state: classes, functions (except R2 symbols), DOM nodes (use `ref`-bound locals), Promises.
- Dev check: aria state factories freeze shape; resume encoder errors already name the path (`#dev`).

### Zero-JS-until-interaction rules
- No `clientEffect` / `clientEvent` with `when: "load"` in any library component by default (would force `data-boot` runtime fetch at idle).
- Global listeners (Escape stack, outside-press, scroll dispatcher, resize) attach **inside the first handler** that needs them (e.g. menu open), owned by the region; detached on close.
- Prefer native behaviour → handler chunk loads only for the remaining gap (table below).
- Composite widgets set `data-rk` (R5) so cold arrow keys never scroll the page.
- Prefetch: library handlers are ordinary symbols → existing `intent` (focusin/60 ms dwell) planning applies; ListBox/Menu rows (≥3 same-symbol elements) get `visible` automatically.

## @rivetjs/cdk modules
Kind: **fn** = pure/headless function or signal helper, **beh** = attribute bag/behaviour (R1), **cmp** = component.

| Module | Contents | Kind | Native first | Server | Client cost |
|---|---|---|---|---|---|
| `id` | `createId`, `createIdScope` (R4 re-export) | fn | — | counter | none |
| `platform` | `isMac/isIOS/isAndroid/isWebKit/isFirefox`, `supports(feature)` (anchor, popover, invokers, interestfor, field-sizing, base-select) | fn | `CSS.supports`, `userAgentData` | returns `undefined` (never branch markup on UA; cached HTML) | lazy, memoized |
| `bidi` | `direction()` accessor, `logicalKey(key, dir)` (ArrowLeft↔Right in RTL), `<DirProvider>` | fn, cmp | `dir` attr, CSS logical props | from locale (i18n) / provider | none |
| `a11y` | `<Announcer>` (polite + assertive regions, rendered in layout SSR), `announce(msg, politeness)`; `isFocusable/isTabbable/isVisible` (`checkVisibility`); key managers `nextKey(coll, from, key, opts)` (list/grid/tree; wrap, orientation, homeEnd, skipDisabled, pageSize); `typeahead(coll, char, state)` (`Intl.Collator` base sensitivity); `visuallyHidden` class string | fn, cmp | live regions must exist before change → SSR-rendered | `<Announcer>` = static markup | announce: no chunk until called |
| `focus` | `FocusScope` (contain/restore/autoFocus), `focusTrap` beh, `rovingTabindex` beh, `focusRestore(el)`, `focusFirst/Last/Next(scope)`, `inertOutside(el)` | beh, cmp | `<dialog showModal>` (trap + inert + restore), `inert` attr, `autofocus` | roving: `tabindex=0` on selected/first, `-1` rest — rendered from state | focusin/keydown handlers |
| `collections` | `Key`, `DomCollection(root, itemSelector)`, `ListCollection(items, getKey, getText)`, `SelectionModel` = `{ selected: Signal<Set<Key>>, mode, behavior: "toggle"\|"replace", anchor }` + `select/toggle/extend/selectAll/clear` fns, `SortDescriptor` | fn | DOM order = collection order | plain data | per-call |
| `overlay` | `overlayBehaviour` (popover attrs, `popovertarget`/`commandfor`), `position` engine (fallback only), `dismissable` (Escape stack, outside press, `closedby`), `scrollLock` (CSS `:has(dialog:modal)`), `placement` types | beh, fn | `popover` / top layer (no portal, no z-index), CSS anchor positioning (`position-area`, `position-try-fallbacks`), implicit anchor via invoker, `closedby="any"` | renders `popover` element in place | fallback engine (~2 KB) imported only when `!supports("anchor")` and on first open |
| `portal` | `Portal` (client-only creation into `document.body` / named outlet) | cmp | top layer makes portals rare | SSR renders children **in place** (no out-of-order write in v1) | creation only |
| `observers` | `elementSize(ref)` / `onResize`, `intersecting(ref, opts)`, `onMutation`, `contentChanged` | fn | `ResizeObserver`/`IntersectionObserver`/`MutationObserver`, CSS container queries preferred | initial value (`undefined` / option) | inside `clientEffect({ when: "visible" })` |
| `layout` | `media(query, ssrDefault)` signal, `breakpoints({ sm: "(min-width: 640px)" … })` | fn | prefer CSS/container queries | `ssrDefault` (mobile-first) | `clientEvent("media:…")` listener-only, chunk on change |
| `scrolling` | `scrollDispatcher` (one passive rAF-throttled listener), `VirtualList` (fixed/estimated sizes, `overscan`, SSR first window `initialCount`, adopts server rows via `For`), `scrollIntoViewIfNeeded`, `scrollStrategy` (`close` / `none`; `reposition` = CSS anchor) | fn, cmp | `content-visibility: auto` for long non-virtual lists, `scroll-snap`, `overscroll-behavior` | first window + spacer sizes | passive scroll `clientEvent` (`when: "visible"`) |
| `text-field` | `autosize` beh | beh | `field-sizing: content` (zero JS) | — | fallback input handler only when unsupported |
| `clipboard` | `copy(text)`, `<CopyButton>` | fn, cmp | `navigator.clipboard.writeText` | — | click chunk |
| `drag-drop` | `draggable` / `dropTarget` beh, keyboard DnD, `DragSession` (transient), files/HTML DnD bridge, sortable list | beh | HTML DnD for files/cross-window; pointer events for in-page | `draggable` attrs | pointerdown chunk (phase 4) |

- Behaviours vs components rule: anything that must decorate an author-chosen element (focus trap, roving, drag source, autosize, overlay trigger) = **behaviour bag**; anything that owns markup the author shouldn't hand-write (Announcer, VirtualList, Portal, FocusScope wrapper, CopyButton) = **component**; algorithms (key managers, typeahead, selection, positioning) = **pure functions** usable from both.

## @rivetjs/aria

### MVP component matrix
"Before JS" = works on resumed page before any library chunk loads.

| Component | Native basis | Before JS | Handler chunk on | Serialized state | Notes |
|---|---|---|---|---|---|
| Button / ToggleButton | `<button type=button>`, `aria-pressed` | press, focus, `:active`, form submit | `click` (user `onPress`) | toggle: `selected` | `onPress` = click on native button (keyboard/virtual covered natively); `data-pressed` only for non-native roots |
| Link | `<a href>` | full; router intercepts | router chunk | — | `aria-current="page"` from router |
| Checkbox / CheckboxGroup | `<label><input type=checkbox>` + visual slot | toggle, form, `:checked`, `:indeterminate` | none if only `model:checked` (no app chunk) | `selected`, group `Set` | indeterminate = DOM prop → R3-like `prop:indeterminate` or `ref`; render state via `:has(:checked)` |
| Switch | `<input type=checkbox role=switch>` | full | as Checkbox | `selected` | |
| RadioGroup / Radio | `fieldset role=radiogroup` + `<input type=radio name>` | full incl. native arrow keys + roving | `change` → signal | `value` | RTL handled natively |
| TextField / TextArea / SearchField | `<label>` + `<input>`/`<textarea>`; `aria-describedby` description + error ids | typing, validation (`:user-invalid`), autosize (`field-sizing`) | `model:value` (no app chunk); SearchField clear button click | `value` | constraint validation + server errors via `validationErrors` prop |
| Disclosure / Accordion | `<details>/<summary>`, `name` for exclusive accordion, `hidden="until-found"` panels where custom | full, zero JS, find-in-page | `toggle` event only when `expanded` signal is read | `expanded` | |
| Dialog / Modal / AlertDialog | `<dialog>` + trigger `command="show-modal"` `commandfor=id`; close `command="close"` / `<form method=dialog>`; `closedby` | open, Escape, focus trap (inert), focus restore, top layer, scroll lock (CSS) | `close`/`toggle` event when `open` signal read; fallback `click` → `showModal()` without invokers | `open` (if controlled) | AlertDialog: `role=alertdialog`, `closedby="none"` |
| Popover (+ DialogTrigger) | `popover="auto"` + `popovertarget`/`commandfor`, CSS anchor positioning (implicit anchor) | open, light dismiss, Escape, positioning | positioning fallback; `toggle` for `open` signal | `open` | `data-placement` only with JS engine; CSS-only path exposes placement via `position-try` fallbacks (anchored container queries when shipped) |
| Tooltip | `popover="hint"` + `interestfor` where supported, `aria-describedby` | show/hide where `interestfor` supported | `pointerenter`/`focusin` (delays, global warm-up in module state) | — | text SSR-rendered (no layout shift, SR available) |
| ListBox | `role=listbox` + `role=option` `data-key`, roving tabindex, `aria-selected`, `aria-multiselectable` | renders, Tab into it | `keydown`/`click`/`focusin`; `data-rk` | `selected: Set`, `focusedKey` | DOM-as-collection; typeahead via `textContent`/`textValue` |
| Select | trigger `<button popovertarget>` + popover ListBox; hidden `<select name>` for forms | open/close (popover) | option click / keydown | `selectedKey`, `open` | opt-in `native` mode: customizable `<select>` (`appearance: base-select`) progressive |
| ComboBox | `<input role=combobox aria-expanded aria-controls aria-activedescendant>` + popover ListBox | typing | `input`/`keydown` (filtering, active descendant) | `inputValue`, `selectedKey`, `open` | filter: `Intl.Collator` `startsWith`/`contains`; async items via `Async` |
| Menu / MenuTrigger / SubMenu | trigger `popovertarget` + `role=menu` popover, `menuitem/radio/checkbox` | open/close | keydown/click; `data-rk` | — (or `selected` for checkable) | `onAction(key)` symbol; submenus = nested popovers (phase 3) |
| Tabs | `role=tablist/tab/tabpanel`, `aria-controls`, inactive panels `hidden` (or `hidden="until-found"`) | renders selected | `click`/`keydown` (manual / automatic activation) | `selectedKey` | panels SSR-rendered (all, `hidden`) vs lazy per prop |
| Slider / RangeSlider | per thumb visually-hidden `<input type=range>` (+ `aria-valuetext`) | keyboard, form, SR (native) | `pointerdown` (track drag), `input` → `style:--rv-slider-value` (R3) | `value` (number \| number[]) | `Intl.NumberFormat` output; RTL inverts |
| DatePicker family | — | — | — | ISO strings | phase 5; date lib open question |

- MVP-1 (phase 2): Button, ToggleButton, Link, Checkbox(+Group), Switch, RadioGroup, TextField/TextArea/SearchField, Disclosure/Accordion, Dialog/Modal/AlertDialog, Popover.
- MVP-2 (phase 3): ListBox, Select, ComboBox, Menu, Tabs, Tooltip, Slider; Toast (cdk Announcer + popover `manual`).
- Forms: every value component takes `name`, renders a native/hidden input → progressive enhancement, plain `<form action>` works with zero JS; `isInvalid`/`validationErrors` → `aria-invalid` + error id.

### Example (authoring, illustrative)
```tsx
// state (./state/toggle) — pure, serializable
export interface ToggleState { readonly selected: Signal<boolean>; readonly disabled: () => boolean }
export function createToggleState(o: { selected?: Signal<boolean>; defaultSelected?: boolean; disabled?: () => boolean }): ToggleState;
export function toggle(s: ToggleState): void { if (!s.disabled()) s.selected.update((v) => !v); }

// behaviour (./toggle-button/behaviour) — attribute bag, handlers become symbols (R1/R2)
export function toggleButtonBehaviour(s: ToggleState) {
  return { type: "button", "aria-pressed": () => s.selected(), disabled: () => s.disabled(), onClick: () => toggle(s) };
}

// component (./toggle-button)
<ToggleButton selected={on} class={(r) => (r.selected() ? "bg-teal-700 text-white" : "bg-white")}>Bold</ToggleButton>
```
- Resumed: server HTML `<button type="button" aria-pressed="false" data-r="3" class="bg-white">`; state `{s: false}`; first click loads ~200 B symbol + shared toggle fn.

### Behaviour layer API conventions
- `xBehaviour(state, opts)` → bag `{ [attr]: value | () => value, on*: fn, ref?: fn }`; parts return named bags: `comboBoxBehaviour(s) → { input, button, popover, listBox, label, description, error }`.
- Bags are plain objects; accessors are read inside the element's attribute bindings (R1 handles `() => v` like `attr={expr}`).
- Ids for ARIA relations (`for`, `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-activedescendant`, `commandfor`) from `createId()` in state factory; user `id` prop overrides.
- Events: native names (`onClick`, `onKeyDown`) internally; public semantic callbacks `onPress`, `onChange(value)`, `onAction(key)`, `onOpenChange(open)`, `onSelectionChange(Set)`; all must be symbols (R2) — non-resumable value → server render error naming prop.

## Styling contract (cdk + aria)
- **Unstyled default**: zero CSS shipped/required; library never emits utility classes or inline styles except documented custom properties.
- **State hooks, ARIA-first** (no duplicate attributes = fewer bytes, one source of truth):

| State | Hook (vanilla CSS) | Tailwind | Notes |
|---|---|---|---|
| hover / focus / focus-visible / focus-within / active / disabled / checked / indeterminate / invalid | native pseudo-classes (`:hover`, `:focus-visible`, `:user-invalid`, …) | built-in variants (`hover:`, `focus-visible:`, `disabled:`, `user-invalid:`) | zero JS; `@media (hover:hover)` recommended in theme |
| selected / expanded / pressed(toggle) / checked(custom) / current / disabled(custom) / invalid(custom) / busy | `[aria-selected=true]`, `[aria-expanded=true]`, `[aria-pressed=true]`, `[aria-current=page]`, `[aria-disabled=true]` | built-in `aria-selected:` … variants | ARIA attr already required for semantics |
| open (popover/dialog/details) | `:popover-open`, `[open]`, `:modal` | `open:` / custom variant | native |
| non-native: being pressed (custom roots), focused item in composite (`aria-activedescendant` target), dragging, drop-target, entering/exiting, placement, orientation, invalid group, readonly, required, empty, has-value | `data-pressed`, `data-focused`, `data-dragging`, `data-drop-target`, `data-entering`/`data-exiting`, `data-placement="top"`, `data-orientation`, `data-readonly`, `data-empty` | `data-pressed:` (Tailwind v4 presence variants) or `@rivetjs/aria/tailwind.css` short variants | boolean = present/absent; enums = value |
| parts | `[data-slot="title"]`, `[data-slot="indicator"]`, … | `*:data-[slot=title]:` / `[&_[data-slot=title]]:` | stable public part names per component |

- **Class names**: `class` prop = `string | (renderState) => string`; renderState = `{ selected(), open(), disabled(), placement(), defaultClass, … }` accessors. Default class `rv-<Component>` (e.g. `rv-Button`, parts `rv-Select-trigger`) emitted **only when `class` omitted**; function form receives `defaultClass` to extend. ⇒ Tailwind users replace wholesale (no merge conflicts), vanilla users target defaults.
- **Merging**: core never merges conflicting utilities (it never adds any). `merge()` concatenates `class` from behaviour bags (only fixed library classes like `rv-sr`, below). No tailwind-merge in core; theme/kit may opt into `tailwind-merge` (user dependency) via `class={(s) => twMerge(base, s.userClass)}` pattern. Documented, not bundled.
- `visuallyHidden`: behaviours that need hiding (radio/checkbox/slider inputs) set fixed `class="rv-sr"`; requires `@rivetjs/aria/base.css` (~120 B, `.rv-sr{…}` in `@layer rivet.base`) — chosen over per-element R3 inline styles (bytes); dev warning when `.rv-sr` has no computed `clip-path`.
- **CSS custom properties** (via R3, read-only outputs): `--rv-trigger-width`, `--rv-anchor-width/height` (JS fallback only; anchor path uses `anchor-size()`), `--rv-available-height`, `--rv-transform-origin`, `--rv-slider-value` (0–1 per thumb), `--rv-virtual-offset`, `--rv-progress`. Inputs (theming tokens) belong to theme, not library.
- **Animation**: CSS-only enter/exit — `@starting-style`, `transition-behavior: allow-discrete`, `overlay`, `display`; `data-entering/exiting` only when JS controls mount; `prefers-reduced-motion` in theme.
- **Cascade**: `base.css` + `theme.css` in `@layer rivet.base, rivet.theme`, selectors wrapped in `:where()` (specificity 0) → any unlayered user CSS or Tailwind `@layer utilities` wins. Doc snippet for Tailwind v4: `@layer theme, base, rivet, components, utilities;`.
- **Optional default theme** (`@rivetjs/aria/theme.css`): tokens `--rv-color-*`, `--rv-radius`, `--rv-focus-ring`, light/dark via `light-dark()`, forced-colors (`@media (forced-colors: active)` system colors), logical properties only (RTL free). Targets `.rv-*` default classes; no JS.
- **Tailwind** (`@rivetjs/aria/tailwind.css`): `@custom-variant pressed (&[data-pressed]); @custom-variant entering (&[data-entering]); @custom-variant placement-top (&[data-placement=top]); …` — zero runtime; optional `@source` hint for class detection in library TSX not needed (classes authored in app).
- **Scoped styles** (parallel spec): library roots must accept the scope marker/class forwarded by R1 spread so a parent's scoped CSS reaches aria roots and `[data-slot]` parts (Vue-style root inheritance). Requirement filed below.

## SSR, ids, resume details
- Ids: `createId()` per state factory (one call, suffixes `-label`, `-desc`, `-err`, `-list`, `-opt-<key>`); option ids derive from `data-key` (`<listId>-<key>`, key escaped) → no per-option counter, no serialization.
- Streaming (`Async`): counter is per render root, segments rendered later still unique; ids captured inside segments arrive in patches as strings.
- Client-created regions (e.g. ComboBox async options re-created): `rvc` prefix — never collides with server ids.
- Multiple Rivet roots per page (micro-frontends): `createIdScope("app2")`.
- Portal/outlet: none server-side in v1; overlays use top layer in place (DOM order = reading order; good for SR).
- Server cost: state factories create a few signals per instance; no per-render DOM objects; MVP target ≤ 1.5× the hand-written equivalent markup render time (ssr-bench microbench lane, not in Razor comparison).
- CSR `mount` path: same components; behaviours attach handlers directly (no symbols needed); `clientOnly` usable for heavy pieces (position fallback engine, DnD).

## i18n
- Needs from [i18n design](2026-10-03-i18n-design.md):
  - **I1** runtime `locale()` + `direction()` accessor for components: server = render variant locale (`RenderOptions.variant` → locale), client = `<html lang dir>`; without i18n configured, aria `<I18nProvider locale dir>` context (no `id`), default `en`/`ltr`.
  - **I2** library catalogs: packages contribute catalogs (`@rivetjs/aria/locales/{locale}.json`, keys namespaced `rv.*`, ICU) merged by the i18n vite plugin into the app tables → built-in strings ("Close", "Clear", "{count} results available", "Previous month") inline at compile time, no browser catalog. Without i18n plugin: English inline literals.
  - **I3** reuse `@rivetjs/i18n/runtime` cached `Intl.NumberFormat`/`DateTimeFormat`/`PluralRules`; aria adds cached `Intl.Collator` (typeahead, ComboBox filter, sort) and `Intl.ListFormat`/`Intl.DisplayNames` on demand.
  - **I4** RTL decision (i18n open question): recommend `Intl.Locale#getTextInfo()`/`textInfo` with static list fallback; `<html dir>` written by guard; cdk `direction()` reads it.
- Aria uses: `NumberField`/Slider value text (`Intl.NumberFormat`, units, percent), ComboBox announcements (plural), DatePicker (phase 5: calendar systems, first day of week `Intl.Locale#getWeekInfo`), key managers flip horizontal arrows in RTL; Slider inverts in RTL; overlays use logical placements (`start`/`end`).
- Locale switch = navigation (i18n v1) ⇒ no reactive relocalization inside components.

## Zero cost & tree shaking
- Per-component subpath + per-function action exports; state/behaviour/components separately importable.
- No import-time side effects (no global listeners, no style injection, no registration); singletons (Escape stack, scroll dispatcher, announcer handle, tooltip warm-up) are lazily created module state.
- Feature fallbacks (`position` engine, autosize JS, invoker polyfill-ish click path) behind dynamic `import()` gated by `supports()` → absent from chunks on modern browsers' critical path (still on disk).
- Resumed page using only Disclosure/Dialog/Popover/Checkbox with `model:`: **0 B library JS** until a JS-requiring interaction.
- Budget gates (brotli, first interaction chunk incl. shared aria code): Button/Toggle ≤ 0.5 KB, Checkbox/Switch/RadioGroup 0 KB (model only), Dialog/Popover 0 KB (invokers) / ≤ 0.6 KB fallback, ListBox ≤ 3 KB, Select ≤ 4 KB, ComboBox ≤ 5 KB, Menu ≤ 4 KB, Tabs ≤ 2 KB, Slider ≤ 2.5 KB, position fallback ≤ 2.5 KB.
- ssr-bench / Razor: packages not imported ⇒ compiler output byte-identical (enforced by existing zero-cost test).

## Browser baseline
| Feature | Required / progressive | Fallback |
|---|---|---|
| `<dialog>`, `popover`, `:popover-open`, `<details name>`, `inert`, `:focus-visible`, `:has`, `@layer`, logical props | required (Baseline 2024) | — |
| invoker commands (`command`/`commandfor`) | progressive | resumable `click` → `showModal()`/`togglePopover()` (same markup, handler symbol only executes when `!("command" in HTMLButtonElement.prototype)`); `popovertarget` already zero-JS |
| CSS anchor positioning + implicit anchor | progressive | lazy JS position engine |
| `popover="hint"`, `interestfor` | progressive | pointer/focus handlers |
| `closedby` | progressive | outside-click handler |
| `field-sizing` | progressive | JS autosize |
| customizable `<select>` | opt-in `native` mode | custom Select |
| `hidden="until-found"` | progressive | plain `hidden` |

## Testing
- **State** (`libs/aria/tests/state`, `node --test`): pure signal transitions, selection modes, key managers, typeahead (collation, RTL), `controllable`; table-driven.
- **Resume format**: every state factory round-trips through `resume-format` encoder/decoder (guards against non-serializable additions).
- **Compile/SSR snapshots**: server HTML per component × key prop combos; ids deterministic; `class` default vs override; zero-cost test (package unused → byte-identical).
- **Keyboard matrices**: one data file per component derived from APG (`{ key, modifiers, dir, from, expect: { focused, selected, open, preventDefault } }`) → generated Playwright tests; run LTR + RTL, horizontal + vertical.
- **Resume behaviour** (Playwright, Chromium, real build like `resume-browser.test.ts`): `__componentRuns` unset; zero library requests before interaction; cold keydown arrow → no page scroll (R5) and correct focus; intent prefetch → sync handler; Dialog/Popover/Disclosure work with JS chunks blocked (route-abort `*.js`).
- **a11y automation**: `@axe-core/playwright` on every story (light/dark/forced-colors/RTL); Playwright `toMatchAriaSnapshot` for role/name/state trees; focus-order assertions; target-size check (WCAG 2.5.8).
- **Cross-browser**: Chromium + Firefox + WebKit for all a11y/keyboard suites (native feature variance); fallback lanes forced via `supports()` test override (anchor off, invokers off, interestfor off).
- **Screen reader smoke** (nightly, non-blocking): Guidepup — VoiceOver/Safari (macOS runner), NVDA/Firefox (Windows runner); scripted per component: name, role, state change announced, live announcer.
- **Size**: per-component first-interaction chunk bytes recorded vs budgets (fail on regression), like loader budget test.
- **Perf**: ListBox/VirtualList 1,000/100,000 items in dom-bench + resume-bench lane (first keydown latency, INP).

## Roadmap
| Phase | Scope | Gate |
|---|---|---|
| 0 | R1–R6 in compiler/runtime; `libs/cdk` + `libs/aria` scaffolds; styling contract doc; story app (`apps/aria-stories`, resumed pages) | zero-cost test green; spread + symbol handlers resume in Playwright |
| 1 | cdk: id, platform, bidi, a11y (Announcer, key managers, typeahead, interactivity), focus, collections/selection, observers, `controllable`, `merge` | node tests; resume round-trip |
| 2 | aria MVP-1 (Button, ToggleButton, Link, Checkbox(+Group), Switch, RadioGroup, TextField/TextArea/SearchField, Disclosure/Accordion, Dialog/Modal/AlertDialog, Popover) + cdk overlay (anchor + fallback) + base/theme/tailwind CSS | axe 0 violations; keyboard matrices; 0 B JS for native-backed components; budgets |
| 3 | aria MVP-2 (ListBox, Select, ComboBox, Menu, Tabs, Tooltip, Slider, Toast) + cdk layout, scrolling dispatcher, text-field, clipboard; i18n I1–I3 | budgets; SR smoke; RTL matrices |
| 4 | VirtualList, GridList, Table (sortable, selectable, virtual), Tree, TagGroup, NumberField, drag & drop (pointer + keyboard + files) | 100k-row bench; DnD keyboard matrix |
| 5 | DateField/TimeField/Calendar/RangeCalendar/DatePicker/DateRangePicker, ColorPicker, Meter/ProgressBar polish | locale matrix (≥ 10 locales, 3 calendar systems) |

## Coordination
- **Slots + server markers** ([2026-10-03-slots-and-server-markers-design.md](2026-10-03-slots-and-server-markers-design.md), not yet present): aria compound components work with context alone; adopt named slots for part placement (ComboBox `input`/`button`/`popover`, Dialog `title`/`actions`) and for `data-slot` naming consistency; if slots spec adds server markers/outlets, revisit server-side Portal (v1: none). Needs: slot content may be function children (render state) resumable via R2.
- **Kit + scoped styles** ([2026-10-03-kit-and-scoped-styles-design.md](2026-10-03-kit-and-scoped-styles-design.md), not yet present): kit = styled layer on top of aria (owns tokens, variants, optional tailwind-merge). Requirements on scoped styles: (a) scope marker forwarded to component roots through `class`/spread (R1); (b) scoped selectors can target `[data-slot]` parts and ARIA/data state attributes of child library components; (c) scoped CSS emitted in a layer above `rivet.theme`; (d) no runtime style injection (zero-JS rule).
- **i18n** ([2026-10-03-i18n-design.md](2026-10-03-i18n-design.md)): I1–I4 above; library catalogs must not force per-locale chunks for modules without translated strings (aria strings mostly in handlers → only those symbol chunks become per-locale).
- **Forms** ([2026-10-03-forms-design.md](2026-10-03-forms-design.md)): no package dependency either way; shared contract = id scheme (`fieldId`/`errorId`/`descriptionId`/`describedBy`) + "issue present" boolean. aria field components accept `id`, `describedBy`, `invalid` (accessor) props so a forms store drives them; aria `validationErrors` = native/standalone path only. aria value components render native `name`d inputs → forms' delegated `<form>` handlers see them unchanged (custom Select/Slider via hidden inputs dispatching `input`/`change`). Align aria id suffixes (`-desc`, `-error`) with forms.
- **Router**: Link `aria-current`; router keeps route focus/scroll; overlays close on navigation (region dispose → cleanup).
- **Resumability**: R1, R2, R5, R6 extend the resume compiler/loader; preload strategies unchanged; library symbols participate in `island`/`route` grouping.

## Open questions (options → recommendation)
1. Behaviour API shape: (a) spread attribute bags (R1+R2) (b) `use:behaviour={…}` element directives (c) components only, behaviours private. → **(a)**: mirrors react-aria, spread is needed anyway for attribute forwarding; (c) as fallback if R1 slips.
2. State attributes: (a) ARIA-first, `data-*` only for non-ARIA/non-native states (b) RAC parity — always mirror (`data-selected`, `data-hovered`, `data-focus-visible`). → **(a)**; fewer bytes, no global JS for hover/focus-visible; revisit if migration demand.
3. Default class hook: (a) `rv-X` default class only when `class` omitted (b) always `data-rv="x"` attribute (c) none. → **(a)**; zero bytes for Tailwind users, theme/vanilla get stable hooks.
4. Class conflict merging: (a) none in core, docs pattern for tailwind-merge (b) bundle tw-merge in aria (c) own small merger. → **(a)**; core adds no utilities so nothing conflicts.
5. Package split: (a) `@rivetjs/aria` with layer subpaths (b) three packages (`aria-state`, `aria`, `aria-components`). → **(a)**; one version, subpaths give same tree-shaking.
6. Headless menu/dialog/listbox/table in cdk (Angular parity)? (a) no, patterns only in aria (b) duplicate thin versions. → **(a)**.
7. Collections: (a) DOM-as-collection default + data collections for virtual/async (b) always serialized item model. → **(a)**; zero state bytes for static lists, matches resume (DOM already there).
8. Server-side Portal: (a) none, top layer in place (b) buffered named outlet (c) wait for slots server markers. → **(a)** now, **(c)** later.
9. Positioning fallback: (a) own ~2 KB engine, lazy (b) depend on `@floating-ui/dom` (c) no fallback (static placement). → **(a)**; (b) acceptable if size equal and tree-shakes.
10. Built-in strings: (a) i18n library catalogs (I2) (b) `messages` prop per component (c) per-locale tables in aria runtime. → **(a)**, English inline when i18n off; (b) as escape hatch.
11. Date library (phase 5): (a) Temporal (native where shipped) (b) `@internationalized/date` (c) own. → decide at phase 5; lean **(a)** if Temporal is Baseline then, else **(b)**.
12. Library distribution: (a) ship `.tsx` source compiled by app (R6) (b) precompiled server/dom dist per target. → **(a)**; needed for resume symbol extraction and i18n variants; (b) breaks both.
13. Hover state on touch: (a) CSS `@media (hover:hover)` guidance (b) JS `data-hovered` ignoring emulated mouse events. → **(a)**; (b) opt-in per component later.
14. `onPress` vs `onClick`: (a) `onPress` alias = native click on native roots, normalized press on custom roots (b) expose only `onClick`. → **(a)**.


## Decisions — open questions resolved (user, 2026-10-03)
Unpicked questions take the recommended answer.
- cdk-aria-1 · Behaviour API shape: Spread attribute bags — Mirrors react-aria; spread is needed anyway for attribute forwarding.
- cdk-aria-2 · State attributes: ARIA first, data-* only for extras — Fewer bytes; no global JS for hover/focus-visible.
- cdk-aria-3 · Default class hook: rv-X class only when class omitted — Zero bytes for Tailwind users; stable hooks otherwise.
- cdk-aria-4 · Class conflict merging: None in core; doc tailwind-merge — Nothing in core conflicts.
- cdk-aria-5 · Package split: One package with subpaths — One version; same tree-shaking.
- cdk-aria-6 · Headless patterns in cdk: No, patterns only in aria — One home per pattern.
- cdk-aria-7 · List data model: DOM as collection, data for virtual/async — Zero extra bytes for static lists; matches resume.
- cdk-aria-8 · Server-side portal: None now; slots later — Use the browser top layer in place; revisit with slot server markers.
- cdk-aria-9 · Positioning fallback: Own ~2 KB engine, lazy — Small and loaded only when needed.
- cdk-aria-10 · Built-in strings: i18n library catalogs — English inline when i18n off; messages prop as escape hatch.
- cdk-aria-11 · Date library: Temporal (native) if Baseline — Lean choice if broadly supported by then.
- cdk-aria-12 · Library distribution: Ship .tsx source — App compiler extracts resume symbols and i18n variants.
- cdk-aria-13 · Hover on touch: CSS @media (hover:hover) guidance — No JS; per-component JS option later.
- cdk-aria-14 · onPress vs onClick: onPress alias — Native click on real buttons; normalized press on custom elements.
