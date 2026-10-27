# libs/cdk/_adapters
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Not exported. Earlier local adapters of react-stately / react-aria collections and selection, written before `../collections/`, `../selection/` existed. Still imported by select / menu / tabs / grid-list / `state/` (collections, selection) and by the `intl.ts` of many components (see Importers). `interactions.ts` / `press.ts` are now thin re-exports of the shared foundations (modality, press events, links, scrolling) plus the owner-keyed long-press / press trackers. Goal: migrate importers onto `../collections` + `../selection`, then delete.

## Layout
Two families (different branches, overlapping APIs):
- "cdk-collections" family (ListBox / Select / Menu):
  - `collections.ts` - Node/Collection types, `ListCollection`, `domCollection`, `keyAttrs`/`domKey` (re-exported from `../collections/dom.ts`: `data-key-type="number"`), `buildNodes`, `flatItems`, `isSection`, `textOf`, `createMultipleSelectionState`, `makeNode` (internal), `ListKeyboardDelegate`, `DOMLayoutDelegate`, `getSearchCollator`; `getSearchCollator()` (menu / select keyboard delegates) is lazy (ZERO ABI-SPLIT 2026-10-27, as `selection/list-keyboard-delegate.ts` `searchCollator`): the `Intl.Collator` is made on the first `compare` / `resolvedOptions` (typeahead) — making it cost ~13 ms at 4× CPU inside the first menu-opening press
  - `selection-manager.ts` - leaf (BIG-UI-2 2026-10-27): `SelectionManager`, `GroupSelectionManager`, `domCollection`; imported only by `selection.ts` (values) and `type-select.ts` / `select/behaviour.tsx` (types). In `collections.ts` they shipped on every Select / ComboBox / Menu page (a module is atomic in its chunk; ~1 KB gz per page that only renders a list state + keyboard delegate). Import them from here, never through a re-export in `collections.ts`
  - `selection.ts` - delegated collection handlers: `collectionKeyDown`/`KeyUp`/`PointerDown`/`PointerUp`/`Click`/`DoubleClick`/`MouseDown`/`PointerOver`/`FocusIn`/`FocusOut`/`DragStart`, `collectionKeys`, `autoFocusCollection`, (`collectionPointerUp`: a pointer press started in the collection keeps its pointerdown pointer type — iOS Safari's 0×0 touch pointerup read as virtual dropped the press, a tapped Menu item closed without selecting; THEME-IOS 2026-10-27), `typeSelectKeyDown` (re-export), `syncFocus`, `managerOf`, `delegateOf`, `ItemPressHooks`, `LinkBehavior`, `SelectableCollection`; `SelectableCollection.virtual?: VirtualCollection { collection(), layoutDelegate? }` (virtualized Menu: manager over the built collection, no scroll restore, focus of an unrendered row retried after render — `whenRendered`)
  - `type-select.ts` - RA useTypeSelect adapter `typeSelectKeyDown(list, root, manager, delegate, e, onTypeSelect?)` + `_resetTypeSelect` (WeakMap search per list, 1000 ms debounce); own module so `select/behaviour.tsx` (closed trigger typeahead) does not pull the 13 KB collection handlers into the Select trigger chunk closure (UI-COLD 2026-10-08)
  - `interactions.ts` - re-exports modality (`noteModality`, `isFocusVisible`, `get/setInteractionModality` from `../interactions/focus-visible.tsx`), `isVirtualClick` (`../platform`), `focusSafely` (`../focus`), `openLink` / `isOpeningLink` (`../utils/links.tsx`), scrolling (`../utils/dom.ts`), virtual focus + `pointerTypeOf` (`../selection/dom-utils.ts`); owns `pressEvent()` (RA `PressEvent` shape, `continuePropagation` no-op) and `startLongPress` / `cancelLongPress`
  - `intl.ts` - `LocalizedStrings`, `localeOf`, `stringsFor`, `formatMessage` (ICU subset)
- "aria-grid-tree" family (Tabs / Toolbar / Breadcrumbs):
  - `collection.ts` - Node/Collection types, node helpers, `ListCollection`, `TreeCollection`, `buildNodes`
  - `dom-collection.ts` - `DOMCollection`, `itemKeyAttrs`/`elementKey` (= `keyAttrs` + `data-collection`, `domKey` from `../collections/dom.ts`), `collectionElements`, `DOMLayoutDelegate`
  - `grid-selection.ts` - `createMultipleSelectionState`, `SelectionManager`, `setSelectedKeys`, `isKeySelected`, `hasKey`
  - `selectable.ts` - `selectableCollectionKeyDown`/`FocusIn`/`FocusOut`, `selectableItemPress*`, `selectableItemLinkClick`, `syncFocus`, `typeSelectKeyDown`
  - `press.ts` - `beginPress`/`endPress`/`currentPress`, `armLongPress`; re-exports `PressEvent` / `pressEvent` (`./interactions.ts`), modality, `isVirtualClick`, `pointerTypeOf`

## Importers (grep `_adapters/`; snapshot 2026-10-06)
- `collections.ts`: `menu/behaviour.tsx`, `menu/index.tsx`, `select/behaviour.tsx`, `state/list.ts`, `state/menu.ts`, `state/select.ts`
- `selection.ts`: `menu/behaviour.tsx`, `select/behaviour.tsx` (type only), `state/list.ts`
- `type-select.ts`: `select/behaviour.tsx`, `selection.ts`
- `interactions.ts`: `menu/behaviour.tsx`, `select/behaviour.tsx`
- `intl.ts`: `<component>/intl.ts` + behaviour of autocomplete, combobox, grid, menu, number-field, search-field, select (+ `index.tsx`, `select-value.tsx`), spinbutton, table, tag-group, toast, tree
- `collection.ts`: `tabs/index.tsx` (types), `tabs/behaviour.ts`, `tabs/keyboard-delegate.ts`, `state/tabs.ts`, `tests-components/selection-manager.test.ts`, `tests-components/tabs-state.test.ts`
- `grid-selection.ts`: `tabs/behaviour.ts`, `tabs/keyboard-delegate.ts`, `state/tabs.ts`, both tests above
- `dom-collection.ts`: `tabs/behaviour.ts`, `grid-list/behaviour.ts`; `press.ts` (`setInteractionModality`, `PressEvent` type), `selectable.ts`: `tabs/behaviour.ts` only (tab presses run through `../interactions/press.tsx` `pressProps`)
- ListBox (`listbox/index.tsx` + `behaviour.tsx`) no longer imports `_adapters` (the old `listbox/behaviour.ts` + `listbox/options.tsx` are deleted)
- internal: `selection.ts` -> `collections.ts`, `selection-manager.ts`, `interactions.ts`; `selection-manager.ts` -> `collections.ts`; `selectable.ts` -> `collection.ts`, `dom-collection.ts`, `grid-selection.ts`, `press.ts`, `../link/router.ts`; `dom-collection.ts`, `grid-selection.ts` -> `collection.ts`; shared types from `../collections/types.ts`

## Upstream
- All: react-spectrum (Apache-2.0, © Adobe); headers say "LOCAL ADAPTER … swap the imports to `@rivetjs/cdk/collections` / `@rivetjs/cdk/interactions` once that branch publishes and delete this file"
- `collections.ts` + `selection-manager.ts`: SelectionManager, useMultipleSelectionState, ListCollection, getChildNodes, ListKeyboardDelegate, DOMLayoutDelegate, selection/utils
- `selection.ts`: useSelectableCollection, useSelectableItem, useSelectableList, useTypeSelect - one delegated listener per event type on the collection root
- `interactions.ts`: react-aria useLongPress timer + usePress event shape (rest re-exported)
- `intl.ts`: `@internationalized/string` LocalizedStringDictionary / Formatter, useLocalizedStringFormatter (`{arg}`, `plural` with `#` / `=n`, `select`)
- `collection.ts`: getChildNodes, ListCollection, TreeCollection; `dom-collection.ts` DOMLayoutDelegate + getItemElement; `grid-selection.ts` Selection, useMultipleSelectionState, SelectionManager; `selectable.ts` useSelectableCollection, useSelectableItem, useTypeSelect, utils
- `press.ts`: "ported in spirit" header (press start / end bookkeeping of usePress, useLongPress timer)

## Replacements (migration targets)
- `collections.ts`, `collection.ts`, `dom-collection.ts` -> `../collections/{types,nodes,list,tree,dom}.ts`
- `grid-selection.ts`, selection parts of `collections.ts` -> `../selection/{state,manager}.ts`
- `selection.ts`, `selectable.ts` -> `../selection/{selectable-collection,selectable-item,selectable-list,type-select}.ts`
- `interactions.ts`, `press.ts`: already thin layers over `../interactions/*`; delete with their importers
- `intl.ts` -> `../i18n/index.ts` (`getStringsForLocale`, `formatString`)

## Rules / invariants
- `selection-manager.ts` `SelectionManager.isSelected` / `isEmpty` + `isKeySelected` read keyed (`../selection/keyed.ts`: a binding re-runs only when its key changes)
- Do not add new importers; new code uses `../collections/*`, `../selection/*`, `../interactions/*`, `../i18n`
- State = signals + JSON; managers / delegates built per event inside handlers; transient state (typeahead buffer, press in progress) in WeakMaps, never serialized; no import-time globals (modality listeners attach on first handler call)
- Markup contract of `dom-collection.ts` (header lines 8-18): `data-collection="<id>"` on root + nodes, `data-key` (+ `data-key-type="number"`), type from `data-type` or role, `hidden` subtrees excluded, `aria-level` -> level

## Commands
- `npx vitest run --project cdk-components libs/cdk/tests-components/selection-manager.test.ts libs/cdk/tests-components/tabs-state.test.ts`
- after any change also: listbox / select / tabs / menu suites (see their CLAUDE.md)

## Gotchas
- Numeric keys: one encoding, `data-key-type="number"` (`../collections/dom.ts` `keyAttrs` / `domKey`), shared by both families, listbox, tabs and `../selection`
- Duplicate implementations of `SelectionManager` / `ListCollection` exist 3 times (two families here + `../selection`, `../collections`); `ListKeyboardDelegate` only in `../selection` now: fix bugs in all, or migrate

## See also
- [../CLAUDE.md](../CLAUDE.md), [../collections/CLAUDE.md](../collections/CLAUDE.md), [../selection/CLAUDE.md](../selection/CLAUDE.md), [../state/CLAUDE.md](../state/CLAUDE.md)
- [../listbox/CLAUDE.md](../listbox/CLAUDE.md), [../select/CLAUDE.md](../select/CLAUDE.md), [../tabs/CLAUDE.md](../tabs/CLAUDE.md)
- `docs/design/specs/2026-10-05-collections-parity.md`, `docs/design/specs/2026-10-05-tabs-parity.md`
