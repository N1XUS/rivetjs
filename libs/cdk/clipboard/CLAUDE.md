# @rivetjs/cdk/clipboard
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Angular CDK clipboard port (`Clipboard`, `PendingCopy`, `[cdkCopyToClipboard]`) as module functions callable from resumable handlers, plus async `copy()` via `navigator.clipboard`.

## Entry points
- `@rivetjs/cdk/clipboard` -> `index.ts` (explicit package.json entry):
  - `copyText(text, doc?)` (Angular `Clipboard.copy`, sync, textarea + `execCommand`) -> boolean
  - `beginCopy(text, doc?)` -> `PendingCopy` (`copy()`, `destroy()`) for large strings
  - `copyToClipboard(owner, options)` (directive click body: `text`, `attempts` (max 50, default 1), `copied(successful)`), `destroyCopyToClipboard(owner)` (directive ngOnDestroy)
  - `copy(text)` -> `Promise<boolean>` (`navigator.clipboard.writeText`, falls back to `copyText`)
  - `_clipboard` (`{ copy, beginCopy }`, test seam replacing Angular's spied `Clipboard`); type `CopyToClipboardOptions`

## Layout
- `index.ts` - whole module (single file)
- tests: `tests/browser/utilities.test.ts` describes "Clipboard" + "CdkCopyToClipboard (copyToClipboard)" (Angular `clipboard.spec.ts` + `copy-to-clipboard.spec.ts`, Chromium)
- docs examples: `apps/cdk-docs/examples/clipboard-{copy,attempts,pending}/`

## Upstream
- angular/components `src/cdk/clipboard` (`Clipboard.copy` / `beginCopy`, `PendingCopy`, `[cdkCopyToClipboard]`) (MIT, © Google LLC)
- Deviations (header): services -> module functions (a handler can call them without capturing an unserializable service object); directive's pending copies + retry timer live in a WeakMap keyed by the trigger element (transient, never serialized); `copy()` async path is a Rivet addition

## Rules / invariants
- Browser only; call from a user gesture (inline handler: `onClick={(e) => copyToClipboard(e.currentTarget, { text })}`)
- `owner` (usually `event.currentTarget`) keys the WeakMap; `destroyCopyToClipboard(owner)` cancels retries + destroys pending copies
- Retries 1 ms apart until success or `attempts` exhausted; `copied` called exactly once
- `PendingCopy` textarea: `position: fixed`, `top: 0`, `opacity: 0`, `left: -999em`, `aria-hidden`, `readOnly` (iOS jump), appended to `fullscreenElement || body`; focus restored after copy
- Never call at import time / on the server (`document` access)

## Commands
- `npx vitest run --project cdk libs/cdk/tests/browser/utilities.test.ts`

## Gotchas
- `copyText` / `copyToClipboard` use deprecated `execCommand("copy")` (Angular-faithful); prefer `copy()` where async is fine
- `copy()` does not check `navigator.clipboard` existence explicitly - relies on the thrown error to fall back

## See also
- [../CLAUDE.md](../CLAUDE.md)
- `apps/cdk-docs/content/foundations/clipboard.md`
