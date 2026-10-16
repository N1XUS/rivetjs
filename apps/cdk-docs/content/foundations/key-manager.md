---
title: ListKeyManager
description: Angular CDK ListKeyManager, FocusKeyManager, ActiveDescendantKeyManager and Typeahead from @rivetjs/cdk/a11y/key-manager: arrow keys, Home/End, typeahead.
template: guide
status: experimental
related: [foundations/keyboard-navigation, foundations/focus, foundations/selection]
---

Keyboard navigation of a list of items, ported from Angular CDK: arrows (vertical, horizontal in either direction), wrap, Home / End, Page Up / Page Down, typeahead, a skip predicate (disabled items by default) and a `change` stream. Two flavours decide what "active" means: `FocusKeyManager` focuses the item (roving focus), `ActiveDescendantKeyManager` styles it while focus stays on a container or input (`aria-activedescendant`). For Rivet-native widgets, `nextIndex()` and `typeahead()` from `@rivetjs/cdk/keys` ([Keyboard navigation](keyboard-navigation.md)) do the same without objects.

::example{id=key-manager-focus}

```ts
import { FocusKeyManager, elementOption } from "@rivetjs/cdk/a11y/key-manager";

const items = [...list.querySelectorAll<HTMLElement>("[role=option]")].map(elementOption);
const manager = new FocusKeyManager(items).withWrap().withHomeAndEnd().withTypeAhead();
manager.change.subscribe((index) => activeIndex.set(index));
list.addEventListener("keydown", (e) => manager.onKeydown(e));
```

## Import

```ts
import { ListKeyManager, FocusKeyManager, ActiveDescendantKeyManager, Typeahead, elementOption, hasModifierKey, Subject } from "@rivetjs/cdk/a11y/key-manager";
```

## Items

| Manager | Item interface |
| --- | --- |
| `ListKeyManager<T>` | `ListKeyManagerOption`: `disabled?`, `getLabel?()` (required with typeahead). |
| `FocusKeyManager<T>` | `FocusableOption`: adds `focus(origin?)`. |
| `ActiveDescendantKeyManager<T>` | `Highlightable`: adds `setActiveStyles()`, `setInactiveStyles()`. |

`elementOption(element)` adapts a DOM element to all three: `disabled` from `aria-disabled="true"` or `disabled`, the label from `aria-label` or the text, `focus()`, and `data-active` as the active style. Items are an array, or an accessor / signal of one: the manager follows changes and keeps the active item by identity.

## Configuration

Each method returns the manager, so they chain.

| Method | Default | Does |
| --- | --- | --- |
| `withWrap(shouldWrap = true)` | off | Wrap from one end to the other. |
| `withVerticalOrientation(enabled = true)` | on | :kbd[ArrowUp] / :kbd[ArrowDown] move. |
| `withHorizontalOrientation(direction)` | `null` | `"ltr"` or `"rtl"`: :kbd[ArrowLeft] / :kbd[ArrowRight] move in that direction; `null` disables. |
| `withHomeAndEnd(enabled = true)` | off | :kbd[Home] / :kbd[End]. |
| `withPageUpDown(enabled = true, delta = 10)` | off | :kbd[PageUp] / :kbd[PageDown] move by `delta`, clamped. |
| `withTypeAhead(debounceInterval = 200)` | off | Typed characters activate the next item whose label starts with them. Throws when an item has no `getLabel`. |
| `withAllowedModifierKeys(keys)` | none | Modifiers (`"altKey"`, `"ctrlKey"`, `"metaKey"`, `"shiftKey"`) that may be held while navigating. |
| `skipPredicate(fn)` | `item.disabled` | Items to skip. |
| `cancelTypeahead()` | | Forget typed letters. |

## State and actions

| Member | Does |
| --- | --- |
| `onKeydown(event)` | Handle a keydown: navigation keys move and `preventDefault()`; :kbd[Tab] emits `tabOut`; other keys go to typeahead and keep their default. |
| `setActiveItem(itemOrIndex)` | Set the active item; emits `change` when it changed (`FocusKeyManager` also focuses it, `ActiveDescendantKeyManager` swaps the styles). |
| `updateActiveItem(itemOrIndex)` | Set it without `change` or side effects. |
| `setFirstItemActive()`, `setLastItemActive()`, `setNextItemActive()`, `setPreviousItemActive()` | |
| `activeItem`, `activeItemIndex` | Current item and index (`-1`: none). |
| `isTyping()` | Typeahead letters are buffered. |
| `change` | Subject of the new active index. |
| `tabOut` | Subject: Tab was pressed. |
| `destroy()` | Stop typeahead, complete the subjects, drop the items effect. |
| `FocusKeyManager.setFocusOrigin(origin)` | Origin passed to the items' `focus()` calls (default `"program"`; see [FocusMonitor](focus-monitor.md)). |

## ActiveDescendantKeyManager

::example{id=key-manager-active-descendant}

## Typeahead and helpers

| Export | Does |
| --- | --- |
| `new Typeahead(items, { debounceInterval?, skipPredicate? })` | The typeahead on its own: `handleKey(event)`, `selectedItem` subject, `setItems`, `setCurrentSelectedItemIndex`, `isTyping`, `reset`, `destroy`. |
| `hasModifierKey(event, ...modifiers)` | Any of the given modifiers held (any modifier when none given). |
| `Subject` | The minimal subject used by the managers: `next`, `subscribe(fn \| { next, complete })` → `{ unsubscribe }`, `complete`, `observed`. |

## Keyboard

| Key | Action (when enabled) |
| --- | --- |
| :kbd[ArrowDown] / :kbd[ArrowUp] | Next / previous item, skipping disabled ones. |
| :kbd[ArrowRight] / :kbd[ArrowLeft] | Next / previous, mirrored for `"rtl"`. |
| :kbd[Home] / :kbd[End] | First / last item. |
| :kbd[PageDown] / :kbd[PageUp] | `delta` items down / up. |
| Letters, digits | Typeahead. |
| :kbd[Tab] | `tabOut` emits; the default action is kept. |

## Resumability

Managers are browser objects. Create one in a client effect (runtime at load) or lazily in the first keydown handler, keep it outside component state, and mirror the active index into a signal from `change` so the markup (`tabIndex`, `aria-selected`) is rendered from state. A widget that recreates its manager restores the position with `updateActiveItem(index())` before `onKeydown`.

## Upstream

Port of `@angular/cdk/a11y` key-manager (`ListKeyManager`, `FocusKeyManager`, `ActiveDescendantKeyManager`, `Typeahead`). Deviations: minimal subjects instead of RxJS; items may be an accessor / signal (Angular's `QueryList` or `Signal<T[]>`), tracked with an effect; `elementOption` is a Rivet addition. Not yet supported: `QueryList` change subscriptions (pass an accessor instead), `TreeKeyManager`.
