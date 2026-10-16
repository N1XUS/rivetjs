# libs/cdk/table
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC Table family + RA useTable / useTableColumnHeader / useTableRow / useTableCell / useTableSelectionCheckbox / useTableColumnResize. Subpaths: `table` (index.tsx), `table/behaviour` (behaviour.ts).

## Files
| File | What |
| --- | --- |
| `index.tsx` | Table, TableHeader, Column, TableBody, Row, Cell, TableFooter, TableLoadMoreItem, ResizableTableContainer, ColumnResizer, `tableOptions()` (RAC useTableOptions); contexts TableContext, TableStateContext / TableColumnResizeStateContext (accessors), TableOptionsContext, RowFocusContext (all `rv-*` resumable). |
| `column-resize.tsx` | `tableColumnResizeProps` (RA useTableColumnResize: resizer + visually hidden range input bags), `focusColumnResizer`. |
| `behaviour.ts` | `tableGridProps`, `tableColumnHeaderProps` (+ `tableColumnHeaderPress`), `tableRowProps` (+ synthetic link attrs), `tableCellProps`, selection checkbox props / handlers, `tableState` view. |
| `collection.ts` | `TableCollection` + node classes (TableHeaderNode, TableColumnNode, TableBodyNode, TableRowNode, TableCellNode, TableFooterNode) built by B5 build mode. |
| `keyboard-delegate.ts` | TableKeyboardDelegate (typeahead falls back to the cell element text when a cell has no build-time `textValue`). |
| `intl.ts` / `rac-intl.ts` | Generated RA table strings / RAC `tableResizer` string. |

## Invariants / gotchas
- Built collection (`collectionOf`, object-literal `build = { content, createCollection }`); parts render from `node.render(node)`; `CollectionBranch` gets `{ key }` (never the node instance: resumable capture); renderer via `(custom ?? DefaultCollectionRenderer)`.
- Children inside providers are bindings: `{provide(Ctx, v, () => rp.children())}` (Column, Cell, ResizableTableContainer) — a JSX `<Provider>` child is not reactive / not provided.
- Native table elements; hidden description divs are siblings after `<table>` (a div inside a table is foster-parented).
- Row / Cell hover + own focus are delegated (HOTPATH 2026-10-09): `onPointerOver` → `hoverStateOver`, `onFocusIn` starts with `focusStateIn` (target === element, one native blur while focused); no native focus / blur / pointerenter / pointerleave per row or cell; the user's `onPointerEnter` / `onPointerLeave` bind only when given. Table ×1000 rows: listeners 28032 → 8032, mount 115 → 104 ms, dispose 16.7 → 13.2 ms, heap −7%. Remaining per-element natives: cell keydown capture, row dragstart / pointercancel.
- Column header focusMode "child": focusing a resizable header moves focus to the resizer input on the next frame (RA useGridCell rAF).
- Build pass tracks nested reads (`collections/components.tsx` re-entry): `<TableBody items={sig}>`, `<Collection items={columns}>` in Row / TableHeader, controlled widths through column items rebuild the collection. Rows / header cells render through `renderNodeAt`: unchanged rows keep their DOM; `TableColumnNode.liveProps` (`width`, `defaultWidth`, `minWidth`, `maxWidth`: read live by the resize state) keep the header (and its dragged resizer) when only widths change.
- Focus after a removed row (`index.tsx` reset effect): `resetGridFocusedKey` picks the replacement key, then a microtask focuses its element when the grid was focused or the last focusout-to-nowhere target left the DOM (Chromium fires focusout on removal; jsdom / React detached-node events do not).
- Gaps: no virtualized table, no DnD, placeholders render nothing; resumed page (docs lane D3): select-all checkbox is dead, row selection checkboxes toggle once on mouse click then stop (row Space works); story tests skipped.
- Ids: only body row header cells get ids (`<table>-<row>-<col>`); other cells have none.
- Live props (P5): Table / TableHeader / Column / ColumnResizer / TableBody / Row / Cell `class` / `style` / `children` render props read live (`renderProps(…, props)` when a prop is live, untracked); header + rows kept on a live class change (`collections` `ownProps`); Row `isDisabled` live (node props forward unread; locked by the LIVE-SWEEP round 2 test)

## Tests
`tests/table.browser.test.tsx` (RAC Table.test.js port), `tests/table-resizing.browser.test.tsx` (RA tableResizingTests port), story `tests-components/table.test.ts` (route `app/src/routes/table.tsx`).
