---
title: Code highlighting
description: Synchronous code tokenization, language aliases and display labels from @rivetjs/cdk/highlight.
template: guide
status: experimental
related: [foundations/markdown, foundations/chat]
---

`@rivetjs/cdk/highlight` splits source code into typed text tokens for a code-block renderer, with the same synchronous output on the server and in the browser.

## Import and example

```ts check
import { highlight, languageLabel, resolveLanguage } from "@rivetjs/cdk/highlight";

const tokens = highlight("const count = 3;", "ts");
const family = resolveLanguage("ts"); // "js"
const label = languageLabel("ts"); // "TypeScript"
const original = tokens.map((token) => token.value).join("");
```

::example{id=highlight-code-block}

The example renders on the server only: a plain `.map` over the tokens, a `span` with a `tok-<type>` class for each non-plain token, and CSS variables for the colors. The page ships no highlighter code.

## API

| Export | Signature / type | Result |
| --- | --- | --- |
| `highlight` | `(code: string, language?: string) => CodeToken[]` | Tokens whose values concatenate to the original input. Unknown languages remain plain text. |
| `resolveLanguage` | `(language: string \| undefined) => CodeLanguage` | Trims and lowercases language aliases; unknown or missing ids resolve to `"plaintext"`. |
| `languageLabel` | `(language: string \| undefined) => string` | Display label; no language yields `"Text"`. |
| `CodeToken` | `{ type: CodeTokenType; value: string }` | One text token. |
| `CodeLanguage` | union type | `js`, `json`, `css`, `markup`, `shell`, `python`, `sql`, `yaml`, `diff`, `clike`, `plaintext`. |
| `CodeTokenType` | union type | `plain`, `comment`, `string`, `number`, `keyword`, `literal`, `type`, `function`, `property`, `operator`, `punctuation`, `tag`, `attribute`, `variable`, `inserted`, `deleted`, `meta`. |

## Anatomy and styling

The tokenizer creates no DOM and supplies no stylesheet or `rv-*` classes. Render `value` as escaped text inside a `<pre><code>` block and use `type` to choose your own token styles. This is a regex tokenizer, not a language parser or type checker; TypeScript shares the JavaScript family, and Rust, Go and other C-like aliases share `clike`.

## Accessibility

Keep the source readable without syntax colors, preserve whitespace and provide sufficient contrast for each token color. Tokenization adds no keyboard interactions or focus targets. A copy button, line navigation or editable code surface needs its own behavior and accessible name.
