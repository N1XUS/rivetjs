---
title: CodeBlock
description: "Syntax-highlighted code with a language label and a copy button."
template: reference
status: experimental
related: [components/markdown, components/chat-tool]
---

`CodeBlock` renders code highlighted by `@rivetjs/cdk/highlight`, a small synchronous tokenizer that gives the same output on the server and in the browser (TS / JS / JSX, JSON, CSS, HTML / XML, shell, Python, SQL, YAML, diff and C-like languages). The header holds the language label and a copy button.

## Usage

```tsx
import { CodeBlock } from "@rivetjs/ui/code-block";
```

::example{id=code-block-basic}

## Anatomy

```tsx
<CodeBlock>
  <CodeBlock.Header>
    <CodeBlock.Language language="ts" />
    <CodeBlock.CopyButton code={code} />
  </CodeBlock.Header>
  <CodeBlock.Code code={code} language="ts" />
</CodeBlock>
```

`code` can be an accessor: a streaming answer re-highlights in place. Rivet UI ships its own tokenizer and colours tokens with CSS variables, so there is no `theme` prop.

Additional exported parts: `CodeBlock.Root`.

## Examples

### Resumability

Highlighting runs on the server; the page carries finished token spans and no highlighter code until a `code` accessor changes.

## Styling Reference

The component’s parts emit these additional `data-slot` values: `code-block-header`, `code-block-language`, `code-block-code`, `code-block-copy-button`.

### CSS Classes

| Class                        | Applied                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `code-block`                 | root                                                                                        |
| `code-block__header`         | `Header`                                                                                    |
| `code-block__language`       | `Language`                                                                                  |
| `code-block__copy-button`    | `CopyButton`; `data-copied`                                                                 |
| `code-block__code` / `__pre` | scroll region + `pre`; `data-wrap`                                                          |
| `code-block__token--<type>`  | token spans (keyword, string, number, comment, function, type, tag, attribute, property, …) |

| CSS variable                                                                                                                                                          | Default      | What                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------- |
| `--code-block-max-height`                                                                                                                                             | none         | scroll after this height     |
| `--code-keyword` / `--code-string` / `--code-number` / `--code-comment` / `--code-function` / `--code-type` / `--code-tag` / `--code-property` / `--code-punctuation` | theme tokens | token colours (light / dark) |

## API Reference

See the [full module API](/api/rivetjs/ui/code-block/) for every named export and part prop type.

| Prop                                    | Type                          | Default                  |
| --------------------------------------- | ----------------------------- | ------------------------ |
| `code` (`Code`, `CopyButton`)           | `string \| () => string`      | required                 |
| `language` (`Code`, `Language`)         | `string`                      | `"plaintext"`            |
| `wrap` (`Code`)                         | `boolean`                     | `false`                  |
| `aria-label` (`Code`)                   | `string`                      | language label + " code" |
| `aria-label` (`CopyButton`)             | `string`                      | `"Copy code"`            |
| `copiedLabel` / `onCopy` (`CopyButton`) | `string` / `(copied) => void` | `"Copied"`               |

::api{symbol="@rivetjs/ui/code-block#CodeBlockCodeProps"}

::api{symbol="@rivetjs/ui/code-block#CodeBlockCopyButtonProps"}

## Accessibility

the code is a focusable scroll region named after the language ("TSX code"), so keyboard users can scroll it; tokens are spans without roles.

## Related Components

- [Markdown](/components/markdown/)
- [ChatTool](/components/chat-tool/)
