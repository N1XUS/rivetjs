# libs/cdk/tree

RAC Tree family + RA useTree/useTreeItem + Angular CDK TreeKeyManager/tree controls. Subpaths: `tree` (index.tsx), `tree/behaviour`, `tree/cdk` (cdk-index.ts).

## Files

| File | What |
| --- | --- |
| `index.tsx` | Tree, TreeItem, TreeItemContent, TreeSection, TreeHeader, TreeLoadMoreItem, TreeContext, TreeStateContext, TreeItemContentContext (RAC Tree.tsx). |
| `behaviour.tsx` | `treeProps` / `treeItemProps` / `treeItemExpandPress` (RA useTree / useTreeItem over grid-list behaviour). Chevron id `<row id>-chevron`. |
| `collection.ts` | `TreeCollection` (RAC), `withExpandedKeys` flattens by expanded keys. |
| `intl.ts` | RA intl/tree strings. |
| `dnd.tsx` | Drag and drop (RAC Tree.tsx dnd parts): `treeDnd(hooks, …)` (Tree body: collection hooks, `TreeDropTargetDelegate` over `ListDropTargetDelegate`, keyboard delegate getter, expand on drop activate / expansion keys while targeting a row, providers, root indicator, `renderRow`), `treeItemDnd` (TreeItem body: draggable item, `drag` button slot props, visually hidden "drop on" row + expand button), `TreeDropIndicatorWrapper`, `RootDropIndicator`. |
| `drop-target-delegate.ts` | RAC `TreeDropTargetDelegate` (pointer targets with nesting levels). |
| `navigation-context.tsx` | NavigationTree internals used by TreeItem: `InternalNavigationTreeContext`, item link / state contexts, route lookup helpers. |
| `tree-key-manager.ts`, `control.ts`, `cdk-index.ts` | Angular CDK TreeKeyManager, Flat/NestedTreeControl. |

## Invariants / gotchas
- TreeItem render values (`isSelected`, `isFocused`, `isDisabled`, `selectionMode`, `selectionBehavior`) and the Tree root `selectionMode` are `computed` over `view()`: `view()` notifies on every expand, and DOM v2 fragment children are reactive (`_scoped`) — an unmemoized `selectionMode() === …` ternary re-created the row Checkbox on expand (V2-FIX R4). Other collections reading `view()` in render props may need the same

- Collection: `computed(() => buildCollectionFrom(...))` local to Tree — B5 `collectionOf`'s computed is not resumable (capture error). Same for `DefaultCollectionRenderer` methods: use `customRenderer ?? DefaultCollectionRenderer` at call time.
- Content rows render through `renderNodeAt(() => flatOf(state), k)` (`collections/components.tsx`): an unchanged row keeps its DOM across rebuilds (expand / items change), a changed one re-renders; nested `items` signals / dynamic children are tracked by the build pass.
- Server `computed` evaluates eagerly: declare `base` → `flat` → `state` in order (TDZ).
- Resumed pages boot nothing for a Tree (TREE-PRE 2026-10-28): its body `clientEffect`s carry no load-time trigger — `resetTreeFocusedKey` is `when: "interaction"`, the `useHasTabbableChild` observer is `"idle"` only for a tree rendered empty (else `"interaction"`; the browser runs it whenever the component runs). Before, both were default `idle`: every Tree page booted at load and fetched the whole Tree closure. NavigationTree `isCurrent` scroll: idle only for the server's current row (CEFF 2026-10-28); DEV-only effects keep idle. Known gap: Tree records are `UNKEYED` (keyed `Set` state — expanded / selected keys, route `createTreeData` — is not tail data, runtime `isData` = plain JSON), so a resumed Tree is rendered in the browser on its first event / wake instead of adopted (before: at idle). Test `tests-components/tree.test.ts` (settles `networkidle`, no `data-boot`).
- Tree root `Provider` has ONE child slot (`collectionContent()`: rows, or `[root drop indicator, rows]` with drag hooks). A second (null without DnD) slot before the rows broke resumed trees: after the first in-browser render a structural change (`createTreeData.move`) reconciled the rows against the wrong anchors (`replaceChild` NotFoundError, rows lost; TREE-LEVEL 2026-10-29, cdk-docs `data-tree`). TreeItem `defaultStyle` `--tree-item-level` is a getter over `level()` (a moved row keeps its DOM; RAC re-renders it). Tests: `tests/tree.browser.test.tsx` "Tree over createTreeData moves", `tests-components/tree.test.ts` "move(key, null, 0)".
- Destructure props before closures (whole `props` capture is not serializable).
- `expandedKeys` / `selectedKeys`: plain value (controlled) or Signal (two-way). Local `isSignal` helper (reactivity does not export one).
- NavigationTree has `render` prop supported: TreeItem adds `data-current`, `data-current-ancestor`, link-driven `data-focus-visible` + link/state contexts when `InternalNavigationTreeContext` present.
- JSX passed as item props is evaluated in the collection build pass (`isHiddenPart()`): hideable parts (Input, …) render nothing — pass render functions. Other eager JSX (ui Chip, …) renders and stays live across rebuilds (TITLE-JSX: build segments, `../collections/CLAUDE.md`).
- Virtualized (`<CollectionVirtualizer layout={ListLayout}>`, COLLECTION-VIRT-2 2026-10-19): ListLayout over the flattened expanded rows; `layoutDelegate` → grid options (PageUp / Down), `focusedKey` → `CollectionRoot`, root scroll → `renderer.onScroll` (`TREE_OWNED` incl. `onScroll`). Example `virtualizer-tree`, story `#vtree`, `tests/tree.browser.test.tsx` "Tree virtualizer".
- Drag and drop (CDK-TREE-DND 2026-10-29): `dragAndDropHooks` from `@rivetjs/cdk/dnd` `useDragAndDrop` (`../dnd/CLAUDE.md`). Rows render `draggable` + `data-allows-dragging` / `data-dragging` / `data-drop-target`; a `<Button slot="drag">` in TreeItemContent gets the keyboard drag props (DEV warning without one). Drop indicators / "drop on" rows / root indicator render only during a drag (server markup: none). Collection id = treegrid id (RAC: `useId()`). With drag hooks rows select on press up (RAC `shouldSelectOnPressUp`). Resumed pages: no boot; first keydown / pointerdown renders the Tree in the browser (UNKEYED, above), the drag starts on that same input (story `/tree-dnd`, `tests-components/tree-dnd.test.ts`: cold keyboard + cold mouse drag).
- Pending: row click stopPropagation (B5 selectable-item), item press props (C6a).
- Open (docs lane D3, scratchpad bug log): `TreeSection` / `NavigationTreeSection` crash SSR (`TreeSection capture #4 … not serializable`); removing a row (`createTreeData.remove`) logs `Cannot read properties of null (reading 'key')`; (fixed: `createTreeData.update` re-renders the row on a resumed page — content rows' `For` items are node values; `tests-components/tree.test.ts` "createTreeData on a resumed page"); emptying `items` logs "Missing resumable element" (regressed with the `renderNodeAt` rework).
- Live props (P5): Tree / TreeItem / TreeLoader `class` / `style` / `children` render props read live (`renderProps(…, props)`, untracked); rows kept on a live class change (`collections` `ownProps` + branch `nodeProps`); TreeItem `isDisabled` live (node props forward unread; locked by the LIVE-SWEEP round 2 test)

## Tests

`tests/tree.browser.test.tsx` (incl. RAC "drag and drop" cases: real `DataTransfer` with shadowed `effectAllowed` / `dropEffect`, session rows counted outside `[inert]` — Chromium supports `inert`, RAC's jsdom run falls back to `aria-hidden`), `tests/navigation-tree.browser.test.tsx`, `tests/tree-key-manager.test.ts`, `tests/tree-control.test.ts`, stories `tests-components/tree.test.ts` (route `app/src/routes/tree.tsx`), `tests-components/tree-dnd.test.ts` (route `tree-dnd.tsx`).
- `render` on Tree, TreeItem, TreeSection (TreeHeader via GridListHeader); aria prop objects as object-literal accessors (`gridAttr` / `rowAttr`; a loop-built accessor map does not resume); tests `tests/render-leftovers.browser.test.tsx`.
- Root `data-rk` = `selectableCollectionKeys` (render branch explicit, JSX branch via `treeProps` → `gridListAttrs`): cold navigation keys are held while chunks load. SLIDER-KEY.
