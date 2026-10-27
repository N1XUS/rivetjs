---
title: Keyboard shortcuts
description: Map shortcut strings such as Mod+s or Control+Shift+z to actions with createKeyboardShortcutHandler from @rivetjs/cdk/keys.
template: guide
status: experimental
related: [foundations/keyboard-navigation, foundations/platform, foundations/utilities]
---

`createKeyboardShortcutHandler` from `@rivetjs/cdk/keys` turns a table of shortcut strings into one `keydown` handler (React Aria `createKeyboardShortcutHandler`). Arrow-key navigation and typeahead from the same module are on [Keyboard navigation](keyboard-navigation.md).

::example{id=keys-shortcuts}

## Import

```ts
import { createKeyboardShortcutHandler, parseKeyboardShortcut, canonicalKeyboardShortcut, keyboardEventToCanonicalShortcut } from "@rivetjs/cdk/keys";
```

## Shortcut strings

- `+`-separated: any modifiers, then exactly one key: `"Mod+s"`, `"Control+Shift+z"`, `"Alt+ArrowDown"`, `"Escape"`.
- Modifiers, case-insensitive, any order: `Shift`, `Alt`, `Control`, `Meta`, and `Mod` (Meta on macOS, Control elsewhere). `Ctrl` is not a modifier name: write `Control`.
- Keys are compared lowercased (`e.key`): `"Z"` and `"z"` are the same. Aliases: `space`, `esc`, `del`, `ins`, `left`, `right`, `up`, `down`, `pageup`, `pagedown`.
- Matching is exact: `"Mod+s"` does not fire for :kbd[Mod+Shift+S].
- A string without a key (`"Shift+"`) throws `Invalid keyboard shortcut`.

## API

| Export | Does |
| --- | --- |
| `createKeyboardShortcutHandler(bindings)` | A handler `(event) => void` that runs the action of the exact modifier + key match. Later duplicate bindings win. |
| `parseKeyboardShortcut(spec)` | `{ shift, alt, ctrl, meta, mod, key }`. Throws when there is no non-modifier key. |
| `canonicalKeyboardShortcut(parsed)` | Modifiers sorted `Alt`, `Control`, `Meta`, `Shift`, then the lowercased key (`"Alt+Control+arrowup"`). `Mod` resolves for this platform. |
| `keyboardEventToCanonicalShortcut(event)` | The same form for a `keydown` event. |
| `modifierSetFromParsed(parsed)`, `modifierSetFromEvent(event)` | The canonical modifier names as a `Set`. |

Types: `KeyboardShortcutBindings` (`Record<string, KeyboardShortcutAction>`), `KeyboardShortcutAction`, `ParsedKeyboardShortcut`.

## Action results

| Action returns | Effect |
| --- | --- |
| nothing / `undefined` / `true` | Handled: `preventDefault()`, propagation stops. |
| `false` | Not handled: the key does its default (Enter types a newline); `continuePropagation()` is called when the event has it. |
| `{ shouldPreventDefault?, shouldContinuePropagation? }` | Exactly that. |

Keys without a binding call `event.continuePropagation?.()`.

::example{id=keys-parse}

## Resumability

Create the handler inside the event handler, as the example does: `onKeyDown={(e) => createKeyboardShortcutHandler({ … })(e)}`. The bindings close over the component's signals and are rebuilt per key press, which is cheap. A handler created in the component body is a run-time function that a resumed page cannot capture.

## Accessibility

- Show shortcuts in the UI (`aria-keyshortcuts` on the control they trigger, and in tooltips or menus).
- Do not take over keys that assistive technology or the browser uses (:kbd[Tab], single letters in text fields without a modifier).
- Use `Mod` for the platform's command key, so macOS users get :kbd[⌘].

## Upstream

React Aria `createKeyboardShortcutHandler` and its helpers from `@react-aria/interactions`. The `continuePropagation` contract is the React Aria keyboard event's; native events simply lack it.

## Common mistakes

- **`"Ctrl+s"`.** `Ctrl` is read as the key and then replaced by `s`, so the binding becomes plain :kbd[S]. Write `"Control+s"` or `"Mod+s"`.
- **Expecting a prefix match.** `"Mod+z"` does not fire with Shift held; bind `"Mod+Shift+z"` too.
- **Building the handler in the component body.** It does not resume; build it in the event handler.
