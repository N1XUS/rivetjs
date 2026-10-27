# @rivetjs/cdk/selection
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Multiple-selection state, SelectionManager, keyboard delegate, typeahead and selectable collection / item handlers: React Stately + React Aria selection ports.

## Entry points
No bare `@rivetjs/cdk/selection`; pattern `./selection/*` -> `selection/<file>.ts`:
- `selection/state` - `createMultipleSelectionState`, `SelectionSet`, `readSelection`, `getSelection`, `setSelectedKeys`, `setFocused`, `setFocusedKey`, `setSelectionBehavior`, `MultipleSelectionState`, `MultipleSelectionStateProps`, `FocusState`
- `selection/manager` - `SelectionManager`, `MultipleSelectionManager`, `SelectionManagerOptions`, `SelectionEvent`, `PointerType`
- `selection/list-keyboard-delegate` - `ListKeyboardDelegate`, `DOMLayoutDelegate`, `searchCollator` (cached per locale; the `Intl.Collator` is made on its first `compare` / `resolvedOptions` — collation data ~3.5 ms at 1× on first use, DERIVED-C2 2026-10-21: a collection mount / resumed first event no longer pays it), `ListKeyboardDelegateOptions`
- `selection/type-select` - `typeSelectKeyDown`, `typeSelectKeyDownCapture`, `typeSelectSearch`, `resetTypeSelect`, `useTypeSelect`, `TYPEAHEAD_DEBOUNCE_WAIT_MS`
- `selection/selectable-collection` - `selectableCollectionKeyDown` / `KeyDownCapture` / `Focus` / `Blur` / `MouseDown` / `Scroll` / `VirtualFocus` / `ClearVirtualFocus` / `Updated` / `AutoFocus`, `selectableCollectionKeys`, `syncFocus`, `collectionTabIndex`, `useSelectableCollection`, `FOCUS_EVENT`, `CLEAR_FOCUS_EVENT`, re-export `isOpeningLink`
- `selection/selectable-item` - `selectableItemPointerDown` / `PointerUp` / `PointerCancel` / `Click` / `KeyDown` / `KeyUp` / `DoubleClick` / `Focus` / `DragStart`, `selectableItemStates`, `selectableItemAttrs`, `focusSelectableItem`, `closestItem`, `LONG_PRESS_THRESHOLD_MS`
- `selection/selectable-list` - `selectableListOptions`, `selectableListKeyDown` / `KeyDownCapture` / `Focus` / `Blur` / `MouseDown`, `useSelectableList`
- `selection/utils` - `isNonContiguousSelectionModifier`, `isCtrlKeyPressed`, `useCollectionId`, `getCollectionId`, `refElement`, `RefLike`, re-export `getItemElement` (from `../collections/dom.ts`)
- `selection/dom-utils` - virtual focus (`moveVirtualFocus`, `dispatchVirtualFocus`/`Blur`, `getVirtuallyFocusedElement`), `pointerTypeOf(event)`, `openLink(target, modifiers, href?)` (anchor or temporary anchor, via `../utils/links.tsx`); re-exports modality (`getInteractionModality`, `trackModality` = `noteModality`, `_setInteractionModality` from `../interactions/focus-visible.tsx`), `isVirtualPointerEvent` (`../platform`), scrolling / `nodeContains` (`../utils/dom.ts`), `focusWithoutScrolling` (`../utils`), `focusSafely` (`../focus`), `isOpeningLink` (`../utils/links.tsx`)
- `selection/keyed` - Rivet: per-key reactive reads `selectionOf(state, key)` (`NOT_SELECTED` / `IN_SELECTION` / `ALL_SELECTED`), `isFocusedKey(state, key)`, `hasFocusedKey(state)`, `isSelectionEmpty(state)`, `KeyedSelectionSource` (works on both `state.ts` and `_adapters/collections.ts` states)
- `@rivetjs/cdk/state/selection` (`../state/selection.ts`) re-exports `state` + `manager` + collection types (react-stately-shaped entry)

## Layout
- `keyed.ts` - Rivet per-key reads over `selector` (no upstream)
- `state.ts`, `manager.ts` - React Stately; consumed by `../collections/list-state.ts`, `../collections/tree-state.ts`, `../state/selection.ts`
- `selectable-collection.ts`, `selectable-item.ts`, `selectable-list.ts`, `type-select.ts`, `list-keyboard-delegate.ts`, `utils.ts`, `dom-utils.ts` - React Aria
- all files depend on `../collections/types.ts` (+ `nodes.ts`, `dom.ts`)
- tests: `tests/selection.test.ts` (state, manager, ListKeyboardDelegate, typeahead, tree-state), `tests/selectable-collection.browser.test.ts` (Chromium, fixture `tests/fixtures/selection-list.ts`: selectable-list/-item/-collection + utils)
- docs examples: `apps/cdk-docs/examples/selection-{dom,functions,keyboard-delegate,manager,manager-api}/`, `keyboard-navigation-delegate/`

## Upstream
- `state.ts`: `@react-stately/selection` Selection.ts, useMultipleSelectionState.ts, types.ts. Rivet: plain data + signals created once in the component body; setters = free functions taking the state; anchor / current keys in own signals (class instances do not serialize)
- `manager.ts`: `@react-stately/selection` SelectionManager.ts. Rivet: construct per use from collection + serializable state; `isSelected` / `isEmpty` read keyed (`keyed.ts`); `_isSelectAll` cached per selection value (a memoized manager, e.g. `nodeSelectionManager`, stays correct)
- `selectable-collection.ts`: `@react-aria/selection` useSelectableCollection.ts. Rivet: handler bodies `(options, event)` wired as explicit `onKeyDown` / `onFocusIn` / … attributes; React effects (focus `focusedKey`, scroll into view, refocus collection) run synchronously at handler end (`syncFocus`); `isVirtualized` (RA): no scroll-position restore on focus and no `Scroll` bookkeeping (virtualizers own the scroll position; a click reset a virtualized ListBox to scrollTop 0)
- `selectable-item.ts`: useSelectableItem.ts; usePress / useLongPress reduced to the events selection reads (press start / up / press + pointerType, touch long press); handlers delegated on the collection element (`closestItem`); pointerup of a press started on the item keeps the pointerdown pointer type (RA usePress: iOS Safari fires a touch's pointerup at 0×0, which `pointerTypeOf` reads as virtual; THEME-IOS 2026-10-27, `tests/ios-touch-press.browser.test.tsx`)
- `selectable-list.ts` useSelectableList.ts; `type-select.ts` useTypeSelect.ts (buffer per owner in a WeakMap, not in state); `list-keyboard-delegate.ts` ListKeyboardDelegate.ts + DOMLayoutDelegate.ts; `utils.ts` utils.ts
- `dom-utils.ts`: `@react-aria/focus` virtualFocus (rest re-exported from the shared foundations)

## Rules / invariants
- Keyed reads (F5, lane IMPL-SELECTION 2026-10-09): `SelectionManager.isSelected` / `isEmpty` (+ `_adapters/collections.ts` `isSelected` / `isEmpty` / `isKeySelected`), `selectableItemStates` `isFocused` + `selectableItemAttrs` `tabIndex` (`focusedKeyIs`: keyed for managers exposing `selectionState`), listbox option `tabIndex`, tag-group `tagProps` `tabIndex`, `state/list.ts` `itemTabIndex` / `itemFocused` go through `keyed.ts` (reactivity `selector`, WeakMaps keyed by the state's signals: shared by spread copies, never serialized). Hints are reactivity's own (`memberKeys` for selections, default pair hint for focus — LAZY-T6: server resume knows them, so a lazy collection row reading `selectionOf` / `isFocusedKey` is recorded per key and wakes only when its key flips; a custom hint function would bring back the whole-For wake). Same values as upstream; a binding depends on its own key only, so a selection / focus change re-runs the changed items (1000-option ListBox: 2.4 → 0.06 ms per change). Per-item code must read focus as `isFocusedKey(...) && isFocused` (key first: only the focused item tracks the collection focus). A new per-item read of `selectedKeys()` / `focusedKey()` brings back O(items) updates
- Never capture a `SelectionManager` (class instance) in a resumable closure: capture the state, rebuild the manager per event (`manager.ts:3-5`, `selectable-collection.ts:8`)
- Options objects are cheap: rebuild per event from serializable state
- Typeahead buffer + press state live in WeakMaps keyed by owner element / state - never serialized
- `selectable-item.ts` press parity with RA usePress: `itemProps` (`ItemPressProps`: `onPressStart` / `onPressEnd` / `onPressUp` / `onPress` / `onPressChange` / `onClick`) fire around selection / action; a handled button-0 non-link click calls `onClick` then `stopPropagation()`; a keyboard press (keyup Enter / Space) also calls `onClick` with a synthetic `MouseEvent` (RA `triggerSyntheticClick`); links open via `router` option (`RouterProvider` navigate) else `openLink`; `UNSTABLE_itemBehavior` ("action" / "toggle" / "replace") overrides the per-item press behaviour
- Item markup: `selectableItemAttrs` sets `data-key` (+ `data-key-type="number"` for numbers, `selectable-item.ts:144`) and roving `tabIndex`

## Commands
- `npx vitest run --project cdk libs/cdk/tests/selection.test.ts libs/cdk/tests/selectable-collection.browser.test.ts`

## Gotchas
- ListBox (`../listbox/behaviour.tsx`) runs on `selectable-*` / `type-select` / `list-keyboard-delegate`; menu, tabs, toolbar, `listbox/options.tsx` still use the `../_adapters/` copies
- `manager.ts` `PointerType` is re-exported from `../interactions/utils.ts`
- Numeric key encoding is `data-key-type="number"` everywhere (`../collections/dom.ts`)
- Upstream "Ctrl" vs macOS "Alt" modifier: the browser test uses `Alt` on darwin (`tests/selectable-collection.browser.test.ts:9-10`)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../collections/CLAUDE.md](../collections/CLAUDE.md), [../_adapters/CLAUDE.md](../_adapters/CLAUDE.md), [../state/CLAUDE.md](../state/CLAUDE.md)
- `apps/cdk-docs/content/foundations/selection.md`, `apps/cdk-docs/content/foundations/keyboard-navigation.md`
- `docs/design/specs/2026-10-05-collections-parity.md`
