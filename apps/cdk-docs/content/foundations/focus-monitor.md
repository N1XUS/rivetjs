---
title: FocusMonitor
description: Angular CDK FocusMonitor and InputModalityDetector: how focus arrived (keyboard, mouse, touch, program) and the cdk-*-focused classes.
template: guide
status: experimental
related: [foundations/focus-interactions, foundations/focus-trap, foundations/focus]
---

`FocusMonitor` tells you how an element got focus: `"keyboard"`, `"mouse"`, `"touch"` or `"program"`, and keeps classes for it on the element (`cdk-keyboard-focused`, …). `InputModalityDetector` tracks the last input modality on the page. Ports of Angular CDK; the React Aria counterpart is `useFocusRing` / `useInteractionModality` ([Focus interactions](focus-interactions.md)).

::example{id=focus-monitor}

```ts
import { getFocusMonitor } from "@rivetjs/cdk/a11y/focus-monitor";

const monitor = getFocusMonitor();
const subscription = monitor.monitor(element).subscribe((origin) => console.log(origin)); // "keyboard" | "mouse" | "touch" | "program" | null
// …
subscription.unsubscribe();
monitor.stopMonitoring(element);
```

## Classes

| Class | While |
| --- | --- |
| `cdk-focused` | The element (or, with `checkChildren`, something inside it) has focus. |
| `cdk-keyboard-focused` | … and it came from the keyboard. |
| `cdk-mouse-focused` | … from a mouse (a click on a `<label>` counts as mouse for its input). |
| `cdk-touch-focused` | … from touch. |
| `cdk-program-focused` | … from a script (`element.focus()`, `focusVia(el, "program")`). |

```css
.my-button.cdk-keyboard-focused {
  outline: 2px solid teal;
}
```

## FocusMonitor

`new FocusMonitor(options?, inputModalityDetector?, document?)`, or the shared `getFocusMonitor()`.

| Member | Does |
| --- | --- |
| `monitor(element, checkChildren = false)` | Start monitoring (an element or `{ nativeElement }`); returns a `Subject<FocusOrigin>` that emits the origin on focus and `null` on blur. Calling it again returns the same subject (and can turn on `checkChildren`). Elements in a shadow root listen on that root. |
| `stopMonitoring(element)` | Stop, remove the classes, complete the subject. |
| `focusVia(element, origin, options?)` | Focus `element` and attribute it to `origin`; on an already focused element it only updates the classes. |
| `destroy()` | Stop monitoring everything. |

| Option | Values | Notes |
| --- | --- | --- |
| `detectionMode` | `FocusMonitorDetectionMode.IMMEDIATE` (default), `.EVENTUAL` | IMMEDIATE: only an interaction just before the focus counts (else `"program"`). EVENTUAL: the last interaction counts however long ago. |

When the window regains focus, the element gets the origin it had before the window blurred.

## InputModalityDetector

`new InputModalityDetector(options?, document?)`, or the shared `getInputModalityDetector()`. Capturing, passive listeners for `keydown`, `mousedown` and `touchstart`.

| Member | Does |
| --- | --- |
| `mostRecentModality` | `"keyboard" \| "mouse" \| "touch" \| null`. |
| `modalityDetected` | Subject: every detected modality. |
| `modalityChanged` | Subject: only changes. |
| `destroy()` | Remove the listeners, complete the subjects. |

Options: `ignoreKeys` (key codes that do not count as keyboard; default `INPUT_MODALITY_DETECTOR_DEFAULT_OPTIONS.ignoreKeys`: Alt, Control, Meta, Shift, so modifier presses with a mouse and VoiceOver's modifiers do not switch to keyboard). A `mousedown` within `TOUCH_BUFFER_MS` (650) of a touch is touch; screen readers' fake `mousedown` / `touchstart` (`isFakeMousedownFromScreenReader`, `isFakeTouchstartFromScreenReader`) count as keyboard.

## Subjects

The observables are minimal subjects: `subscribe(fn | { next, complete })` returns `{ unsubscribe() }`; there is no RxJS and no operator chain.

## Resumability

Browser only. Create and subscribe in a client effect (the runtime boots at load on pages that use one) or a handler, and stop monitoring in the effect's cleanup. Write the origin into a signal to render it, as in the example.

## Upstream

Port of `@angular/cdk/a11y` focus-monitor, input-modality and fake-event-detection. Deviations: plain classes with shared instances (`getFocusMonitor()`, `getInputModalityDetector()`) instead of root injectables; minimal subjects instead of RxJS; no `NgZone`. Not yet supported: the `cdkMonitorElementFocus` / `cdkMonitorSubtreeFocus` directives (call `monitor()` from a client effect), the injection tokens for the options (pass them to the constructor).
