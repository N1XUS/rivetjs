# @rivetjs/testing/fake-events

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Port of Angular Components `src/cdk/testing/testbed/fake-events` (MIT, © Google LLC): create and dispatch synthetic DOM events for ported Angular CDK specs.

## Entry points (`index.ts`, re-exports all)

- `event-objects.ts` — `createMouseEvent`, `createPointerEvent`, `createTouchEvent`, `createKeyboardEvent`, `createFakeEvent`.
- `dispatch-events.ts` — `dispatchEvent`, `dispatchFakeEvent`, `dispatchKeyboardEvent`, `dispatchMouseEvent`, `dispatchPointerEvent`, `dispatchTouchEvent`.
- `element-focus.ts` — `patchElementFocus`, `triggerFocus`, `triggerBlur`.
- `type-in-element.ts` — `typeInElement`, `clearElement`, `isTextInput`.
- `test-element.ts` — `ModifierKeys` type only.

## Rules / invariants

- Faithful port: upstream code + formatting; spec `tests/event-objects.browser.test.ts` is the upstream spec "unchanged apart from the imports" (uses `@rivetjs/testing/jasmine`).
- For new tests prefer `@testing-library/user-event`; use fake events only for ported Angular specs or events user-event can't produce.

## See also

- [../CLAUDE.md](../CLAUDE.md) · `../jasmine.ts`
