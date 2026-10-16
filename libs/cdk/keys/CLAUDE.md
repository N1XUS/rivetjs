# @rivetjs/cdk/keys
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Pure key handling: APG composite navigation (`nextIndex`), typeahead, and React Aria keyboard shortcut parsing.

## Entry points
- `./keys` -> `index.ts`: `nextIndex(count, from, key, opts)`, `navigationKeys(opts)` (-> `data-rk` value), `typeahead(owner, texts, from, key, now?, isDisabled?)`, `_resetTypeahead`; shortcuts: `createKeyboardShortcutHandler(bindings)`, `parseKeyboardShortcut`, `canonicalKeyboardShortcut`, `keyboardEventToCanonicalShortcut`, `modifierSetFromParsed`, `modifierSetFromEvent`; types `Orientation`, `NavigationOptions` (`orientation`, `wrap`, `homeEnd`, `pageSize`, `dir`, `isDisabled`), `KeyboardShortcutBindings`, `KeyboardShortcutAction`, `ParsedKeyboardShortcut`

## Layout
- `index.ts` - single file; imports only `Direction` type from `../bidi/index.ts`
- consumers: `../interactions/keyboard.tsx` (shortcuts), composite widgets (`data-rk`)
- tests: `tests/cdk.test.ts` (`nextIndex`, `navigationKeys`, `typeahead`); shortcuts only indirectly
- docs examples: `apps/cdk-docs/examples/{keys-parse,keys-shortcuts}/`

## Upstream
- navigation + typeahead: Rivet-own (APG)
- shortcuts section (`index.ts:115`): `@react-aria/interactions` createKeyboardShortcutHandler (Apache-2.0)

## Rules / invariants
- pure functions over indices; collection = whatever the caller has; disabled skipped via `isDisabled`; RTL = caller's `dir` (horizontal arrows swap)
- `nextIndex` returns `null` for non-navigation keys (let through), `from` when handled but no move (edge without wrap); `from=-1` = nothing focused yet
- `navigationKeys(opts)` must list exactly the keys `nextIndex` handles for the same opts (loader holds them while a chunk loads, cold keys never scroll)
- typeahead buffer per `owner` in a WeakMap (transient, never serialized), 750 ms timeout, `Intl.Collator` base sensitivity, same char repeated cycles; leading space ignored on empty buffer
- shortcuts: `Mod` = Meta on Mac, Control elsewhere; canonical modifier order Alt, Control, Meta, Shift; action result `undefined`/`true` = handled (preventDefault + stop), `false` = not handled; later duplicate bindings win
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)

## Commands
- `npx vitest run --project cdk libs/cdk/tests/cdk.test.ts`

## Gotchas
- `"Ctrl"` is not a modifier name (`MODIFIER_NAMES` `index.ts:136` has `control` only): `"Ctrl+s"` silently parses as `"s"` (`index.ts:188`), though the docstring (`index.ts:177`) and error message (`index.ts:195`) advertise `Ctrl` - accept the alias or throw
- no unit tests for the shortcut parser / handler
- `../a11y/key-manager.ts` is the separate Angular CDK key-manager API (classes); this module is the functional one

## See also
- [../CLAUDE.md](../CLAUDE.md), [../interactions/CLAUDE.md](../interactions/CLAUDE.md), [../a11y/CLAUDE.md](../a11y/CLAUDE.md), [../bidi/CLAUDE.md](../bidi/CLAUDE.md)
- `apps/cdk-docs/content/foundations/{keyboard-navigation,keyboard-shortcuts}.md`
