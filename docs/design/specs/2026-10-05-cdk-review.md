# @rivetjs/cdk review vs Rivet conventions (2026-10-05)

Read-only review of `libs/cdk` (242 source files) against `apps/docs/content/{best-practices,gotchas,guides,learn,reference}`. Fix plan: tracker step 2c.

## Clean

- No module-top-level `window`/`document` access; no context reads after `await`; no `history.pushState`; no `style` strings in spreads.
- Idiomatic APIs already used: `clientEvent` (`interactions/interact-outside.tsx`), `document:onScroll` (`scrolling/viewport.tsx`).

## High

- **H1 Overlay teardown leaks on unmount** — `popover/behaviour.ts:67-120`, `popover/position.ts:465-516`, `position.ts:957-981`, `modal-overlay.ts`. Undo runs only on `beforetoggle`/`toggle`; removing an open overlay leaves `inert` (ariaHideOutside), the scroll lock, window/visualViewport listeners, a ResizeObserver. Rule: effects.md, browser-only.md cleanup. Fix: `onCleanup` under the owner / `clientEffect(..., { when: "interaction" })`, `isConnected` guards. Superseded by the overlay rewrite (2b), which must own teardown.
- **H2 Router / openLink split** — two RouterContext + RouterProvider (`links.tsx:104/137`, `link/router.ts:31` + `link/index.tsx:141`); five `openLink` copies with separate "opening" flags (`links.tsx:60`, `interactions/utils.ts:349`, `link/router.ts:66`, `_adapters/interactions.ts:144`, `selection/dom-utils.ts:214`). press / focus-visible see only one flag → synthetic link clicks look virtual. Fix: one Router, one context, one `openLink`.

## Medium

- **M1** `bidi-dir.tsx:38` raw `effect()` → runs only on the server; use `clientEffect`.
- **M2** Virtualizer / virtual-scroll engines never disposed (`virtualizer/dom.ts:258-271`, `virtualizer/behaviour.ts:179-283`, `scrolling/virtual-scroll-viewport.ts:126`, `viewport-ruler.ts:40`, `scroll-dispatcher.ts:60`): window resize, doc capture scroll, ResizeObserver, effects leak. Fix: `onCleanup(() => driver.dispose())`.
- **M3** Render-time browser reads through `typeof` guards (gotchas/window-is-not-defined.md): `i18n.ts:52` `navigator.language` (Node 21+ has `navigator` → server machine locale), `bidi.ts:57`, `focus-scope.tsx:338-339` `document.activeElement` at render.
- **M4** Four modality trackers (`interactions/focus-visible.tsx`, `_adapters/interactions.ts`, `_adapters/press.ts`, Angular `a11y/focus-monitor.ts`) → focus-visible can disagree. Swap adapters to `@rivetjs/cdk/interactions`.
- **M5** Duplicates with own state: `runAfterTransition` ×2, `follow` ×2, `interactOutside` ×2, press ×3 (`interactions/press.tsx`, `button/press.ts`, `_adapters/press.ts`), viewport ruler ×2, `isVirtualClick` ×5, `focusWithoutScrolling` ×4, `getScrollParent` ×2, `chain`/`mergeProps` ×2.
- **M6** Controlled modal/popover programmatic open is a no-op (`modal/index.tsx:60`, `popover/index.tsx:68`): sync effect only when `isOpen`/`defaultOpen` passed.
- **M7** `onKeyDownCapture` in spreadable prop bags (`selection/type-select.ts:124`, `selection/selectable-collection.ts:596`); capture handlers are not resumable (reference/jsx.md).
- **M8** Not 1:1: `ModalOverlay` aliases `Modal` (no underlay, no isEntering/isExiting); `disclosure/` uses `<details>`; `menu/`, `combobox/`, legacy `dialog/` are APG/native-popover builds without "Ported from"; `_adapters/press.ts` reduced; `form/behaviour.ts:112` reset listener never removed + duplicates `useFormReset`.

## Low

- Per-gesture global listeners without owner cleanup: `press.tsx:185`, `hover.tsx:76`, `focus.tsx:149`, `long-press.tsx:52`, `move.tsx:98`, `button/press.ts:228/378`, `calendar/behaviour.ts:453`.
- `HTMLElement.prototype.focus` patched twice (`focus-visible.tsx:127`, `prevent-scroll-ios.ts:95`): teardown order can drop the iOS patch.
- Eager loading: `useFocusVisible`/modality listeners at idle on every page (`focus-visible.tsx:252-276`); `Portal`/`Overlay` `when: "load"` (`portal.tsx:52,90`); `interact-outside.tsx:67` boots at load.
- `checkbox/index.tsx:91-99` clientEffect for `indeterminate` — `prop:indeterminate` exists (reference/jsx.md).
- `overlay-ref.ts:468-476` `disposeOnNavigation` fallback misses router pushState navigations.
- `links.tsx:101` function stored on an object property, captured by handlers (function-is-not-serializable.md).
- Module `let` reassigned in modules with resumed symbols (`_adapters/interactions.ts:48`, `state/tooltip.ts:38`, `link/router.ts`) vs the "read-only bindings" note in `focus-visible.tsx:30` — verify.
- `drag-drop/drag-drop-registry.ts:22` `<style>` without nonce.
- `focus-scope.tsx` `style={{display:"contents"}}` → data attribute + CSS.
- Function props (`shouldCloseOnInteractOutside`, `onOpenChange`) captured in handlers — resume only when written inline in a resume-compiled module; document.
- NOTICE lists nonexistent `dnd/`, `stepper`; omits `checkbox/`, `radio-group/`, `switch/`, `toggle-button/`, `label/`, `form/`, `group/`, `toolbar/`, `breadcrumbs/`, `calendar/`, `range-calendar/`, `date-field/`, `button/`, `link/index.tsx`, `popover/behaviour.ts`, `modal/*`, `dialog/`, `state/{checkbox-group,form-validation,toast,radio-group,date-intl,overlays,calendar,tooltip,disclosure,toggle}.ts`. Missing "Ported from" headers: `dialog/behaviour.ts`, `_adapters/press.ts`, `menu/*`, `combobox/*`, `state/combobox.ts`.

## Native top layer (removed by step 2b)

- `showModal()`: `overlay.ts:252,270`, `modal-overlay.ts:29,69`, `modal/behaviour.ts:89`.
- `<dialog>`: `modal/index.tsx:62`, `dialog/index.tsx:128` (+ `<form method="dialog">`).
- Invoker commands: `dialog/index.tsx:35,121`, `dialog/behaviour.ts:13`, `modal/index.tsx:78`, `button/index.tsx:53,102`. `closedby`: `modal/behaviour.ts:27`, `dialog/behaviour.ts:22`, `platform.ts:15,28`.
- CSS: `theme.css:42` `::backdrop`, `base.css:22` `html:has(dialog:modal)`, `overlay.css:93`, `theme.css:187-191`, `tailwind.css:10` `popover-open`.
- `popover` attribute: `popover/`, `menu/`, `combobox/`, `overlay.ts:186-218`.

## addEventListener classification

(a) idiomatic replacement exists · (b) legitimately raw (dynamic attach/detach, imperative Angular services, global trackers) · (c) leaks/duplicate.

- (a): `focus-scope.tsx:179` → `clientEvent(doc, …)` in the effect; `interactions/scroll-wheel.tsx:45` → `clientEvent(el, "wheel", fn, { passive: false })`; `popover/behaviour.ts:90,113` → JSX `onBeforeToggle`/`onFocusOut`; `modal-overlay.ts:36-50` for component-rendered dialogs → JSX.
- (c): `position.ts:969,980`, `popover/position.ts:507-510`, `overlay-ref.ts:468-472`, `form/behaviour.ts:112`, `scrolling/viewport-ruler.ts:40`, `scrolling/scroll-dispatcher.ts:60`, `virtualizer/dom.ts:258,260`, `_adapters/interactions.ts:69-73`.
- (b): everything else — `dom.ts`, `observers.ts`, `utils.ts`, `platform.ts`, `overlay-ref.ts` backdrop/popstate, `layout.ts`, `prevent-scroll-ios.ts`, `overlay-container.ts`, `overlay-dispatchers.ts`, `overlay.ts`, `overlay-viewport.ts`, `interactions/*` gesture globals, `a11y/*`, `button/press.ts`, `text-field/autosize.ts`, `scrolling/scrollable.ts`, `drag-drop/*`, `calendar/behaviour.ts`.
- Why mostly (b): `clientEvent` lives for the owner's lifetime, no detach-on-demand; per-gesture / per-open listeners (react-aria `useGlobalListeners`, Angular services) need raw add/remove. Possible runtime follow-up: a detachable `clientEvent` (returns `off`) would let gesture code use it.
