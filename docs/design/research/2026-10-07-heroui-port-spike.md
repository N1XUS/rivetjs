# HeroUI port spike — compound parts, variant context on resume, `render` prop shape, input-otp placement, Plan 2 inputs (2026-10-07)

Plan 1 of the HeroUI v3.2.6 port (`@rivetjs/ui`, spec `../specs/2026-10-07-heroui-port-design.md`, plan `../plans/2026-10-07-heroui-port-plan-1-foundation.md`). Upstream `heroui-inc/heroui` @ `73000ea`. Evidence: Plan 1 commits `85adfbc1` (compound parts) … `c17e46c0` (story app), tests under `libs/compiler/tests/compound-parts.test.ts`, `libs/ui/tests/`, `libs/ui/tests-components/`.

## Verdict

- Compound parts (`<Card.Header>`) work on server, DOM v2 and resume with no compiler patch.
- Variant data through context resumes: re-created child regions re-provide `rv-ui-card` / `rv-ui-surface` contexts. A resumed `variant={signal()}` change updates root + parts on the **first** change only; the second change needs live props (Plan 2 prerequisite).
- `render` prop: RAC 1.x shape `render={(props, renderProps) => <a {...props} />}`; blocked on cdk `render` support + `ref` in spreads.
- `input-otp`: port in-tree under `libs/ui/src/vendor/input-otp/`, exposed only as `@rivetjs/ui/input-otp`.
- No Rust patch queued.

## 1. Compound parts

- Compile (`libs/compiler/tests/compound-parts.test.ts`, 4 tests):
  - server: member calls kept (`Card.Header({ children })`), each child component a `region` site, lazy children `slot` sites; no lowercase `card.header` tag.
  - DOM: `__rivet_cp(Card, …)`, `__rivet_c(Card.Header, …)`.
  - resume: server and DOM symbol tables identical (8 symbols); the namespace import `Card` is never captured (symbol modules re-import it; DOM resume tail adds a harmless `export { Card }`).
  - nested `<Select.Popover><ListBox.Item>` compiles (compile-level only).
- Runtime (`tests-components/resume.test.ts`, Chromium, resumed production build): `<Card variant="secondary">` with a child region (`open() ? <Card.Footer> : <Card.Content>`) re-creates the part with the right slot class + `data-slot`; Card roots keep their nodes across toggles.
- Editor: `rivet-check -p libs/ui/tsconfig.json` 0 diagnostics (language-core). One RV1000 parse error appears only if `dom.tsx` is compiled under a `.ts` / `.js` filename (wrong-filename probe, not a real build path).
- Not covered: HMR boundary on compound statics (no dev-server test yet) → Plan 2 / docs app.

## 2. Variant context and resume

Pattern chosen (Ruling 5, `libs/ui/src/components/CLAUDE.md` "Port pattern"):

- Context value = **plain data** (`{ variant }`), upstream type + default `{}`, `resumableContext(createContext<XContext>({}, { id: "rv-ui-<name>" }))` + `<Provider token value>`. Never accessors, never tv slot functions (functions do not serialize: a re-created region would see `{}` and lose every slot class).
- Slots: module-level memo per variant key, `slotsFor(variant) = (SLOTS[variant] ??= xVariants({ variant }))`; multi-variant key `${size}|${variant}|${color}` on defaulted values. Measured (Card, 6 slot calls, warm): per-part `xVariants()` 0.62 µs, upstream single call 0.13 µs, memo 0.03 µs.
- Parts read the context at creation (`useSlots()`); outside a provider → caller `class` only (= upstream `slots?.x`).
- Rivet JSX is eager: an element hoisted into a `const` before `<Provider>` renders outside it → `const content = () => <…/>` called inside the provider. DOM-target only (server `Provider` calls a children thunk), so every provider-wrapping part needs a DOM test.

Resume results (`tests-components/`):

| Case | Result |
| --- | --- |
| Re-created child region inside a resumed `Card` re-provides `rv-ui-card` + `rv-ui-surface` (region state `["rv-ui-card",{p:[variant,secondary]},"rv-ui-surface",{…}]`) | pass |
| Transparent `Card` provides CardContext only (`data-surface="none"` before + after toggle) | pass |
| `<Card variant={variant()}>` on a resumed page, first change: root + header / title / description classes update | pass |
| Same, second change | **`test.fails`**: props are snapshots (`_cp` = `untrack(() => fn(props()))`); the server-recorded region re-creates the component once, the re-created `_cp` tracks nothing. Client-rendered pages never update. User decision 2026-10-07: **live props** (Solid-style reactive component props; spec `../specs/2026-10-07-live-props-design.md`, in progress) → remove `.fails` when it lands. Interim: re-create on change (keyed `Show`, `#c-keyed` passes every change). |
| `<dom.div class={() => cls()}><span/></dom.div>` resumes + updates both ways, `div` kept | pass (spread capture `{ id, class: {f}, children: {f slot} }`) |
| Same, child `<span>` node identity across a class change | pass (resumed + client-rendered, `tests/dom.test.tsx`); was a runtime bug (a `_spread` update re-ran the `children` slot when another key changed), fixed in runtime commit "fix(runtime): spread re-inserts children only when `children` changes". |

## 3. `render` prop shape for Plan 2

Upstream (`$HEROUI/packages/react/src/utils/dom.tsx`, from RAC `src/utils.tsx`):

- `DOMRenderFunction<E, T> = (props: JSX.IntrinsicElements[E], renderProps: T) => ReactElement`; `DOMRenderProps<E, T> { render?: DOMRenderFunction<E, T> }`.
- `dom.<tag>` merges `forwardedRef` with an internal ref, then `render ? render({ ...otherProps, ref }, undefined) : <Tag {...domProps} />`; dev warning when the returned element did not attach the ref.
- Requirements (upstream JSDoc): same element type, single root element, pass through props **and** `ref`.
- Two paths in HeroUI:
  1. HeroUI-own parts on `dom.*`: 103 `extends DOMRenderProps<E, undefined>` interfaces in 47 component files (`disclosure`, `drawer`, `tabs`, `tooltip`, `kbd`, `progress-circle`, …); `renderProps` is always `undefined`. Containers forward it explicitly (`tabs.tsx` / `combo-box.tsx` `containerRender` → `render={containerRender}` on an inner RAC part).
  2. RAC parts (`Button`, `ListBox`, …): `render` arrives through `ComponentPropsWithRef<typeof ButtonPrimitive>` rest spread → RAC 1.21.1 calls `render(props, renderProps)` with the part's state (`isPressed`, `isHovered`, …).

Rivet shape (Plan 2, cdk gap #1):

- Same name + signature: `render?: (props: JSX.IntrinsicElements[E], renderProps: T) => DOMValue`; `T` = the cdk render-props object (**accessors**: `renderProps.isPressed()`, as cdk `class` / `style` / `children` render props already are), `undefined` for `dom.*`.
- `props` carries `ref`; the user writes `<a {...props} />`. Prerequisite: Rivet ignores `ref` inside `{...spread}` (Task 4 F7; `dom.tsx` passes `ref={props.ref}` explicitly) → fix spread `ref` in compiler/runtime first, otherwise the RAC idiom silently drops refs. Fallback if not fixed: document `<a {...props} ref={props.ref} />` (user-visible diff → `known.ts`).
- Resume: `render` must be an inline arrow / local const (compiler `_rFn` capture); a module-level function passed as `render` is not serializable (repo resumability rule).
- Dev ref check: through the `#dev` import (as `dom.tsx` warns today), never `process.env` probes (they ship in production; see §6).
- `dom.*` today: `render` ignored + dev-warned (Known diff); switch to calling it when cdk lands support.
- cdk today: 48 cdk modules (non-test `.ts`/`.tsx`, `grep -rlE 'no .?render.? prop'`) document "no `render` prop (RAC DOMRenderProps)" — the gap #1 scope.

## 4. `input-otp` placement

- Upstream: HeroUI `input-otp.tsx` (167 LOC) wraps `OTPInput` + `OTPInputContext` from `input-otp` 1.5.0 (MIT, ~600 LOC per spec estimate; a React hooks library → this is a rewrite onto signals, not verbatim vendoring).
- Consumers: only HeroUI `InputOTP`. Repo grep (`input-otp|OTPInput|one-time-code`): no use outside `libs/ui/styles` (vendored CSS / tv).
- **Decision: vendor in-tree** under `libs/ui/src/vendor/input-otp/`, exposed only through `@rivetjs/ui/input-otp` (the component subpath), not a separate lib and not a public `vendor` subpath. MIT header per file + `libs/ui/NOTICE` entry. Zero-cost: only `@rivetjs/ui/input-otp` pays for it (per-subpath hashes, §6).
- Revisit only if a non-HeroUI consumer (cdk / forms) appears → then move to `@rivetjs/cdk/otp` (headless) and keep the HeroUI part as the styled wrapper.

## 5. Translation rule changes discovered

- Context: plain variant data, not accessors (§2; supersedes the plan's accessor shape). Slots via module memo; never in context.
- Eager JSX: provider-wrapping roots build content as a thunk inside the provider.
- Generic roots: `XRootProps<E> & JSX.IntrinsicElements[E]` (intersection) instead of upstream `Omit<JSX.IntrinsicElements[E], …>` — the `Omit` of the generic indexed type is TS2590 at JSX sites passing a function-valued attribute (seen with `ref`, `onClick`). Body casts to the default-element type (`XRootDivProps`); `index.ts` type maps use it, never `Parameters<typeof XRoot>[0]`. Type-only Known diff.
- `dom.*`: static map of the tags HeroUI uses (+ `section`), not a Proxy (Known diff: `dom.article` is `undefined`); explicit `ref={props.ref}` (spread `ref` ignored); `render` ignored + dev warning.
- Dev-only code: package `#dev` import (`development` → `dev-on.ts`, default → `dev-off.ts`), same as the runtime; rolldown test proves the string is absent from production bundles. `scripts/package` keeps the map in `dist/libs/ui/package.json` (`types` `.d.ts`, `development` / `default` `.js`; checked with `nx run ui:package`).
- `composeTwRenderProps(string, string)` returns a string (upstream: a function); same classes.
- Changing props (`isDisabled={state}`, `variant={v()}`): pending live props; until then keyed `Show` re-creation.
- Tests: SSR suites `<name>.server.test.tsx` (server target via the test register, relative `.ts` barrels carried), DOM suites `<name>.test.tsx` (happy-dom) incl. a context read for every provider-wrapping part, `<name>.types.tsx` type tests; story app asserts "no JS before interaction" with an exact runtime-entry-chunk allowlist (`harness.ts` `RUNTIME_ENTRY`, name + 8-char Vite hash).
- Zero-cost: `scripts/zero-cost/packages-hashes.mjs` covers `libs/ui` (`[dom]` + `[server]` line per subpath; `./styles` CSS skipped). Every new component subpath appears as a new line → intended `--update` delta per component lane.

## 6. Inputs for Plan 2

Prerequisites (block dynamic-prop components):

| # | Item | Owner / status |
| --- | --- | --- |
| P1 | Live props: component props follow signals on client-rendered and resumed pages (second change after resume, `card.test.ts` `test.fails`) | user decision 2026-10-07; live-props lane, spec in progress |
| P2 | `_spread` update re-runs `children` when another key changes (`dom.*` children re-created; `resume.test.ts` + `tests/dom.test.tsx`, formerly `test.fails`) | fixed in runtime commit "fix(runtime): spread re-inserts children only when `children` changes"; both tests are plain `test` now |
| P3 | `ref` inside `{...spread}` ignored | compiler/runtime; needed for the RAC `render` idiom (§3) |
| P4 | `dom.*` prop types reject accessors (`class={() => …}` needs `@ts-expect-error`; Task 4 F3) | ui, before parts pass reactive classes |

cdk gaps (spec §3, confirmed; faithful RAC ports + upstream tests):

| # | Gap | Dependents |
| --- | --- | --- |
| 1 | `render` DOM-override prop on every RAC part that has it (shape §3; 48 cdk modules lack it) | 47 HeroUI component files / 103 part interfaces + RAC-forwarded parts |
| 2 | Composable `Select` (`Select` + `SelectValue` + Popover/ListBox parts); monolith replaced | select, autocomplete |
| 3 | Tabs parts `Tabs`/`TabList`/`Tab`/`TabPanel`/`TabPanels`, SelectionIndicator, `data-*="true"` states | tabs |
| 4 | Radio parts `RadioGroup`/`Radio`/`RadioField`/`RadioButton`, `RadioGroupContext` | radio, radio-group, fieldset |
| 5 | Hideable parts + `TextContext.slots` visibility (Header, Separator, Group) | 7 dirs |
| 6 | `ToggleButtonContext`; reactive `useFocusVisible`; `RouterConfig` type; `getLocalizationScript` (or N/A) | fieldset, toast, rac |
| 7 | Behaviour holes: menu popover `[data-exiting]`; `--trigger-width` without Group; table resumed selection checkboxes; popover `clearContexts` | dropdown, select/combo-box/autocomplete, table, popover |
| 8 | `data-slot` collisions (cdk-set `errorMessage`, `value-item`, `title`, …) | label, radio-group, select, popover |
| 9 | Every `data-*` boolean written as `"true"` (audit) | all CSS |
| 10 | Version check: HeroUI pins RAC 1.21.1 / react-aria 3.52.1 → diff vs cdk baseline, record in `libs/cdk/NOTICE` | all |

New from Plan 1:

- cdk `isDev()` (`globalThis.process?.env?.NODE_ENV`) warning strings ship in production bundles (`interactions/pressable.tsx`, `controllable.ts`); cdk is not in the `scripts/zero-cost/dev-leaks.mjs` scan → move cdk to a `#dev` import and add cdk to the scan. (ui is scanned since the Plan 1 final fixes: `dev-on.ts` in `DEV_FILES`, its warning text in `DEV_MESSAGES`, `#` imports resolved.)
- Server-target compiles hoist `Object.freeze([...])` template fragments without `/*#__PURE__*/`: a server bundle keeps unused `dom.<tag>` fragment arrays (DOM bundles shake them). Compiler patch queued (`ui-pure-fragments.patch.md`, root agent).
- `node scripts/package/smoke.ts ui` blocked: ui needs cdk packed, cdk blocked by its `text-field/behaviour` basename clash.
- HMR on compound statics untested (§1).
- Each new component lane: `--update` zero-cost (new `@rivetjs/ui/<name>` lines), `tests/package.test.ts` subpath mapping, story route + resume test for any provider-wrapping or dynamic-prop part.

## 7. Plan 2 findings

Wave 1 (Tasks 1-18, `10ba1a31..HEAD`): infra (barrel walk, spread `ref`, dom.* accessors), cdk `render` gap #1 closed, 13 HeroUI component dirs (+ `useCSSVariable`), wave-1 resumed story page. Tasks 19-23 (dynamic-prop components) stay blocked on live props.

### `render` prop: landed shape vs §3

- `libs/cdk/utils/render.ts`: `DOMRenderFunction<E, T>` / `DOMRenderProps<E, T>` / `renderElement` (contract only) / `slotChildren`. Same name + signature as §3; `renderProps` = cdk render-props object of accessors, `undefined` for parts without render props.
- Pattern (Task 4, rule set `render-rules.md`): `if (render) return render(attrs, rp);` early return BEFORE the unchanged compiled element. Default path identical to HEAD (one truthiness check, no allocation).
- Delta: NOT `renderElement(render, attrs, rp, (p) => <el {...p}/>)`. A JSX fallback callback breaks resume (reactive children not rebound, `ref` signals unset, adopted nodes lost); found only by cdk-components (Chromium), not by browser tests.
- Delta: `attrs` handlers must be unconditional inline arrows in the object literal (conditional → "Cannot resume spread event handler"); `render` itself must be an inline arrow / local const.
- Delta: effects / roots created in handlers on the render path run under the spread effect's owner (disposed on its next run) → detached with `runWithOwner(null, …)`, disposed by the matching end event (Button `watchPending` / `watchDisabled`; regression test: render Button press + `isDisabled` flip cancels press).
- Delta: `_spread` with `flags & 1` writes a `kids` signal at creation (throws inside a `computed`) → `children` stays a JSX child on the default path.
- Delta: no `on:custom-event` form in `_spread` → `on<Type>` keys (`"onReact-aria-focus"`, `"onRv-item-press"`, `onBeforeMatch`).
- Delta: tab index key must be lowercase `tabindex` in attrs (resume focus; fixed in 10 modules).
- Delta: reactive aria ids on render path are accessors (Menu item / MenuSection / ListBoxSection eager `aria-labelledby: slotIdRef(x)` kept a dangling id); aria prop objects (Tree `gridProps` / `rowProps`) → object-literal accessors (`gridAttr` / `rowAttr`), since `liveProps` closures built in a loop are not resumable.
- Delta: ListBox with `render` — eager `provide()` body captured by `children` broke SSR resume ("function is not serializable"); render path builds a compiled `<Provider>` body with `customRenderer ?? DefaultCollectionRenderer` (as GridList).
- Typing: `render` props are element-specific (`Handler<HTMLButtonElement>`); spreading onto another tag needs `{...(props as {})}`. `dom.*` hides this: ui `DOMRenderFunction` props = loose `DOMRenderedProps` (`Record<string, any>`), pinned in `tests/dom.types.tsx`.
- Scope landed: Button, Link, Separator, Header, Label, Text, Heading, Keyboard (T4); forms/fields/slider/Group/Form/ToggleButtonGroup (T5, 22 parts); breadcrumbs/toolbar/combo-box/grid-list/menu/tag-group/tooltip/popover/modal/dialog/disclosure/toast (T6, 28 parts); meter/progress/color/calendar/date-field/date-picker (T7, 20 parts); ListBox/Tree + ColorSwatchPicker / DateInput forwarding (T7b). Gap #1 closed; `grep 'no .?render.? prop'` over non-test src is empty. Old `it.skip` render cases replaced by pointers.
- Left out (not RAC render parts): LoadMoreItems, DetailsDisclosure, PopoverOverlay.
- Tests: `render-core` / `render-forms` / `render-collections` / `render-date-color` / `render-leftovers` browser suites; `render-parity.browser.test.tsx` (14 parts, render attrs == default element's across states, full subtree; no `render` DOM attribute leak); `render-server.test.ts` (SSR HTML parity: Calendar, RangeCalendar, DateField, DatePicker); Chromium `/button-render`, `/render-resumed` (`render-resumed.test.ts`, 20 pass).
- `dom.*` (Task 8, `1372544f`): each tag `if (props.render) return rendered(props)` before the compiled element; `rendered` calls `render(propsWithoutRender, undefined)`; lazy JSX children via `renderSlot`, function children passed as is (a wrapper arrow is non-serializable). Dev ref check (upstream wording) only for a `ref()` signal still empty after a microtask, browser only; callback refs cannot be probed (Known diff). `#r-render` resumed story: press works, text follows. Task 4's "render to `<div role=button>` does not fire press" not reproducible.
- `dom.*` props accept accessor attributes (Task 3; closes P4): one `intrinsic()` cast helper in `dom-tags.tsx`.

### `ref` in spread locus

- P3 landed (`bc0842f7`): `_spread` binds `ref` once on first run under the spread owner (first-run-only; `first=false` set at bind time). Micro-bench (node/happy-dom, 1000 spreads × 30 updates, median of 5): 75.4 → 79.3 ms (~+5%, ranges overlap); accepted as noise (Ruling 4), Chromium re-measure + revert-if-it-holds deferred to Task 24.
- Resumed / adopted pages do NOT adopt a spread `ref` (e.g. Label slot `rendered` lost). Render path is unaffected (fresh element); default elements keep an explicit `ref={…}`. `dom.*` passes `ref={props.ref}` explicitly. Documented in `libs/ui/CLAUDE.md` + `libs/runtime/CLAUDE.md`; rule 7: do not work around.
- Explicit `ref=` next to a spread that also carries `ref` binds twice → pinned by `test.fails`; compiler dedupe patch note `ref-spread-dedupe.md` queued for the root agent (no Rust in the lane).

### Barrel walk (Task 1, `efda56c0`, `734d6f43`)

- Resume chunk discovery followed only `.tsx` imports; `import { dom } from "@rivetjs/ui"` (→ `index.ts` → `src/utils/dom.tsx` → `export * as dom from "./dom-tags.tsx"`) never registered the `.tsx` leaf → no chunk for `dom-tags.tsx#div$n`.
- Fix: `barrelLeaves(entry)` in `libs/compiler/vite.ts` follows static `export … from` / `import … from` relative specifiers through `.ts`/`.js` files of source packages (cycle-safe), returns sorted unique `.tsx`/`.jsx` leaves; external / missing specifiers ignored. Tests `vite-ts-barrel.test.ts`. Review fix: stale CLAUDE.md clauses removed, barrelLeaves limits + over-registration documented.
- Related router fix `db645b57` (+ docs `48ab7174`): an app `.tsx` module outside `src/routes` not listed in `resume.modules` was silently non-resumable (request-time "Resume manifest has no chunk", dead handlers, no build error; found by Task 16). `rivetRouter` now sets `resume.appModules` (default `true`); compiler `isResumable` includes app tsx/jsx inside the root when set. Story app keeps an explicit `resume.modules: ["src/wave1-markup.tsx"]`.

### Per-component translation notes

- Children-text wrapping (`badge` / `chip`, T12): React children are values, Rivet component children are compiler thunks for any JSX child. Literal string / number → wrapped in `*Label` as upstream; `{expr}` children resolve inside a child accessor (`src/utils/with-label.tsx`), string / number result wrapped, anything else as is. Context carries plain `{ color, size, variant }` (+ `placement` for badge); `chip` size `null` = no size.
- `children ?? <default icon>` (`alert` Indicator, `close-button`, `link` Icon): any child expression (even resolving to nothing) replaces the default; omit children for the default icon. `empty-state` same for `||`. Known diff.
- lucide mappings (via `@rivetjs/kit/icon`; lucide now a peer dep of `@rivetjs/ui`): `spinner` → `LoaderCircle` (gradient fade lost; `data-slot="spinner-icon"`, `viewBox`, CSS spin kept); `alert` → `Info` (default + accent) / `CircleCheck` / `TriangleAlert` / `CircleAlert` at 16px (`data-slot="alert-default-icon"` kept); `link` → `ArrowUpRight` (upstream 9px `ExternalLinkIcon`); `close-button` → `X` (upstream 16px `CloseIcon`). Stroked vs filled glyphs = visual diffs in `known.ts`.
- Avatar primitive (T15 + fix `f8c2eb19`): first written from memory of 1.2.6 behaviour (not tarball-verified; review flagged parity unverified). Now a 1:1 port of the `@radix-ui/react-avatar` 1.2.6 tarball (version pinned by HeroUI v3.2.6 `packages/react/package.json`; `npm pack` read-only, not installed) in `libs/ui/src/vendor/radix-avatar/avatar-primitive.tsx`: one `imageLoadingStatus` per root (context); `useImageLoadingStatus` (no src → `error`; `load`/`error` listeners; `referrerPolicy`, then `crossOrigin ?? null`, then `src`; status read right after → cached image `loaded` synchronously with no fallback flash; `complete` without width → `error`; cleanup removes listeners + resets `idle`); `onLoadingStatusChange` batched like React; `Fallback` `delayMs`; dev-only `useImageCount` warning via `#dev`. Reactive `src` / `crossOrigin` / `referrerPolicy` (value or accessor) re-probe on change. Deviation: `Image` outside a `Root` keeps its own status (upstream throws). `NOTICE` + vendor CLAUDE.md updated. Chromium `/avatar`: resumed `clientEffect` loads the image without user event; `#a-swap` accessor src swap. Server `clientEffect` is a no-op → avatar dev warning only in DOM dev bundle.
- Description / ErrorMessage gate ruling (review: `useHasTextSlot` dropped): keep always-render. Upstream `FieldSlotsGate` exists only because RAC CollectionBuilder's hidden pass renders before `TextContext` slots exist; cdk `Text` returns `null` in a hidden build pass itself → identical visible DOM. Proof `tests/field-slots-gate.test.tsx` (cdk `TagGroup` + ui `Label` / `Description` / `ErrorMessage`: one part each, `aria-describedby` → `["Pick one", "Required"]`, `aria-labelledby` → label; standalone parts always render). Known diff names TagGroup / Select / ComboBox / Autocomplete as gated roots.
- `typography` (T13): uses cdk `Text` with `elementType` (brief said `Heading`; upstream uses Text). cdk `Text` Dynamic branch passes `style` only when set (server Dynamic rejects the `style` name).
- `button` (T14): no spinner (upstream has none). `ButtonGroupContext` in `button/button-group-context.ts` (Task 20); `AvatarGroupContext` in `avatar/avatar-group-context.ts` (Task 21).
- `skeleton` uses `useCSSVariable` (T9, `src/hooks/use-css-variable.ts`, plain function, try/catch + `|| undefined`, cache; barrel export deferred to Task 24; pinned absent in `package.test.ts`).
- Field primitives (`separator`, `header`, `label`, `description`, `error-message`, `field-error`) not generic over element (as upstream); `FieldError` render props are accessors (`({ isInvalid }) => isInvalid()`). `composeTwRenderProps` `cls` type widened to `(v: T) => string | undefined`. Description/ErrorMessage `data-slot` collisions (gap #8): no cdk change needed (asserted).
- `data-slot` audit (fix round): wave-1 dirs identical to upstream literals; Kbd (root + parts), Skeleton, Avatar root carry none upstream either. Drift-guard tests (badge, chip, alert, avatar) assert hard-coded defaults == `xVariants()` slots.
- Wave-1 story (T16 `4ed931da`): `/wave1` (all components, keyed `Show` re-creation, Button / CloseButton press, variant toggle, avatar), `/wave1-markup` (strict no-JS gate), per-component SSR markup == client markup (T10-13 C4 folded into one aggregate page). T17: `package.test.ts` subpath mapping already covers all 20 `src/components/*` dirs, no edit.

### Resume bugs found + fixes

- Spread function `children` on `dom.*` (T8): bare function `children` stayed at server text on resumed pages unless an accessor attribute sat next to it → `1df5d96d` (resumed spread captures a bare function children site).
- Rendered GridList / ListBox / Tree rows re-created on first selection change (focus → body); rendered DatePicker root re-created on open ("Missing resumable element 137/140") — `test.fails` after the T5-7 fix round (`dfe48bdd`), not the `tabindex` key, not region 18. Root cause: render root's spread `children: () => <Provider>…</Provider>` arrow was rendered inside `_rSpread`'s tracked read with no site; resumed DOM `_spread` could not keep an unbranded function's content on the first attribute re-run (`held === SERVER` → `textContent = ""` + fresh slot). Fix `d8d815f6`: `_rSpread` renders an `_rFn` function `children` through `_rBind` with its own symbol + captures and tags binding names ` #r`; DOM `_spread` skips content for such spreads. Not applied when the object itself read signals (` #c`). Cost: `/dom` +23 B min, `/server-resume` +154 B min (resumed spreads only); no ABI bump. 5 `test.fails` → `test`; `spread.test.ts` `#fnjsx` / `#fnjsxn`.
- Menu / Tag looked fine only because no `render` was used (Tag) or the popover is client-created (Menu).
- Render-path bugs from T5-7 review: dangling eager `aria-labelledby`, ListBox `provide()` non-serializable, Tree `liveProps` loop closures (see render deltas).
- Unlisted app module silently non-resumable → router `resume.appModules` (above).
- Dev server (not prod) re-creates CalendarCell (known).

### Open gaps

- Live props: Tasks 19-23 blocked; 6 ui DOM `outerHTML` tests (card ×2, surface ×2, header, empty-state) fail on attribute order (`data-slot` before `class`) from the uncommitted LIVE-PROPS compiler wasm → update assertions (compare sets) when it lands; `card.test.ts` live-props `test.fails` remains.
- Spread-`ref` double bind (compiler patch queued); spread `ref` not adopted on resumed pages; `_spread` has no `on:custom-event` form.
- Resume-bearing cdk parts preload chunks on load (Button, Link, TextField state chunks) → no strict "no JS before interaction" gate on pages containing them; only `/wave1-markup` is strict. Perf lane: why TextField state chunks are eager.
- kit `Icon` client DOM has an extra `<!---->` anchor vs SSR (elements identical).
- GridList `aria-labelledby` drop after selection = upstream `useSlotId` behaviour (no bug, tests pin it: `475aeb22`).
- Zero-cost hashes moved (`dom-v2-spread`, `/dom`, `/server-resume`, new `@rivetjs/ui/<name>` lines): root `--update` at Task 24 gate; `cdk-components` full run on a quiet host; Chromium re-measure of the spread `ref` check.
- `dom-tags` `rendered()` size cost (`isSlot` / `renderSlot` from `@rivetjs/runtime/slot`) unmeasured: `size-report` has no `@rivetjs/ui` entry.
- Avatar dev warning unreachable in server dev bundle; `useCSSVariable` / barrel exports decided at Task 24.
- Tree `render`, resumed stories for Group / Form / ToggleButtonGroup / Calendar / DateSegment handlers not individually covered (parity + `/render-resumed` cover the main cases).
