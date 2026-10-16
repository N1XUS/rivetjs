---
title: Props, values and timing
description: Helpers for widget code from @rivetjs/cdk/utils and interactions - mergeProps, controllable values, number math, transitions, labels, form reset.
template: guide
status: experimental
related: [foundations/utilities, foundations/ids, foundations/dom]
---

The small helpers every component in `@rivetjs/cdk` is built with, for your own widgets: merging attribute objects, the controlled / uncontrolled value pattern, number math for sliders and number fields, waiting for CSS transitions, labelling and form reset. `@rivetjs/cdk/utils` ports React Aria's `utils`; `@rivetjs/cdk/interactions` holds the Rivet-specific `controllable()`.

::example{id=utils-merge}

## Import

```ts
import { controllable } from "@rivetjs/cdk/interactions";
import { chain, mergeProps, mergeRefs, clamp, snapValueToStep, runAfterTransition, useLabels, useDescription, useFormReset, updateEffect } from "@rivetjs/cdk/utils";
import { mergeIds } from "@rivetjs/cdk/id";
```

## Merging props

| Export | Does |
| --- | --- |
| `mergeProps(...props)` | React Aria `mergeProps`: `on[A-Z]…` handlers chained with `chain`, `class` / `className` joined (an accessor on either side gives an accessor), `id`s merged with `mergeIds`, `ref`s merged with `mergeRefs`; any other key: the last defined value wins (`undefined` never overrides). Aria id lists (`aria-describedby`, …) are not joined. Pure and server-safe for attribute bags. |
| `chain(...callbacks)` | One function calling every function argument in order with the same arguments; non-functions are skipped. |
| `mergeRefs(...refs)` | One callback ref for callback refs and `{ current }` objects. Cleanups returned by callback refs are chained; refs without a cleanup are reset to `null`. A single ref is returned as is. |
| `mergeIds(a, b)` | From `@rivetjs/cdk/id`: equal ids stay; otherwise reactive ids holding one switch to the other (see [Ids](ids.md)). |

There is one `mergeProps` / `chain` / `mergeRefs` implementation (`@rivetjs/cdk/interactions/merge-props`, re-exported by `@rivetjs/cdk/utils`). It is a resume-compiled module, so the chained handlers it returns are resumable symbols: a merged bag of resumable handlers (hook `xxxProps` bags, inline arrows) stays resumable when spread on a native element.

## Controlled and uncontrolled values

`controllable(value, defaultValue)` returns the caller's signal when one is passed (controlled, two-way), else a new signal starting at `defaultValue` (uncontrolled). Both are plain signals, so state stays serializable. The internal signal is region state: when a resumed page re-creates the component's region, it keeps its value. Every `selected`, `value` and `input` prop of the cdk components goes through it.

::example{id=utils-controllable}

`updateEffect(deps, fn)` (React Aria `useUpdateEffect`) runs `fn` when `deps()` changes after the first run, comparing positions with `Object.is`; `fn` may return a cleanup. It returns the disposer. It creates an effect, so call it in browser-only code: inside `clientEffect` as above, or in a client-rendered tree.

## Numbers

| Export | Does |
| --- | --- |
| `clamp(value, min = -Infinity, max = Infinity)` | `value` limited to `[min, max]`. |
| `snapValueToStep(value, min, max, step)` | The nearest multiple of `step` counted from `min` (or 0), then kept inside `[min, max]` on a step (react-stately). |
| `roundToStepPrecision(value, step)` | Rounds to the decimal places of `step` (exponent steps such as `1e-7` included). |
| `toFixedNumber(value, digits, base = 10)` | Rounds to `digits` digits in `base`, as a number. |

::example{id=utils-numbers}

## Transitions

`runAfterTransition(fn)` runs `fn(true)` once every running CSS transition in the document has ended, or `fn(false)` on the next frame when none runs (one frame lets a transition that starts on mount begin). It returns a cancel function. Overlays use it to move focus after an exit animation. Tracking starts at the first call (React Aria starts at import; Rivet modules have no import-time effects) and picks up transitions already running through `document.getAnimations()`. `trackTransitions(doc?)` starts it explicitly; `_resetTransitions()` is the test hook.

::example{id=utils-transition}

## Labels and descriptions

| Export | Does |
| --- | --- |
| `useLabels(props, defaultLabel?)` | React Aria `useLabels`, pure: with both `aria-label` and `aria-labelledby`, the element's own id joins `aria-labelledby` so both are read; id lists are normalized; without any label, `defaultLabel` becomes `aria-label`. Creates an `id` when missing. |
| `useDescription(element, description?)` | React Aria `useDescription`, browser only: a shared hidden node per distinct text (reference counted) referenced from `aria-describedby`. Returns the cleanup. Server-rendered markup should render its own description element instead. |
| `focusWithoutScrolling(element)` | `element.focus({ preventScroll: true })`. |
| `getOffset(element, reverse?, orientation = "horizontal")` | The element's left / top edge in client coordinates, or right / bottom with `reverse`. |

::example{id=utils-labels}

## Form reset

`useFormReset(field, initialValue, onReset)` (React Aria) listens for `reset` on the field's form and, unless the reset was cancelled, calls `onReset(initialValue)`. It returns the cleanup. Call it from a client effect, or from the first handler that needs it. A field whose value lives only in the DOM needs nothing: the browser resets it.

::example{id=utils-form-reset}

## Resumability

- Pure helpers (`mergeProps`, `clamp`, `snapValueToStep`, `useLabels`, …) can run while the server renders.
- `mergeProps` / `chain` / `mergeRefs` return resumable functions; merged handlers must themselves be resumable (inline arrows, local functions, hook bags) to resume when spread.
- `useDescription`, `useFormReset`, `runAfterTransition` and `updateEffect` touch the DOM or create effects: call them from client effects or handlers and return their cleanups.

## Upstream

React Aria `utils`: `chain`, `mergeProps`, `mergeRefs`, `mergeIds`, `runAfterTransition`, `focusWithoutScrolling`, `getOffset`, `useLabels`, `useDescription`, `useFormReset`, `useUpdateEffect` (→ `updateEffect`); react-stately `utils/number`: `clamp`, `snapValueToStep`, `roundToStepPrecision`, `toFixedNumber`. Hooks become plain functions that return attributes or cleanups. Rivet adds `controllable()` (`useControlledState` equivalent). Not ported: `useId` (see [Ids](ids.md)), `useObjectRef`, `useEffectEvent`, `useSyncRef`, `useValueEffect`, `useEvent`, `useGlobalListeners` (use `clientEvent` from `@rivetjs/runtime/dom`).

## Common mistakes

- **Merging handlers that are not resumable.** `mergeProps` chains whatever it is given; a module-level or imported function in the bag still does not resume. Use inline arrows / local functions / hook bags.
- **Passing a value instead of a signal for controlled state.** `controllable(undefined, x)` is uncontrolled; pass the signal itself to control it.
- **Focusing during an exit transition.** Wait with `runAfterTransition`, or focus lands on an element that is about to disappear.
