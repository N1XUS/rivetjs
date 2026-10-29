---
title: Keyboard navigation
description: "Arrow keys, Home, End, paging and typeahead for your own widgets: nextIndex, Toolbar, Angular CDK key managers and React Aria keyboard delegates."
template: guide
status: experimental
related: [foundations/overview, foundations/focus, foundations/selection, components/menu, components/tabs]
---

Composite widgets such as toolbars, lists and tab lists have one tab stop and move focus inside with the arrow keys. `@rivetjs/cdk` has four layers for it, from small to complete:

| Layer | Module | Upstream | Use it for |
| --- | --- | --- | --- |
| Pure functions | `@rivetjs/cdk/keys` | APG patterns | Index math over DOM items: `nextIndex`, `typeahead`, `navigationKeys`. |
| Component | `@rivetjs/cdk/toolbar` | RAC `Toolbar` | A toolbar of any focusable controls, groups and separators. |
| Key managers | `@rivetjs/cdk/a11y/key-manager` | Angular CDK `ListKeyManager`, `FocusKeyManager`, `ActiveDescendantKeyManager` | A stateful object with builder options, a `change` stream and typeahead. |
| Keyboard delegates | `@rivetjs/cdk/selection/list-keyboard-delegate`, `…/type-select` | React Aria `ListKeyboardDelegate`, `useTypeSelect` | Key-to-key navigation over a collection, grids measured from the DOM. |

`roveFocus` from `@rivetjs/cdk/focus` moves the tab stop; `direction` from `@rivetjs/cdk/bidi` mirrors the arrows in right-to-left text.

::example{id=cdk-toolbar}

## Import

```tsx
import { nextIndex, navigationKeys, typeahead } from "@rivetjs/cdk/keys";
import { Toolbar } from "@rivetjs/cdk/toolbar";
import { ListKeyManager, FocusKeyManager, ActiveDescendantKeyManager, elementOption } from "@rivetjs/cdk/a11y/key-manager";
import { ListKeyboardDelegate, searchCollator } from "@rivetjs/cdk/selection/list-keyboard-delegate";
import { typeSelectKeyDown } from "@rivetjs/cdk/selection/type-select";
import { roveFocus } from "@rivetjs/cdk/focus";
import { direction, logicalKey } from "@rivetjs/cdk/bidi";
```

## nextIndex

`nextIndex(count, from, key, options)` returns the index the key moves to, `null` when the key is not a navigation key for these options (let it through), or `from` when the key is handled but nothing moves (an edge without `wrap`). `from` is `-1` when nothing is focused yet: forward keys then go to the first enabled item, backward keys to the last.

```tsx title="src/components/Toolbar.tsx"
import { navigationKeys, nextIndex } from "@rivetjs/cdk/keys";
import { roveFocus } from "@rivetjs/cdk/focus";
import { direction } from "@rivetjs/cdk/bidi";

const options = { orientation: "horizontal", wrap: true } as const;

function move(event: KeyboardEvent & { currentTarget: HTMLElement }) {
  const buttons = [...event.currentTarget.querySelectorAll("button")];
  const from = buttons.indexOf((event.target as Element).closest("button")!);
  const to = nextIndex(buttons.length, from, event.key, { ...options, dir: direction(event.currentTarget), isDisabled: (i) => buttons[i]!.disabled });
  if (to === null) return; // not a navigation key
  event.preventDefault();
  roveFocus(buttons, buttons[to]!);
}

export function Toolbar() {
  return (
    <div role="toolbar" aria-label="Format" data-rk={navigationKeys(options)} onKeyDown={move}>
      <button type="button">Bold</button>
      <button type="button" tabIndex={-1}>Italic</button>
    </div>
  );
}
```

- Render the first item with no `tabindex` (or `0`) and the others with `tabIndex={-1}`: one tab stop, in the server HTML.
- Read the items from the DOM in the handler. There is no list to keep in sync.
- `data-rk` lists the keys the widget handles. On a resumed page, Rivet holds those keys while the handler's code loads, so the first arrow key does not scroll the page.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `orientation` | `"vertical" \| "horizontal" \| "both"` | `"vertical"` | Up/Down, Left/Right, or all four. |
| `wrap` | `boolean` | `false` | From the last item to the first and back. |
| `homeEnd` | `boolean` | `true` | Home and End go to the first and last enabled item. |
| `pageSize` | `number` | `0` | PageUp and PageDown step this many items (clamped to the ends, landing on an enabled item); `0` leaves them alone. |
| `dir` | `"ltr" \| "rtl"` | `"ltr"` | In `rtl`, ArrowLeft moves forward. |
| `isDisabled` | `(index) => boolean` | none | Items to skip. |

### Vertical list, paging and typeahead

No wrap, `pageSize: 3`, a disabled item, and `typeahead` for letters.

::example{id=keyboard-navigation-list}

### Both orientations

`orientation: "both"` makes all four arrows move; `homeEnd: false` leaves :kbd[Home] and :kbd[End] to the page.

::example{id=keyboard-navigation-both}

### Functions

| Function | Module | Does |
| --- | --- | --- |
| `nextIndex(count, from, key, options?)` | `keys` | See above. |
| `navigationKeys(options?)` | `keys` | The keys `nextIndex` handles for `options`, as a `data-rk` value. |
| `typeahead(owner, texts, from, key, now?, isDisabled?)` | `keys` | Index of the next item after `from` whose text starts with the typed letters, or `-1`. Case and accents are ignored (`Intl.Collator`, base sensitivity); the typed text resets after 750 ms; typing one letter again cycles through its matches; :kbd[Space] counts only inside a word. `owner` is any object that identifies the widget. |
| `roveFocus(items, item, options?)` | `focus` | Sets `tabindex="0"` on `item`, `-1` on the others, and focuses it. |
| `direction(element)` | `bidi` | `"ltr"` or `"rtl"` at the element (nearest `dir`, else the computed direction). `"ltr"` on the server. |
| `logicalKey(key, dir)` | `bidi` | Swaps ArrowLeft and ArrowRight in `rtl`, so a handler can think in "start" and "end". |

## Keyboard shortcuts

`createKeyboardShortcutHandler` from the same module maps shortcut strings (`"Mod+s"`, `"Control+Shift+z"`, `"Escape"`) to actions; see [Keyboard shortcuts](keyboard-shortcuts.md).

## Toolbar

`Toolbar` (React Aria Components) is a `role="toolbar"` around any focusable controls. Arrow keys move focus to the next or previous focusable element inside, across nested toolbars, `Group`s and separators, without wrapping. :kbd[Tab] leaves the toolbar from wherever focus is, and focus coming back returns to the last focused control. Disabled buttons are skipped (they are not focusable).

::example{id=toolbar-groups}

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Left/Right or Up/Down. Rendered as `aria-orientation` and `data-orientation`. |
| `aria-label` | `string` | none | Name of the toolbar. |
| `aria-labelledby` | `string` | none | Used only when there is no `aria-label`. |
| `id`, `slot` | `string` | none | |
| `class` | `string` | `"rv-Toolbar"` | |
| `children` | content | none | The controls. |
| Global DOM events and attributes | `GlobalDOMAttributes` | none | On the toolbar element. It owns `keydown`, `focusin` and `focusout`. |

`data-rk` is `ArrowLeft ArrowRight` (horizontal) or `ArrowUp ArrowDown` (vertical). A Toolbar nested in another renders `role="group"` and no `data-rk`: the outer one handles the keys.

### Vertical and right-to-left

In right-to-left text a horizontal toolbar swaps ArrowLeft and ArrowRight. Tailwind's `orientation-vertical:` and `orientation-horizontal:` variants (from `@rivetjs/cdk/tailwind.css`) match `data-orientation`.

::example{id=toolbar-vertical}

`@rivetjs/cdk/toolbar/behaviour` exports the parts for your own markup: `toolbarProps(props, isInToolbar?)` (role, `aria-orientation`, labels), `toolbarKeys(orientation)` (the `data-rk` value), and the handlers `toolbarKeyDown(event, { orientation, direction? })`, `toolbarFocus(event)` (focusin) and `toolbarBlur(event)` (focusout).

## Key managers

The key managers provide an object that holds the active index of a list and moves it on keydown. Configure it with the builder methods, call `onKeydown(event)` from your handler, and react to `change`.

- `ListKeyManager<T>` only tracks the active item: render it yourself.
- `FocusKeyManager<T>` also calls `item.focus()` on the active item (roving focus).
- `ActiveDescendantKeyManager<T>` calls `setInactiveStyles()` on the old item and `setActiveStyles()` on the new one; focus stays on the container, which you point at the item with `aria-activedescendant`.

Items are any objects with an optional `disabled` (and `getLabel()` for typeahead); `elementOption(element)` adapts a DOM element. Managers are browser objects: create them in a handler (keep one per element in a `WeakMap`) or a client effect, never in server-rendered state.

### FocusKeyManager

`withWrap()`, `withHomeAndEnd()`, `withTypeAhead()`, a `skipPredicate` that also skips sold-out items, and the `change` and `tabOut` streams.

::example{id=keyboard-navigation-focus-key-manager}

### ActiveDescendantKeyManager

No wrap (the default), `withPageUpDown(true, 3)` and `withHomeAndEnd()`. `elementOption` marks the active item with `data-active`.

::example{id=keyboard-navigation-active-descendant}

### ListKeyManager

Plain data items, `withHorizontalOrientation(direction(group))`, `withVerticalOrientation(false)`, `withAllowedModifierKeys(["shiftKey"])`, and `setLastItemActive()` from a button.

::example{id=keyboard-navigation-list-key-manager}

### API

| Builder method | Default | Does |
| --- | --- | --- |
| `withWrap(shouldWrap = true)` | off | Wrap from one end to the other. |
| `withVerticalOrientation(enabled = true)` | on | ArrowUp / ArrowDown move. |
| `withHorizontalOrientation(direction)` | `null` | `"ltr"` or `"rtl"`: ArrowLeft / ArrowRight move (mirrored in `rtl`); `null` turns them off. |
| `withAllowedModifierKeys(keys)` | `[]` | Modifiers (`"altKey"`, `"ctrlKey"`, `"metaKey"`, `"shiftKey"`) that may be held while navigating; with any other modifier the key is ignored. |
| `withHomeAndEnd(enabled = true)` | off | Home / End go to the first / last item that is not skipped. |
| `withPageUpDown(enabled = true, delta = 10)` | off | PageUp / PageDown move by `delta`, clamped to the ends. |
| `withTypeAhead(debounceInterval = 200)` | off | Typed characters (debounced, in ms) activate the next item whose `getLabel()` starts with them. Items must have `getLabel()`. |
| `skipPredicate(fn)` | `item.disabled` | Items to skip. Replaces the default, so include `item.disabled` yourself. |
| `cancelTypeahead()` | | Forget the typed letters. |

Each builder method returns the manager.

| Member | Does |
| --- | --- |
| `new ListKeyManager(items)` | `items`: an array, or an accessor / signal of one (tracked: the active index follows its item when the list changes). |
| `onKeydown(event)` | Moves the active item for handled keys and calls `preventDefault()`; other keys are left alone. :kbd[Tab] emits `tabOut`. |
| `setActiveItem(itemOrIndex)` | Sets the active item; emits `change` when it changed (Focus / ActiveDescendant: focuses or styles it). |
| `updateActiveItem(itemOrIndex)` | Sets it silently (no `change`, no focus). Use it to sync with focus that moved by click. |
| `setFirstItemActive()`, `setLastItemActive()`, `setNextItemActive()`, `setPreviousItemActive()` | Move programmatically, honouring the skip predicate and wrap. |
| `activeItemIndex`, `activeItem` | The current active index (`-1` for none) and item. |
| `isTyping()` | Whether typeahead letters are buffered. |
| `change` | `Subject<number>`: the new active index. `change.subscribe(fn)` returns `{ unsubscribe() }`. |
| `tabOut` | `Subject<void>`: :kbd[Tab] was pressed. |
| `destroy()` | Completes the streams, clears timers and the items effect. |
| `FocusKeyManager.setFocusOrigin(origin)` | The `FocusOrigin` passed to `item.focus(origin)` (default `"program"`). |

| Other export | Does |
| --- | --- |
| `elementOption(element)` | DOM element as an item: `disabled` from `aria-disabled="true"` or `disabled`, `getLabel()` from `aria-label` or text, `focus()`, `data-active` as active style. Rivet addition. |
| `Typeahead<T>` | The typeahead alone: `new Typeahead(items, { debounceInterval?, skipPredicate? })`, `handleKey(event)`, `setItems`, `setCurrentSelectedItemIndex`, `isTyping()`, `reset()`, `selectedItem` stream, `destroy()`. |
| `hasModifierKey(event, ...modifiers)` | Whether the event has any of the modifiers (any modifier when none given). |
| `Subject<T>` | The minimal stream: `next`, `subscribe`, `complete`, `observed`. |
| `ListKeyManagerOption`, `FocusableOption`, `Highlightable`, `TypeaheadItem`, `ListKeyManagerModifierKey` | Types. |

## Keyboard delegates

React Aria's `ListKeyboardDelegate` answers "which key is below / above / left / right / a page away / matching this search" for a collection, skipping disabled keys. In `layout: "grid"` it measures the item elements (`[data-key]` inside `ref`) through `DOMLayoutDelegate`, so arrows follow the rendered rows and columns. `typeSelectKeyDown` adds React Aria's typeahead on top. These are what the [selection](selection.md) handlers use.

::example{id=keyboard-navigation-delegate}

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `collection` | `Collection<Node<T>>` | required | E.g. `new ListCollection(new CollectionBuilder().build({ children }))`. |
| `ref` | element or `{ current }` | required | The element the items are in (measured for grids and paging). |
| `disabledKeys` | `Set<Key>` | empty | Keys to skip. |
| `disabledBehavior` | `"all" \| "selection"` | `"all"` | `"selection"`: disabled keys stay reachable. |
| `layout` | `"stack" \| "grid"` | `"stack"` | |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | A vertical stack has no left / right methods. |
| `direction` | `"ltr" \| "rtl"` | none | Mirrors left / right. |
| `collator` | `Intl.Collator` | none | Needed for `getKeyForSearch`; `searchCollator(locale?)` gives a cached search collator (`<html lang>` by default). |
| `layoutDelegate` | `LayoutDelegate` | `DOMLayoutDelegate(ref)` | Item rects from elsewhere (a virtualizer). |

| Method | Returns |
| --- | --- |
| `getKeyBelow(key)`, `getKeyAbove(key)` | The key below / above (same column in a grid), or `null`. |
| `getKeyRightOf(key)`, `getKeyLeftOf(key)` | The key to the side (horizontal or grid only). |
| `getFirstKey()`, `getLastKey()` | First / last enabled key. |
| `getKeyPageBelow(key)`, `getKeyPageAbove(key)` | One visible page away (first / last key when the element does not scroll). |
| `getNextKey(key)`, `getPreviousKey(key)` | Collection order, skipping disabled keys (`{ includeDisabled: true }` to keep them). |
| `getKeyForSearch(search, fromKey?)` | The next key whose text starts with `search`. |

| Type-select export | Does |
| --- | --- |
| `typeSelectKeyDown(owner, options, event)` | Bubble-phase keydown: printable characters extend the search of `owner` and focus the match through `options.selectionManager.setFocusedKey`. Returns whether it handled the key. |
| `typeSelectKeyDownCapture(owner, options, event)` | Capture-phase keydown: during a search, :kbd[Space] extends it instead of selecting. |
| `useTypeSelect(owner, options)` | `{ typeSelectProps: { onKeyDownCapture, onKeyDown } }`. |
| `typeSelectSearch(owner)`, `resetTypeSelect(owner)` | Read / clear the buffer. |
| `TYPEAHEAD_DEBOUNCE_WAIT_MS` | `1000`: the buffer resets after a second. |

`options` is `{ keyboardDelegate, selectionManager: { focusedKey, setFocusedKey }, onTypeSelect? }`.

## Accessibility

- One tab stop per widget: roving `tabindex` (`roveFocus`, `FocusKeyManager`) or `aria-activedescendant` on a focused container (`ActiveDescendantKeyManager`). `Toolbar` keeps every control tabbable but jumps over them on :kbd[Tab].
- Give composite widgets their role (`toolbar`, `listbox`, `menu`, `radiogroup`, `grid`) and a name.
- Set `aria-orientation` when a widget moves with Left/Right only (`Toolbar` does).

| Key | `nextIndex` | `Toolbar` | Key managers | `ListKeyboardDelegate` |
| --- | --- | --- | --- | --- |
| Arrows | By `orientation`, mirrored with `dir` | By `orientation`, mirrored in `rtl` | Vertical by default; horizontal opt-in | Below / above / left / right |
| :kbd[Home], :kbd[End] | On (`homeEnd`) | Not handled | `withHomeAndEnd()` | `getFirstKey` / `getLastKey` |
| :kbd[PageUp], :kbd[PageDown] | `pageSize` | Not handled | `withPageUpDown()` | `getKeyPage…` (visible page) |
| Letters | `typeahead` (750 ms) | Not handled | `withTypeAhead()` (200 ms debounce) | `typeSelectKeyDown` (1 s) |
| :kbd[Tab] | Not handled | Leaves the toolbar | `tabOut` stream | Not handled |

## Resumability

- `nextIndex`, `typeahead` and `Toolbar` keep no state that needs serializing: the handler reads the DOM on each key. The typeahead buffers live in `WeakMap`s in the browser.
- Key managers and delegates are browser objects: build them in the handler, or once per element in a `WeakMap`, from the DOM. Keep anything the server must render (the active index for `tabindex`) in a signal.
- Handlers can be any function. Set `data-rk` to the keys you handle, so the first cold key does not scroll the page.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `nextIndex`, `navigationKeys`, `typeahead` | Rivet functions for the APG composite patterns |
| `Toolbar`, `toolbar/behaviour` | RAC `Toolbar`, react-aria `useToolbar` |
| `ListKeyManager`, `FocusKeyManager`, `ActiveDescendantKeyManager`, `Typeahead` | Angular CDK `a11y/key-manager` |
| `ListKeyboardDelegate`, `DOMLayoutDelegate` | `@react-aria/selection` |
| `typeSelectKeyDown`, `useTypeSelect` | `@react-aria/selection` `useTypeSelect` |

Deviations:

- Key managers: RxJS `Subject`s are a minimal emitter with the same `subscribe` / `next` / `complete`; a `QueryList` or `Signal<T[]>` is an array or an accessor; there is no injector.
- `Toolbar` uses bubbling `keydown` / `focusin` / `focusout` listeners (upstream: capture phase, which does not resume yet), so a control that stops an arrow key's propagation keeps it.
- `useTypeSelect` keeps its buffer per owner object in a `WeakMap`, not in component state.

### Not yet supported

- Angular CDK `TreeKeyManager` (tree navigation: expand, collapse, parent and child keys).
- Two-dimensional grid movement in `nextIndex` and the key managers: use `ListKeyboardDelegate` with `layout: "grid"`.

## Common mistakes

- **Calling `preventDefault()` for every key.** Only for keys `nextIndex` handled (a non-`null` result). Otherwise Tab, letters and shortcuts stop working.
- **Every item in the tab order.** Items other than the tab stop need `tabIndex={-1}`, or Tab walks through the whole widget.
- **No `data-rk`.** The first cold arrow key on a resumed page then scrolls the page while the code loads.
- **A new `owner` object on every key.** `typeahead` and `typeSelectKeyDown` keep the typed text per owner. Pass the same object (or the widget element) each time.
- **A new key manager on every key with typeahead.** Its letters are buffered in the instance; keep one per element.
- **A `skipPredicate` that forgets `disabled`.** It replaces the default instead of adding to it.
