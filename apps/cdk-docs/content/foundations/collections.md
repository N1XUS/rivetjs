---
title: Collections
description: List, tree, grid and table collections, DOM-built collections and the Angular CDK SelectionModel and DataSource, from @rivetjs/cdk/collections/*.
template: guide
status: experimental
related: [foundations/selection, foundations/overview, components/listbox]
---

A collection is the ordered, keyed list of nodes a widget navigates and selects: items, sections, rows, cells. The modules below port `@react-stately/collections`, `list`, `tree`, `grid`, `table`, `@react-aria/collections` and `@angular/cdk/collections`. Names, options and behaviour match the originals, so their docs apply.

Collections are class instances, so they are never part of the resumed state. A handler or a `computed` rebuilds one from the state (items, expanded keys) or from the server-rendered DOM.

::example{id=collections-builder}

## Modules

| Import | Gives you | Original |
| --- | --- | --- |
| `@rivetjs/cdk/collections/types` | `Key`, `Node`, `Collection`, `KeyboardDelegate`, `LayoutDelegate`, `SortDescriptor`, `Selection`, `ItemProps`, `SectionProps` and the other shared types. | `@react-types/shared` |
| `@rivetjs/cdk/collections/builder` | `Item`, `Section`, `CollectionBuilder`, `createCollection` (`useCollection`), `defineCollectionComponent`. | `@react-stately/collections` |
| `@rivetjs/cdk/collections/nodes` | `getChildNodes`, `getFirstItem`, `getNthItem`, `getLastItem`, `compareNodeOrder`, `getItemCount`. | `@react-stately/collections` |
| `@rivetjs/cdk/collections/list` | `ListCollection`. | `@react-stately/list` |
| `@rivetjs/cdk/collections/list-state` | `createListState`, `createSingleSelectListState`, `listCollection`, `listSelectionManager`, `selectedItem`, `setSelectedKey`, `resetFocusedKey`, `filteredListCollection`. | `useListState`, `useSingleSelectListState` |
| `@rivetjs/cdk/collections/tree` | `TreeCollection` (only expanded rows are visible). | `@react-stately/tree` |
| `@rivetjs/cdk/collections/tree-state` | `createTreeState`, `treeCollection`, `treeSelectionManager`, `toggleTreeKey`, `setExpandedKeys`, `resetTreeFocusedKey`. | `useTreeState` |
| `@rivetjs/cdk/collections/grid` | `GridCollection`. | `@react-stately/grid` |
| `@rivetjs/cdk/collections/table` | `TableCollection`, `TableHeader`, `TableBody`, `Column`, `Row`, `Cell`, `tableBuilderContext`, `nextSortDescriptor`, `ariaSort`, `ROW_HEADER_COLUMN_KEY`. | `@react-stately/table` |
| `@rivetjs/cdk/collections/base` | `BaseCollection`, `CollectionNode` and its subclasses, `buildCollection(specs)`. | `@react-aria/collections` |
| `@rivetjs/cdk/collections/dom` | `domCollection(root, options?)`, `keyAttrs(key)`, `domKey(element)`, `getItemElement`, `domNodeType`, `domTextValue`, `nodeOf`. | Rivet |
| `@rivetjs/cdk/collections/selection-model` | `SelectionModel`, `SelectionChange`. | `@angular/cdk/collections` |
| `@rivetjs/cdk/collections/data-source` | `DataSource`, `ArrayDataSource`, `isDataSource`, `ListRange`, `CollectionViewer`. | `@angular/cdk/collections` |
| `@rivetjs/cdk/collections/unique-selection-dispatcher` | `UniqueSelectionDispatcher`. | `@angular/cdk/collections` |

The selection side (`SelectionManager`, state, keyboard delegate) is on [Selection](selection.md).

## Building a collection

`Item(props)` and `Section(props)` return collection elements, the same as `<Item>` and `<Section>` in React Stately. Pass static elements, or `items` plus a renderer, to `new CollectionBuilder().build({ children, items }, context?)`, and wrap the nodes in a collection class.

- Keys: an element's `key`; for rendered items `item.key` or `item.id`; else `"$.<index>"`. Child keys of nested items are prefixed with the parent key.
- `textValue` defaults to string content; set it for other content (typeahead).
- `Item` with `childItems` (or `title` plus item children) has child nodes; `hasChildItems` marks a branch before its children load.

| `ListCollection` member | Does |
| --- | --- |
| `size`, `getKeys()`, `getItem(key)`, `at(index)` | |
| `getFirstKey()`, `getLastKey()`, `getKeyBefore(key)`, `getKeyAfter(key)` | Across sections. |
| `getChildren(key)` | Items of a section. |

| Node helper | Does |
| --- | --- |
| `getChildNodes(node, collection)` | Children of a node. |
| `getFirstItem(iterable)`, `getNthItem(iterable, n)`, `getLastItem(iterable)` | |
| `compareNodeOrder(collection, a, b)` | Document order of two nodes. |
| `getItemCount(collection)` | Items only (sections not counted). |

## List state

`createListState(props)` (`useListState`): `items` and `children` (or a pre-built `collection`, `filter`) plus multiple selection state. `listCollection(state)` builds and caches the collection; `listSelectionManager(state)` returns `state.selectionManager`. `createSingleSelectListState(props)` backs the selection with a `selectedKey` signal (or a plain controlled value), never empties it by user action and fires `onSelectionChange(key)` for the same key again; `setSelectedKey(state, key)` and `selectedItem(state)` read and write it.

`@rivetjs/cdk/state/list` is the signal-only form the components use (no collection class, DOM as collection); this module is the collection-class form for code that needs the nodes.

::example{id=collections-list-state}

## Trees

`createTreeState({ items, children, expandedKeys?, defaultExpandedKeys?, onExpandedChange?, …selection props })` (`useTreeState`). `treeCollection(state)` is a `TreeCollection` of the expanded rows only, rebuilt when the items or the expanded keys change; `toggleTreeKey(state, key)` and `setExpandedKeys(state, keys)` change them (a plain `expandedKeys` value is controlled: only `onExpandedChange` fires). `resetTreeFocusedKey` clears a focused key whose row went away.

::example{id=collections-tree}

## Tables and sorting

`TableCollection(nodes, previous?, context)` adds header rows (nested columns get placeholder cells and `colSpan`), `columns`, `rowHeaderColumnKeys` and `body`. Build the nodes with `TableHeader` / `Column` / `TableBody` / `Row` / `Cell` and a `tableBuilderContext({ showSelectionCheckboxes?, showDragButtons?, selectionMode? })`. Cell keys are row key + column key. The cell count of each row must match the column count.

`nextSortDescriptor(current, column, direction?)` returns the next `{ column, direction }` (the same column flips, a new column starts ascending); `ariaSort(descriptor, column, allowsSorting?)` gives the `aria-sort` value.

With selection checkboxes, the extra column has the key `"row-header-column-$selection"` (`ROW_HEADER_COLUMN_KEY`). React Stately adds a random suffix; Rivet keeps the key fixed so server and client agree.

`GridCollection({ columnCount, items, visitNode? })` is the rows-of-cells base (`colIndex` after `colSpan`, sibling links).

::example{id=collections-table}

## BaseCollection

`buildCollection(specs)` builds a frozen `BaseCollection`, the model React Aria Components use, from node specs `{ type?, id?, textValue?, "aria-label"?, rendered?, props?, hidden?, children? }`: index, level, parent and sibling keys, `colIndex`, item count and duplicate-key errors. `filter((textValue, node) => boolean)` returns a filtered copy: sections without matching items and separators at the ends drop out. `clone()`, `addNode`, `removeNode` and `commit` are there for builders.

::example{id=collections-base}

## The DOM as the collection

On a resumed page the server-rendered items already hold the order, the keys and the text. `domCollection(root)` reads them when a handler runs:

| Node field | From |
| --- | --- |
| key | `data-key`; with `data-key-type="number"` (spread `keyAttrs(key)`) a number |
| type | `data-type`, else the role: `option`, `menuitem*`, `treeitem`, `tab`, `row`, `radio`, `checkbox`, `link`, `listitem`, `button` are items; `group` a section; `presentation` / `heading` a header; `separator`; `gridcell` / `cell` / `rowheader` cells; `columnheader` a column |
| text | `data-text-value`, `data-text`, `aria-label`, else the trimmed text |
| props | `isDisabled` (`aria-disabled="true"`, `disabled`, `data-disabled`), `href` / `data-href` with `target`, `rel`, `download`; `colSpan` |
| parent | the nearest ancestor that is a node |

Hidden subtrees (`hidden`, except popovers) are left out. With a `data-collection` attribute on `root`, nested collections are skipped (`scoped`); `selector` (default `[data-key]`) changes which elements count.

::example{id=collections-dom}

## Angular CDK

`SelectionModel`, `DataSource` and `UniqueSelectionDispatcher` follow `@angular/cdk/collections`, with two changes: `changed` is a small emitter (`subscribe(fn)` returns `{ unsubscribe }`) instead of an RxJS `Subject`, and `DataSource.connect()` returns an accessor instead of an `Observable`.

### SelectionModel

`new SelectionModel<T>(multiple = false, initiallySelected?, emitChanges = true, compareWith?)`: a selection of values, for client-side code and stores. It is a class: keep it at module level or in a handler, and mirror what the page shows into signals.

| Member | Does |
| --- | --- |
| `selected` | The selected values (array). |
| `select(...values)`, `deselect(...values)`, `setSelection(...values)`, `toggle(value)`, `clear(flush = true)` | Change; return whether anything changed. Several values in single mode throw. |
| `bulk.select(values)`, `bulk.deselect(values)`, `bulk.setSelection(values)` | The same with arrays. |
| `isSelected(value)`, `isEmpty()`, `hasValue()`, `isMultipleSelection()`, `sort(predicate?)` | |
| `changed.subscribe(({ source, added, removed }) => …)` | One event per change. |
| `compareWith` | Value equality (match fresh objects by id). |

::example{id=collections-selection-model}

### DataSource and UniqueSelectionDispatcher

`DataSource<T>` has `connect(viewer)` (returns `() => readonly T[]`) and `disconnect(viewer)`. `ArrayDataSource` wraps an array or an accessor (a signal); `isDataSource(value)` checks for `connect`. `CollectionViewer` is `{ viewChange: () => ListRange }`.

`UniqueSelectionDispatcher`: `listen((id, name) => …)` returns an unregister function, `notify(id, name)` tells every listener, `destroy()` drops them (Angular's `ngOnDestroy`). Create one per scope; Angular provides one at the root.

::example{id=collections-data-source}

## Common mistakes

- **Storing a collection or a SelectionManager in state.** They are class instances; the serializer refuses them. Store items, keys and signals; derive the collection in the handler or a `computed`.
- **Number keys from the DOM.** `data-key` is text. Spread `keyAttrs(key)` so `domCollection` reads `data-key-type="number"` back as a number.
- **Rows that do not match the columns.** `TableCollection` throws when a row has more or fewer cells than there are columns.
