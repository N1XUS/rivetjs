---
title: Platform
description: Browser, OS and feature checks from @rivetjs/cdk/platform - React Aria platform probes, Angular CDK Platform flags, virtual clicks, shadow DOM helpers.
template: guide
status: experimental
related: [foundations/utilities, foundations/keyboard-shortcuts, foundations/dom]
---

`@rivetjs/cdk/platform` answers "which browser, which OS, which feature" for widget code: the React Aria platform checks (`isMac()`, `isIOS()`, …), the Angular CDK `Platform` flags, CSS feature probes, and helpers for virtual clicks and shadow DOM. Nothing runs at import time; results are memoized where the originals memoize.

::example{id=platform-checks}

## Server rule

Server HTML is cached and shared between browsers, and on a resumed page components do not run again in the browser. So never choose markup from a platform check. On the server:

- `supports()`, `isMac()` and the other React Aria probes return `undefined`.
- `getPlatform()` returns every flag `false` (`isBrowser: false`), as Angular does off the browser.
- `supportsScrollBehavior()` is `false`, `getRtlScrollAxisType()` is `NORMAL`, `getSupportedInputTypes()` returns every candidate type.

Read the checks in event handlers or client effects and keep the result in a signal, as the example does. For layout, use CSS (`@supports`, media queries) instead.

## Import

```ts
import { supports, isMac, isIOS, getPlatform, isCtrlKeyPressed, isVirtualClick } from "@rivetjs/cdk/platform";
```

## React Aria checks

| Export | Returns |
| --- | --- |
| `supports(feature)` | Whether the browser supports `"field-sizing"` (`field-sizing: content`) or `"base-select"` (`appearance: base-select`, customizable `<select>`). Memoized. `undefined` on the server. |
| `isMac()` | macOS (`userAgentData.platform`, else `navigator.platform`). |
| `isIPhone()`, `isIPad()` | iPhone; iPad, including iPadOS 13+ that reports as Mac (told apart by touch points). |
| `isIOS()`, `isAppleDevice()` | iPhone or iPad; macOS or iOS. |
| `isChrome()` | Chrome, including Chrome on iOS (`CriOS`). |
| `isWebKit()` | WebKit engine: every iOS browser, or AppleWebKit without Chrome. |
| `isSafari()`, `isFirefox()`, `isAndroid()` | By user agent brand / string. |
| `isCtrlKeyPressed(event)` | The platform's command modifier: `metaKey` on macOS, else `ctrlKey`. |
| `isVirtualClick(event)` | A click produced by a keyboard, assistive technology or `element.click()` rather than a pointer. |
| `isVirtualPointerEvent(event)` | A pointer event from a screen reader (zero-size pointer; TalkBack's 1×1 mouse with no pressure). |
| `_setSupports(feature, value)` | Test hook: force a feature on or off; `undefined` detects again. |

::example{id=platform-modifier}

## Angular CDK Platform

| Export | Returns |
| --- | --- |
| `getPlatform()` | The current `Platform`, memoized in the browser. |
| `detectPlatform(env)` | Pure: the flags for `{ isBrowser, userAgent?, chrome?, v8BreakIterator?, hasCSS?, msStream? }`. |
| `Platform` | `{ isBrowser, EDGE, TRIDENT, BLINK, WEBKIT, IOS, FIREFOX, ANDROID, SAFARI }`. `WEBKIT` is standalone WebKit (not Blink, EdgeHTML or Trident). |
| `supportsPassiveEventListeners()` | Passive listener support (true in every Baseline browser). |
| `normalizePassiveListenerOptions(options)` | `options` where option objects work, else only the capture flag. |
| `supportsScrollBehavior()` | `scrollTo({ behavior })` support, native or polyfilled. |
| `getRtlScrollAxisType()` | How `scrollLeft` behaves in RTL containers: `RtlScrollAxisType.NORMAL`, `NEGATED` (current spec, every Baseline browser) or `INVERTED`. Measured once with a 1px container. |
| `getSupportedInputTypes()` | The `<input type>` values this browser supports, as a `Set`. |
| `_supportsShadowDom()`, `_getShadowRoot(node)` | Shadow DOM support; the shadow root a node is in, or `null`. |
| `_getFocusedElementPierceShadowDom(doc?)` | The focused element, through open shadow roots. |
| `_getEventTarget(event)` | The real target: the first `composedPath()` entry. |
| `_isTestEnvironment()` | Under Karma, Jasmine, Jest, Mocha, Vitest or `node --test`. |
| `_resetPlatformMemo()` | Test hook: forget memoized checks. |

`detectPlatform` is what `getPlatform()` calls with the browser's own values, so you can test user-agent logic without a browser:

::example{id=platform-detect}

## Resumability

Every export is a plain function: handlers that call them resume without capturing anything. None of them reads `document` or `navigator` at import time.

## Upstream

- React Aria `utils/platform.ts`, `utils/isVirtualEvent.ts` and `shadowdom/DOMFunctions.ts` (as `_getShadowRoot`, `_getEventTarget`, `_getFocusedElementPierceShadowDom`).
- Angular CDK `cdk/platform`: `Platform` (an object from `getPlatform()` instead of an injectable), `supportsPassiveEventListeners`, `normalizePassiveListenerOptions`, `supportsScrollBehavior`, `getRtlScrollAxisType`, `RtlScrollAxisType`, `getSupportedInputTypes`, shadow DOM helpers, `_isTestEnvironment`.
- Rivet adds `supports(feature)`.

## Common mistakes

- **A check in JSX.** `{isMac() ? "⌘" : "Ctrl"}` renders `Ctrl` on the server for every visitor. Set the label in a client effect or show both.
- **User agent sniffing for layout.** Use CSS media and feature queries; they need no JavaScript and survive caching.
- **`isCtrlKeyPressed` with a hard-coded Control shortcut.** On macOS it checks `metaKey`; bind `Mod+…` with [keyboard shortcuts](keyboard-shortcuts.md) to get the same rule.
