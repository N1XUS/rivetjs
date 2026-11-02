# @rivetjs/cdk/markdown
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Rivet-authored safe Markdown parser for AI responses (feature set inspired by HeroUI Pro's public Markdown docs; independent implementation, no react-markdown / remark / marked / streamdown code). Output = plain-data AST, never HTML strings.

## Entry points
- `@rivetjs/cdk/markdown` -> `index.tsx`:
  - `splitBlocks(source)` -> top-level block strings (line scan; fences, lists continuing after blank lines, quotes stay together); `parseMarkdown(chunk)` of each chunk = the matching part of `parseMarkdown(source)` (streaming keys)
  - `parseMarkdown(source)` -> `MarkdownBlock[]`: heading (ATX / setext), paragraph (hard / soft breaks), code (`lang`, `value`, `closed`: an unclosed fence runs to the end, its trailing empty line dropped), blockquote, list (ordered / start / tight / task `checked`), table (GFM, `align`), hr
  - `parseInline(src)` -> `MarkdownInline[]`: text, strong, em, del, code, link (`href`, `title`), image (`src`, `alt`, `title`), br; `<url>` + bare http(s) autolinks, backslash escapes
  - `safeUrl(url)` (http / https / mailto / tel / relative only; else `undefined` → link dropped, its text kept), `textOf(nodes)`, `closeOpenMarks(block)` (closes `**` / `__` / `~~` / backtick left open by a stream, innermost first; a lone trailing opener is removed; closers go before trailing whitespace — `**bold **` is no strong — unless a code span closes first; 2026-10-09: a chunk ending in a space flashed raw `**`)
  - types `MarkdownBlock`, `MarkdownInline`, `MarkdownListItem`, `MarkdownAlign`

## Layout
- `index.tsx` whole module; tests `tests/markdown.test.ts`, `tests/markdown-hostile.test.ts` (linear-time budgets, depth cap, golden parity); consumer `@rivetjs/ui/markdown`

## Invariants
- Raw HTML is text (renderers build elements from the AST). Not supported: reference links, footnotes, indented code, HTML blocks.
- Hostile input (untrusted LLM / user text, parsed in SSR and per streamed chunk; FIX-CDK 2026-11-01): work stays linear. `closingBracket` caches every bracket a scan passes (per `inline` call), `closingDelimiter` marks per delimiter the positions a failed scan passed (`dead`: later scans stop there), `linkDestination` runs the destination pattern step by step (sticky regexes, no adjacent `\s*`/`\s+`), the hard-break check reads only the current line. Same AST as before (golden test + differential fuzz). `MAX_NESTING` 32: deeper block quotes / list items become one paragraph, deeper link / emphasis content one text node (was a stack overflow).
- Images: `safeUrl` allows any http(s) host, so a model-written `![](https://host/?d=…)` loads on render (prompt-injection exfil channel); host filtering / image opt-out is the renderer's call (ui `Markdown`, open ruling).
- FIX2-CDK 2026-11-01: `splitBlocks` keeps a blank run inside a list / quote in one pass (was a rescan per blank line: 20000 blanks 1.66 s → 0.5 ms).
