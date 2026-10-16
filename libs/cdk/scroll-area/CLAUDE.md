# @rivetjs/cdk/scroll-area
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Radix UI `ScrollArea` port: native scrolling in the Viewport, native scrollbars hidden, custom scrollbars mirror the scroll metrics (thumb size / position, drag, track click, wheel), visibility `type` auto / always / scroll / hover, RTL, ResizeObserver re-measure. Not React Aria: Radix is the upstream here (no RA / Angular CDK equivalent).

## Entry points
- `@rivetjs/cdk/scroll-area` -> `index.tsx` (package.json `./*` pattern): `ScrollArea`, `ScrollAreaViewport`, `ScrollAreaContent`, `ScrollAreaScrollbar`, `ScrollAreaThumb`, `ScrollAreaCorner` + Radix aliases `Root` / `Viewport` / `Content` / `Scrollbar` / `Thumb` / `Corner`; `*Props` types, `ScrollAreaType`, `ScrollAreaOrientation`, `ScrollAreaDirection`

## Layout
- `index.tsx` - parts; contexts `rv-scroll-area` (type, dir, scrollHideDelay, element refs, axis enabled / mounted flags, corner sizes, `active`) + `rv-scroll-area-scrollbar` (orientation, sizes, hasThumb, thumb ref, pointer offset). Scrollbar = `Show when={active}` (fallback `ScrollbarStatic`: server markup of `always` / `forceMount` bars) over `ScrollbarActive`, which dispatches to internal `ScrollbarHover` / `ScrollbarScroll` / `ScrollbarAuto` / `ScrollbarVisible` (= Radix Visible + X/Y + Impl merged); Viewport `ViewportStyle` (inserts the stylesheet once active); pure math helpers (`getThumbSize`, `getScrollPositionFromPointer`, `getThumbOffsetFromScroll`, `linearScale`, …) module-level
- `presence.tsx` - Radix `Presence` (`createPresence({ present, node })` + `isPresent`), exit animations
- `dom.ts` - browser-only helpers (a `.ts`, so module functions may touch `document`): `insertViewportStyle(nonce)` (one `style[data-rv-scroll-area-style]` per document), `addUnlinkedScrollListener` (rAF loop), `observeResize` (RO + rAF)
- tests: `../tests/scroll-area.browser.test.tsx` (Radix `scroll-area.test.tsx` port, 16/17 + behaviour: metrics, drag, track, wheel, RTL, corner, auto / hover / scroll timing, forceMount, exit animation); stories `/scroll-area` + `/scroll-area-cold` (`../tests-components/scroll-area.test.ts`, resumed: no scroll-area code before interaction (chunks preloaded when visible, first hover needs no further chunk), activation by pointerenter / scroll / focus)
- docs: `apps/cdk-docs/content/components/scroll-area.md`, examples `apps/cdk-docs/examples/scroll-area-{basic,types,tailwind}`

## Upstream
- `@radix-ui/react-scroll-area` 1.3.0 (+ `react-presence` 1.1.11, `number` 1.1.3 `clamp`, `react-direction` 1.1.5), MIT © 2022 WorkOS (NOTICE). Tests from radix-ui/primitives main (`packages/react/scroll-area/src/scroll-area.test.tsx`); skipped: "asChild fallback" (no `asChild`).

## Rules / invariants
- Behaviour-critical styles inline: root `position: relative` + corner vars, viewport overflow axes + `scrollbar-width: none`, scrollbar absolute positioning, thumb `width` / `height` from vars + `transform`, content `min-width: 100%; display: table`.
- CSS vars `--rv-scroll-area-thumb-width` / `-thumb-height` (scrollbar), `--rv-scroll-area-corner-width` / `-corner-height` (root); attribute `data-rv-scroll-area-viewport`.
- All component state is `_regionState` (resumed regions are re-created on the first signal change and must keep visibility / machine / sizes / presence).
- Corner shows from `scrollbarXMounted` / `YMounted` flags (clientEffect), not from the scrollbar `ref()` signals (revived refs hold the server element without a change).
- Browser globals only in `dom.ts` or via `element.ownerDocument` (RV2001 on module functions in `.tsx`); no `<style>` JSX (RV1007).
- `type`, `dir`, `scrollHideDelay`, `orientation`, `forceMount`, `nonce` read at creation.
- Activation (2026-10-08, perf): context `active` = `typeof document !== "undefined"` at creation (server `false`, client render `true`). Inactive = server first frame, zero JS: no part may create a `clientEffect` / non-interaction handler outside the `active` branches (a recorded effect loads its chunks at idle / visible). Activators: Root `onPointerEnter` / `onWheel` / `onFocusIn`, Viewport `onScroll` (all `preload="visible"` since 2026-10-08: fetched + evaluated when in view, run only on the event; `"interaction"` made the first hover / wheel wait for a 7-deep chunk waterfall), Root `clientEffect({ when: "visible" })` for `auto` / `always` only. Scrollbar `server` flag (`_regionState`, `true` when rendered by the server) makes Hover check `:hover` and Scroll compare with offset 0 on creation, so the activating event is not lost. A server-rendered Scrollbar sets its axis `enabled` during the server render (serialized true): on activation the Viewport binding never flips an axis with a scrollbar to `hidden` while that scrollbar's chunks load.
- `Show` `fallback` must be a function (`() => <ScrollbarStatic/>`): JSX in a conditional prop is created eagerly in a client render (ref called twice).

## Deviations (vs Radix)
- Before activation both viewport axes `overflow: scroll` (server cannot know which Scrollbars follow; an axis without one switches to `hidden` at activation, keeping its offset). Renamed vars / viewport attribute (`radix` → `rv`); inline hiding + one client-inserted nonce'd style instead of a `<style>` per viewport; `render` instead of `asChild`; Thumb pointer offset in bubbling `pointerdown` (capture handlers not resumable); Thumb rAF loop stops on unmount; `type="scroll"` scroll-end timer not cleared on unmount; `DirectionProvider` → cdk `<Dir>`.

## Gotchas
- Measured (story app, 2026-10-08, af95b8e4 `preload="interaction"`): `/scroll-area-cold` 25 → 9 scripts before interaction, 47.2 → 32.5 KB; first hover loaded 16 chunks (~15 KB). Slow network (`../tests-components/cold-latency.ts`, 150 ms RTT, 1.6 Mbps, 4x CPU) p50 first hover → thumb / first wheel → thumb moved: eager (pre-af95b8e4) 427 / 399 ms, interaction-only 1473 / 1413 ms, `preload="visible"` (now) 123 / 126 ms (fast: 92 / 118, 115 / 124, 100 / 95); scripts before input 25 / 9 / 25, still no boot and no scroll-area code before the event.
- Not done: CSS scroll-driven thumb before activation (`animation-timeline: scroll()` positions a thumb, but its length needs viewport / content ratio — no CSS without typed arithmetic + `anchor-size()` across the scroll container); one chunk for the whole area (compiler `resume.chunks` is app-wide: `component` / `island` / `route`).
- With `render` on Root / Viewport the activation handlers land on your element without the directive (a literal JSX attribute): their own chunks still plan `visible` (scroll / pointerenter are not intent events), their dependency chunks only `intent` — add `preload="visible"` yourself.
- `class` replaces the default `rv-*` class (tests / examples asserting classes use the given one).
- Tests: `setPointerCapture` / `hasPointerCapture` are mocked in the browser suite; fake-timer tests keep a real `setTimeout` for `until` polling.

## See also
- [../CLAUDE.md](../CLAUDE.md), [../bidi/](../bidi/), `docs/guides/resumability.md`
