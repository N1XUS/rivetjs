# libs/cdk/tree

RAC Tree family + RA useTree/useTreeItem + Angular CDK TreeKeyManager/tree controls. Subpaths: `tree` (index.tsx), `tree/behaviour`, `tree/cdk` (cdk-index.ts).

## Files

| File | What |
| --- | --- |
| `index.tsx` | Tree, TreeItem, TreeItemContent, TreeSection, TreeHeader, TreeLoadMoreItem, TreeContext, TreeStateContext, TreeItemContentContext (RAC Tree.tsx). |
| `behaviour.tsx` | `treeProps` / `treeItemProps` / `treeItemExpandPress` (RA useTree / useTreeItem over grid-list behaviour). Chevron id `<row id>-chevron`. |
| `collection.ts` | `TreeCollection` (RAC), `withExpandedKeys` flattens by expanded keys. |
| `intl.ts` | RA intl/tree strings. |
| `navigation-context.tsx` | NavigationTree internals used by TreeItem: `InternalNavigationTreeContext`, item link / state contexts, route lookup helpers. |
| `tree-key-manager.ts`, `control.ts`, `cdk-index.ts` | Angular CDK TreeKeyManager, Flat/NestedTreeControl. |

## Invariants / gotchas
- TreeItem render values (`isSelected`, `isFocused`, `isDisabled`, `selectionMode`, `selectionBehavior`) and the Tree root `selectionMode` are `computed` over `view()`: `view()` notifies on every expand, and DOM v2 fragment children are reactive (`_scoped`) — an unmemoized `selectionMode() === …` ternary re-created the row Checkbox on expand (V2-FIX R4). Other collections reading `view()` in render props may need the same

- Collection: `computed(() => buildCollectionFrom(...))` local to Tree — B5 `collectionOf`'s computed is not resumable (capture error). Same for `DefaultCollectionRenderer` methods: use `customRenderer ?? DefaultCollectionRenderer` at call time.
- Content rows render through `renderNodeAt(() => flatOf(state), k)` (`collections/components.tsx`): an unchanged row keeps its DOM across rebuilds (expand / items change), a changed one re-renders; nested `items` signals / dynamic children are tracked by the build pass.
- Server `computed` evaluates eagerly: declare `base` → `flat` → `state` in order (TDZ).
- Destructure props before closures (whole `props` capture is not serializable).
- `expandedKeys` / `selectedKeys`: plain value (controlled) or Signal (two-way). Local `isSignal` helper (reactivity does not export one).
- NavigationTree has `render` prop supported: TreeItem adds `data-current`, `data-current-ancestor`, link-driven `data-focus-visible` + link/state contexts when `InternalNavigationTreeContext` present.
- JSX passed as item props is evaluated in the collection build pass (`isHiddenPart()`): hideable parts (Input, …) render nothing — pass render functions.
- Virtualized (`<CollectionVirtualizer layout={ListLayout}>`, COLLECTION-VIRT-2 2026-10-19): ListLayout over the flattened expanded rows; `layoutDelegate` → grid options (PageUp / Down), `focusedKey` → `CollectionRoot`, root scroll → `renderer.onScroll` (`TREE_OWNED` incl. `onScroll`). Example `virtualizer-tree`, story `#vtree`, `tests/tree.browser.test.tsx` "Tree virtualizer".
- Pending: DnD; row click stopPropagation (B5 selectable-item), item press props (C6a).
- Open (docs lane D3, scratchpad bug log): `TreeSection` / `NavigationTreeSection` crash SSR (`TreeSection capture #4 … not serializable`); removing a row (`createTreeData.remove`) logs `Cannot read properties of null (reading 'key')`; (fixed: `createTreeData.update` re-renders the row on a resumed page — content rows' `For` items are node values, tree rows re-checked by `resumedKeys` (ROW-RERENDER 2026-10-20, `../collections/CLAUDE.md` "Resumed rows"); `tests-components/tree.test.ts` "createTreeData on a resumed page"); emptying `items` logs "Missing resumable element" (regressed with the `renderNodeAt` rework).
- Live props (P5): Tree / TreeItem / TreeLoader `class` / `style` / `children` render props read live (`renderProps(…, props)`, untracked); rows kept on a live class change (`collections` `ownProps` + branch `nodeProps`); TreeItem `isDisabled` live (node props forward unread; locked by the LIVE-SWEEP round 2 test)

## Tests

`tests/tree.browser.test.tsx`, `tests/navigation-tree.browser.test.tsx`, `tests/tree-key-manager.test.ts`, `tests/tree-control.test.ts`, story `tests-components/tree.test.ts` (route `app/src/routes/tree.tsx`).
- `render` on Tree, TreeItem, TreeSection (TreeHeader via GridListHeader); aria prop objects as object-literal accessors (`gridAttr` / `rowAttr`; a loop-built accessor map does not resume); tests `tests/render-leftovers.browser.test.tsx`.
