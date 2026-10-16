# @rivetjs/testing/user

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Port of `@react-aria/test-utils` (react-spectrum `packages/@react-aria/test-utils/src`, Apache-2.0): `User` drives ARIA-pattern testers over real DOM with `@testing-library/user-event` (mouse / touch / keyboard).

## Entry points (`index.ts`)

- `User` (`user.ts`): `new User({ interactionType, advanceTimer })`; `user.createTester(name, { root, … })` → pattern tester inheriting the user's options.
- `installMouseEvent`, `installPointerEvent` (`testSetup.ts`): `beforeAll/afterAll` global patches (pageX/pageY, PointerEvent in envs lacking it). Rivet: `globalThis` instead of upstream `global` (works in browser mode); `installPointerEvent` restores the environment's own `PointerEvent` in `afterAll` (upstream deletes it — would remove Chromium's native one for later suites).
- `triggerLongPress` (`utils.ts`), `pointerMap` (`userEventMaps.ts`).
- Types: every `*Tester`, `UserOpts`.

## Testers (all upstream testers ported; `createTester` names)

| Name | File | Rivet cdk component it targets |
| --- | --- | --- |
| `CheckboxGroup` | `checkboxgroup.ts` | `@rivetjs/cdk/checkbox` (group) |
| `ComboBox` | `combobox.ts` | `@rivetjs/cdk/combobox` (no doc/test usage yet) |
| `Dialog` | `dialog.ts` | `@rivetjs/cdk/dialog`, popover/modal triggers |
| `GridList` | `gridlist.ts` | none — no cdk GridList yet |
| `ListBox` | `listbox.ts` | `@rivetjs/cdk/listbox` (covered by `tests/user.browser.test.tsx`) |
| `Menu` | `menu.ts` | `@rivetjs/cdk/menu` |
| `RadioGroup` | `radiogroup.ts` | `@rivetjs/cdk/radio-group` |
| `Select` | `select.ts` | `@rivetjs/cdk/select` |
| `Table` | `table.ts` | none — no cdk Table yet |
| `Tabs` | `tabs.ts` | `@rivetjs/cdk/tabs` |
| `Tree` | `tree.ts` | none — no cdk Tree yet |

cdk components with NO tester (upstream has none either; test with `@testing-library/dom` queries + `user-event` directly): accordion, breadcrumbs, button, toggle-button, checkbox (single), switch, calendar, range-calendar, date-field, date-picker, disclosure, link, text-field, toolbar, tooltip, popover (use `Dialog`), drag-drop, form, group, label.

## Layout

- `user.ts` — `User`, `keyToUtil` registry, conditional `Tester<T>` / `TesterOpts<T>` types. Adding a tester = registry + both conditional types + `types.ts` opts + `index.ts` export.
- `types.ts` — `UserOpts`, `BaseTesterOpts`, per-tester opts.
- `utils.ts` — `triggerLongPress`, `getAltKey`/`getMetaKey`, `formatTargetNode`, `pressElement`.
- `act.ts` — Rivet `act` (replaces `React.act`; async → await + `flush()` of `@rivetjs/runtime/testing`); Rivet-only file.
- `testSetup.ts`, `userEventMaps.ts` — upstream setup helpers.

## Rules / invariants

- Faithful port: keep upstream code/formatting; deviations as inline `// Rivet: …` comments only.
- Only import surface the testers need from React land is `act` → `./act.ts`. Never add React.
- New tester = port the upstream file when one exists; otherwise don't invent one here.

## Gotchas

- `utils.ts` `cached()` never caches (upstream caches outside `NODE_ENV==='test'`; `node-env` clears NODE_ENV and browser mode has no `process`).
- Table tester needs `advanceTimer` (long press / timers); with fake timers pass `(ms) => vi.advanceTimersByTime(ms)`.
- `getAltKey()` returns `'AltLeft'` on mac (upstream `'Alt'` has no user-event keyMap code → key "Unknown", altKey=false in real Chromium/macOS).
- `user.ts` ↔ `index.ts` circular import (`pointerMap`) is upstream — keep.

## See also

- [../CLAUDE.md](../CLAUDE.md) · `apps/cdk-docs/src/routes/(docs)/start/testing.tsx` · `tests/user.browser.test.tsx`
