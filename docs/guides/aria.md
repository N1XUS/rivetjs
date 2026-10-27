# CDK + ARIA (`@rivetjs/cdk`) — experimental

Design: [2026-10-03 spec](../design/specs/2026-10-03-cdk-and-aria-design.md); implementation status + queued compiler work: [2026-10-04 spec](../design/specs/2026-10-04-cdk-aria-implementation-design.md).

## Packages
- Both are source packages (`"rivet": { "source": true }`, [vite](vite-integration.md)): `.tsx` compiled by the app's build, resume symbols `@rivetjs/cdk/<path>#<Component>$n`.
- One subpath per module; unused module = 0 B (no barrel). Deps: `@rivetjs/reactivity`, `@rivetjs/runtime`; aria → cdk.
- Resumed pages: no library JS before the page is loaded (Playwright-checked at `load`); afterwards the framework preload plan applies: runtime + chunks of widgets with per-item bindings in view (Tabs, ListBox, ComboBox) prefetch at idle / when visible, others (Button, Menu, Dialog, Popover, form fields) on intent; the first interaction then runs synchronously.

## `@rivetjs/cdk`
| Subpath | Exports | Notes |
| --- | --- | --- |
| `id` | `createId`, `withIdScope` | re-export of `@rivetjs/runtime/id` ([slots](slots.md#portal-and-createid)) |
| `platform` | `supports(feature)` (`field-sizing` `base-select`), `isMac` `isIOS` `isAndroid` `isWebKit` `isFirefox`, `isCtrlKeyPressed`, `_setSupports` | server: `undefined` (never branch markup on UA); memoized |
| `bidi` | `direction(el)`, `logicalKey(key, dir)` | |
| `keys` | `nextIndex(count, from, key, {orientation, wrap, homeEnd, pageSize, dir, isDisabled})` → index \| `null` (not handled); `typeahead(owner, texts, from, key, now?, isDisabled?)`; `navigationKeys(opts)` → `data-rk` value | pure; typeahead: `Intl.Collator` base sensitivity, 750 ms buffer, repeated char cycles, leading Space ignored |
| `a11y` | `announce(msg, "polite"\|"assertive")`, `clearAnnouncements`, `isVisible` `isFocusable` `isTabbable` `tabbables`, `visuallyHidden` (style object, react-aria `useVisuallyHidden`), `hideVisually(el)` (CSSOM) | announce uses the SSR `<Announcer>` regions, else creates one (CSSOM-hidden, CSP-safe) |
| `announcer` | `<Announcer class?>`, `<LiveAnnouncerRegions class?>` | static polite + assertive regions, inline visually hidden `style` (strict CSP: `style-src-attr 'unsafe-inline'`); `class` only adds yours; render once in the layout (live regions must exist before the change) |
| `focus` | `focusFirst` `focusLast`, `containFocus(scope, event)`, `saveFocus(within?)` → restore, `roveFocus(items, item)`, `inertOutside(el)` → undo | |
| `focus-scope` | `<FocusScope contain? restoreFocus? autoFocus?>` | React Aria FocusScope; `<Overlay>` wraps every overlay in one (contain for modals); `containFocus` judges by `event.target` (cold first Tab runs after the browser moved focus) |
| `collections` | `domItems`, `keyOf`, `sameKey`, `isDisabledItem`, `itemText`, `keyId`; `createSelection({mode, selected?, defaultSelected?, toggleSingle?})`, `isSelected` `firstSelected` `selectKey` `toggleKey` `extendTo` `selectAll` `clearSelection` | DOM as collection: handlers query rendered items (`data-key`), no item model serialized; selection = `Signal<Set<Key>>` |
| `overlay` | `overlay(element, AriaOverlayProps)` → cleanup (`onClose`, `isDismissable`, `shouldCloseOnInteractOutside`, `shouldCloseOnBlur`, `isKeyboardDismissDisabled`), `interactOutside`, `topOverlay`, `AriaOverlayProps` | React Aria useOverlay: stack of visible overlays (top-most closes), Escape inside, pointerdown+click outside; div overlay layer, never native top layer; call on open, cleanup on close |
| `position` | `overlayPosition({target, overlay, placement, offset, crossOffset, containerPadding, shouldFlip, maxHeight, arrow, onClose, …})` → `{placement, triggerAnchorPoint, position, updatePosition, dispose}`, `calculatePosition` (pure), `Placement`; deprecated `compute`, `position` | React Aria geometry (flip, offsets, boundary, arrow, max height); follows resizes, closes on scroll parent scroll; CSSOM writes, `data-placement`, `--trigger-width`, `--rv-available-height`, `--trigger-anchor-point` |
| `interactions` | `controllable(signal?, default)`, `merge(...bags)` | merge: `class` / `aria-describedby` / `aria-labelledby` joined (accessors stay accessors), `on*` chained, later wins |
| `clipboard` | `copy(text)` | |

## `@rivetjs/cdk`
- Layers: `@rivetjs/cdk/state/<name>` (serializable state factories), `@rivetjs/cdk/<name>/behaviour` (attribute + handler functions for custom markup), `@rivetjs/cdk/<name>` (component).
- Collections compose RAC parts (`<Tabs><TabList><Tab id>…</TabList><TabPanel id>…</Tabs>`, `<ListBox><ListBoxItem>…`; component children are lazy slots) or render `items` (`<TabList items={…}>{(item) => <Tab id={item.id}>…</Tab>}</TabList>`); most collection components also take an `items` preset (data in, default parts out).
- Two-way state: pass a signal (`selected={sig}`, `value={sig}`), else `defaultX`. Callback props on resumed pages: any function — a component given one adopts with its parent ([mechanics](resumability.md#mechanics)).
- Styling: default `rv-<Name>[-part]` class only when `class` (`…Class`) is omitted; state through ARIA attributes (`[aria-selected=true]`, `[aria-expanded]`) plus `data-focused`, `data-placement`, `data-orientation`; overlay transitions `data-entering` `data-exiting` (RAC) + `data-closed` `data-enter` `data-leave` `data-transition` (Headless UI, `@rivetjs/kit/transition`). No behaviour stylesheet: behaviour-critical styles inline / CSSOM (modal underlay `position:fixed;inset:0;z-index:100`, popover/menu/listbox z-index 100000 + arrow from `overlayPosition`, visually hidden parts, usePress `touch-action`), so own classes never break behaviour. `theme.css` (optional starter look only: tokens, `light-dark()`, forced colors, underlay centering + backdrop), `tailwind.css` (`focused:`, `placement-*:`, `orientation-*:`, `entering:`, `exiting:` variants). Layer `rivet.theme`; selectors in `:where()` (0 specificity).

| Component | Native base | Keyboard | Notes |
| --- | --- | --- | --- |
| `Button` | `<button>` | native | `onPress` alias of click |
| `ToggleButton` | `<button aria-pressed>` | native | `selected` signal |
| `Checkbox`, `Switch` | `<input type=checkbox>` (`role=switch`) | native | form value without JS; `checked` binding + `onChange`, not `model:checked` (a server `model:` read inside a component makes the call site a region → the first change re-rendered the control, focus lost) |
| `RadioGroup` | `<fieldset role=radiogroup>` + radios | native arrows | `value` signal |
| `TextField`, `TextArea` | `<input>` / `<textarea>` + `<label>` | native | `description`, `errorMessage` + `invalid` → `aria-describedby`, `aria-invalid` |
| `DisclosureGroup` / `Disclosure` / `DisclosurePanel` | RAC parts: `Heading` > `Button slot="trigger"` (`aria-expanded`, `aria-controls`) + `div[role=group]` panel (`hidden` from the server) | Enter/Space on the button | `isExpanded` / `expandedKeys` value or Signal; `allowsMultipleExpanded`; Angular accordion extras (`openAll` / `closeAll`, `onOpened` / `onClosed` / `onDestroyed`; `@rivetjs/cdk/accordion` re-exports); `DetailsDisclosure` = native `<details name>`, no JS |
| `Dialog` | RAC `DialogTrigger` > `Button` + `ModalOverlay` > `Modal` > `Dialog` (div overlay layer: `.rv-ModalOverlay` underlay, `.rv-Modal`, `section.rv-Dialog[role=dialog]`) | Escape, Tab contained, focus restore | rendered only while open / animating out (`data-entering` / `data-exiting`); dialog focuses `[autofocus]` child else itself; scroll lock + inert outside in JS while open; trigger: no `aria-haspopup`, `aria-controls` only while open; `Heading slot="title"`, `Text slot="description"`, `Button slot="close"`; `isDismissable`, `isKeyboardDismissDisabled`, `shouldCloseOnInteractOutside`; `DialogTrigger trigger` = press / longPress / hover / focus; `({close}) =>` children |
| `Popover` | trigger + `role=dialog` in the div overlay layer, `overlayPosition` placement | Escape, outside click, blur; Tab contained unless `isNonModal` | modal by default (underlay, inert, scroll lock); takes focus; labelled by `title`; DismissButton (visually hidden, `tabIndex -1`); `data-placement` |
| `ListBox` | `role=listbox` / `option` | arrows, Home/End, typeahead, Space/Enter, Ctrl/Cmd+A, Shift+arrows (multiple) | roving `tabindex`, `followFocus`, `orientation` |
| `Tabs` | `role=tablist` / `tab` / `tabpanel` | arrows (orientation, RTL), wrap, Home/End, Enter/Space (manual) | `keyboardActivation="automatic" \| "manual"`; selected panel only (`shouldForceMount`: `inert`) |
| `MenuTrigger` / `Menu` / `MenuItem` / `MenuSection` / `SubmenuTrigger` | RAC parts: `Button` (`aria-haspopup=true`) + `Popover` > `div[role=menu].rv-Menu` > `.rv-MenuItem` (`menuitem` / `menuitemcheckbox` / `menuitemradio`, `<a>` with `href`) | ArrowDown/Up open on first/last, arrows, Home/End, typeahead, Enter/Space, ArrowRight/Left submenus, Escape (refocus trigger), Tab closes all | one delegated handler on the menu (`menuEvent`), items carry no handlers; `onAction`, selection, sections, `shouldCloseOnSelect`, `trigger` press / longPress / contextMenu; virtual focus inside `Autocomplete` |
| `ComboBox` | `<input role=combobox>` + in-page listbox (`hidden` while closed, `overlayPosition` while open) | typing filters (case / accent-insensitive, `contains` \| `startsWith`) and activates the first match; arrows (wrap), Enter commits, Escape closes then clears | focus stays in the input (`aria-activedescendant`); hidden `name` input; result count announced |

- Cold keys: composite widgets declare their navigation keys (`data-rk` → boundary `k`, [resumability](resumability.md#mechanics)) → a cold arrow / Space never scrolls the page while the chunk loads.
- Server HTML carries the full ARIA state (roles, `aria-selected`, roving `tabindex`, `hidden` panels): assistive tech reads it before any JS.

## Dev a11y checks (runtime)
- `@rivetjs/runtime/dom` `development` condition only (dev/a11y.ts; production: 0 B). Starts on the first client render (or at load on resumed dev pages, below); audits the document, then added subtrees / changed attributes a microtask after the render.
- Rules (warn once per element as `Rivet a11y [rule]: …` + `  in <component chain (file:line:col)>` — or `  in server-rendered HTML of /path (resume site data-r="N")` — + `  element: <css path>` + `  docs: <url>` lines (`dev/where.ts`); devtools hook event `a11y { rule, element, message, where }`): `img-alt`, `click-events` (onClick on a non-interactive element without role + tabIndex + key handler; client-bound handlers only; composite widget roles — listbox, grid, tree, menu, tablist, radiogroup, toolbar … — are exempt), `tabindex-positive`, `label-control`, `accessible-name` (button, `a[href]`, named widget roles; a labelable control inside a `<label>` is named by the label's own text — text of the control's subtree and of other controls in the label does not count), `aria-idref` (labelledby / describedby / controls / owns / activedescendant / errormessage / details; judged once the document settles: 100 ms after the last mutation, at most 2 s), `duplicate-id`.
- Opt out: `<html data-rivet-a11y="off">`. Resumed dev pages (`vite serve`, dev resume): the generated `entry.dev.tsx` starts them at load (`@rivetjs/runtime/dev/a11y`; default resolution = no-op stub); same module instance as the dev facade's.

## Tests
- [cdk unit](../../libs/cdk/tests/cdk.test.ts): key managers, typeahead, selection, positioning, merge, server-side platform probes.
- [aria browser](../../libs/cdk/tests-components/): production build of a story app ([tests/app](../../libs/cdk/tests-components/app/)), node adapter, Chromium: [listbox](../../libs/cdk/tests-components/listbox.test.ts), [widgets](../../libs/cdk/tests-components/widgets.test.ts) (tabs, menu, dialog, popover, combobox, buttons, form fields incl. cold-Space focus, FocusScope cold Tab), [axe](../../libs/cdk/tests-components/axe.test.ts) (axe-core 4.13 over server HTML with scripts stripped and over resumed widgets with overlays open).
- [dev a11y](../../libs/runtime/tests/dev-a11y.test.ts), [cold keys](../../libs/runtime/tests/derived-cold-keys-browser.test.ts).

## Docs site
- Pages: `apps/docs/content/ui/accessible/<component>.md` (one per component; Checkbox+Switch, Button+ToggleButton, TextField+TextArea grouped), `apps/docs/content/ui/cdk/<module>.md`; each embeds a live example (`apps/docs/examples/aria-*`, `cdk-*`) whose `test` steps drive the keys and assert ARIA state.

## Limits
- Props are live (live-props P5): a prop that reads a signal (`isInvalid={!ok()}`) updates the part's attributes in place (focus kept, also resumed). Pass a signal for two-way values (`value={text}`). Live by default (LIVE-SWEEP 2026-10-11): attributes too (TextField / SearchField `type` / `inputMode` / `autoComplete` / …, NumberField min / max / step, Button `type`, Select `placeholder` / `isRequired`; round 2: Slider min / max / step / orientation / formatOptions, Tabs orientation / keyboardActivation / disabledKeys, RadioGroup orientation, Meter / ProgressBar formatOptions, tooltip / DialogTrigger hover delays, GridListItem / MenuItem `isDisabled`). Read once (JSDoc "Read once at mount" + component CLAUDE.md): handlers, ids, `name`, element-picking props, `autoFocus`, state options (`default*`, `selectionMode`, collection roots' `disabledKeys`), MenuTrigger / DialogTrigger `trigger`; not live yet: collection roots' state props.
- `Portal` content is browser-only; a portal visible at load needs `clientOnly(…, { when: "load" })`.
- ComboBox announcements are English only (`comboInput` takes `messages`, the component exposes no prop).
- Chromium only in CI so far (Firefox / WebKit lanes pending).
- No Slider, Toast, GridList, Table, Tree components yet (queued RAC re-ports).
- `mergeProps` / `chain` (`@rivetjs/cdk/interactions/merge-props`) combine two handlers of one type into a run-time function, which does not resume → merge attributes only; pass handlers as `onX` (or object-literal functions).
- `style` attribute unsupported → `overlayPosition` writes CSSOM from JS.
- Content of a closed overlay is created on open: resumable components inside need function children (`{() => …}` / `({close}) => …`).
