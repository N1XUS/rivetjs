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
- Row / cell press handlers stop propagation like usePress, except the click a synthetic link dispatches (`isOpeningLink()`), so link rows reach the document.
- State: `state/grid.ts` (RS useGridState); handlers build the selectable-item options per event from the state view.
