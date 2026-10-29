---
title: Focus
description: Contain, restore and move focus with FocusScope, useFocusManager and createFocusManager, plus focusFirst, saveFocus, inertOutside and tabbable checks.
template: guide
status: experimental
related: [foundations/focus-interactions, foundations/focus-trap, components/dialog]
---

`<FocusScope>` from `@rivetjs/cdk/focus-scope` manages focus for its children: :kbd[Tab] and :kbd[Shift]+:kbd[Tab] wrap inside it (`contain`), focus goes back where it came from when it unmounts (`restoreFocus`), and the first field is focused when it mounts (`autoFocus`). The overlay components ([Dialog](../components/dialog.md), [Popover](../components/popover.md), [Menu](../components/menu.md)) render one already; use it for your own surfaces such as an inline editor or a drawer. `@rivetjs/cdk/focus` adds focus managers and small functions for custom widgets.

::example{id=focus-scope-contain}

```tsx title="src/routes/editor.tsx"
import { FocusScope } from "@rivetjs/cdk/focus-scope";

export default function Editor() {
  return (
    <FocusScope contain>
      <input aria-label="Title" />
      <button type="button">Save</button>
      <button type="button">Cancel</button>
    </FocusScope>
  );
}
```

## Anatomy

```html
<div data-rv-focus-scope="rv3" data-rv-contain="" class="…" style="display: contents">
  …children…
</div>
```

- `data-rv-focus-scope`: the scope's id. Nesting follows the DOM; a scope that mounts outside the active scope's subtree (a dialog opened from a menu, rendered in a portal) gets `data-rv-focus-parent="<parent id>"`.
- `data-rv-contain`: present with `contain`.
- `display: contents`: the wrapper adds no box; `class` is for selectors, not layout.

## Import

```ts
import { FocusScope, useFocusManager } from "@rivetjs/cdk/focus-scope";
import { createFocusManager, focusFirst, focusLast, containFocus, saveFocus, roveFocus, inertOutside, focusSafely, getFocusableTreeWalker, isElementInScope } from "@rivetjs/cdk/focus";
import { isFocusable, isTabbable, isVisible, tabbables } from "@rivetjs/cdk/a11y";
```

## FocusScope props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `contain` | `boolean` | `false` | Tab and Shift+Tab wrap inside; focus that escapes (a click outside, the address bar) is pulled back to the last focused element or the first tabbable one. Read once, when the scope renders. |
| `restoreFocus` | `boolean` | `false` | On unmount, focus the element that was focused when the scope rendered (if focus was inside the scope or lost to `<body>`). Tab out of a restoring, non-containing scope continues after that element. |
| `autoFocus` | `boolean` | `false` | Focus the first tabbable (else focusable) element on mount, unless focus is already inside. |
| `class` | `string` | none | Class of the wrapper. |
| `children` | content | none | |

Nested scopes: the innermost active one wins. A containing child scope is not fought by its containing parent, and a restore chain falls back to the parent's target when the child's is gone.

## Restore and auto focus

::example{id=focus-scope-restore}

## useFocusManager

`useFocusManager()` returns a `FocusManager` for the FocusScope that holds focus (or `opts.from`'s scope) when a method runs. Call the methods from handlers.

| Method | Does |
| --- | --- |
| `focusNext(opts?)` | Next focusable element after the focused one. |
| `focusPrevious(opts?)` | Previous one. |
| `focusFirst(opts?)`, `focusLast(opts?)` | First / last in the scope. |

All return the focused element or `null`. `FocusManagerOptions`:

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `from` | `Element` | the focused element | Start here. |
| `tabbable` | `boolean` | `false` | Only tabbable elements (default: all focusable). |
| `wrap` | `boolean` | `false` | Wrap at the ends (next / previous). |
| `accept` | `(node: Element) => boolean` | none | Filter. |

::example{id=focus-manager}

## createFocusManager

The same manager over any element, without a FocusScope: `createFocusManager(ref, defaultOptions?)`. `ref` is a `ref()`, an element accessor or `{ current }`. `defaultOptions` apply to every call.

::example{id=focus-manager-create}

## Functions

| Function | Does |
| --- | --- |
| `focusFirst(scope)`, `focusLast(scope)` | Focus the first / last tabbable element inside `scope`; return it or `null`. |
| `containFocus(scope, event)` | Keydown handler body: wraps Tab at the ends of `scope`. Returns `true` when it moved focus (or when `scope` has nothing tabbable: Tab is then swallowed). Judges by the element the key was pressed on, which is right on a resumed page whose first Tab ran after the browser moved focus. |
| `saveFocus(within?)` | Remember the focused element; the returned function focuses it again if focus is on `<body>` or inside `within` (any focus when `within` is omitted). |
| `roveFocus(items, item, options?)` | Roving `tabindex`: `item` gets `tabindex="0"` and focus, the others `-1` (see [Keyboard navigation](keyboard-navigation.md)). |
| `inertOutside(element)` | Make the siblings of `element` and of each ancestor up to `<body>` inert; returns the undo function. For custom modal surfaces. |
| `focusSafely(element)` | Focus without scrolling; under a screen reader's virtual cursor, wait for running CSS transitions first. |
| `getFocusableTreeWalker(root, opts?, scope?)` | `TreeWalker` over the focusable (or tabbable) elements; radio groups collapse to their tab stop. |
| `isElementInScope(element, scope)` | `element` is inside one of the `scope` nodes. |

::example{id=focus-functions}

## Focusable and tabbable checks

From `@rivetjs/cdk/a11y`:

| Function | True when |
| --- | --- |
| `isVisible(element)` | Rendered: not `display: none`, not in a closed `<details>`, not `visibility: hidden` (`checkVisibility`). |
| `isFocusable(element)` | A focusable element (`a[href]`, form controls, `[tabindex]`, `[contenteditable]`, …), not disabled, not inside `[inert]`, not `type="hidden"`, visible. |
| `isTabbable(element)` | Focusable, `tabindex` ≥ 0, and for radios: the checked one of its group (or the first when none is checked). |
| `tabbables(root)` | All tabbable descendants, in DOM order. |

::example{id=a11y-checks}

The Angular CDK `InteractivityChecker` (frames, iOS rules, audio / video) is on [AriaDescriber and checks](a11y-services.md#interactivitychecker).

## Accessibility

| Key | In a `contain` scope |
| --- | --- |
| :kbd[Tab] on the last tabbable element | Focus the first one. |
| :kbd[Shift]+:kbd[Tab] on the first | Focus the last one. |
| :kbd[Tab] elsewhere | Next tabbable element in the scope. |

- A FocusScope alone is not a modal: the page stays scrollable and reachable for screen readers. Use [Dialog](../components/dialog.md) (scroll lock, inert page, restore).
- Keep at least one tabbable element in a containing scope, or Tab does nothing.
- Avoid positive `tabindex`: the walkers follow DOM order.

## Resumability

- The wrapper has a resumable `keydown` handler, so containment works from the first Tab on a resumed page.
- Restore, auto focus and the document listeners run in a client effect: on a resumed page when the scope is visible (a scope inside `Show` mounts when shown).
- The element to restore is read when the scope renders. A resumed page re-creates a server-rendered region on its first change; restore then finds the replacement by its `id`, so give openers an `id`.
- `useFocusManager()` holds no state, so nothing of it is written into the page.

## Upstream

| API | Ported from | Deviations |
| --- | --- | --- |
| `FocusScope`, `useFocusManager` | `@react-aria/focus` `FocusScope` | One `display: contents` wrapper instead of two sentinel spans; the scope tree is the DOM (`data-rv-focus-parent` links portaled children); `useFocusManager()` resolves the scope at call time (Rivet evaluates children before their parent, so context cannot reach them). |
| `createFocusManager`, `getFocusableTreeWalker`, `focusSafely`, `isElementInScope` | `@react-aria/focus`, `@react-aria/interactions` | `createFocusManager` takes an accessor as well as `{ current }`. |
| `focusFirst`, `focusLast`, `containFocus`, `saveFocus`, `roveFocus`, `inertOutside` | Rivet | |

Not yet supported: `useHasTabbableChild`.
