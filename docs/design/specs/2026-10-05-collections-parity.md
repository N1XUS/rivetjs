# Collections + selection parity (aria/cdk 1:1)

- Area: `@react-stately/{collections,list,selection,tree,grid,table}` (data level), `@react-aria/selection`, `@react-aria/collections`, `@angular/cdk/collections`
- Owner branch: `cdk-collections`; consumers: aria listbox/menu/select/combobox, grid/table/tree, tabs agents
- Rivet modules: `@rivetjs/cdk/collections/*`, `@rivetjs/cdk/selection/*`, `@rivetjs/aria/state/list`, `@rivetjs/aria/state/selection`
- Legacy `@rivetjs/cdk/collections` (createSelection, domItems, ...) unchanged

## Parity table

| Original API | Rivet API | Status | Tests |
| --- | --- | --- | --- |
| `@react-types/shared` Collection, Node, KeyboardDelegate, LayoutDelegate, Selection, SortDescriptor, ... | `cdk/collections/types` | done | typecheck |
| `Item`, `Section` | `cdk/collections/builder` `Item(props)`, `Section(props)` | done (function calls, not JSX) | collections.test |
| `CollectionBuilder` (static + dynamic, childItems, caching, textValue warning) | `CollectionBuilder` | done | collections.test |
| `useCollection` | `createCollection(props, factory, context?, builder?)` | done | collections.test, list-state.test |
| `getChildNodes`, `getFirstItem`, `getNthItem`, `getLastItem`, `compareNodeOrder`, `getItemCount` | `cdk/collections/nodes` | done | collections.test |
| `ListCollection` | `cdk/collections/list` | done | collections.test |
| `useListState` (+ filter, reset focused key) | `aria/state/list` `createListState`, `listCollection`, `listSelectionManager`, `resetFocusedKey` | done | list-state.test, aria listbox tests |
| `UNSTABLE_useFilteredListState` | `filteredListCollection` | done | list-state.test |
| `useSingleSelectListState` | `createSingleSelectListState`, `selectedItem`, `setSelectedKey` | done | list-state.test |
| `Selection` class (anchorKey/currentKey) | `SelectionSet` | done | selection.test |
| `useMultipleSelectionState` (mode, behavior, disallowEmpty, disabledKeys/Behavior, controlled, allowDuplicateSelectionEvents, focus + childFocusStrategy) | `cdk/selection/state` `createMultipleSelectionState`, `setSelectedKeys`, `setFocusedKey` | done | selection.test |
| `SelectionManager` | `cdk/selection/manager` `SelectionManager` | done | selection.test, browser test |
| `TreeCollection` | `cdk/collections/tree` | done | collections.test |
| `useTreeState` | `cdk/collections/tree-state` `createTreeState`, `treeCollection`, `toggleTreeKey`, `setExpandedKeys`, `resetTreeFocusedKey` | done | selection.test ("should be keyboard navigable", state-level) |
| `GridCollection` | `cdk/collections/grid` | done | collections.test |
| `useGridState` | — | out of scope (grid/table/tree agent) | — |
| `TableCollection`, `TableHeader`, `TableBody`, `Column`, `Row`, `Cell`, `buildHeaderRows` | `cdk/collections/table` | done | collections.test |
| sort descriptors (`onSortChange` toggle logic, `aria-sort`) | `nextSortDescriptor`, `ariaSort`, `OPPOSITE_SORT_DIRECTION` | done | collections.test |
| `useTableState`, `TableColumnLayout`, `useTableColumnResizeState`, `useTreeGridState` | — | out of scope (grid/table/tree agent); TableUtils.test not ported here | — |
| RAC `BaseCollection`, `CollectionNode` subclasses, `filter` | `cdk/collections/base` | done | collections.test (CollectionBuilder.test ported) |
| RAC `Document` commit (index, level, prev/next, parentKey, duplicate key error) | `buildCollection(nodes)` | done | collections.test |
| RAC `CollectionBuilder` component, `createLeafComponent`, `createBranchComponent`, `Hidden`, `useCachedChildren` | `domCollection(root)` (server DOM is the collection) + `buildCollection` | partial: no hidden render tree; see queued compiler work | collections.test (DOM) |
| `useSelectableCollection` | `cdk/selection/selectable-collection` handlers (`KeyDownCapture`, `KeyDown`, `Focus`, `Blur`, `MouseDown`, `Scroll`, `VirtualFocus`, `ClearVirtualFocus`, `AutoFocus`, `Updated`), `collectionTabIndex`, `useSelectableCollection` | done | selectable-collection.browser.test (all 11 upstream cases) |
| `useSelectableList` | `cdk/selection/selectable-list` | done | browser test |
| `useSelectableItem` (press, long press, actions, links, virtual focus, double click, drag start) | `cdk/selection/selectable-item` | done with local press adapter | browser test (touch / VO toggle) |
| `ListKeyboardDelegate`, `DOMLayoutDelegate` | `cdk/selection/list-keyboard-delegate` | done | selection.test |
| `useTypeSelect` | `cdk/selection/type-select` | done | selection.test |
| `selection/utils` (`getItemElement`, `useCollectionId`, `isNonContiguousSelectionModifier`) | `cdk/selection/utils` | done | browser test |
| Angular `SelectionModel` | `cdk/collections/selection-model` | done | selection-model.test (selection.spec ported) |
| Angular `DataSource`, `ArrayDataSource`, `CollectionViewer`, `ListRange`, `isDataSource` | `cdk/collections/data-source` | done | selection-model.test |
| Angular `UniqueSelectionDispatcher` | `cdk/collections/unique-selection-dispatcher` | done | selection-model.test (spec ported) |
| Angular `TreeDataNodeFlattener` | `cdk/collections/selection-model` | done (interface) | typecheck |
| Angular `_ViewRepeater`, `_DisposeViewRepeaterStrategy`, `_RecycleViewRepeaterStrategy` | — | not applicable (Angular ViewContainerRef internals; Rivet `For` owns DOM reuse) | — |

## Deviations (reason)

- State is signals, not React state: `selectedKeys`, `selectionBehavior`, `focusedKey`, `isFocused`, `childFocusStrategy`, `anchorKey`, `currentKey` are signals on a plain object (resumability: state must serialize as signals + JSON).
- `Selection` class replaced by `SelectionSet` (Set subclass) for in-flight values; anchor/current keys are stored as separate signals because a Set subclass does not serialize.
- Controlled props: a `Signal` = two-way binding, a plain value = controlled (only `onSelectionChange` fires). Replaces `useControlledState`.
- `SelectionManager`, collections and keyboard delegates are classes: never captured in state; built inside each handler from state (or `domCollection`). `listCollection(state)` / `treeCollection(state)` cache per state + items + expanded keys.
- Single-select list state writes a `selectedKey` signal directly (single-key backing in `MultipleSelectionState`) instead of a computed Set view (a computed view would not serialize).
- `Item` / `Section` are called as functions returning elements; `props.key` becomes the element key. Arrays are fragments.
- `ROW_HEADER_COLUMN_KEY` = `"row-header-column-$selection"` without React Stately's `Math.random()` suffix (server and client must agree; also `$drag`).
- RAC's hidden-render `CollectionBuilder` replaced by `buildCollection(nodeSpecs)` (data) and `domCollection(root)` (server DOM with `data-key`, `keyAttrs(key)` keeps number keys).
- Hooks return props to spread in React; Rivet exposes one handler per event, `(options, event)`, wired as explicit `onX` attributes (resumable handlers, no spread-props hooks). `useSelectableCollection` / `useSelectableList` / `useTypeSelect` remain as convenience wrappers returning handler maps.
- React effects (focus the focused key after state change, scroll into view, auto focus) run synchronously at the end of each handler (`syncFocus`) and through `selectableCollectionAutoFocus` / `selectableCollectionUpdated` called by the component.
- Typeahead capture phase (Space during search) is a separate `...KeyDownCapture` handler.
- Press handling uses a local adapter in `selection/dom-utils.ts` + `selectable-item.ts` (pointer, click, key, long press, virtual pointer detection as `isVirtualPointerEvent`) until `cdk-interactions` lands `usePress`; replace then. No `isPressed` styling state from here.
- Modality tracking (`getInteractionModality`) is a local module variable in `dom-utils.ts` (to be replaced by cdk-interactions).
- Angular Observables → small `Emitter` (`subscribe` → `{unsubscribe}`) for `SelectionModel.changed` and `UniqueSelectionDispatcher`; `DataSource.connect()` returns an accessor; `ngOnDestroy` → `destroy()`.
- `SelectionManager.firstSelectedKey` / `lastSelectedKey` handle `"all"` through the select-all keys (upstream iterates the string `"all"`; bug fix).
- `aria/state/list` keeps the pre-parity fields (`selection`, `focused`, `orientation`, `followFocus`, label items) for current ListBox/Menu/ComboBox/Tabs; legacy-shaped items default to `"single"` selection, react-stately default otherwise is `"none"`.
- Browser test runs on the host platform: on macOS the "move without selecting" modifier is Option (upstream jsdom runs as non-Mac with Control).

## Queued compiler / runtime work

- Compound collection JSX: `<Item>` / `<Section>` children inside `<ListBox>` etc. compile today to rendered DOM; to feed `CollectionBuilder` without a hidden render pass the compiler should lower collection-component JSX (known `getCollectionNode` components) to `Item({...})` element calls, with children kept lazy (thunks) so static collections cost nothing until a handler builds the collection.
- RAC parity for `createLeafComponent` / `createBranchComponent` would need a collection-only render mode (render a subtree to node specs, not DOM); not doable in user land without runtime support.
- `useCollectionId` uses `createId()`; ids for SSR-built collections must match on resume — currently the component passes its own id (`data-collection`).

## Migration notes (libs/ui and aria consumers)

- No exports removed. `@rivetjs/cdk/collections` legacy API unchanged; new code under `@rivetjs/cdk/collections/*` and `@rivetjs/cdk/selection/*` (package exports `./collections/*`, `./selection/*`).
- `createListState` accepts react-stately options (`selectionMode`, `selectionBehavior`, `selectedKeys`, `disabledKeys`, `children` renderer, `items`, `filter`, `collection`) plus the legacy ones; legacy fields still present on the state.
- Item / Section elements are assignable to any collection's children (`GenericCollectionComponent`).
