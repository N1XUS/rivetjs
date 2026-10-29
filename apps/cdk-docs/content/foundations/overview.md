---
title: CDK
description: Low-level UI building blocks from @rivetjs/cdk for your own widgets, such as unique ids, keyboard navigation, focus handling, selection and overlays.
template: guide
status: experimental
related: [components/overview]
---

`@rivetjs/cdk` is a "component development kit", similar to the Angular CDK. It holds mechanisms, not finished components, so you can build your own widgets. The [accessible components](../components/overview.md) are built from it. After reading this page you know which module to reach for.

The package is experimental. Its API may change.

## Modules

Each module is a separate import path. Code you do not import is not shipped.

| Import | Gives you | Guide |
| --- | --- | --- |
| `@rivetjs/cdk/keys` | `nextIndex()` for arrow keys, Home and End in lists, tabs and toolbars, with wrapping, disabled items and right-to-left. `typeahead()` jumps to the item the visitor types. | [Keyboard navigation](keyboard-navigation.md) |
| `@rivetjs/cdk/focus` | Move focus to the first or last element, keep Tab inside an area, restore focus later, roving `tabindex`. | [Focus](focus.md) |
| `@rivetjs/cdk/focus-scope` | `<FocusScope contain>`: keeps Tab inside its children. | [Focus](focus.md) |
| `@rivetjs/cdk/overlay` | `overlay()`: Escape and outside-press dismissal on a stack of overlays (React Aria `useOverlay`). | [Overlays](overlays.md) |
| `@rivetjs/cdk/position` | `overlayPosition()`: placement next to a trigger, flipping and following resizes (React Aria `useOverlayPosition`). | [Overlays](overlays.md) |
| `@rivetjs/cdk/collections` | Selection state (single or multiple) as a signal, ranges, select all, and helpers that read items from the DOM. | [Selection](selection.md) |
| `@rivetjs/cdk/collections/*` | Collection builders (`Item`, `Section`), list, tree, grid and table collections, collections read from the DOM, and the Angular CDK `SelectionModel` and `DataSource`. | [Collections](collections.md) |
| `@rivetjs/cdk/selection/*` | React Aria selection: `SelectionManager`, selection state, `ListKeyboardDelegate`, typeahead, and the selectable list and item handlers. | [Selection](selection.md#selectionmanager) |
| `@rivetjs/cdk/a11y` | `announce()` for screen readers, checks for visible, focusable and tabbable elements, `visuallyHidden` styles for visually hidden text. | [Announcements](announcements.md) |
| `@rivetjs/cdk/announcer` | `<Announcer />`: the live regions `announce()` writes to. | [Announcements](announcements.md) |
| `@rivetjs/cdk/id` | `createId()`: unique ids for `for`, `aria-labelledby` and `aria-controls`, safe on resumed pages. | [Ids](ids.md) |
| `@rivetjs/cdk/virtualizer` | React Spectrum's virtualizer: layouts and a `Virtualizer` that renders only the items in view. | [Virtualizer](virtualizer.md) |
| `@rivetjs/cdk/scrolling` | Angular CDK scrolling: virtual scroll, `ScrollDispatcher`, `ViewportRuler`, `CdkScrollable`. | [Scrolling](scrolling.md) |
| `@rivetjs/cdk/portal`, `@rivetjs/cdk/portal-outlet` | `<Portal>` that renders on the server and moves to its mount; Angular CDK portal outlets. | [Portal](portal.md) |
| `@rivetjs/cdk/interactions`, `@rivetjs/cdk/utils` | `mergeProps()` for attribute objects, `controllable()` for a value that is passed in or internal, `clamp()` and step math, `runAfterTransition()`, `useLabels()`, `useFormReset()`. | [Props, values and timing](props-and-values.md) |
| `@rivetjs/cdk/dom` | Owner document and window, shadow-DOM-safe containment and focus, scroll parents, `scrollIntoView()`, viewport size, CSP nonce. | [DOM helpers](dom.md) |
| `@rivetjs/cdk/platform` | `supports("field-sizing")` and other feature checks, `isMac()`, `getPlatform()`, `isVirtualClick()`. On the server they return `undefined`. | [Platform](platform.md) |
| `@rivetjs/cdk/coercion` | Coerce attribute strings and accessors into booleans, numbers, CSS pixels, arrays and elements. | [Coercion](coercion.md) |
| `@rivetjs/cdk/clipboard` | `copy(text)`, synchronous `copyText()`, `beginCopy()` for large text, `copyToClipboard()` with retries. | [Clipboard](clipboard.md) |
| `@rivetjs/cdk/keys` | `createKeyboardShortcutHandler()`: shortcut strings such as `Mod+s` mapped to actions. | [Keyboard shortcuts](keyboard-shortcuts.md) |
| `@rivetjs/cdk/layout` | `Breakpoints`, `BreakpointObserver`, `breakpointState()` for handlers and client effects. | [Breakpoints](layout.md) |
| `@rivetjs/cdk/observers` | `observeContent()`, shared content and resize observers, `useResizeObserver()`. | [Observers](observers.md) |
| `@rivetjs/cdk/i18n`, `@rivetjs/cdk/i18n-provider` | `I18nProvider`, `useLocale()`, cached date formatters, localized string tables. | [Internationalization](i18n.md) |
| `@rivetjs/cdk/bidi`, `@rivetjs/cdk/bidi-dir` | The text direction of an element, `logicalKey()`, `<Dir>` and the `Directionality` state. | [Text direction](bidi.md) |
| `@rivetjs/cdk/date` | `@internationalized/date`: `CalendarDate`, time zones, calendar systems, date math, string forms for state. | [Dates](dates.md) |
| `@rivetjs/cdk/drag-drop` | Angular CDK drag and drop: `Drag`, `DropList`, `DropListGroup`, `DragHandle`, `DragPreview`, `DragPlaceholder`, the engine. | [Drag and drop](../components/drag-and-drop.md) |

All small modules at a glance: [Utilities](utilities.md).

`Portal` comes from `@rivetjs/cdk/portal`. It renders content in place on the server and moves its host to the chosen mount in the browser; the default mount is `document.body`. See [Portal](portal.md).

## Import and example

```ts check
import { mergeProps } from "@rivetjs/cdk/utils";

const attributes = mergeProps({ class: "field" }, { class: "compact", "aria-label": "Search" });
```

## API guides

Each row above links to its module's API and examples. For text-oriented interfaces, see [Chat helpers](chat.md), [Markdown parsing](markdown.md) and [Code highlighting](highlight.md).

## Rules for your own widgets

- Keep state in signals and plain objects, so the page can resume it.
- Read the rendered items from the DOM in event handlers. You do not need to keep a copy of the list.
- Use the native element when one exists, such as `<button>`, `<details>` and inputs. The CDK adds only what the browser does not do. Overlays are the exception: use the div overlay layer (`overlay()`, `overlayPosition()`, `<Overlay>`), not `popover` or `<dialog>`.
- Handlers can be any function: inline, local, imported, from another library, or `.bind(…)`. A component that receives a function runs together with the component that passes it, the first time it is used in the browser.
- List the keys a composite widget handles in `data-rk` (`navigationKeys()` builds the list), so a cold arrow key does not scroll the page while the widget's code loads.
- In a component's module, reach the document through an element (`event.currentTarget.ownerDocument`): the compiler rejects a bare `document` it cannot prove runs only in the browser.
