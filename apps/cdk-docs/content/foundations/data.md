---
title: Collection data
description: createListData, createAsyncList and createTreeData from @rivetjs/cdk/data hold list, paged and tree data as resumable signals with immutable updates.
template: guide
status: experimental
related: [foundations/collections, foundations/selection, components/listbox, components/grid-list, components/tree]
---

`@rivetjs/cdk/data` ports the React Stately data hooks as factories: `useListData` → `createListData`, `useAsyncList` → `createAsyncList`, `useTreeData` → `createTreeData`. Each returns a plain object of signals and functions. Read `items()` in JSX or pass `items` to a collection component (`ListBox`, `GridList`, `Table`, `Tree`); pass `selectedKeys` (a two-way signal) to its `selectedKeys`; call the methods from event handlers. Every update is immutable: a new array (and new nodes up the tree), so the collection re-renders what changed.

```ts
import { createListData, createAsyncList, createTreeData } from "@rivetjs/cdk/data";
```

| Export | Upstream | Returns |
| --- | --- | --- |
| `createListData(options?)` | react-stately `useListData` | `ListData<T>`: items, selection, filter text, list operations |
| `createAsyncList(options)` | react-stately `useAsyncList` | `AsyncListData<T>`: `ListData` + loading state, `reload`, `loadMore`, `sort` |
| `createTreeData(options?)` | react-stately `useTreeData` | `TreeData<T>`: root `TreeNode`s, selection, tree operations |
| `createListActions(options, dispatch)` | react-stately `createListActions` | The list operations over your own dispatch function (what both list factories use). |
| `listDataState(list)` | React's `{...state}` of `useListData` | A snapshot `{ items, selectedKeys, filterText }` (reads the signals). |
| types | | `ListOptions`, `ListData`, `ListActions`, `ListDataState`, `AsyncListOptions`, `AsyncListData`, `AsyncListLoadFunction`, `AsyncListLoadOptions`, `AsyncListStateUpdate`, `TreeOptions`, `TreeData`, `TreeNode` |

Call a factory once in a component body (or at module scope for data shared by several components). Its state is region state: a region re-created on a resumed page keeps its data.

## createListData

Manages an immutable list of items with a selection and an optional filter.

::example{id=data-list}

### Options

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `initialItems` | `T[]` | `[]` | |
| `initialSelectedKeys` | `Iterable<Key> \| "all"` | empty | |
| `initialFilterText` | `string` | `""` | |
| `getKey` | `(item: T) => Key` | `item.id ?? item.key` | Inline arrow or local function (captured). |
| `filter` | `(item: T, filterText: string) => boolean` | none | Without it `items()` ignores the filter text. |

### ListData

| Member | Type | Notes |
| --- | --- | --- |
| `items` | `() => T[]` | A computed: the items filtered by `filterText` (when `filter` is set). Pass it as `items`. |
| `selectedKeys` | `Signal<Selection>` | Two-way: give it to a collection's `selectedKeys`. |
| `filterText` | `() => string` | |
| `getItem(key)` | `T \| undefined` | From the unfiltered list. |
| `setSelectedKeys(keys)`, `addKeysToSelection(keys)`, `removeKeysFromSelection(keys)` | | `keys` is a `Set` or `"all"`. |
| `setFilterText(text)` | | |
| `insert(index, ...values)`, `insertBefore(key, ...values)`, `insertAfter(key, ...values)` | | `insertBefore` / `insertAfter` of a missing key insert at 0 into an empty list, else do nothing. |
| `append(...values)`, `prepend(...values)` | | |
| `remove(...keys)` | | Also drops the keys from the selection; an empty list clears it. |
| `removeSelectedItems()` | | Removes the selected items (all with `"all"`) and clears the selection. |
| `move(key, toIndex)` | | |
| `moveBefore(key, keys)`, `moveAfter(key, keys)` | | Moves `keys` (kept in list order) next to `key`. |
| `update(key, value)` | | A new value, or `(prev) => next`. |

### Inserting, removing, moving, updating

```ts
list.append({ id: 5, name: "Animal 5" });
list.insertAfter(2, { id: 6, name: "Hare" });
list.remove(3);
list.removeSelectedItems();
list.moveBefore(list.items()[0].id, [...(list.selectedKeys() as Set<Key>)]);
list.update(2, (prev) => ({ ...prev, name: prev.name.toUpperCase() }));
```

:::note
Never change `items()` or `selectedKeys()` in place: call a method, or `selectedKeys.set(new Set(…))`.
:::

## createAsyncList

Loads a list through your `load` function, with pagination (a cursor), sorting, server-side filtering and abort of stale requests. The initial load starts in the browser after mount (also on a resumed page); the server renders the initial `idle` state with no items, so show a loading state in `renderEmptyState`.

::example{id=data-async}

### Options

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `load` | `(options: AsyncListLoadOptions) => AsyncListStateUpdate \| Promise<…>` | required | Loads a page; see below. |
| `sort` | `(options & { sortDescriptor }) => AsyncListStateUpdate \| Promise<…>` | none | Client-side sort. Without it, `sort()` calls `load` with the new `sortDescriptor`. |
| `initialSelectedKeys` | `Iterable<Key> \| "all"` | empty | Pre-select keys before loading. |
| `initialSortDescriptor` | `SortDescriptor` | none | `{ column, direction: "ascending" \| "descending" }`. |
| `initialFilterText` | `string` | `""` | |
| `getKey` | `(item: T) => Key` | `item.id \|\| item.key` | |

`load` and `sort` receive `AsyncListLoadOptions`: `items` (the current items), `selectedKeys`, `sortDescriptor`, `signal` (an `AbortSignal`: aborted when a newer load starts), `cursor` (the last returned cursor, on `loadMore` only), `filterText`, `loadingState`. They return `AsyncListStateUpdate`: `items` (the page; appended on `loadMore`, replacing otherwise), `cursor` (the next page; `undefined` ends paging), and optionally `selectedKeys` (the new selection; added to it on `loadMore`: select based on loaded data), `sortDescriptor`, `filterText` (a new filter text starts a filtering load).

Use the `signal` to cancel your request: `fetch(url, { signal })`.

### AsyncListData

Every `ListData` member (above), plus:

| Member | Type | Notes |
| --- | --- | --- |
| `isLoading` | `() => boolean` | `loading`, `loadingMore`, `sorting` or `filtering`. |
| `loadingState` | `() => LoadingState` | `"idle" \| "loading" \| "loadingMore" \| "sorting" \| "filtering" \| "error"`. |
| `error` | `() => Error \| undefined` | The error `load` threw. |
| `sortDescriptor` | `() => SortDescriptor \| undefined` | |
| `reload()` | | Loads the first page again (items cleared while loading). |
| `loadMore()` | | Loads the next page; ignored while loading / filtering or without a cursor. |
| `sort(descriptor)` | | Sorts through `sort`, else `load`; the items stay while sorting. |
| `setFilterText(text)` | | Server-side filtering: calls `load` with the new `filterText`. |

The list operations (`append`, `remove`, `move`, `update`, …) change the loaded items locally (client-side updates), even while a load is running. Several calls in one handler see the state as it was when the handler started, as in React (three `loadMore()` calls start three loads; the older two are aborted).

### Infinite loading

Give `loadMore` to a load-more part (`ListBoxLoadMoreItem`, `TreeLoadMoreItem`, `TableLoadMoreItem`) as `onLoadMore={() => list.loadMore()}` and its `isLoading={() => list.loadingState() === "loadingMore"}`: see [Tree: loading more rows](../components/tree.md#loading-more-rows).

## createTreeData

Manages an immutable tree of items: each item is wrapped in a `TreeNode` (`{ key, parentKey, value, children }`), and every update copies the changed node and its ancestors.

::example{id=data-tree}

### Options

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `initialItems` | `T[]` | `[]` | Root items. |
| `initialSelectedKeys` | `Iterable<Key>` | empty | |
| `getKey` | `(item: T) => Key` | `item.id ?? item.key` | |
| `getChildren` | `(item: T) => T[]` | `item.children` | |

### TreeData

| Member | Type | Notes |
| --- | --- | --- |
| `items` | `() => TreeNode<T>[]` | The root nodes. Pass to `Tree` `items`; render `node.children` through a nested `Collection`. |
| `selectedKeys` | `Signal<Set<Key>>` | Two-way. |
| `setSelectedKeys(keys)` | | |
| `getItem(key)` | `TreeNode<T> \| undefined` | Any node by key. |
| `insert(parentKey, index, ...values)` | | `parentKey` `null`: the root. |
| `insertBefore(key, ...values)`, `insertAfter(key, ...values)` | | Siblings of `key`. |
| `append(parentKey, ...values)`, `prepend(parentKey, ...values)` | | |
| `remove(...keys)`, `removeSelectedItems()` | | A node goes with its children. |
| `move(key, toParentKey, index)` | | Throws when moving a node into its own subtree. |
| `moveBefore(key, keys)`, `moveAfter(key, keys)` | | Next to `key`, under its parent. |
| `update(key, value)` | | Replaces the value (children rebuilt from `getChildren(value)`). |

```ts
tree.append("john", { id: "person-1", name: "Person 1" });
tree.move("john", null, 0);
tree.update("sam", { id: "sam", name: "Sam (renamed)" });
tree.removeSelectedItems();
```

:::warning
In a `Tree`, removing a row (`remove`, `removeSelectedItems`) logs an error from the removed row, and `update` does not re-render the row's content yet: the example only appends and moves. With a `ListBox`, `createListData` updates render as expected.
:::

## Resumability

- The returned objects are signals plus arrow functions of a resume-compiled module: handlers and bindings of a resumed page share them.
- Options that are functions (`getKey`, `filter`, `getChildren`, `load`, `sort`) are captured: inline arrows or local functions, never module-level functions.
- `createAsyncList` keeps in-flight `AbortController`s in the browser only; the initial load runs in a client effect.
- Pass `list.items` itself (a computed / accessor) to `items`, not `list.items()` (a value read once).

## Upstream

| Rivet | Upstream |
| --- | --- |
| `createListData`, `createListActions`, `listDataState` | `@react-stately/data` `useListData` |
| `createAsyncList` | `@react-stately/data` `useAsyncList` |
| `createTreeData` | `@react-stately/data` `useTreeData` |

Deviations:

- Factories instead of hooks; reactive members are accessors (`items()`, `isLoading()`, `loadingState()`, …) and `selectedKeys` is a signal.
- React's `{...state}` spread of `useListData` is `listDataState(list)`.
- `createTreeData` methods read the current tree when called (React reads the tree of the current render; the result is the same between renders).

## Common mistakes

- **Mutating items.** `list.items().push(x)` changes nothing visible: use `append`.
- **Unstable keys.** `getKey` must return the same key for the same item across loads.
- **Ignoring `signal`.** A `load` that does not stop on abort still finishes; its result is dropped, but the request runs.
- **Reading `items()` once.** `items={list.items()}` freezes the first value: pass `items={list.items}`.
