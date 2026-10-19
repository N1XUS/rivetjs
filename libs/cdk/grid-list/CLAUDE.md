# libs/cdk/grid-list
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC GridList family + RA useGridList / useGridListItem / useGridListSection / useGridListSelectionCheckbox. Subpaths: `grid-list` (index.tsx), `grid-list/behaviour`.

## Files
| File | What |
| --- | --- |
| `index.tsx` | GridList, GridListItem, GridListSection, GridListHeader, GridListLoadMoreItem; GridListContext, GridListInternalContext, GridListHeaderContext (RAC GridList.tsx). |
| `behaviour.ts` | `gridListProps` / `gridListItemProps` / `gridListSectionProps` / `gridListSelectionCheckboxProps` + `gridList<Event>` / `gridListItem<Event>` handlers; `listStateView` / `treeStateView`; `gridListItemsChanged` (useFocusedKeyReset + focus restore after removal). Shared by `tree`, `tag-group`. |
| `row.ts` | Row helpers: `rowCollection`, `rowSpec`, `LINK_PROPS` / `PRESS_PROPS`, `eventNode`, focus `Ring`. |

## Invariants / gotchas
- B5 live collection: rows carry `data-key` / `data-collection`; state snapshots via `listCollection(state, root)`.
- Tree set sizes (`deriveItem` `aria-setsize` / `aria-posinset`): cached per committed collection object (module WeakMap, `isFrozen === false` not cached), upstream recounts siblings per row (O(n²) mount: 1000-row Tree 129 → 38 ms; selection update 0.26 → 0.10 ms). Collections must stay immutable once committed (react-stately contract).
- Resumability: destructure props before closures; handler bags are inline object literals (`io = { dispatch: … }`), never arrows passed only as call args; no module-level fns / classes captured (`customRenderer ?? DefaultCollectionRenderer` at call time).
- Chromium fires focusout when a focused row is removed → `manager.isFocused` false; `gridListItemsChanged` treats `activeElement == body` as was-focused.
- `render` prop (RAC DOMRenderProps; `(attrs, renderProps)` → spread attrs; early return before the compiled element; `tests/render-collections.browser.test.tsx`) on GridList / Item / Section / Header (LoadMoreItem excluded)
- Virtualized (`<CollectionVirtualizer layout={ListLayout | GridLayout}>`, COLLECTION-VIRT-2 2026-10-19): `isVirtualized` → built collection (`builtCollectionOf`) given to `createListState` + `CollectionRoot` (`scrollRef`, `focusedKey`); root scroll → `renderer.onScroll`; items get `aria-rowindex` via `gridListRowIndex(collection, key)` (`behaviour.ts`, section headers counted, WeakMap per frozen collection); internal context carries `collection`. Example `virtualizer-grid-list`, story `#vgrid`, `tests/grid-list.browser.test.tsx` "GridList virtualizer".
- Pending: `gridListItemsChanged` not wired into GridList (TagList only); DnD, ComboBox/Toolbar nesting.
- Live props (P5): GridList / GridListItem `class` / `style` / `children` render props read live (`renderProps(…, props)` when a prop is live, body untracked; rows kept); item `isDisabled` live (LIVE-SWEEP round 2): a live one is read through `specNow()` = `withDisabled(spec, current)` (`row.ts`; plain data) in the row's `aria` computed and at event time (`eventNode`)

## Tests
`tests/grid-list.browser.test.tsx`, story `tests-components/grid-list.test.ts` (route `app/src/routes/grid-list.tsx`).
