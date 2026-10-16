---
title: AriaDescriber and checks
description: Angular CDK AriaDescriber, aria-reference helpers, InteractivityChecker and HighContrastModeDetector from @rivetjs/cdk/a11y/*.
template: guide
status: experimental
related: [foundations/focus, foundations/announcements, foundations/focus-trap]
---

Three Angular CDK accessibility services, as plain classes with shared instances: `AriaDescriber` adds `aria-describedby` descriptions that live in one hidden container, `InteractivityChecker` decides whether an element is disabled, visible, focusable or tabbable, and `HighContrastModeDetector` detects Windows high-contrast (forced colors) mode. All three are browser only: call them from handlers or client effects.

## AriaDescriber

::example{id=aria-describer}

```ts
import { getAriaDescriber } from "@rivetjs/cdk/a11y/aria-describer";

getAriaDescriber().describe(button, "Cannot be undone");
getAriaDescriber().removeDescription(button, "Cannot be undone");
```

| Member | Does |
| --- | --- |
| `new AriaDescriber(appId = "rv", document?)` | A describer; `getAriaDescriber()` returns the shared one. |
| `describe(host, message, role?)` | Add `message` (a string) to `host`'s `aria-describedby`. One message element per distinct message + role, shared by every host and reference counted. Skipped when the message is empty or equals the host's `aria-label` (it would be read twice). |
| `describe(host, element)` | Use an element of yours as the description (it gets an id if it has none). |
| `removeDescription(host, message, role?)` / `(host, element)` | Remove the reference; a created message element is deleted when no host uses it, the container when it is empty. Your own elements stay. |
| `destroy()` | Remove every description this describer added and its container. |

Existing `aria-describedby` ids on the host are kept. Rendered markup:

```html
<button aria-describedby="own-hint cdk-describedby-message-rv-0-1" cdk-describedby-host="rv-0">Delete</button>
…
<div class="cdk-describedby-message-container cdk-visually-hidden" style="visibility: hidden; …visually hidden…">
  <div id="cdk-describedby-message-rv-0-1">Cannot be undone</div>
</div>
```

`visibility: hidden` keeps the text out of find-in-page; screen readers still read descriptions. A server-rendered container (`.cdk-describedby-message-container[platform="server"]`) is removed when the first message is created.

### aria-reference helpers

| Function | Does |
| --- | --- |
| `addAriaReferencedId(el, attr, id)` | Add `id` to an id-list attribute (`aria-describedby`, `aria-labelledby`, `aria-owns`, …), no duplicates. |
| `removeAriaReferencedId(el, attr, id)` | Remove it; removes the attribute when the list is empty. |
| `getAriaReferenceIds(el, attr)` | The ids in the attribute. |

Constants: `CDK_DESCRIBEDBY_ID_PREFIX` (`"cdk-describedby-message"`), `CDK_DESCRIBEDBY_HOST_ATTRIBUTE` (`"cdk-describedby-host"`).

## InteractivityChecker

::example{id=interactivity-checker}

| Method | True when |
| --- | --- |
| `isDisabled(element)` | It has a `disabled` attribute (not `aria-disabled`). |
| `isVisible(element)` | It has geometry and computed `visibility: visible`. |
| `isFocusable(element, config?)` | A native control, `a[href]`, `[contenteditable]` or a valid `tabindex`; not disabled; not `type="hidden"`; visible (`config.ignoreVisibility` skips that check: `new IsFocusableConfig()`). |
| `isTabbable(element)` | Tab reaches it (assumes it is visible): `tabIndex` ≥ 0, frames that are themselves untabbable or hidden exclude their content, `iframe` / `object` never, `audio` only with `controls`, `video` with `controls` (Firefox: always), iOS Safari only text inputs, selects and textareas. Server: `false`. |

`getInteractivityChecker()` returns the shared instance; FocusTrap uses it. `@rivetjs/cdk/a11y` has lighter `isFocusable` / `isTabbable` / `tabbables()` used by FocusScope ([Focus](focus.md#focusable-and-tabbable-checks)).

## HighContrastModeDetector

::example{id=high-contrast}

| Member | Does |
| --- | --- |
| `new HighContrastModeDetector(document?)`, `getHighContrastModeDetector()` | Detector; listens to `(forced-colors: active)` changes. |
| `getHighContrastMode()` | `HighContrastMode.NONE`, `BLACK_ON_WHITE` or `WHITE_ON_BLACK`, from the color forced on a test element. Server: `NONE`. |
| `_applyBodyHighContrastModeCssClasses()` | Add `cdk-high-contrast-active` plus `cdk-high-contrast-black-on-white` or `cdk-high-contrast-white-on-black` to `<body>` (once until the mode changes). |
| `destroy()` | Stop listening. |

Constants: `HIGH_CONTRAST_MODE_ACTIVE_CSS_CLASS`, `BLACK_ON_WHITE_CSS_CLASS`, `WHITE_ON_BLACK_CSS_CLASS`. In plain CSS, `@media (forced-colors: active)` covers most needs without JavaScript.

## Resumability

None of these render markup or keep state in the page: call them from handlers (as in the examples) or client effects, and `destroy()` / `removeDescription()` yourself. A description added in the browser does not survive a full page load; for server-rendered descriptions, render the element and `aria-describedby` in JSX ([Ids](ids.md)).

## Upstream

Ports of `@angular/cdk/a11y` aria-describer + aria-reference, interactivity-checker and high-contrast-mode-detector. Deviations: plain classes and shared getters instead of injectables (`APP_ID` is the `appId` argument); the platform checks follow Angular's `Platform`; the high-contrast detector listens with `matchMedia` instead of `BreakpointObserver`.
