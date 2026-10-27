---
title: Utilities
description: Index of the small @rivetjs/cdk modules for widget code - clipboard, platform, text direction, breakpoints, observers, coercion, dates, i18n and helpers.
template: guide
status: experimental
related: [foundations/overview, foundations/props-and-values, foundations/platform]
---

Small modules for your own widgets. Each is its own import path; code you do not import is not shipped. Use them from your own widget handlers and client effects.

| Import | Gives you | Upstream | Guide |
| --- | --- | --- | --- |
| `@rivetjs/cdk/clipboard` | `copy()`, `copyText()`, `beginCopy()`, `copyToClipboard()` with retries. | Angular CDK clipboard | [Clipboard](clipboard.md) |
| `@rivetjs/cdk/platform` | `isMac()`, `isIOS()`, `supports()`, `getPlatform()`, `isCtrlKeyPressed()`, `isVirtualClick()`. | React Aria, Angular CDK platform | [Platform](platform.md) |
| `@rivetjs/cdk/bidi`, `@rivetjs/cdk/bidi-dir` | `direction()`, `logicalKey()`, `isRtlLocale()`, `<Dir>`, `Directionality` state. | Angular CDK bidi | [Text direction](bidi.md) |
| `@rivetjs/cdk/layout` | `Breakpoints`, `BreakpointObserver`, `breakpointState()`. | Angular CDK layout | [Breakpoints](layout.md) |
| `@rivetjs/cdk/observers` | `observeContent()`, shared content and resize observers, `useResizeObserver()`. | Angular CDK observers, React Aria | [Observers](observers.md) |
| `@rivetjs/cdk/coercion` | `coerceBooleanProperty()`, `coerceNumberProperty()`, `coerceCssPixelValue()`, … | Angular CDK coercion | [Coercion](coercion.md) |
| `@rivetjs/cdk/keys` | `createKeyboardShortcutHandler()` (and `nextIndex()`, `typeahead()`). | React Aria | [Keyboard shortcuts](keyboard-shortcuts.md), [Keyboard navigation](keyboard-navigation.md) |
| `@rivetjs/cdk/i18n`, `@rivetjs/cdk/i18n-provider` | `I18nProvider`, `useLocale()`, `getDateFormatter()`, `getStringsForLocale()`. | React Aria i18n, `@internationalized/string` | [Internationalization](i18n.md) |
| `@rivetjs/cdk/date` | `CalendarDate`, `ZonedDateTime`, calendar systems, date math, `stringifyDateValue()`. | `@internationalized/date` | [Dates](dates.md) |
| `@rivetjs/cdk/utils`, `@rivetjs/cdk/interactions` | `mergeProps()`, `controllable()`, `clamp()`, `runAfterTransition()`, `useLabels()`, `useFormReset()`. | React Aria utils, react-stately | [Props, values and timing](props-and-values.md) |
| `@rivetjs/cdk/dom` | Owner document, shadow-DOM-safe containment, `scrollIntoView()`, `getViewportSize()`, `getNonce()`. | React Aria utils | [DOM helpers](dom.md) |
| `@rivetjs/cdk/storage` | `webStorage()`, `readStorage()`, `writeStorage()`, `removeStorage()`: Web Storage that never throws (Safari private mode, blocked cookies, full quota). | Rivet | [Resizable: persisted layout](../components/resizable.md) |
| `@rivetjs/cdk/drag-drop`, `@rivetjs/cdk/drag-drop/cdk`, `@rivetjs/cdk/drag-drop/utils` | Drag and drop components, engine (`DragRef`, `DropListRef`) and array helpers. | Angular CDK drag-drop | [Drag and drop](../components/drag-and-drop.md) |

## Import and example

```ts check
import { coerceBooleanProperty, coerceCssPixelValue } from "@rivetjs/cdk/coercion";

const disabled = coerceBooleanProperty("false"); // false
const width = coerceCssPixelValue(320); // "320px"
```

## API guides

The table above links to the API for each utility family. [Chat helpers](chat.md), [Markdown parsing](markdown.md) and [Code highlighting](highlight.md) cover streaming text and custom content renderers.

## Rules for all of them

- **Nothing in markup that depends on the browser.** Platform checks, direction, breakpoints and viewport sizes are unknown (or default) on the server, and server HTML is cached. Read them in handlers or client effects and keep the result in a signal.
- **Call browser work from handlers or `clientEffect`.** Return the cleanup the function gives you (observers, `useFormReset`, `useDescription`, subscriptions).
- **Strings in state.** Date values, locales and directions go into signals as strings.
