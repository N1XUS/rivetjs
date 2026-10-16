---
title: Focus interactions
description: focusProps, focusWithinProps, useFocusRing, createFocusVisible and the interaction modality from @rivetjs/cdk: focus events and keyboard-only focus rings.
template: guide
status: experimental
related: [foundations/interactions, foundations/focus, foundations/focus-monitor]
---

Focus events of an element or a group, and whether the focus ring should show. A ring shows for keyboard focus (and screen reader focus), not after a mouse click: the same rule as CSS `:focus-visible`, but as a signal you can write to an attribute or read in code. Ports of React Aria `useFocus`, `useFocusWithin`, `useFocusVisible` and `useFocusRing`.

::example{id=focus-ring}

```tsx title="src/components/SaveButton.tsx"
import { useFocusRing } from "@rivetjs/cdk/focus-ring";

export function SaveButton() {
  const { focusProps, isFocusVisible } = useFocusRing();
  return (
    <button type="button" {...focusProps} data-focus-visible={isFocusVisible() || undefined}>
      Save
    </button>
  );
}
```

## Import

```ts
import { focusProps, focusWithinProps } from "@rivetjs/cdk/interactions/focus";
import { createFocusVisible, watchFocusVisible, createInteractionModality, getInteractionModality, setInteractionModality, isFocusVisible } from "@rivetjs/cdk/interactions/focus-visible";
import { useFocusRing } from "@rivetjs/cdk/focus-ring";
```

## useFocusRing

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `within` | `boolean` | `false` | Track focus inside the element (`focusin` / `focusout`) instead of on it. |
| `isTextInput` | `boolean` | `false` | A text field: typing keeps the current verdict; only :kbd[Tab] and :kbd[Escape] switch to keyboard. |
| `autoFocus` | `boolean` | `false` | Start as focus-visible (the element is auto focused). |

Returns `focusProps` (`onFocusIn` handling only focus on the element itself, with a `blur` listener bound while focused; `onFocusIn` / `onFocusOut` with `within`), `isFocused()` and `isFocusVisible()` (focused and the last interaction was keyboard or virtual). While focused, it listens for modality changes, so a mouse click on the focused element hides the ring.

## focusProps

Focus events of the element itself; focus moving between its children is ignored.

| Option | Type | Notes |
| --- | --- | --- |
| `onFocus`, `onBlur` | `(e: FocusEvent) => void` | |
| `onFocusChange` | `(isFocused: boolean) => void` | |
| `isDisabled` | `MaybeAccessor<boolean>` | Read at event time. |

Returns `{ focusProps }`, only with the handlers it needs. An element that becomes `disabled` while focused gets a synthetic blur (browsers fire none).

## focusWithinProps

| Option | Type | Notes |
| --- | --- | --- |
| `onFocusWithin` | `(e: FocusEvent) => void` | Focus entered the element or a descendant. |
| `onBlurWithin` | `(e: FocusEvent) => void` | Focus left the element and all descendants. |
| `onFocusWithinChange` | `(isFocusWithin: boolean) => void` | |
| `isDisabled` | `MaybeAccessor<boolean>` | |

Returns `{ focusWithinProps }` (`onFocusIn`, `onFocusOut`). Moving focus inside is no blur; a focused descendant that is removed ends focus-within on the next focus elsewhere.

::example{id=use-focus}

## Modality and focus-visible

| Export | Does |
| --- | --- |
| `createFocusVisible({ isTextInput?, autoFocus? })` | `{ isFocusVisible }`: a page-wide signal, updated on modality changes (client effect). |
| `createInteractionModality()` | Signal of `"keyboard" \| "pointer" \| "virtual" \| null` (`null` on the server and before the first interaction). |
| `watchFocusVisible(fn, { enabled?, isTextInput? })` | Call `fn(isFocusVisible)` on modality changes (client effect). |
| `addFocusVisibleListener(fn, opts?)` | The same from a handler; returns the unsubscribe function. |
| `getInteractionModality()`, `setInteractionModality(m)` | Read or set the modality (set: for tests, or to mark a virtual-cursor interaction). |
| `isFocusVisible()` | `true` unless the last interaction was a pointer. |
| `getPointerType()` | Pointer type of the last interaction. |
| `addWindowFocusTracking(element?)`, `setupGlobalFocusEvents(element?)` | Install the global tracking now (another window or shadow root). |

::example{id=interaction-modality}

## Styling

Write the signals to attributes: `data-focused`, `data-focus-visible`, `data-focus-within`. With `@rivetjs/cdk/tailwind.css`, `focused:` matches `[data-focused]`; for the others use `data-[focus-visible]:…`. Without JavaScript-driven state, CSS `:focus-visible` is the same rule for the element itself: the cdk components use it ([Button](../components/button.md) has no focus-ring JS). See [Interactions](interactions.md#styling) for Tailwind and plain-CSS versions of a chip with press, hover and focus-ring states.

## Resumability

- No listener runs at load: `useFocusRing`, `focusProps` and `focusWithinProps` handlers resume on the first focus, and the modality tracking installs then.
- A focus that happens before tracking was installed (the first Tab on a resumed page) adopts the browser's own `:focus-visible` verdict for that element, so the first keyboard focus shows a ring and the first click does not.
- `createFocusVisible`, `createInteractionModality` and `watchFocusVisible` use client effects: the runtime boots at load on pages that call them.

## Upstream

Ports of `@react-aria/interactions` `useFocus`, `useFocusWithin`, `useFocusVisible` and `@react-aria/focus` `useFocusRing` (Rivet: `focusProps`, `focusWithinProps`, `createFocusVisible`, `createInteractionModality`, `watchFocusVisible`, `useFocusRing`). Deviations: global listeners install on first use instead of at import; `useFocus` binds the native `focus` / `blur` only when you pass a callback (handlers merged around its bag run in `mergeProps` order, as in React Aria); `useFocusRing` handles the delegated `focusin` (target = the element) and binds the native `blur` only while focused, so it runs after the element's other focus handlers (React Aria components merge it last); `useFocusWithin` uses the bubbling `focusin` / `focusout` (React's synthetic `onFocus` bubbles); no `deps` argument on `useFocusVisibleListener`. Not yet supported: the `FocusRing` component (use `useFocusRing` and write the attributes yourself), `useFocusable`.
