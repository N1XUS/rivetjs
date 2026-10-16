# libs/cdk/sheet-motion

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`@rivetjs/cdk/sheet-motion` — Rivet-authored (no upstream). Edge-attached sheet gesture on `../motion` (embla physics; no CSS transition / JS easing). Feature set (snap points, close threshold, sequential snapping, handle-only, backdrop fade from an index) inspired by HeroUI Pro's public Sheet docs; independent implementation (no Pro source / CSS viewed). Generalises `../sidebar/sheet-motion.ts` (Sidebar mobile swipe) to four placements.

## API (`index.ts`)

- `sheetMotion(sheet, options) → SheetMotionController` (`snapTo(i, jump?)`, `dismiss()`, `offset()`, `index()`, `destroy()`). Options: `placement` (bottom), `close`, `dismissible` (true), `snapPoints`, `activeSnapIndex`, `onSnap`, `closeThreshold` (0.25), `sequential`, `handle` (selector), `backdrop`, `fadeFromIndex` (last), `onDrag(event, pct)`, `onRelease(event, open)`, `onProgress(shown)`, `onSettle(open)`, `reduceMotion()`, `touchAction`, `bleed` (true).
- Pure helpers: `snapPointSize(point, viewport, vertical, rem)`, `snapPointTransform(placement, point)` (CSS expression for the first / server render), `sheetBackdropOpacity(offset, size, offsets, fadeFrom)`, `rubberBand(raw, limits)`, `isVerticalSheet`; constants `SHEET_AXIS_LOCK` (6 px), `SHEET_RUBBER_BAND` (0.2), `SHEET_CLOSE_THRESHOLD` (0.25).

## Invariants

- Offset = px towards the closed edge (0 shown, size off-screen); rendered as inline `transform: translate{X|Y}` (overlay enter / exit animate `translate`: they compose). Snap mode keeps a transform at rest + `--snap-point-height`; non-snap clears it at rest.
- Backdrop: writes `--sheet-backdrop-opacity` (0…1) every frame; removed at rest without snap points. Style a child / pseudo-element with it (the sheet is usually inside the backdrop element).
- Drag decision: 6 px axis lock, cross-axis move abandons (native scroll / pan); a scroll container that can still scroll in the drag direction wins (closing direction always, opening direction once fully expanded); never from text fields / `[data-sheet-no-drag]`; `handle` limits starts to that element. Started drag: synthetic `pointercancel` on the press target, next click swallowed, pointer capture, `data-dragging="true"`, `transition: none` inline (sheet + backdrop).
- Release: VelocityTracker force × DragRelease boost (300 mouse / 400 touch) projects; dismiss past `closeThreshold` of the remaining distance (snap: below the lowest point; sequential: only from index 0), else nearest point (sequential: ±1). Dismiss animates off-screen, then `close()`. Reduced motion (`prefers-reduced-motion` or `reduceMotion()`) jumps.
- Overdrag bleed (`bleed`, default true; vaul `[data-vaul-drawer]::after` equivalent): while the offset is < 0 (rubber band past fully shown) a child `<div data-sheet-bleed aria-hidden>` (inline: `position:absolute`, beyond the attached edge — bottom `top:100%` / top `bottom:100%` / right `left:100%` / left `right:100%` — `100vh` / `100vw` long, `background:inherit`, `pointer-events:none`) keeps the surface attached; created on the first overdrag, removed when the motion settles at ≥ 0 and on `destroy`. A static sheet gets inline `position: relative` while it is shown (restored). Limit: an `overflow: hidden` sheet clips it. ui Sheet passes `bleed: !isDetached`.
- Inline `touch-action`: `none` (vertical) / `pan-y` (horizontal) unless `handle`; restored on `destroy`.

## Tests

`../tests/sheet-motion.test.ts` (helpers, node), `../tests/sheet-motion.browser.test.tsx` (Chromium gesture suite). Consumer suites: `libs/ui/tests/sheet.test.tsx`, `libs/ui/tests-components/sheet.test.ts`.

## Gotchas

- Touch inside a scroll container of the sheet: the container's own `touch-action` (auto) wins for touches that start in it (effective touch-action stops at the nearest scroller), so the browser pans it and sends `pointercancel`: on touch, a scrollable body never drags the sheet, even scrolled to its start (mouse / pen follow the scroll-first rule above). Drag from the handle / header. Sidebar adoption: `side` left / right → `placement`, `closeThreshold: 0.5`, `backdrop` = its overlay.
