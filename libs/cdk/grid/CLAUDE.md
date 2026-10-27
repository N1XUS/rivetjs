# libs/cdk/grid
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

@react-aria/grid port (no component; used by `table`). Subpath: `grid/behaviour`.

## Files
| File | What |
| --- | --- |
| `behaviour.ts` | `gridProps` / `gridRowProps` / `gridCellProps` bags + `grid<Event>` / `gridRow<Event>` / `gridCell<Event>` handlers (RA useGrid, useGridRow, useGridCell, useGridSelectionAnnouncement, useHighlightSelectionDescription); `gridShared`. No closures in bags (`.ts`). |
| `keyboard-delegate.ts` | GridKeyboardDelegate (RA). |
| `intl.ts` | Generated RA grid strings. |

## Invariants / gotchas
- Row / cell press handlers stop propagation like usePress (pointerdown / click / keydown), except the click a synthetic link dispatches (`isOpeningLink()`), so link rows reach the document. Never `pointerup` (usePress lets it bubble): a nested press (selection checkbox, sortable column's sort press) ends through its document `pointerup` listener, and the runtime's delegated stop is immediate at the document — stopped there, a touch tap's `pointerleave` (before the click) ended the press without `onPress`: tapped Table checkboxes / sortable headers did nothing (B1 2026-10-27, `tests/touch-tap.browser.test.tsx`).
- State: `state/grid.ts` (RS useGridState); handlers build the selectable-item options per event from the state view.
- `gridProps` sets `data-rk` = `selectableCollectionKeys` (resume loader holds cold navigation keys; a cell's text field keeps its caret keys). SLIDER-KEY.
