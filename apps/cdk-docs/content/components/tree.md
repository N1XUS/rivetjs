---
title: Tree
description: Tree from @rivetjs/cdk is a treegrid of nested, expandable rows with selection, actions, links and keyboard navigation, rendered on the server.
template: guide
status: experimental
related: [components/navigation-tree, components/listbox, components/grid-list, foundations/data, foundations/collections, foundations/selection, foundations/key-manager]
---

`Tree` renders a single-column `role="treegrid"`: each `TreeItem` is a `role="row"` with `aria-level`, `aria-expanded` (parents), `aria-posinset` and `aria-setsize`, and child `TreeItem`s nest inside their parent. The server HTML holds the visible rows with their final ARIA state; collapsed rows are not rendered. Arrow keys move between rows, :kbd[ArrowRight] / :kbd[ArrowLeft] expand and collapse, letters jump by typeahead. A `Button slot="chevron"` in the row content is the expand toggle; a `Checkbox slot="selection"` is the selection checkbox.

::example{id=tree-basic}

## Anatomy

```html
<div role="treegrid" id="files" aria-label="Files" tabindex="0" class="rv-Tree">
  <div role="row" id="files-documents" data-key="documents" tabindex="-1" aria-label="Documents"
       aria-expanded="true" aria-level="1" aria-posinset="1" aria-setsize="2"
       class="rv-TreeItem" style="--tree-item-level:1" data-expanded="true" data-has-child-items="true" data-level="1">
    <div role="gridcell" aria-colindex="1" style="display:contents">
      <!-- TreeItemContent children -->
      <button id="files-documents-chevron" slot="chevron" type="button" tabindex="-1" aria-label="Collapse"
              aria-labelledby="files-documents-chevron files-documents" data-rv-prevent-focus="true">…</button>
      Documents
    </div>
  </div>
  <div role="row" id="files-project" aria-level="2" aria-expanded="false" class="rv-TreeItem" style="--tree-item-level:2" …>…</div>
</div>
```

```tsx
<Tree>
  <TreeItem>
    <TreeItemContent>
      <Button slot="chevron" />
      <Checkbox slot="selection" /> or <SelectionIndicator />
    </TreeItemContent>
    <TreeItem>{/* … */}</TreeItem>
  </TreeItem>
  <TreeSection>
    <TreeHeader />
    <TreeItem>{/* … */}</TreeItem>
  </TreeSection>
  <TreeLoadMoreItem />
</Tree>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `Tree` | `div[role=treegrid]` | `rv-Tree` | `id` (generated unless set; row ids derive from it), `aria-multiselectable` with `selectionMode="multiple"`, `data-empty`, `data-selection-mode`. |
| `TreeItem` | `div[role=row]` > `div[role=gridcell]` (`display: contents`) | `rv-TreeItem` | Id `<tree id>-<key>`; `--tree-item-level` on its `style`. Child `TreeItem`s render as sibling rows after it (a flat list of rows, nesting by `aria-level`). |
| `TreeItemContent` | none (its children) | none | The row's own content. Children may be a function of `TreeItemContentRenderProps`. |
| `Button slot="chevron"` | `button` | `rv-Button` | Id `<row id>-chevron`, `aria-label` "Expand" / "Collapse" (localized), labelled by itself and the row, out of the tab order, does not take focus. |
| `Checkbox slot="selection"` | `label` > visually hidden `input[type=checkbox]` | `rv-Checkbox` | Id `<row id>-checkbox`; checked, labelled and toggled by the tree. |
| `TreeSection` | `div[role=rowgroup]` | `rv-TreeSection` | Labelled by its `TreeHeader` or by `aria-label`. |
| `TreeHeader` | `div[role=row]` > `div[role=rowheader]` | `rv-TreeHeader` | The section's label. |
| `TreeLoadMoreItem` | sentinel `div[inert]` + loading `div[role=row]` | `rv-TreeLoader` | Calls `onLoadMore` when the sentinel nears the scroll viewport; renders its children while `isLoading`. |
| Empty state | `div[role=row]` > `div[role=gridcell]` (`display: contents`) | none | `renderEmptyState` content while the collection is empty. |

| Attribute | Where | Value |
| --- | --- | --- |
| `aria-expanded`, `data-expanded` | row | `aria-expanded` `"true"` / `"false"` on rows with children (absent on leaves); `data-expanded="true"` when expanded |
| `data-has-child-items` | row | the row has child rows (or `hasChildItems`) |
| `aria-level`, `data-level`, `--tree-item-level` | row | depth, 1 for root rows |
| `aria-posinset`, `aria-setsize` | row | position among its siblings |
| `aria-selected`, `data-selected` | row | with selection: `"true"` / `"false"`, `data-selected="true"` when selected; absent on rows that cannot be selected |
| `aria-disabled`, `data-disabled` | row | disabled rows (`isDisabled`, `disabledKeys`) with `disabledBehavior="all"` |
| `data-focused`, `data-focus-visible`, `data-hovered`, `data-pressed` | row | focused row; keyboard focus; pointer over / pressing a selectable or actionable row |
| `data-selection-mode` | tree, row | `"single"` or `"multiple"` |
| `data-href` | row | rows with `href` (rows are never `<a>`; the link opens from JavaScript) |
| `data-key` | row | the item key |
| `data-empty` | tree | no rows |
| `tabindex` | tree, row | tree `0` until a row has been focused; then the focused row is the tab stop (roving) |

## Import

```ts
import { Tree, TreeItem, TreeItemContent, TreeSection, TreeHeader, TreeLoadMoreItem } from "@rivetjs/cdk/tree";
import { Button } from "@rivetjs/cdk/button";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { Collection } from "@rivetjs/cdk/collections/components";
import type { Key, Selection } from "@rivetjs/cdk/collections/types";
```

## Props

### Tree

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `TreeItem` / `TreeSection` / `Collection` children, or `(item) => TreeItem` with `items` | none | Static rows, or the item renderer of `items`. |
| `items` | `Iterable<T> \| () => Iterable<T>` | none | Dynamic root items; each `TreeItem` gets the item's `id` (or `key`) and `value`. Pass a `computed` / signal for derived items. |
| `dependencies` | `readonly unknown[]` | none | RAC parity; ignored (signals re-render). |
| `idScope` | `Key` | none | Prefix of the child item ids (`<idScope>:<id>`). |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | A tree needs a name. |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | |
| `selectionBehavior` | `"toggle" \| "replace"` | `"toggle"` | `replace`: a press replaces the selection, arrow keys move it, `onAction` moves to :kbd[Enter] and double click; no selection checkboxes. |
| `selectedKeys` | `Signal<Selection> \| Iterable<Key> \| "all"` | none | Controlled selection; a signal is written two-way. |
| `defaultSelectedKeys` | `Iterable<Key> \| "all"` | none | Initial selection (uncontrolled). |
| `onSelectionChange` | `(keys: Selection) => void` | none | |
| `disallowEmptySelection` | `boolean` | `false` | |
| `disabledKeys` | `Iterable<Key>` | none | |
| `disabledBehavior` | `"all" \| "selection"` | `"all"` | `selection`: disabled rows stay focusable, expandable and actionable, but cannot be selected. |
| `expandedKeys` | `Signal<Set<Key>> \| Iterable<Key>` | none | A signal: two-way. A plain value: controlled (changes are reported, never written). |
| `defaultExpandedKeys` | `Iterable<Key>` | none | Initially expanded rows (uncontrolled). |
| `onExpandedChange` | `(keys: Set<Key>) => void` | none | |
| `onAction` | `(key: Key) => void` | none | :kbd[Enter] or a click on a row (toggle, nothing selected), double click (replace). |
| `shouldSelectOnPressUp` | `boolean` | `false` | Select on pointer up instead of down. |
| `keyboardNavigationBehavior` | `"arrow" \| "tab"` | `"arrow"` | `tab`: :kbd[Tab] moves into and out of the row's focusable children (text fields keep their arrow keys). |
| `escapeKeyBehavior` | `"clearSelection" \| "none"` | `"clearSelection"` | |
| `disallowTypeAhead` | `boolean` | `false` | |
| `linkBehavior` | `"action" \| "selection" \| "override"` | `"action"` | How rows with `href` behave when selection is on. |
| `autoFocus` | `boolean \| "first" \| "last"` | none | |
| `direction`, `locale` | | from the document | Rivet: reading direction of the arrow keys; typeahead collator / chevron label locale. |
| `renderEmptyState` | `(props: TreeEmptyStateRenderProps) => content` | none | Shown while the tree has no rows. |
| `class`, `style` | value or `(props: TreeRenderProps) => value` | `rv-Tree` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `Tree`; see [Render](#render). |
| `slot`, `id`, `ref` | | | `TreeContext` slots. |
| global DOM props | `GlobalDOMAttributes` | none | See [DOM events and attributes](#dom-events-and-attributes). |

`TreeRenderProps` (accessors): `isEmpty()`, `isFocused()`, `isFocusVisible()`, `selectionMode()`, `allowsDragging()`, `isDropTarget()` (both always false: no drag and drop yet), `state`. `TreeEmptyStateRenderProps`: the same without `isEmpty`.

### TreeItem

| Prop | Type | Notes |
| --- | --- | --- |
| `id` | `Key` | Defaults to the item's `id` / `key` inside `items`, else generated. |
| `value` | `T` | The item object (set inside `items`). |
| `textValue` | `string` | Required: typeahead text and accessible label (a dev warning when missing). |
| `children` | `TreeItemContent`, child `TreeItem`s, `Collection` | The row content plus its child rows. |
| `hasChildItems` | `boolean` | The row is expandable even before its children load. |
| `isDisabled` | `boolean` | |
| `onAction` | `() => void` | Runs before the Tree `onAction`. |
| `href`, `hrefLang`, `target`, `rel`, `download`, `ping`, `referrerPolicy`, `routerOptions` | | A link row: `data-href`; a press opens the link (through the `RouterProvider` when one is set). |
| `aria-label` | `string` | |
| `focusMode` | `"row" \| "child"` | `child`: focusing the row focuses its first focusable child. |
| `allowsArrowNavigation` | `boolean` | Arrow keys navigate rows even with `keyboardNavigationBehavior="tab"`. |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | | |
| `class`, `style` | value or function of `TreeItemRenderProps` | Default `rv-TreeItem`; `--tree-item-level` is merged into the style. |
| global DOM props | | On the row element (except `onClick`, as RAC). |

`TreeItemRenderProps` (accessors, also given to `TreeItemContent` children): `isHovered()`, `isPressed()`, `isSelected()`, `isFocused()`, `isFocusVisible()`, `isDisabled()`, `selectionMode()`, `selectionBehavior()`, `isExpanded()`, `hasChildItems()`, `level()`, `isFocusVisibleWithin()`, `allowsDragging()`, `isDragging()`, `isDropTarget()`, `state`, `id`.

### TreeItemContent, TreeSection, TreeHeader, TreeLoadMoreItem

| Part | Props |
| --- | --- |
| `TreeItemContent` | `children`: content, or `(props: TreeItemContentRenderProps) => content`. Provides the `chevron` Button slot, the `selection` Checkbox slot and `SelectionIndicator`. |
| `TreeSection` | `id`, `value`, `aria-label`, `items` + item renderer (or static children), `class` (`rv-TreeSection`), `style`, `ref`, global DOM props (not `id` / `data-*`). |
| `TreeHeader` | `children`, `id`, `class` (`rv-TreeHeader`), `style`, `ref`, global DOM props. |
| `TreeLoadMoreItem` | `onLoadMore`, `isLoading` (boolean or accessor), `scrollOffset` (fraction of the viewport height, default `1`), `children` (loading content), `class` / `style` (value or function of `{ level }`, default `rv-TreeLoader`), global DOM props. |

`TreeContext` (props for the Trees inside a component, per `slot`), `TreeStateContext` (the `TreeState` of the enclosing Tree) and `TreeItemContentContext` (the row's render props) are exported for custom parts.

### Events

| Event | Fires |
| --- | --- |
| `onSelectionChange(keys)` | Selection changed (press, :kbd[Space], selection checkbox, :kbd[Ctrl]+:kbd[A], :kbd[Escape]). |
| `onExpandedChange(keys)` | A row expanded or collapsed (chevron, :kbd[ArrowRight] / :kbd[ArrowLeft], :kbd[Enter] on a plain row). |
| `onAction(key)` / item `onAction()` | Row action: :kbd[Enter], a click (toggle, nothing selected), double click (replace). |
| item hover events | Pointer enters / leaves a selectable or actionable row. |
| `TreeLoadMoreItem` `onLoadMore()` | The sentinel scrolled within `scrollOffset` of the viewport (again after each expand / collapse: handle repeated calls). |

## Content

### Dynamic items

Pass `items` and a renderer; render each item's children through a nested `Collection` inside its `TreeItem` (a recursive row component). `disabledKeys` disables rows by key; `renderEmptyState` shows when `items` is empty.

::example{id=tree-dynamic}

### Loading more rows

Put a `TreeLoadMoreItem` after the children of a row (or at the end of the tree). Its sentinel calls `onLoadMore` when it scrolls near the tree's viewport, and its children render while `isLoading`. This example pages a fake loader with [`createAsyncList`](../foundations/data.md#createasynclist).

::example{id=tree-load-more}

### Links

A `TreeItem` with `href` stays a `role="row"` (HTML does not allow a link row); it gets `data-href`, and a press or :kbd[Enter] opens the link from JavaScript. Inside a `RouterProvider` same-tab links go through its `navigate`. With selection on, `linkBehavior` decides: `action` (default) makes the link the row's action, `selection` makes a press select instead, `override` keeps the link and drops selection for that row. For a sidebar of links with a current route, use the [NavigationTree](navigation-tree.md).

::example{id=tree-links}

### Empty state

::example{id=tree-empty}

### Sections

`TreeSection` groups rows into a `role="rowgroup"`, labelled by a `TreeHeader` (or `aria-label` without one). Arrow keys move across sections.

```tsx
<Tree aria-label="Files">
  <TreeSection>
    <TreeHeader>Photos</TreeHeader>
    <TreeItem id="my-photos" textValue="My Photos">
      <TreeItemContent>My Photos</TreeItemContent>
    </TreeItem>
  </TreeSection>
  <TreeSection aria-label="Documents">…</TreeSection>
</Tree>
```

:::warning
`TreeSection` does not render on the server yet (its section node is captured by a resumable closure), so there is no live example here. It works in client-only renders.
:::

## Selection and expansion

`selectionMode="multiple"` with a `Checkbox slot="selection"` in each row gives checkbox selection; `selectedKeys` and `expandedKeys` as signals are written by the tree and by you.

::example{id=tree-selection}

With `selectionMode="single"` and `selectionBehavior="replace"`, a click selects the row and a double click (or :kbd[Enter]) runs `onAction`.

::example{id=tree-actions}

## Disabled rows

`disabledKeys` and `isDisabled` both disable. With `disabledBehavior="all"` the row is skipped by the keyboard and gets `aria-disabled` / `data-disabled`. With `disabledBehavior="selection"` it stays focusable and expandable but cannot be selected (no `aria-selected`).

::example{id=tree-disabled}

## Keyboard navigation

By default arrow keys move between rows and into a row's focusable children. Set `keyboardNavigationBehavior="tab"` when rows hold interactive content such as text fields: :kbd[Tab] moves into the row's children, and arrow keys, :kbd[Space] and letters edit the field instead of navigating, selecting or typeahead. Render the field from a function child of `TreeItemContent` (the content of a row is built in the collection pass first).

::example{id=tree-keyboard}

## DOM events and attributes

Every part takes the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`): `Tree` props land on the treegrid, `TreeItem` props on the row, `TreeSection` props on the rowgroup, `TreeLoadMoreItem` props on the loading row.

- The tree handles `onMouseDown` itself (your handler runs right after its own) plus the key, focus and blur events of the treegrid.
- A row handles `onPointerDown`, `onPointerUp`, `onPointerCancel`, `onPointerEnter`, `onPointerLeave` and `onDblClick` (yours chained after its own), `onDragStart`, and drops `onClick` (as RAC).

`on…Capture` handlers do not resume yet.

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-Tree` | treegrid | `class` |
| `.rv-Tree[data-focused]`, `[data-focus-visible]`, `[data-empty]` | tree focus; no rows | `focused:`, `data-focus-visible:`, `data-empty:` |
| `.rv-TreeItem[data-expanded]`, `[data-has-child-items]` | expanded / parent row | `data-expanded:`, `data-has-child-items:` |
| `.rv-TreeItem[data-level="2"]`, `var(--tree-item-level)` | depth | `data-[level=2]:`, `ps-[calc((var(--tree-item-level)-1)*1rem)]` |
| `.rv-TreeItem[data-selected]` | selected row | `data-selected:` |
| `.rv-TreeItem[data-disabled]` | disabled row | `data-disabled:` |
| `.rv-TreeItem[data-focused]`, `[data-focus-visible]` | focused row; keyboard-focused row | `focused:`, `data-focus-visible:` |
| `.rv-TreeItem[data-hovered]`, `[data-pressed]` | hovered / pressed row | `data-hovered:`, `data-pressed:` |
| `.rv-TreeSection`, `.rv-TreeHeader`, `.rv-TreeLoader` | section, header, loading row | `class` |

Indent rows with `--tree-item-level`, rotate the chevron icon from `isExpanded()` (or `[data-expanded]`). `class` / `style` replace the defaults (or compute them from the render props); the attributes stay. `@rivetjs/cdk/theme.css` styles `.rv-Tree` as a box and `.rv-TreeItem` rows like list options (selected, disabled, focus ring).

### Tailwind

::example{id=tree-tailwind}

### Plain CSS

::example{id=tree-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Tree` (`<div>`), `TreeItem` (`<div>`), `TreeSection` (`<div>`), `TreeHeader` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<Tree render={(props) => <div {...(props as {})} />}>…</Tree>
```

## Custom markup

`@rivetjs/cdk/tree/behaviour` is the layer `Tree` is built on (react-aria `useTree`, `useTreeItem`), over the grid-list behaviour:

| Export | What it does |
| --- | --- |
| `treeProps(props, state, hasTabbableChild?)` | `{ gridProps }`: the treegrid attributes (`role="treegrid"`). Wire the `gridList*` handlers of `@rivetjs/cdk/grid-list/behaviour` on the element. |
| `treeItemProps({ node, focusMode?, allowsArrowNavigation?, hasChildItems?, locale?, … }, state)` | `{ rowProps, gridCellProps, descriptionProps, expandButtonProps, isSelected, isDisabled, isFocused, … }`: row attributes; the chevron props (`id` `<row id>-chevron`, localized label). Row handlers: `gridListItem<Event>`. |
| `treeItemExpandPress(event, { node }, state, isDisabled?)` | The chevron's press: toggles the row and moves focus state to it. |

`state` is a grid-list view of a tree state (`createTreeState` from `@rivetjs/cdk/collections/tree-state`, react-stately `useTreeState`), rebuilt per event: read it in the handler, do not keep it.

## Accessibility

- `role="treegrid"` (single column) with `aria-multiselectable` for multiple selection. Name it with `aria-label` or `aria-labelledby`.
- Rows are `role="row"` with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` on parents and `aria-selected` when selectable; each row's content is one `role="gridcell"`.
- The chevron button is labelled "Expand" / "Collapse" plus the row; it is out of the tab order (expand with the keyboard via the arrow keys). Expandable rows need a `Button slot="chevron"` (dev warning otherwise).
- One tab stop: the tree until a row is focused, then the focused row.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[ArrowDown], :kbd[ArrowUp] | Next / previous visible enabled row. With `replace`, the selection follows. |
| :kbd[ArrowRight] | Collapsed parent: expand. Otherwise move into the row's focusable children. Mirrored in right-to-left text. |
| :kbd[ArrowLeft] | Expanded parent: collapse. Child row: move to the parent. |
| :kbd[Home], :kbd[End] | First / last row. |
| :kbd[PageDown], :kbd[PageUp] | One visible page down / up in a scrolling tree. |
| Letters | Typeahead on `textValue`. |
| :kbd[Space] | Select / toggle the focused row. |
| :kbd[Enter] | `onAction` or the link when set; else select (with selection) or expand / collapse (plain row). |
| :kbd[Shift]+arrow | Multiple: extend the selection. |
| :kbd[Ctrl]+:kbd[A] (:kbd[Cmd]+:kbd[A] on Mac) | Multiple: select all. |
| :kbd[Escape] | Clear the selection (unless `escapeKeyBehavior="none"`). |
| :kbd[Tab] | Leave the tree; with `keyboardNavigationBehavior="tab"`, move through the row's children. |

## Resumability

- The server renders the visible rows with their final `aria-expanded`, `aria-selected`, `aria-level` and tabindex; no Tree code runs before the first interaction.
- The collection is built from the content in a resumable `computed` (flattened by the expanded keys): expanding adds rows in place, resumed rows are adopted.
- Pass `items` as a `computed` or signal.
- Interactive row content (text fields, inputs) belongs in a function child of `TreeItemContent`: plain JSX passed as item props is evaluated in the collection build pass.
- `on…Capture` handlers do not resume yet.

Known issues: a conditionally rendered row (`{cond() && <TreeItem/>}`) is not added after resume (derive `items` instead); `TreeItem` `onAction` on :kbd[Enter] may not fire (use the Tree `onAction`); signals read inside nested row components during the collection build pass may not update; removing rows logs an error from the removed `TreeItem`; a row does not re-render when only its item's value changes.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Tree`, `TreeItem`, `TreeItemContent`, `TreeSection`, `TreeHeader`, `TreeLoadMoreItem`, `TreeContext`, `TreeStateContext`, `TreeItemContentContext` | RAC `Tree.tsx` |
| `@rivetjs/cdk/tree/behaviour` | react-aria `useTree`, `useTreeItem` |
| `@rivetjs/cdk/collections/tree-state` | react-stately `useTreeState` |
| `@rivetjs/cdk/tree/cdk`: `TreeKeyManager`, `TREE_KEY_MANAGER` | Angular CDK `TreeKeyManager` (`@angular/cdk/a11y`) |
| `@rivetjs/cdk/tree/cdk`: `FlatTreeControl`, `NestedTreeControl`, `BaseTreeControl` | Angular CDK tree controls (`@angular/cdk/tree`) |

### Angular CDK tree pieces

`@rivetjs/cdk/tree/cdk` holds the Angular CDK parts of the merged tree module, for trees you render yourself:

- `new TreeKeyManager(items, options)`: keyboard navigation over your own items (`TreeKeyManagerItem`: `activate`, `getParent`, `getChildren`, `isExpanded`, `expand`, `collapse`, `focus`, `unfocus`, optional `isDisabled`, `getLabel`, `makeFocusable`). :kbd[ArrowUp] / :kbd[ArrowDown] move, :kbd[ArrowRight] / :kbd[ArrowLeft] expand / collapse or move to the first child / parent (swapped with `horizontalOrientation: "rtl"`), :kbd[Home] / :kbd[End], :kbd[Enter] / :kbd[Space] activate, :kbd[*] expands all siblings, debounced typeahead (`typeAheadDebounceInterval`). Options: `shouldActivationFollowFocus`, `skipPredicate`, `trackBy`. Methods: `onKeydown(event)`, `focusItem(indexOrItem)`, `getActiveItem()`, `getActiveItemIndex()`, `destroy()`; `change` is a subject of the active item. `items` is an array, an accessor / signal or a subscribable. Create it in the browser (a handler or client effect). See [Key managers](../foundations/key-manager.md).
- `new FlatTreeControl(getLevel, isExpandable, options?)` / `new NestedTreeControl(getChildren, options?)`: expansion state over `dataNodes` (`expansionModel` is a `SelectionModel`): `expand`, `collapse`, `toggle`, `isExpanded`, `expandAll`, `collapseAll`, `expandDescendants`, `collapseDescendants`, `toggleDescendants`, `getDescendants`; `trackBy` (and `isExpandable` for nested).

Deviations:

- Render props are accessors; `class` is RAC `className`.
- The selection checkbox and the chevron ids derive from the row id (`<row id>-checkbox`, `<row id>-chevron`) so server HTML is byte-stable.
- No `FocusScope` wrapper; row `data-pressed` follows the row's own pointer and key handlers.

## Not yet supported

- Drag and drop (`dragAndDropHooks`, drop indicators, `Button slot="drag"`). Virtualized trees: `<CollectionVirtualizer layout={ListLayout}>` (see [Virtualizer](../foundations/virtualizer.md#collection-components)); `TreeLoadMoreItem` and `TreeSection` inside it are not covered yet.
- `dependencies` is accepted and ignored.
- `TreeSection` / `TreeHeader` in server-rendered pages (see [Sections](#sections)).
- Press events on items (`onPress*`); a row click does not stop propagation yet.

## Common mistakes

- **No `textValue`.** Every `TreeItem` needs one (typeahead and the accessible name).
- **No chevron.** An expandable row needs a `Button slot="chevron"`; without it screen reader users cannot expand it.
- **Changing a Set in place.** `expanded().add("a")` notifies nobody: `expanded.set(new Set([...expanded(), "a"]))`.
- **Duplicate keys across levels.** Keys identify rows in the whole tree, not per level.
- **Links as anchors.** Rows are never `<a>`; for client-side routing wrap the tree in a `RouterProvider` (or navigate from `onAction`).
