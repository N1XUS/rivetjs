---
title: Markdown
description: "Safe Markdown for model answers, rendered as real elements and updated block by block while it streams."
template: reference
status: experimental
related: [components/code-block, components/chat-message]
---

`Markdown` renders CommonMark plus the GFM parts chat answers use (tables, task lists, strikethrough, autolinks) with the Rivet UI typography. `@rivetjs/cdk/markdown` parses the text into plain data and the component builds elements from it: raw HTML stays text and links are limited to http(s), mailto, tel and relative URLs, so model output can never inject markup.

## Usage

```tsx
import { Markdown } from "@rivetjs/ui/markdown";
```

::example{id=markdown-basic}

## Anatomy

```tsx
<Markdown content={() => text()} isStreaming={() => streaming()} />
```

Fill the signal from a `fetch` body with `streamText(signal, response.body)` from `@rivetjs/cdk/chat`: one signal write per chunk.

Additional exported parts: `Markdown.Root`.

## Examples

### Streaming

Pass an accessor as `content` and `isStreaming`. The text is split into top-level blocks; finished blocks keep their DOM nodes (keyed rows). The block being written is keyed down to its words: a chunk only appends word spans, which fade and un-blur in, and each new block (paragraph, list item, code block) eases in. While streaming, open marks in the last block (`**`, `__`, `~~`, a backtick) are closed for display, a soft pulsing caret follows the text, and the root's height grows smoothly (`followHeight` from `@rivetjs/cdk/chat`). An open code fence streams as plain words in the code block frame and is highlighted once it closes. Fenced code renders as a [CodeBlock](/components/code-block/). Reduced motion: no fades, no height easing.

::example{id=markdown-streaming}

### Custom components

`components` replaces the element rendered for a node type. Keys are HTML tag names: `h1`–`h6`, `p`, `blockquote`, `ul`, `ol`, `li`, `hr`, `a`, `img`, `strong`, `em`, `del`, `code` (inline code), `pre` (a fenced block, replacing the whole [CodeBlock](/components/code-block/)), `table`, `th`, `td`, `br` and `input` (the task-list checkbox). Each override is a function of `{ class, children, …attributes }` that returns the element: `class` is the default Markdown class, `children` is already rendered (and live while streaming: finished blocks keep their nodes, the block being written keeps its words), and nodes carry their own attributes (`href`, `src`, `alt`, `level`, `start`, `code` / `language` / `closed` for `pre`). Elements are still built from the parsed AST, never from HTML, so an override cannot receive unsafe URLs or raw markup. Tight list-item paragraphs have no `<p>`, so `p` is not called for them. The map is read once when the Markdown is created.

::example{id=markdown-custom-components}

### With Streamdown

There is no Streamdown adapter: the built-in streaming mode above covers mark repair and the caret.

### Resumability

Parsed and rendered on the server; a static answer ships no parser. A streaming accessor re-parses only the last block per update; the parser loads with the first change.

## Styling Reference

The component’s parts emit these additional `data-slot` values: `markdown-caret`, `code-block-code`.

### CSS Classes

| Class                                                        | Applied                                        |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `markdown`                                                   | root                                           |
| `markdown__code-block[data-streaming]`                       | a fence still open while streaming             |
| `markdown__heading` / `--1` … `--6`                          | headings                                       |
| `markdown__paragraph`                                        | paragraphs                                     |
| `markdown__list` / `--ordered` / `markdown__list-item`       | lists                                          |
| `markdown__task-checkbox`                                    | task list box                                  |
| `markdown__blockquote`                                       | quotes                                         |
| `markdown__table-wrapper` / `markdown__table`                | tables (scrolling wrapper)                     |
| `markdown__code-block`                                       | fenced code (a `code-block`)                   |
| `markdown__inline-code`                                      | inline code                                    |
| `markdown__strong` / `__del` / `__link` / `__image` / `__hr` | inline marks, links, images, rules             |
| `markdown__caret`                                            | streaming caret                                |
| `markdown__tail`                                             | streaming blocks wrapper (`display: contents`) |
| `markdown__live`                                             | a block entering while streaming               |
| `markdown__word`                                             | a streamed word (fades in)                     |

## API Reference

See the [full module API](/api/rivetjs/ui/markdown/) for every named export and part prop type.

| Prop          | Type                       | Default |
| ------------- | -------------------------- | ------- |
| `content`     | `string \| () => string`   | —       |
| `children`    | `string`                   | —       |
| `isStreaming` | `boolean \| () => boolean` | `false` |
| `showCaret`   | `boolean`                  | `true`  |
| `components`  | `MarkdownComponents`       | —       |
| `class`       | `string`                   | —       |

Other `div` attributes pass to the root. Not supported: reference links, footnotes, raw HTML blocks.

::api{symbol="@rivetjs/ui/markdown#MarkdownProps"}

## Accessibility

headings, lists, tables and quotes are their native elements; images keep their alt text; task-list checkboxes are read-only.

## Related Components

- [CodeBlock](/components/code-block/)
- [ChatMessage](/components/chat-message/)
