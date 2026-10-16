---
title: FocusTrap
description: Angular CDK FocusTrap, CdkTrapFocus and ConfigurableFocusTrap from @rivetjs/cdk/a11y/focus-trap: Tab anchors, initial focus, a stack of traps.
template: guide
status: experimental
related: [foundations/focus, foundations/focus-monitor, components/dialog]
---

A port of Angular CDK's focus trap: two invisible, tabbable anchors around a region send :kbd[Tab] back to the first or last tabbable element inside it. It is a browser object you create and destroy yourself; the declarative alternative is `<FocusScope contain>` ([Focus](focus.md)), which also resumes before any code runs.

::example{id=focus-trap}

```ts
import { FocusTrap } from "@rivetjs/cdk/a11y/focus-trap";

const trap = new FocusTrap(element); // anchors inserted before and after `element`
trap.focusInitialElement(); // [cdk-focus-initial], else the first tabbable element
// …
trap.destroy(); // anchors removed
```

## Anatomy

```html
<div tabindex="0" aria-hidden="true" class="cdk-visually-hidden cdk-focus-trap-anchor" style="…visually hidden…"></div>
<div id="region">
  <input />
  <input cdk-focus-initial />
  <button>Done</button>
</div>
<div tabindex="0" aria-hidden="true" class="cdk-visually-hidden cdk-focus-trap-anchor" style="…"></div>
```

Markers inside the region (in JSX, write the dashed form: `<input cdk-focus-initial="" />`; the camel-case names are not in the element typings):

| Attribute | Effect |
| --- | --- |
| `cdk-focus-initial` (or `cdkFocusInitial`) | `focusInitialElement()` focuses it (or its first tabbable child when it is not focusable itself). |
| `cdk-focus-region-start` (or `cdkFocusRegionStart`, `cdk-focus-start`) | The "first" element Tab wraps to. |
| `cdk-focus-region-end` (or `cdkFocusRegionEnd`, `cdk-focus-end`) | The "last" element Shift+Tab wraps to. |

## FocusTrap

`new FocusTrap(element, checker?, document?, deferAnchors = false)`

| Member | Does |
| --- | --- |
| `enabled` | Get / set: disabled anchors lose their `tabindex`. |
| `attachAnchors()` | Insert the anchors (done by the constructor unless `deferAnchors`); `false` while `element` has no parent. |
| `hasAttached()` | Whether the anchors are in the DOM. |
| `focusInitialElement(options?)` | The `cdk-focus-initial` element, else the first tabbable element. Returns whether it focused something. |
| `focusFirstTabbableElement(options?)`, `focusLastTabbableElement(options?)` | Region start / end marker, else the first / last tabbable element. |
| `focusInitialElementWhenReady()`, `focusFirstTabbableElementWhenReady()`, `focusLastTabbableElementWhenReady()` | The same after the next animation frame; promise of the result. |
| `destroy()` | Remove the anchors. |

`FocusTrapFactory` (`new FocusTrapFactory(checker?, document?)`, `.create(element, deferCaptureElements?)`) builds traps with shared dependencies. Tabbability comes from the [InteractivityChecker](a11y-services.md#interactivitychecker).

A plain FocusTrap only handles Tab: a click or a script can still move focus out.

## CdkTrapFocus

The `cdkTrapFocus` directive as a class. `new CdkTrapFocus(element, { enabled?, autoCapture? }, factory?)`; call `attach()` once the element is in the DOM (a client effect) and `destroy()` on unmount.

| Member | Does |
| --- | --- |
| `attach()` | Insert the anchors; with `autoCapture`, remember the focused element and focus the initial element after the next frame. |
| `check()` | Retry the anchors when the element had no parent at `attach()` (Angular's `ngDoCheck`). |
| `enabled`, `autoCapture` | Get / set. Turning `autoCapture` on after attach captures now. |
| `focusTrap` | The underlying `FocusTrap`. |
| `destroy()` | Remove the anchors; with `autoCapture`, focus the remembered element again. |

::example{id=focus-trap-capture}

## ConfigurableFocusTrap

`new ConfigurableFocusTrapFactory(inertStrategy?, checker?, manager?, document?).create(element, { defer })` returns a trap registered with a `FocusTrapManager`: only the most recently registered (or re-enabled) trap is active, the others are disabled until it goes. Its inert strategy also handles focus that leaves by other means than Tab.

| Export | Does |
| --- | --- |
| `ConfigurableFocusTrap` | A `FocusTrap` whose `enabled` setter registers / deregisters with the manager; `destroy()` deregisters. |
| `FocusTrapManager` | `register(trap)`, `deregister(trap)`: a stack; the top one is enabled. |
| `getFocusTrapManager()` | The shared manager. |
| `FocusTrapInertStrategy` | Interface: `preventFocus(trap)`, `allowFocus(trap)`. |
| `EventListenerFocusTrapInertStrategy` | Default strategy: a capturing `focus` listener moves focus back to the first tabbable element when it lands outside (overlay panes `div.cdk-overlay-pane` and `[data-rv-top-layer]` are allowed). |

::example{id=focus-trap-configurable}

## Accessibility

| Key | Action |
| --- | --- |
| :kbd[Tab] on the last tabbable element | The end anchor takes focus and forwards it to the first element. |
| :kbd[Shift]+:kbd[Tab] on the first | The start anchor forwards it to the last element. |

The anchors are `aria-hidden` and visually hidden. A trap does not make the rest of the page inert or block scrolling: for modals, use [Dialog](../components/dialog.md).

## Resumability

FocusTrap and its relatives are browser objects: create them in a handler or a client effect, keep them outside component state (a module-level holder, as in the examples), and destroy them yourself. Nothing is serialized. Prefer `<FocusScope contain>` when the trap should work before any code has loaded.

## Upstream

Port of `@angular/cdk/a11y` focus-trap (`FocusTrap`, `FocusTrapFactory`, `CdkTrapFocus`, `ConfigurableFocusTrap`, `ConfigurableFocusTrapFactory`, `FocusTrapManager`, `EventListenerFocusTrapInertStrategy`). Deviations: no dependency injection or `NgZone`, constructors take the element and optional dependencies; "when ready" waits for the next animation frame (Angular `afterNextRender`); the directive is a class with `attach()` / `destroy()`; anchors also carry inline visually-hidden styles next to the `cdk-visually-hidden` class. Not yet supported: the `FOCUS_TRAP_INERT_STRATEGY` injection token (pass the strategy to the factory).
