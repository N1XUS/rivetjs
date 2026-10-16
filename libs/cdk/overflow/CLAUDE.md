# @rivetjs/cdk/overflow
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Headless overflow collapsing: measure a container's item elements, keep what fits, collapse the rest behind one overflow element (render prop). Port of React Spectrum v3 Breadcrumbs collapsing (`updateOverflow` / `computeVisibleItems`) + ActionGroup `overflowMode="collapse"`, generalised into one module (Rivet addition: RAC has no overflow).

## Entry points
- `@rivetjs/cdk/overflow` -> `index.tsx` (package `./*` pattern): `createOverflow(options)` → `{ visibleCount, isCollapsed, isMeasuring, items, before, hidden, after }` (accessors), `OVERFLOW` marker (+ `OverflowMarker`), `overflowSlices(items, visible, { collapse, showRoot })`, `computeVisibleItemsStart` (Spectrum Breadcrumbs), `computeVisibleItemsEnd` (ActionGroup), `updateOverflow(run)` (measurement sequence), `overflowChildren(container)`, types `OverflowOptions`, `OverflowMeasureOptions`, `Overflow`, `OverflowCollapse`.

## Algorithm (Spectrum, keep 1:1)
- `collapse: "start"` (Breadcrumbs): rendered `[root?, overflow, ...last]`; widths = `offsetWidth`; container = the list's own `offsetWidth`; root first (`showRoot`), overflow element, last item measured with `overflow: visible` (unless `isMultiline`), then the rest from the end; fits while `sum < width` (strict); `max(1, min(maxVisibleItems (−1 while showing the menu), n))`; default `maxVisibleItems` 4 (`MAX_VISIBLE_ITEMS`). `showRoot && visible == 1` collapses the root too.
- `collapse: "end"` (ActionGroup): rendered `[...first, overflow]`; sizes = bounding rect + margins (first item's start / last item's end ignored, logical in RTL); container = own bounding width / height (`orientation`); fits while `round(sum) <= round(size)`, stop at the first misfit; may collapse to 0 (only the overflow element).
- Sequence (`useValueEffect` generator): `visible = total` → `onMeasureAll(elements)` → measure → set → measure again with the overflow element shown when `n < total && n > (start ? 1 : 0)`. Signal writes outside a batch flush synchronously, so each measurement sees the new DOM (all inside one ResizeObserver callback / microtask: no paint between).
- Rivet: flex `column-gap` / `row-gap` of the container counted between items (S2 Breadcrumbs does the same); boxless children (`display: none` / `contents`, e.g. a Popover's overlay anchor span) are not items (`overflowChildren`).
- Not ported: ActionGroup `buttonLabelBehavior` pass, "collapse all when selectable" (component policy, not overflow).

## Rules / invariants
- `.tsx` (closures must resume): one `clientEffect` tracks `ref()`, `items()`, `isDisabled`; creates a ResizeObserver + `document.fonts.ready` re-measure; cleanup disconnects (and cancels a pending frame). RO callback: the first measures synchronously; a callback whose measured-axis `contentRect` size (width; height for vertical `"end"`) equals the last one is OUR layout write re-firing (container height follows its content) and is skipped; a changed size (real resize) measures in a `requestAnimationFrame` (still one synchronous show-all/collapse sequence, no half-state paint). Measuring synchronously inside the callback leaves the observed element a different size than the callback saw => browser `ResizeObserver loop completed with undelivered notifications` (verified in Chromium: the skip alone was not enough; the rAF is required). Items / `isDisabled` / fonts triggers are unchanged (synchronous). Never runs on the server; resumed pages start it when the container is visible (captured `ref()`).
- `visible` starts at `defaultVisibleItems` or `Number.MAX_SAFE_INTEGER` ("all": `Infinity` does not serialize). SSR renders that state; the browser measures after mount (layout-shift policy documented in `apps/cdk-docs/content/foundations/overflow.md`).
- `items()` order = DOM order of the container's item elements; the overflow element must be a direct child at the `OVERFLOW` position.
- Callers: `breadcrumbs/index.tsx` (`overflowMode="collapse"`); `@rivetjs/ui/breadcrumbs` forwards it.

## Tests
- `tests/overflow.browser.test.tsx` (Chromium): Spectrum Breadcrumbs.test.js collapsing cases (mocked `offsetWidth`) + ActionGroup collapse cases (mocked `getBoundingClientRect`) + Rivet: real-layout resize, `ResizeObserver re-fire` (content-sized container: no window `error` with a ResizeObserver message, one measure per width change), items change, `maxVisibleItems`, `defaultVisibleItems`, `textValue` / `overflowClass`, `overflowSlices`.
- `tests/overflow-ssr.test.ts`: server markup (all items / `defaultVisibleItems`), every capture serializes.
- Docs: `apps/cdk-docs/content/foundations/overflow.md`, examples `overflow-*`, `breadcrumbs-overflow`.

## See also
- [../breadcrumbs/CLAUDE.md](../breadcrumbs/CLAUDE.md), [../CLAUDE.md](../CLAUDE.md)
