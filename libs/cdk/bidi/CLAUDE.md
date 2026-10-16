# @rivetjs/cdk/bidi
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Text direction: Angular CDK `Directionality` as resumable signal state, `<Dir>` provider, DOM direction helpers.

## Entry points
- `./bidi` -> `index.ts`: `Direction`, `Directionality` (`valueSignal`, `rawDir`), `DirState`, `createDir(dir)`, `setDir(state, value)`, `documentDirectionality(doc?)`, `directionValue(dir)`, `DirectionalityContext`, `injectDirectionality()`, `useDirection()`, `direction(element?)`, `logicalKey(key, dir)`, `isRtlLocale(locale)`, `_resolveDirectionality(raw)`, type `DirDocument`
- `./bidi-dir` -> `bidi-dir.tsx`: `<Dir dir onDirChange as class id>`, `DirProps`

## Layout
- `index.ts` - plain TS state + helpers
- `bidi-dir.tsx` - `<Dir>` wrapper element (`div` default, `span`, `section`) + Provider
- consumers: `../keys/index.ts` (`Direction` type), widgets reading `direction(el)` in handlers
- tests: `tests/utilities.test.ts` "Directionality (service)", "Dir state"; `tests/browser/utilities.test.ts` "Dir" (Chromium); `tests/browser/smoke.test.ts` (imports `/bidi/index.ts`)
- docs examples: `apps/cdk-docs/examples/{bidi-dir,bidi-direction,bidi-logical-key}/`

## Upstream
- angular/components `src/cdk/bidi` (MIT): `Directionality`, `Dir` directive (`dir.ts`), `_resolveDirectionality`; RTL locale regex from `goog.i18n.bidi.isRtlLanguage`
- Rivet shape (header): `Directionality` = plain state (`valueSignal` + raw accessor) so it resumes; DI lookup = `injectDirectionality()` reading `DirectionalityContext`, fallback document; `change` EventEmitter = the signal (or `onDirChange` on `<Dir>`)

## Rules / invariants
- `DirectionalityContext` registered as resumable context id `rv-directionality`; the provided `Directionality` is `{ valueSignal: computed, rawDir: inline arrow }` (bidi-dir.tsx) so it serializes for re-created regions — keep it free of module functions
- markup uses `dir` attribute + CSS logical properties (RTL needs no JS); handlers call `direction(element)` only when a key maps to a visual side; `logicalKey` swaps ArrowLeft/Right in RTL
- `<Dir>` renders `dir` exactly as given (`auto` stays `auto`); `valueSignal` = normalized; `"auto"` resolves from `navigator.language`
- `<Dir>` children: plain JSX (lazy slot, `renderSlot`) or `{() => <Child/>}`; both render inside the provider (`bidi-dir.tsx`)
- `onDirChange` client-rendered trees only; resumed pages: read `injectDirectionality().valueSignal` in a binding (`bidi-dir.tsx:12-17`)
- `documentDirectionality`: `<body dir>`, then `<html dir>`, else ltr; server ltr; `direction()` server ltr
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)

## Commands
- `npx vitest run --project cdk libs/cdk/tests/utilities.test.ts libs/cdk/tests/browser/utilities.test.ts`

## Gotchas
- `useDirection()` throws in SSR: `computed` created in plain `.ts` (`index.ts:95`)
- `<Dir dir={() => sig()}>` never updates on a resumed page; `dir={sig()}` updates only on first change (`bidi-dir.tsx:30-45`)
- `Direction` type is re-exported from `../collections/types.ts` (one definition, also used by `../i18n`)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../i18n/CLAUDE.md](../i18n/CLAUDE.md), [../keys/CLAUDE.md](../keys/CLAUDE.md)
- `apps/cdk-docs/content/foundations/bidi.md`
