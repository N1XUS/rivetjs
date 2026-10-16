# @rivetjs/cdk/toast
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC Toast family (`UNSTABLE_*`, Toast.tsx) + @react-aria/toast (useToastRegion, useToast): notifications in a portalled landmark region over a `ToastQueue` (../state/toast.ts).

## Entry points
- `@rivetjs/cdk/toast` → `index.tsx`: `UNSTABLE_ToastRegion`, `UNSTABLE_ToastList`, `UNSTABLE_Toast`, `UNSTABLE_ToastContent`, `UNSTABLE_ToastStateContext` (id `rv-toast-state`), `UNSTABLE_ToastQueue`; plain `ToastContent`, `ToastContentContext` (id `rv-toast-content`); re-exports `toastProps`, `toastRegionProps`; types `ToastRegionProps`, `ToastRegionRenderProps`, `ToastListProps`, `ToastProps`, `ToastRenderProps`, `ToastContentProps`, `ToastOptions`, `QueuedToast`, `ToastState`
- `@rivetjs/cdk/toast/behaviour` → `behaviour.tsx`: `toastRegionProps(props & {locale?}, state, ref)` (RA `regionProps` bag), `toastProps(props, state)` → `{toastProps, contentProps, titleProps, descriptionProps, closeButtonProps}`; types `AriaToastRegionProps`, `AriaToastProps`, `ToastAria`
- `intl.ts` — generated from react-aria `intl/toast/*.json` (`close`, `notifications` plural); regenerate with scratchpad `gen-intl.mjs`-style script, never hand-edit

## Layout
- `ToastRegion`: `span[data-rv-toast-anchor]` (`display: contents`, gives the Show a resumable branch) → `Show(toasts().length > 0)` → `<Portal>` → `ToastRegionContent`: `ContextProvider(ToastStateContext)` → `div[role=region].rv-ToastRegion` (landmark, `data-react-aria-top-layer`, `tabindex=-1`) → function children wrapped in `ToastList` (`ol.rv-ToastList`, `display: contents`) or custom content
- `ToastList`: `For each=state.visibleToasts by key` → `li[style=display:contents]`
- `Toast`: `div[role=alertdialog].rv-Toast`; `Provider` → `ToastContentContext` (contentProps), `TextContext` slots `title` / `description`, `ButtonContext` slot `close` (`aria-label`, `onPress`)
- `ToastContent`: `div[role=alert].rv-ToastContent` (`aria-hidden` accessor until mounted)
- Landmark / F6: `../landmark` (`landmarkProps`)

## Rules / invariants
- Server renders no region (only the empty anchor); no toast chunk before the first toast (`tests-components/toast.test.ts`)
- Resume wake: queue is never captured by a resumable closure; region `clientEvent(document, "rv-toast-queue", …, {preload: "interaction"})` matches `detail.name === queue.name` and `connectToastRegion(queue, toasts)` (idempotent, WeakMap signal → queue); browser-rendered region subscribes directly
- Region focus management: RA layout effect → `effect` + `queueMicrotask` after the list re-rendered; ignores Chromium's focusout from removing the focused toast (Deviation, behaviour.tsx header)
- Timers pause on region hover / focus-within (`pauseAll` / `resumeAll`); `toastProps` resets a toast's timer on mount and again whenever its `timer` / `timeout` changed after a `visibleToasts()` update (RA `useEffect([timer, timeout])`: queues that replace a timer in place, e.g. `@rivetjs/ui` toast `update()`), pauses the previous one, pauses on cleanup
- `render` prop (RAC DOMRenderProps; `(attrs, renderProps)` → spread attrs; early return before the compiled element; `tests/render-collections.browser.test.tsx`) on ToastRegion / ToastList / Toast / ToastContent
- `globalDOMProps(props, ["style"])`: `style` is a render prop, never spread
- `.tsx` server compile: no bare `document` in render code (behaviour uses `getOwnerDocument()`)
- Live props (P5): ToastRegion / ToastList / Toast class / style (Toast: + children) through a narrow live view (region: carried in the `content` bag as `live`); ToastContent with a live prop takes `liveToastContent` (class via `liveClass` in the spread, children binding, rest forwarded unread)

## Upstream
- RAC `packages/react-aria-components/src/Toast.tsx`; react-aria `src/toast/useToast.ts`, `useToastRegion.ts`; react-stately `src/toast/useToastState.ts` — Apache-2.0, NOTICE entries
- Deviations: no RAC `render` prop; `class` not `className`; region host `div[data-rivet-portal]` + anchor span; focusout-on-removal ignore

## Tests
- `tests/toast.browser.test.tsx` (cdk-browser): RAC Toast.test.js (12) + useToast.test.js (3) + single-toast story (1) + timer replaced in place restarts the countdown (1)
- `tests/toast-state.test.ts` (cdk): useToastState.test.js + Rivet wake (once per update, no timed re-dispatch) / Timer cases
- `tests/toast-ssr.test.ts` (cdk): server render, no region
- `tests-components/toast.test.ts` + route `app/src/routes/toast.tsx`: resumed page (no code before interaction, region on first toast, F6, close, timed dismissal)

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/toast.browser.test.tsx libs/cdk/tests/landmark.browser.test.tsx`
- `npx vitest run --project cdk libs/cdk/tests/toast-state.test.ts libs/cdk/tests/toast-ssr.test.ts`
- `STORIES_DIST=dist-scratch npx vitest run --project cdk-components libs/cdk/tests-components/toast.test.ts`

## Gotchas
- A component-root `Show` serializes no branch on a resumed page: keep the anchor span
- Wake = one `rv-toast-queue` dispatch per update while unsubscribed: relies on the resume runtime attaching document `clientEvent` listeners before resumed handlers run (no retries)
- Queue must live at module level (a component-local queue is a different instance in the browser); multiple queues per page need distinct `name`s
- Module-level signals in example/route code are not bound to SSR output (browser module instance differs)
