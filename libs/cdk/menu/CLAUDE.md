# @rivetjs/cdk/menu
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC Menu family port: `MenuTrigger`, `Menu`, `MenuItem`, `MenuSection`, `SubmenuTrigger`, `MenuLoadMoreItem` on the live collection (`../collections/components.tsx`) + react-aria useMenuTrigger / useMenu / useMenuItem / useSubmenuTrigger / useSafelyMouseToSubmenu.

## Entry points
- `@rivetjs/cdk/menu` → `index.tsx`: components above; contexts `MenuContext`, `MenuStateContext`, `RootMenuTriggerStateContext`, `MenuItemContext`; types `MenuTriggerProps`, `MenuProps`, `MenuItemProps`, `MenuSectionProps`, `SubmenuTriggerProps`, `MenuLoadMoreItemProps`, render props, `Key`, `Selection`, `SelectionMode`, state types
- `@rivetjs/cdk/menu/behaviour` → `behaviour.tsx` (explicit package.json entry): `menuTriggerProps(props, state)`, `menuProps(props, state)`, `menuEvent(e, aria, state)` (ONE delegated handler: useMenu + every useMenuItem / useSubmenuTrigger), `menuKeys`, `menuTriggerKeys`, `menuTrigger*` handlers (keydown, press, long press, context menu), `submenuTriggerKeyDown`, `submenuKeyDown`, `menuSubmenuOpened` / `menuSubmenuClosed`, `menuVirtualFocus` / `menuClearVirtualFocus` / `menuCollectionUpdated` (Autocomplete), `getItemId`, `submenuId`
- `@rivetjs/cdk/state/menu` → `../state/menu.ts`: `createMenuTriggerState`, `openMenu` / `toggleMenu` / `closeMenu`, `createSubmenuTriggerState`, `bindSubmenuTrigger`, `openSubmenu` / `closeSubmenu` / `toggleSubmenu` / `closeAllSubmenus`, `createMenuState`, `registerMenuItem` / `registerMenuSection` / `registerSubmenu`, `selectionOf`

## Layout
- `index.tsx` — components; MenuTrigger renders no element (contexts + `PressResponder` for the user's `<Button>`); Menu = `div[role=menu].rv-Menu` with one delegated handler set (inline arrows → `menuEvent`); items carry no handlers (callbacks registered by key into the menu state)
- `behaviour.tsx` — hook ports (resumable closure bags; handlers = inline arrows in object literals)
- `safely-mouse-to-submenu.ts` — useSafelyMouseToSubmenu (safe-triangle pointer tracking while a submenu is mounted)
- `intl.ts` — generated react-aria menu locale strings (used by behaviour.tsx)
- Tests: `tests/menu.browser.test.tsx` (RAC Menu.test port subset + "inside Autocomplete"), `tests/menu-trigger-modality.test.ts` (trigger keydown records keyboard modality), `tests-components/widgets.test.ts` (`/menu`, `/callbacks` resumed), `tests-components/dom-events-collections.test.ts`, `tests-components/axe.test.ts` (`/menu`); story `tests-components/app/src/routes/menu.tsx`

## Upstream
- RAC `Menu.tsx`; react-aria `menu/{useMenuTrigger,useMenu,useMenuItem,useSubmenuTrigger,useSafelyMouseToSubmenu}.ts`; react-stately `menu/{useMenuTriggerState,useSubmenuTriggerState}.ts` (Apache-2.0). Headers list `Rivet:` / `Deviation:` bullets.

## Rules / invariants
- Popover is the shared div overlay layer (`<Popover>`), never native `popover`
- Trigger `aria-haspopup="true"` (RA useOverlayTrigger type menu); pointer open focuses the menu itself, keyboard open the first / last item
- `trigger="contextMenu"`: no `aria-haspopup` / `aria-expanded` / `aria-controls` (w3c/aria#1971); `data-cm` instead (COLD-CTXMENU 2026-10-27): the resume loader cancels the browser's own menu for a cold `contextmenu` inside it (the replayed handler opens ours; before, the native menu covered the first open)
- `menuTriggerKeyDown` has no `defaultPrevented` gate (RA): the Button's usePress already prevented Enter / Space
- `menuTriggerProps` press / longPress `onKeyDown`: keys `menuTriggerKeyDown` does not handle call `continuePropagation()` (RA useMenuTrigger `default: e.continuePropagation()`; the cdk keyboard wrapper stops propagation otherwise): Tab reaches an enclosing FocusScope (sidebar sheet, dialog), Cmd/Ctrl+B the sidebar shortcut.
- ids: trigger id via `idSignal` (Button `id` merges on the server); menu id via the `idRef` context pattern (merged on the client) → `aria-labelledby` / `aria-controls` are accessors
- Item `ITEM_OWNED = ["style"]`: item DOM handlers stay on the item element
- Autocomplete: SelectableCollectionContext merged under the menu props; `shouldUseVirtualFocus` / `disallowTypeAhead` / `autoFocus` may be accessors mirrored into `state.options` by a clientEffect; `filter` = each item's own `Show`
- PROPS-CAPTURE: props destructured into locals before closures (link attrs, `delay`, `onClose`)
- Live props (P5): Menu / MenuItem `class` / `style` / `children` render props read live (`renderProps(…, props)`, untracked); MenuItem `isDisabled` live (LIVE-SWEEP round 2): `liveAt` accessor → `liveItemDisabled(state, key, own)` (with Menu `disabledKeys`), `aria-disabled` / `data-disabled` returned arrows in the spread `attrs`, `isSelected` / `tabIndex` read it; a live item is not registered in `state.disabledKeys` (handlers / keyboard read the DOM collection's `aria-disabled`). Read once: MenuTrigger `trigger` (trigger props + popover offset), SubmenuTrigger `delay` (registered with the submenu), item `id` / `href` / handlers

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/menu.browser.test.tsx`
- `STORIES_DIST=dist-c3 npx vitest run --project cdk-components libs/cdk/tests-components/widgets.test.ts libs/cdk/tests-components/dom-events-collections.test.ts`

## Gotchas
- Escape / ArrowLeft focus restore happens in a rAF (FocusScope): tests `waitFor` the active element
- `menuTriggerKeyDown` calls `noteModality(e)` before opening: on a resumed page the document listener runs before the lazily installed focus-visible listeners, so a programmatically focused trigger stayed `virtual` and Enter / ArrowDown focused the popover instead of the first item (`focusSafely` defers both in `virtual`; the popover's runs first)
- Reopening while the previous popover is still exiting reuses the mounted menu: no new `autoFocus` (as upstream); docs example tests wait for `{ absent: "#menu" }` first
- `render` prop (RAC DOMRenderProps; `(attrs, renderProps)` → spread attrs; early return before the compiled element; `tests/render-collections.browser.test.tsx`) on Menu (`div`), MenuSection (`section`), MenuItem (`div` / `a` with `href`); custom events in the spread use `on<Type>` keys (`"onReact-aria-focus"`), not `on:`
- Virtualized (`<CollectionVirtualizer layout={ListLayout}>`, COLLECTION-VIRT-2 2026-10-19): menu element = scroller (popover menus too); `builtCollectionOf` collection → `createMenuState({ virtual: { collection, layoutDelegate } })` (`state.virtual`; DOM adapter navigates the built collection, focus waits for the row: `../_adapters/selection.ts`); items get `aria-posinset` / `aria-setsize` (`menuItemPosition` → `itemPosition`); scroll forwarded to `renderer.onScroll`. Example `virtualizer-menu`, story `#vmenu`, `tests/menu.browser.test.tsx` "Menu virtualizer"
- `isEmpty` counts rendered items (MenuItem count cleanups skip the write while the menu tears down: `state.disposing`, set by a scope created before the items and the empty-state `Show`; it once re-ran that `Show` under the disposed menu owner on unmount, "Cannot run with a disposed owner"; tests `menu.browser.test.tsx` "unmounts …", ui `context-menu-command.test.tsx`); filtering keeps empty sections; no `--trigger-width` on the popover
- `[data-exiting]` on the menu popover not observed (Popover exit, C1b) — `menu-transition` example does not assert it
- Not ported: rest of RAC `Menu.test.js`, react-aria `useMenuTrigger` / `useMenu` unit tests
- False `[click-events]` a11y dev warning on `div[role=menu]`

## See also
- [../CLAUDE.md](../CLAUDE.md), [../popover/CLAUDE.md](../popover/CLAUDE.md), [../collections/CLAUDE.md](../collections/CLAUDE.md), [../autocomplete/CLAUDE.md](../autocomplete/CLAUDE.md)
- Docs: [menu](../../../apps/cdk-docs/content/components/menu.md); examples `apps/cdk-docs/examples/menu-*/`, `aria-menu/`
- `MenuItem` label / description / keyboard ids: `slotIdRef(id, false)` (UIID 2026-10-12; were kept by expectation: dangling IDREFs for items without them). The item's children render in a binding after its attributes, so the server probes them first (`probeSlots([[TextContext, …], [KeyboardContext, { id: kbd }], [SubmenuScopeContext, null]], children)`, `#server`; same providers as `body`; `Keyboard` marks its id in the probe). `MenuSection` heading keeps `slotIdRef(heading)` (by expectation: its body is a binding; open item)
