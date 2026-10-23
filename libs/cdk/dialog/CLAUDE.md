# @rivetjs/cdk/dialog
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `DialogTrigger` + `Dialog` (React Aria useDialog / useOverlayTrigger). Composition: `<DialogTrigger><Button/><Modal|ModalOverlay|Popover><Dialog>…</Dialog></…></DialogTrigger>`.

## Entry points
- `@rivetjs/cdk/dialog` → `index.tsx`: `DialogTrigger`, `Dialog`, `DialogContext`, `OverlayTriggerStateContext`, types `DialogTriggerProps`, `DialogProps`, `DialogRenderProps` (`{close}`)
- `@rivetjs/cdk/dialog/behaviour` → `behaviour.tsx` (explicit export): `dialogProps(props, slots)` (useDialog bag), `dialogFocus(element, isEntering?)`, `dialogBlur`, `dialogTitleWarning`, types `AriaDialogProps`, `DialogSlots`, `DialogAria`
- `contexts.ts`: `DialogContext`, `DialogContextValue` (`aria-labelledby` string | accessor, `idRef` signal)

## Layout
- `DialogTrigger`: renders no element. Provides OverlayTriggerStateContext (state = `createMenuTriggerState`), DialogContext (`id`, `aria-labelledby` = trigger id accessor, `idRef`), PopoverContext (`trigger: "DialogTrigger"`, `triggerRef`), and a `PressResponder` with `aria-expanded` / `aria-controls` accessors for the user's `<Button>`
- Server-open DialogTrigger (CDK-PINS 2026-10-12): the trigger's attributes are written before the Dialog renders, so a `<Dialog id>` (RA mergeIds via `idRef`) left `aria-controls` at the generated id (IDREF to nothing; client render follows the merge; resume fuzz ui `/drawer-open`, `/sheet-open`). `probeSlots([[OverlayTriggerStateContext, state], [DialogContext, { id, idRef }]], children)` runs first when `state.isOpen()` on the server (cdk `#server`; browser no-op); a probed `Dialog` sets `idRef` and returns `null`. Cost only for server-open triggers: the overlay subtree down to the Dialog renders twice. Test `tests/dialog-ssr.test.ts`, ui `tests/modal.server.test.tsx`. Gap (CDK-PINS review L1): `Popover` returns `null` during any probe (`popover/index.tsx` `if (slotProbing) return null`), so a server-open DialogTrigger whose `<Dialog id>` sits inside a `<Popover>` keeps the generated `aria-controls` (client render says the Dialog id) and the probe walks for nothing.
- `trigger` prop (Rivet extension, RAC vocabulary): `"press"` (default, toggles) | `"longPress"` (RA useLongPress; `longPressAccessibilityDescription` → hidden span + `aria-describedby`) | `"hover"` / `"focus"` (`../overlay/hover-trigger.tsx`, `delay` / `closeDelay`; safe area attached from own anchor `span[data-rv-overlay-anchor]` while open)
- `isHidden()` (collection build pass) → DialogTrigger renders nothing
- `render` prop on Dialog (`section`, renderProps `undefined`)
- `Dialog`: `section[role=dialog|alertdialog].rv-Dialog`, `tabIndex=-1`; Heading `slot="title"` (level 2) / Text `slot="description"` / Button `slot="close"` via slot contexts; `aria-label` wins, else title slot id (a Heading with its own `id` prop: that id — `SlotId.rendered` string, RA mergeIds), else context `aria-labelledby`; render prop `close` = `closeOverlay(contextState)`; focuses `[autofocus]` descendant then itself on mount (`dialogFocus`); dev warning without title/label
- alert dialog `aria-describedby` (content id): `slotIdRef(content, false)` + a server slot probe of the children (`probeSlots([[TextContext, …]], children)`, `#server`, only while the content id applies; UIID 2026-10-12): names the description only when a part takes it — the id was kept by expectation, an IDREF to nothing for every ui AlertDialog without a Description
- Tests: `tests/dialog.browser.test.tsx` (RAC Dialog.test.js port + trigger modes + reactive text children), `tests/dialog-ssr.test.ts` + `tests/fixtures/dialog-ssr-fixture.tsx` (RAC Dialog.ssr), `tests/dialog-behaviour.browser.test.tsx` (RA useDialog.test.js); stories `/dialog`, `/modal`, `/dom-events-overlays` (`tests-components/overlays.test.ts`, `widgets.test.ts`, `dom-events-overlays.test.ts`)

## Upstream
- RAC Dialog.tsx; RA dialog/useDialog, overlays/useOverlayTrigger; RS useMenuTriggerState — Apache-2.0

## Rules / invariants
- Live by default (LIVE-SWEEP round 2): DialogTrigger `delay` / `closeDelay` (`liveOptions` → accessors, read at event time by `../overlay/hover-trigger.tsx` `delayOf`); read once (JSDoc): `trigger` (picks the trigger implementation), `longPressAccessibilityDescription`
- Modal surface = `../modal` on the div overlay layer, never native `<dialog>` (user decision)
- Body children rendered as `[() => rp.children()]` inside Provider on the client (Provider resolves its slot once, untracked; a bare function child would be a render prop); server: `rp.children()` called inside the Provider slot (the server Provider runs it while `body` is built, before the `<section>` record reads aria-labelledby / -describedby), so a title / description part's slot id — its own `id` prop included — is final in the server HTML (the traversal would call the accessor after the open tag). Measured: fixture `renderHtml` 1000× within noise (SignUp 0.256 → 0.258, own-id 0.249 → 0.236 ms min)
- `close` closures: one local arrow / block-body object-literal arrows (R2 resumable); destructure props before closures
- Legacy API deleted: `Dialog trigger=`, `alert`, `dismissable`, `closeLabel`, transition props, `portalContainer`, `dialogAttrs` / `dialogTriggerAttrs` / `closeEnclosing`

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/dialog.browser.test.tsx libs/cdk/tests/dialog-behaviour.browser.test.tsx`
- `npx vitest run --project cdk libs/cdk/tests/dialog-ssr.test.ts`
- `STORIES_DIST=dist-c1a npx vitest run --project cdk-components libs/cdk/tests-components/overlays.test.ts`

## Gotchas
- SSR: an open dialog IS in the server HTML (RAC renders nothing for an overlay on the server) — deliberate, resumable pages
- Resumed page: focus-on-mount client effect (idle) skips when focus is already outside the dialog and the user moved it (`focusMovedByUser`, `../focus/index.ts`) — inline open dialog must not steal the first cold keystroke (deviation in header)
- Hover mode: pointer leave does not close while focus is inside the dialog (dialog takes focus on open)
- Plain text children re-run the whole children slot on change (bare expression reads tracked by the binding); element / component children keep their own bindings
- Skipped upstream cases: portalContainer (deleted), MenuItem autoFocus (needs Menu re-port), DateRangePicker dismiss (needs DateRangePicker re-port), "latest onEnter/onExit" (no rerender)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../modal/CLAUDE.md](../modal/CLAUDE.md), [../popover/CLAUDE.md](../popover/CLAUDE.md), [../overlay/CLAUDE.md](../overlay/CLAUDE.md)
- Docs: [dialog](../../../apps/cdk-docs/content/components/dialog.md); examples `apps/cdk-docs/examples/dialog-*/`
