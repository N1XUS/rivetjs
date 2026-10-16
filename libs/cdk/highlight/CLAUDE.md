# @rivetjs/cdk/highlight
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Rivet-authored synchronous regex tokenizer for code blocks (feature set inspired by HeroUI Pro's public CodeBlock docs, which use Shiki; independent implementation, no grammars / WASM). Identical output on server and client.

## Entry points
- `@rivetjs/cdk/highlight` -> `index.tsx`:
  - `highlight(code, language?)` -> `CodeToken[]` (`{ type, value }`; values concatenate back to `code`)
  - `resolveLanguage(language)` -> `CodeLanguage` (`js` (js / ts / jsx / tsx / mjs …), `json`, `css`, `markup` (html / xml / svg / vue), `shell`, `python`, `sql`, `yaml`, `diff`, `clike` (c / cpp / java / go / rust / …), `plaintext`); `languageLabel(language)` display name ("TypeScript", "Text" for none)
  - `CodeTokenType`: plain, comment, string, number, keyword, literal, type, function, property, operator, punctuation, tag, attribute, variable, inserted, deleted, meta

## Layout
- `index.tsx` whole module; tests `tests/highlight.test.ts`; consumer `@rivetjs/ui/code-block` (and `markdown` / `chat-tool` through it)

## Gotchas
- Tag rule has a lookbehind `(?<![\w$)\]])` so TS generics (`Array<number>`) are not tags; shell command words are detected at line start only.
- A function token needs `name(`: `function f<T>(` names stay plain.
