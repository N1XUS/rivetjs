---
title: Text direction
description: Right-to-left support from @rivetjs/cdk/bidi and bidi-dir - direction(), logicalKey(), the Dir provider and the Angular CDK Directionality state.
template: guide
status: experimental
related: [foundations/utilities, foundations/keyboard-navigation, foundations/i18n]
---

Layout needs no JavaScript for right-to-left text: use the `dir` attribute and CSS logical properties (`margin-inline-start`, `inset-inline-end`, `text-align: start`). Code needs the direction only when a key maps to a visual side, such as :kbd[ArrowLeft] in a toolbar. `@rivetjs/cdk/bidi` reads it; `@rivetjs/cdk/bidi-dir` provides it to a subtree (Angular CDK `Directionality` and `[dir]`).

::example{id=bidi-direction}

## Import

```ts
import { direction, logicalKey, isRtlLocale, injectDirectionality, createDir, setDir, documentDirectionality } from "@rivetjs/cdk/bidi";
import { Dir } from "@rivetjs/cdk/bidi-dir";
```

## Reading the direction

| Export | Does |
| --- | --- |
| `direction(element?)` | `"ltr"` or `"rtl"`: the nearest `dir` attribute (`ltr` / `rtl`), else the element's computed `direction`, else `<html dir>`. `"ltr"` on the server. |
| `logicalKey(key, dir)` | Swaps `ArrowLeft` and `ArrowRight` when `dir` is `"rtl"`, so a handler can reason in "start" and "end". Other keys pass through. |
| `isRtlLocale(locale)` | Whether a locale is written right to left, by language (`ar`, `he`, `fa`, `ur`, …) or script subtag (`Arab`, `Hebr`, `Thaa`, …), unless a `Latn` / `Cyrl` subtag follows (`goog.i18n.bidi.isRtlLanguage`). |
| `_resolveDirectionality(raw)` | Normalizes a raw `dir` value: case-insensitive `rtl` → `rtl`; `auto` → from `navigator.language`; anything else → `ltr`. |

Call `direction()` in a handler with the widget's element. One handler then serves both directions:

::example{id=bidi-logical-key}

[`nextIndex()`](keyboard-navigation.md) takes the same `dir` as an option.

## Providing a direction: `<Dir>`

`<Dir dir="rtl">` renders a wrapper element with `dir` exactly as given (`auto` stays `auto`, `RTL` stays `RTL`) and provides the normalized direction as the `Directionality` of its subtree.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `dir` | `string \| (() => string)` | required | `"ltr"`, `"rtl"` or `"auto"`, case-insensitive. An accessor follows a changing value in client-rendered trees (see [Resumability](#resumability)). |
| `onDirChange` | `(dir: Direction) => void` | none | Angular `(dirChange)`: called when the normalized direction changes after the first render. Client-rendered trees only. |
| `as` | `"div" \| "span" \| "section"` | `"div"` | Element to render. |
| `class`, `id` | `string` | none | |
| `children` | content or `() => content` | none | Rendered inside the provider (plain JSX children are a lazy slot), so descendants that read the `Directionality` see it; a render function `{() => …}` works too. |

::example{id=bidi-dir}

## Directionality state

| Export | Does |
| --- | --- |
| `Directionality` | `{ valueSignal: () => Direction; rawDir: () => string }`: the normalized direction and the raw `dir` value. |
| `DirState` | A writable `Directionality` whose fields are signals. |
| `injectDirectionality()` | Angular `inject(Directionality)`: the closest `<Dir>`, else `documentDirectionality()`. Call it in a component body. |
| `useDirection()` | A computed accessor of the closest direction. Client-rendered components only (see below). |
| `directionValue(dir)` | `dir.valueSignal()` (Angular `dir.value`). |
| `documentDirectionality(doc?)` | The root direction: `<body dir>`, else `<html dir>`, else `ltr`. `ltr` on the server. |
| `createDir(dir?)` | State of a `[dir]` element: `rawDir` keeps the value as given, `valueSignal` the normalized one. |
| `setDir(state, value)` | Sets the raw and normalized values; returns `true` when the normalized direction changed (Angular emits `dirChange` then). |
| `DirectionalityContext` | The context `<Dir>` provides. |

## Styling

- Style direction with `[dir="rtl"]` selectors or Tailwind's `rtl:` / `ltr:` variants, and logical properties (`ps-4`, `ms-auto`, `start-0`).
- Components set `data-orientation` and use logical properties; nothing in `@rivetjs/cdk` needs an RTL stylesheet.

## Resumability

- `direction()` and `logicalKey()` are plain functions: call them in handlers.
- `<Dir>` and `injectDirectionality()` run while the server renders. Read `valueSignal()` / `rawDir()` in bindings.
- To switch a `<Dir>` on a resumed page, render one branch per value (`{value() === "ltr" ? <Dir dir="ltr">…</Dir> : <Dir dir="rtl">…</Dir>}`), as the example does: the branch is created again in the browser.
- Known limitations: an accessor `dir={() => value()}` does not update a server-rendered `<Dir>` after resume, and a plain `dir={value()}` updates it only on the first change. `useDirection()` throws during server rendering (its `computed` is created outside a compiled component); use `injectDirectionality().valueSignal` instead. `onDirChange` never runs on a resumed page.

## Upstream

Angular CDK `cdk/bidi`: `Directionality` (plain signal state instead of a service with an `EventEmitter`), the `Dir` directive (a wrapper component), `_resolveDirectionality`, `DIR_DOCUMENT` (the `doc` parameter of `documentDirectionality`). Rivet adds `direction()`, `logicalKey()` and `useDirection()`. React Aria's `useLocale().direction` lives in [Internationalization](i18n.md).

## Common mistakes

- **Mirroring with JavaScript.** Swapping `left` / `right` styles in code instead of using logical properties.
- **Plain children under `<Dir>`.** `<Dir dir="rtl"><Toolbar /></Dir>` builds `Toolbar` before the provider exists; write `{() => <Toolbar />}`.
- **Reading `direction()` once at render.** It is `"ltr"` on the server. Read it in the handler that needs it.
