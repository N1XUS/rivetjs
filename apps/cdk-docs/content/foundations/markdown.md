---
title: Markdown parsing
description: Parse Markdown into a plain-data syntax tree, split streamed blocks and repair incomplete marks with @rivetjs/cdk/markdown.
template: guide
status: experimental
related: [foundations/chat, foundations/highlight]
---

`@rivetjs/cdk/markdown` parses a Markdown subset into plain-data nodes for your renderer, including incomplete streamed responses.

## Import and example

```ts check
import { parseMarkdown, parseInline, textOf, safeUrl } from "@rivetjs/cdk/markdown";

const blocks = parseMarkdown("# Release notes\n\nThe report is **ready**.");
const label = textOf(parseInline("Read **release notes**"));
const href = safeUrl("/releases");
```

::example{id=markdown-render}

The renderer in the example maps each node type to an element, renders code blocks as text and renders a link whose URL `safeUrl` rejects as plain text.

## API

| Export | Signature | Result |
| --- | --- | --- |
| `parseMarkdown` | `(source: string) => MarkdownBlock[]` | Headings, paragraphs, fenced code, blockquotes, lists, tables and thematic breaks. |
| `parseInline` | `(source: string) => MarkdownInline[]` | Text, strong/emphasis, strikethrough, inline code, links, images and breaks. |
| `splitBlocks` | `(source: string) => string[]` | Top-level chunks; keeps fenced code and continuing lists/quotes together. |
| `closeOpenMarks` | `(block: string) => string` | Repairs unfinished strong, strike and code marks for a streaming preview. |
| `safeUrl` | `(url: string) => string \| undefined` | Allows relative URLs and http, https, mailto and tel schemes; rejects other schemes. |
| `textOf` | `(nodes: readonly MarkdownInline[]) => string` | Extracts inline text, including image alt text. |
| `MarkdownBlock` | union type | `heading`, `paragraph`, `code`, `blockquote`, `list`, `table`, `hr`. |
| `MarkdownInline` | union type | `text`, `strong`, `em`, `del`, `code`, `link`, `image`, `br`. |
| `MarkdownListItem` | interface | Optional `checked` and a `children: MarkdownBlock[]` array. |
| `MarkdownAlign` | type | `"left" \| "center" \| "right" \| null`. |

### Node anatomy

Headings carry a `level` and inline `children`. Code blocks carry `lang`, `value` and `closed`: an unfinished fence has `closed: false`. Lists carry `ordered`, `start`, `tight` and `items`; task items have `checked`. Tables carry `align`, `head` and `rows`. Links carry `href`, optional `title` and inline children; images carry `src`, `alt` and optional `title`.

## Streaming

```ts check
import { splitBlocks, closeOpenMarks, parseMarkdown } from "@rivetjs/cdk/markdown";

const source = "The answer is **almost ready";
const preview = splitBlocks(source).map((block) => parseMarkdown(closeOpenMarks(block)));
```

Keep the original source separately from the repaired preview. Repair is for incomplete display text; it does not complete a response or fetch more data.

## Accessibility and rendering

The parser creates no DOM, keyboard behavior, ARIA attributes or classes. Render nodes as semantic headings, lists, links and tables, and preserve image alt text. Render code and raw HTML as text rather than inserting them with `innerHTML`.

Raw HTML is text. Reference links, footnotes, indented code blocks and HTML blocks are outside this parser's supported Markdown subset. URL filtering rejects unsafe schemes; it does not restrict which HTTP hosts a link or image may reference.
