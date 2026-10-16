---
title: Selection
description: Selection in @rivetjs/cdk - a signal of keys with helpers, plus the React Aria SelectionManager, selectable list and item handlers and typeahead.
template: guide
status: experimental
related: [foundations/overview, foundations/collections, foundations/keyboard-navigation, components/listbox]
---

Two layers, both resumable because the state is signals and plain data:

- `@rivetjs/cdk/collections`: a small `Selection` (a `Signal<Set<Key>>`, a mode, a range anchor) and helpers that treat the server-rendered elements as the collection. For hand-written lists.
- `@rivetjs/cdk/selection/*`: the React Aria port (`@react-stately/selection`, `@react-aria/selection`). `createMultipleSelectionState`, `SelectionManager`, the selectable collection, list and item handlers, `ListKeyboardDelegate` and type select. It is what [ListBox](../components/listbox.md), Select, ComboBox, Menu and Tabs are built on.

::example{id=selection-dom}

## Selection helpers

```ts
import { createSelection, isSelected, selectKey, toggleKey, extendTo, selectAll, clearSelection, firstSelected } from "@rivetjs/cdk/collections";
```

`createSelection(options)` returns `{ selected, mode, anchor, toggleSingle }`.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `mode` | `"none" \| "single" \| "multiple"` | `"single"` | |
| `selected` | `Signal<Set<Key>>` | none | Your signal (two-way). |
| `defaultSelected` | `Iterable<Key>` | empty | Initial keys of an internal signal. |
| `toggleSingle` | `boolean` | `false` | Single mode: selecting the selected key again clears it. |

| Function | Does |
| --- | --- |
| `isSelected(selection, key)` | Whether `key` is selected. Reads the signal: use it in JSX. |
| `firstSelected(selection)` | The first selected key, or `null` (the value of a single selection). |
| `selectKey(selection, key)` | Single: select only `key` (or clear it with `toggleSingle`). Multiple: toggle it. Sets the anchor. No-op in `none` mode. |
| `toggleKey(selection, key)` | Toggle `key` (single mode: select it or clear). Sets the anchor. |
| `extendTo(selection, keys, key)` | Multiple: add the range from the anchor to `key`, in the order of `keys`. Other modes: `selectKey`. |
| `selectAll(selection, keys)` | Multiple: select every key in `keys`. |
| `clearSelection(selection)` | Select nothing. |

::example{id=selection-functions}

### The DOM as the collection

| Function | Does |
| --- | --- |
| `domItems(root, selector)` | Elements matching `selector` inside `root`, in DOM order, without hidden ones. |
| `keyOf(element)` | The element's `data-key` (a string). |
| `sameKey(a, b)` | Compare keys as text: `1` and `"1"` are the same key. |
| `isDisabledItem(element)` | `aria-disabled="true"` or a disabled control. |
| `itemText(element)` | `data-text`, else the trimmed text: the typeahead and filter text. |
| `keyId(base, key)` | A safe id fragment, `<base>-<key>` (other characters become `_<hex>`). |

The first example adds arrow keys with `nextIndex` (`@rivetjs/cdk/keys`) and `roveFocus` (`@rivetjs/cdk/focus`), :kbd[Space] to toggle, :kbd[Shift]+arrows for ranges and :kbd[Ctrl]+:kbd[A] (:kbd[Cmd]+:kbd[A] on Mac, `isCtrlKeyPressed` from `@rivetjs/cdk/platform`) for all.

## Selection state

`@rivetjs/cdk/selection/state` ports `useMultipleSelectionState`. The state object holds signals; the setters are functions taking it.

| Export | Does |
| --- | --- |
| `createMultipleSelectionState(props)` | The state (below). Create it once in the component body. |
| `readSelection(state)` | The current selection, `"all"` or a `Set` (reads the signal). |
| `getSelection(state)` | The same as a `SelectionSet` with `anchorKey` / `currentKey`. |
| `setSelectedKeys(state, keys)` | Write the selection; skips equal sets unless `allowDuplicateSelectionEvents`; calls `onSelectionChange`. |
| `setFocused(state, focused)`, `setFocusedKey(state, key, childFocusStrategy?)` | Focus state. |
| `setSelectionBehavior(state, behavior)` | Switch `toggle` / `replace` (touch long press does this). |
| `SelectionSet` | A `Set<Key>` with `anchorKey` and `currentKey` (react-stately `Selection`). |

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | |
| `selectionBehavior` | `"toggle" \| "replace"` | `"toggle"` | |
| `selectedKeys` | `Signal<Selection> \| "all" \| Iterable<Key>` | none | A signal is two-way. A plain value is controlled: the state never changes, `onSelectionChange` reports requests. |
| `defaultSelectedKeys` | `"all" \| Iterable<Key>` | empty | Uncontrolled initial selection. |
| `onSelectionChange` | `(keys: Selection) => void` | none | |
| `disabledKeys` | `Iterable<Key>` | none | |
| `disabledBehavior` | `"all" \| "selection"` | `"all"` | |
| `disallowEmptySelection` | `boolean` | `false` | |
| `allowDuplicateSelectionEvents` | `boolean` | `false` | Fire `onSelectionChange` for an unchanged selection. |
| `defaultFocusedKey` | `Key \| null` | `null` | Rivet: the initial focused key (the server tab stop). |
| `selectedKey`, `selectedKeyControlled`, `onSelectedKeyChange` | | | Single-key storage, as `useSingleSelectListState` uses it. |

## SelectionManager

`@rivetjs/cdk/selection/manager` ports react-stately's `SelectionManager`: `new SelectionManager(collection, state, { allowsCellSelection?, layoutDelegate?, fullCollection? })`. It is a class over one collection, so it never goes into resumed state: build it from the state in each handler, or in a binding (its getters read the signals, so the binding updates).

| Member | Does |
| --- | --- |
| `selectionMode`, `selectionBehavior`, `disallowEmptySelection`, `disabledKeys`, `disabledBehavior` | From the state. |
| `selectedKeys`, `rawSelection`, `isEmpty`, `isSelectAll`, `firstSelectedKey`, `lastSelectedKey` | The selection (`"all"` expanded to keys in `selectedKeys`). |
| `isFocused`, `focusedKey`, `childFocusStrategy`, `setFocused`, `setFocusedKey` | Focus. |
| `isSelected(key)`, `isSelectionEqual(set)`, `canSelectItem(key)`, `isDisabled(key)`, `isLink(key)`, `getItemProps(key)` | Queries. |
| `select(key, event?)` | What a press does: single toggles or replaces; multiple toggles (`toggle`, touch, screen reader) or replaces. |
| `toggleSelection`, `replaceSelection`, `extendSelection(toKey)`, `setSelectedKeys(keys)` | Changes; ranges skip disabled keys. |
| `selectAll`, `clearSelection`, `toggleSelectAll` | |
| `setSelectionBehavior(behavior)`, `withCollection(collection)` | |

::example{id=selection-manager-api}

## Selectable list and items

The handlers of `useSelectableCollection`, `useSelectableList` and `useSelectableItem`. React Aria returns props to spread; here each event has its own handler `(options, event)`, and focus is moved at the end of the handler instead of in an effect. Delegate the item handlers from the list element with `closestItem`, item first, then list, as React runs them.

::example{id=selection-manager}

| Module | Exports |
| --- | --- |
| `@rivetjs/cdk/selection/selectable-list` | `selectableListKeyDown`, `selectableListKeyDownCapture`, `selectableListFocus` (focusin), `selectableListBlur` (focusout), `selectableListMouseDown`, `selectableListOptions` (adds a `ListKeyboardDelegate`), `useSelectableList`. Options: `AriaSelectableListOptions` = the collection options plus `collection`, `disabledKeys`, `keyboardDelegate?`, `layoutDelegate?`, `orientation?`, `locale?`. |
| `@rivetjs/cdk/selection/selectable-collection` | `selectableCollectionKeyDown`, `…KeyDownCapture`, `…Focus`, `…Blur`, `…MouseDown`, `…Scroll`, `…VirtualFocus`, `…ClearVirtualFocus`, `…Updated`, `…AutoFocus`, `syncFocus`, `collectionTabIndex(manager, virtual?)`, `useSelectableCollection`, `selectableCollectionKeys`, `FOCUS_EVENT`, `CLEAR_FOCUS_EVENT`. |
| `@rivetjs/cdk/selection/selectable-item` | `selectableItemPointerDown`, `…PointerUp`, `…PointerCancel`, `…Click`, `…KeyDown`, `…KeyUp`, `…DoubleClick`, `…Focus`, `…DragStart`, `focusSelectableItem`, `selectableItemStates` (`isPressed`, `isSelected`, `isFocused`, `isDisabled`, `allowsSelection`, `hasAction`), `selectableItemAttrs` (`data-key`, roving `tabIndex`), `closestItem(list, target)`, `LONG_PRESS_THRESHOLD_MS`. |
| `@rivetjs/cdk/selection/utils` | `isNonContiguousSelectionModifier`, `isCtrlKeyPressed`, `getItemElement`, `useCollectionId`, `getCollectionId`, `refElement`. |
| `@rivetjs/cdk/selection/dom-utils` | `scrollIntoView`, `scrollIntoViewport`, `focusSafely`, `focusWithoutScrolling`, virtual focus helpers, `getInteractionModality`, `openLink`. |

Collection options (`AriaSelectableCollectionOptions`):

| Option | Default | Notes |
| --- | --- | --- |
| `selectionManager`, `keyboardDelegate` | required | `selectableList*` builds the delegate. |
| `ref`, `scrollRef` | the event's `currentTarget` | The collection element and its scroller. |
| `selectOnFocus` | `selectionBehavior === "replace"` | Focus moves the selection. |
| `shouldFocusWrap`, `disallowEmptySelection`, `disallowSelectAll`, `disallowTypeAhead` | `false` | |
| `escapeKeyBehavior` | `"clearSelection"` | or `"none"`. |
| `shouldUseVirtualFocus`, `isVirtualized`, `allowsTabNavigation` | `false` | |
| `linkBehavior` | `"action"` | `"action" \| "selection" \| "override"`. |
| `autoFocus` | none | Applied by `selectableCollectionAutoFocus` (call it once the element is connected). |
| `direction` | from the element | |

Item options (`SelectableItemOptions`): `selectionManager`, `key`, `ref`, `id`, `isDisabled`, `onAction`, `linkBehavior`, `shouldSelectOnPressUp`, `allowsDifferentPressOrigin`, `shouldUseVirtualFocus`, `isVirtualized`, `focus`.

On macOS the "move focus without selecting" modifier is :kbd[Option] (:kbd[Ctrl] elsewhere), and :kbd[Cmd] toggles, as in React Aria.

## Keyboard delegate and type select

`ListKeyboardDelegate` (`@rivetjs/cdk/selection/list-keyboard-delegate`) answers "which key is below, above, left, right, first, last, a page away, or matches this search" for stack and grid layouts, both orientations and right-to-left text, skipping disabled keys. Options: `collection`, `ref`, `collator`, `layout`, `orientation`, `direction`, `disabledKeys`, `disabledBehavior`, `layoutDelegate` (default `DOMLayoutDelegate`, which reads element rects). Search needs a `collator`: `searchCollator(locale?)`.

`@rivetjs/cdk/selection/type-select`: `typeSelectKeyDown(owner, options, event)` and `typeSelectKeyDownCapture` (Space extends a search in progress), `typeSelectSearch(owner)`, `resetTypeSelect(owner)`, `useTypeSelect`, `TYPEAHEAD_DEBOUNCE_WAIT_MS` (1000). The search text is kept per `owner` (the list element works) outside the state.

::example{id=selection-keyboard-delegate}

## Resumability

- `createSelection` and `createMultipleSelectionState` return signals and plain data: create them in the component body; handlers and bindings capture them.
- Never capture a `SelectionManager`, a collection or a `ListKeyboardDelegate`: the server refuses class instances ("class instances are not serializable"). Rebuild them in the handler from the state and `domCollection(event.currentTarget)`.
- Handlers must be inline arrows, local functions or imported functions.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `@rivetjs/cdk/selection/state` | `@react-stately/selection` `useMultipleSelectionState`, `Selection` |
| `@rivetjs/cdk/selection/manager` | `@react-stately/selection` `SelectionManager` |
| `@rivetjs/cdk/selection/selectable-collection`, `-list`, `-item` | `@react-aria/selection` `useSelectableCollection`, `useSelectableList`, `useSelectableItem` |
| `@rivetjs/cdk/selection/list-keyboard-delegate` | `ListKeyboardDelegate`, `DOMLayoutDelegate` |
| `@rivetjs/cdk/selection/type-select` | `useTypeSelect` |
| `@rivetjs/cdk/collections` helpers | Rivet |

Deviations: setters are functions over the state; anchor and current keys live in their own signals; handlers per event instead of props objects; the press handling in `selectable-item` is reduced to what selection reads (no full `usePress` machine); the type-select buffer lives in a `WeakMap` per owner.

## Common mistakes

- **Changing the Set in place.** `selection.selected().add(key)` notifies nobody. The helpers always set a new Set; do the same when you write a signal yourself.
- **Comparing keys with `===`.** `data-key` is a string. Use `sameKey`, or `keyAttrs` / `domKey` from `@rivetjs/cdk/collections/dom` to keep number keys numbers.
- **Reading `isSelected` outside JSX.** In the component body it runs once, on the server. Read it in JSX or in a handler.
- **A `ListKeyboardDelegate` without a collator.** Arrow keys work, typeahead finds nothing.
- **Hidden items in ranges.** `domItems` and `domCollection` skip hidden elements, so a filtered-out item is not part of a Shift range.
