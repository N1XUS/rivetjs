# @rivetjs/cdk/focus
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Focus management: Rivet helpers (Tab containment, save/restore, roving tabindex, inert outside) + React Aria FocusScope, focus manager, useFocusRing.

## Entry points
- `./focus` -> `index.ts`: `focusFirst`, `focusLast`, `containFocus(scope, e)`, `saveFocus(within?)`, `roveFocus(items, item)`, `inertOutside(el)`; react-aria: `focusSafely`, `isElementInScope`, `getFocusableTreeWalker`, `createFocusManager(ref, opts)`; types `FocusManager`, `FocusManagerOptions` (`from`, `tabbable`, `wrap`, `accept`)
- `./focus-scope` -> `focus-scope.tsx`: `<FocusScope contain restoreFocus autoFocus class>` (resumed page: the mount effect is idle only with `contain` / `autoFocus`; a plain or restore-only scope registers when it adopts — CEFF 2026-10-28), `useFocusManager()`, `scopeFocusNext/Previous/First/Last`, `isElementInChildOfActiveScope`, internals `scopeKeyDown`, `mountScope`
- `./focus-ring` -> `focus-ring.tsx`: `useFocusRing({ within, isTextInput, autoFocus })` -> `{ isFocused, isFocusVisible, focusProps }`
- `./focusable` -> `focusable.tsx`: `focusableProps(props, ref?)` (RA `useFocusable`: `focusProps` + `keyboardProps` bags, `FocusableContext` props merged, tabIndex `-1` when `excludeFromTabOrder` / disabled, autoFocus `clientEffect` + `focusSafely`, `ref`), `Focusable` (render-function child `{(p) => <span {...p} ref={p.ref} role="button" />}`; dev checks: forwarded ref, focusable, interactive role), `FocusableProvider`, `FocusableContext` (re-export: defined in `../interactions/focus.tsx`), types `FocusableOptions`, `FocusableContextValue`, `FocusableProviderProps`, `FocusableComponentProps`; tests `tests/pressable.browser.test.tsx`

## Layout
- `index.ts` - Rivet helpers (lines 1-106) + react-aria focus utilities section (`focusSafely`, tree walker, `createFocusManager`)
- `focus-scope.tsx` - FocusScope component + scope tree + focus manager bound to the focused element
- `focus-ring.tsx` - useFocusRing on top of `../interactions/focus.tsx` + `focus-visible.tsx`
- deps: `../a11y/index.ts` (`tabbables`), `../interactions/utils.ts`, `../interactions/focus-visible.tsx`, `../utils/id.ts`
- tests: `tests-components/widgets.test.ts` "FocusScope: Tab wraps..." (story `tests-components/app/src/routes/focus-scope.tsx`); `tests/app/src/routes/{focus-scope,hover}.tsx` stories (hover uses `focus-ring`)
- docs examples: `apps/cdk-docs/examples/{focus-functions,focus-manager,focus-manager-create,focus-ring,focus-scope-contain,focus-scope-restore}/`

## Upstream
- `@react-aria/focus` FocusScope.tsx (FocusScope, getFocusableTreeWalker, createFocusManager), useFocusRing; `@react-aria/interactions` focusSafely (Apache-2.0)
- `index.ts` lines 1-106: Rivet-own (no upstream header)
- FocusScope deviations (header): scope = wrapper `<div data-rv-focus-scope style="display:contents">` (upstream: two sentinel spans); nesting = DOM nesting, out-of-subtree child (portal) carries `data-rv-focus-parent`; `useFocusManager()` resolves the scope from the focused element at call time (no context); containment/restore/autoFocus run in a client effect, resumable wrapper keydown contains Tab before that
- useFocusRing (header): `isFocused`/`isFocusVisible` signals; modality listener subscribed from the focus handler, dropped on blur (no load-time client effect); resumed page without tracking adopts browser `:focus-visible` on first focus

## Rules / invariants
- FocusScope attributes: `data-rv-focus-scope=<id>`, `data-rv-focus-parent=<parent id>`, `data-rv-contain=""` (only with `contain`); keydown handler only when `contain`
- containment uses the key's `event.target`, not `activeElement`: on a resumed page the first Tab runs after the chunk loads, focus already moved (`index.ts:42`, `focus-scope.tsx:167`)
- module state in one object `g` (resume-extracted symbols import module bindings read-only) (`focus-scope.tsx:58`); per-scope data in a WeakMap, never serialized
- `nodeToRestore` captured during render (before autoFocus child mounts); server: none
- restore: `rv-focus-scope-restore` CustomEvent dispatched first (cancelable, parents may intercept); resumed region re-creation -> restores to replacement element with same id (`focus-scope.tsx` `current()`), resolved when the scope unmounts: a same-id element created after that (next page of a client navigation that removed trigger + scope, next test after `cleanup()`) is skipped, RA restores to the connected original only (`tests/focus-scope-restore.browser.test.tsx`, 2026-10-09)
- `[data-rv-top-layer]` elements always accept focus (toasts)
- `focusMovedByUser(doc)` (index.ts): activeElement not body / documentElement; FocusScope `autoFocus` on a resumed scope (`mount.resumed`, no doc at render) skips when focus moved outside the scope before the idle effect (no idle focus steal; deviation in header)
- `focusSafely` waits for transitions when modality is `virtual` (iOS VoiceOver)
- `useFocusManager()` object is resumable (methods are arrows over exported functions)
- `focusRing` focusProps: `onFocusIn/onFocusOut` when `within`, else `onFocusIn` only (`focusRingIn`: target === element check, native `blur` bound while focused via interactions `bindBlur`, slot in `ring.state.blur`) — delegated, 0 listeners per element
- `roveFocus`: server markup must render the same tabindex from state
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/pressable.browser.test.tsx`
- `npx vitest run --project cdk-components libs/cdk/tests-components/widgets.test.ts`

## Gotchas
- not ported: FocusRing component, useHasTabbableChild
- `Focusable` / `Pressable` dev checks only when `globalThis.process.env.NODE_ENV === "development"` (browser tests set `globalThis.process`)
- `index.ts` `tabbables()` ignores positive tabindex order (`../a11y/index.ts:97`)
- no dedicated unit tests for `containFocus`/`saveFocus`/`roveFocus`/`inertOutside`/`createFocusManager`

## See also
- [../CLAUDE.md](../CLAUDE.md), [../interactions/CLAUDE.md](../interactions/CLAUDE.md), [../a11y/CLAUDE.md](../a11y/CLAUDE.md)
- `apps/cdk-docs/content/foundations/{focus,focus-interactions}.md`
- `docs/guides/resumability.md`
