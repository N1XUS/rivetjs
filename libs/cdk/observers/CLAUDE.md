# @rivetjs/cdk/observers
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Angular CDK observers port (`ContentObserver`, `cdkObserveContent`, `SharedResizeObserver`) + react-aria `useResizeObserver`. Browser-only plumbing called from client effects.

## Entry points
- `@rivetjs/cdk/observers` -> `index.ts` (explicit package.json entry):
  - content: `createContentObserver(factory?)`, `contentObserver()` (shared), `ContentObserver` (`observe`, `destroy`), `observeContent(element, onChange, { debounce?, observer? })` -> cleanup
  - mutation factory: `MutationObserverFactory`, `defaultMutationObserverFactory`
  - resize: `createSharedResizeObserver()`, `sharedResizeObserver()` (shared), `SharedResizeObserver` (`observe(target, { box })`, `destroy`), `useResizeObserver({ ref, box?, onResize })` -> cleanup
  - minimal RxJS subset: `Observable`, `ObserverLike`, `Unsubscribable`, `_Subject`

## Layout
- `index.ts` - whole module (single file)
- deps: `../coercion` (`coerceElement`, `coerceNumberProperty`)
- tests: `tests/observers.test.ts` (observe-content.spec cases with a fake `MutationObserverFactory`), `tests/browser/observers.test.ts` (real MutationObserver / ResizeObserver in Chromium: observe-content + shared-resize-observer specs, useResizeObserver)
- docs examples: `apps/cdk-docs/examples/observers-{content,resize}/`

## Upstream
- angular/components `src/cdk/observers` (`observe-content.ts`, `private/shared-resize-observer.ts`) (MIT, © Google LLC); react-spectrum `packages/react-aria/src/utils/useResizeObserver.ts` (Apache-2.0, © Adobe)
- Deviations (header): services -> factories with shared instances; RxJS -> minimal `Observable` with same emission semantics; `cdkObserveContent` directive -> `observeContent(element, onChange, { debounce })` returning cleanup (disabled = don't call / call cleanup)

## Rules / invariants
- Nothing runs at import time or on the server (`defaultMutationObserverFactory` returns null without `MutationObserver`)
- ContentObserver: one `MutationObserver` per element (`characterData`, `childList`, `subtree`), reference counted, comment-only records dropped
- `observeContent` `debounce` coerced like the Angular input; one call per quiet period with the last records
- SharedResizeObserver: one `ResizeObserver` per box type; same observable per element + box while subscribed; new subscriber gets last entries immediately; window `error` listener logs a `console.error` hint on "ResizeObserver loop limit exceeded" (index.ts:180, Angular behaviour)
- `useResizeObserver` falls back to window `resize` when `ResizeObserver` is missing
- Element args accept an element or ref accessor (`coerceElement`)
- Call from `clientEffect` (or handlers) and return the cleanup

## Commands
- `npx vitest run --project cdk libs/cdk/tests/observers.test.ts libs/cdk/tests/browser/observers.test.ts`

## Gotchas
- Shared instances (`contentObserver()`, `sharedResizeObserver()`) are module-level singletons; capture them only inside client effects, not in serializable state
- `useResizeObserver` is a plain function despite the hook name: reads `ref` once at call time (no re-subscribe when the ref changes)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../coercion/CLAUDE.md](../coercion/CLAUDE.md), [../layout/CLAUDE.md](../layout/CLAUDE.md)
- `apps/cdk-docs/content/foundations/observers.md`
