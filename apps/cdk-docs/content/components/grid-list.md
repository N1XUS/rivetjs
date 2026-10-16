---
title: GridList
description: GridList from @rivetjs/cdk is a list of interactive rows (role grid) with selection, actions, links, sections, grid layouts and infinite loading.
template: guide
status: experimental
related: [components/overview, components/listbox, components/table, components/tag-group, foundations/selection, foundations/collections]
---

`GridList` renders a `role="grid"` whose `GridListItem` children are `role="row"`s with one `role="gridcell"` each. Unlike a [ListBox](listbox.md) option, a row may hold interactive content: a selection checkbox, buttons, text fields. It is a port of React Aria Components `GridList` on the react-aria `useGridList` / `useGridListItem` hooks: the same parts, props and render props. The server HTML holds every row with its `aria-selected` state; no GridList code runs before the first interaction.

::example{id=grid-list-basic}

## Anatomy

```html
<div id="plans" role="grid" class="rv-GridList" aria-label="Plans" tabindex="0" data-layout="stack" data-orientation="vertical">
  <div role="rowgroup" class="rv-GridListSection" data-type="section" data-key="plans-section" aria-labelledby="rv0">
    <div role="row" class="rv-GridListHeader" data-type="header">
      <div id="rv0" role="rowheader" style="display:contents">Plans</div>
    </div>
    <div id="plans-free" role="row" class="rv-GridListItem" data-key="free" data-collection="plans" data-text-value="Free"
         tabindex="-1" aria-label="Free" aria-labelledby="plans-free rv1" aria-selected="true" data-selected="true"
         data-selection-mode="single">
      <div role="gridcell" aria-colindex="1" style="display:contents">
        <label slot="selection">…<input type="checkbox" aria-label="Select" aria-labelledby="rv2 plans-free" /></label>
        <span class="rv-Text">Free</span>
        <span id="rv1" slot="description" class="rv-Text">1 project</span>
      </div>
    </div>
  </div>
</div>
```

```tsx
<GridList>
  <GridListItem>
    <Checkbox slot="selection" />
    <Text />
    <Text slot="description" />
  </GridListItem>
  <GridListSection>
    <GridListHeader />
    <GridListItem />
  </GridListSection>
  <GridListLoadMoreItem />
</GridList>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `GridList` | `div[role=grid]` | `rv-GridList` | `id` (generated unless set; row ids derive from it), `data-layout`, `data-orientation`, `data-empty`, `data-focused`, `data-focus-visible`. |
| `GridListItem` | `div[role=row]` > `div[role=gridcell]` | `rv-GridListItem` | Id `<grid id>-<key>` (whitespace removed). The cell is `display: contents`. |
| `Checkbox slot="selection"` | `label` + visually hidden `input` | `rv-Checkbox` | From `@rivetjs/cdk/checkbox` (`Checkbox` or `CheckboxField`): checked, labelled ("Select" + the row) and toggled by the row. |
| `Text`, `Text slot="description"` | `span` | `rv-Text` | The description joins the row's name (`aria-labelledby="<row> <description>"`). |
| `GridListSection` | `div[role=rowgroup]` | `rv-GridListSection` | Named by its `GridListHeader` or `aria-label`; `data-type="section"`, `data-key`. |
| `GridListHeader` | `div[role=row]` > `div[role=rowheader]` | `rv-GridListHeader` | `data-type="header"`. |
| `GridListLoadMoreItem` | sentinel `div[inert]` + loading `div[role=row]` | `rv-GridListLoadingIndicator` | Calls `onLoadMore` when the sentinel scrolls near the viewport. |
| Empty state | `div[role=row]` > `div[role=gridcell]` (both `display: contents`) | none | `renderEmptyState` content while the collection is empty. |

| Attribute | Where | Value |
| --- | --- | --- |
| `aria-multiselectable` | grid | `"true"` with `selectionMode="multiple"` |
| `aria-selected`, `data-selected` | row | `aria-selected` `"true"` / `"false"` on selectable rows (absent with `selectionMode="none"` and on disabled rows), `data-selected="true"` when selected |
| `aria-disabled`, `data-disabled` | row | disabled rows (`isDisabled`, `disabledKeys`) |
| `data-focused`, `data-focus-visible` | grid, row | focused element; with keyboard modality |
| `data-focus-visible-within` | row | keyboard focus on an element inside the row |
| `data-hovered`, `data-pressed` | row | pointer over / pressing a selectable or actionable row |
| `data-selection-mode` | row | `"single"` or `"multiple"` |
| `data-href`, `data-target`, `data-rel`, `data-download`, `data-ping`, `data-referrer-policy` | row | link rows (the row is not an `<a>`) |
| `data-key` (+ `data-key-type="number"`), `data-collection`, `data-text-value` | row | key, grid id, `textValue` |
| `tabindex` | grid, row | grid `0` until a row has been focused; then `0` on the focused row and `-1` on the others (roving) |
| `data-layout`, `data-orientation`, `data-empty` | grid | layout, orientation, no rows |

## Import

```ts
import { GridList, GridListItem, GridListSection, GridListHeader, GridListLoadMoreItem, type Key, type Selection } from "@rivetjs/cdk/grid-list";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { Text } from "@rivetjs/cdk/text";
import { Collection } from "@rivetjs/cdk/collections/components";
```

## Props

### GridList

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `GridListItem` / `GridListSection` / `Collection` children, or `(item) => GridListItem` with `items` | none | |
| `items` | `Iterable<T> \| () => Iterable<T>` | none | Dynamic rows; each `GridListItem` gets the item's `id` (or `key`) and `value`. |
| `idScope` | `Key` | none | Prefix of the item ids (`<idScope>:<id>`). |
| `dependencies` | `unknown[]` | none | RAC parity; ignored (signals re-render). |
| `id` | `string` | generated | |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | A grid needs a name. |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | |
| `selectionBehavior` | `"toggle" \| "replace"` | `"toggle"` | `replace`: a press replaces the selection, arrows move it, :kbd[Ctrl] / :kbd[Cmd] adds. |
| `selectedKeys` | `Signal<Selection> \| Iterable<Key> \| "all"` | none | Controlled selection; a signal is written two-way. |
| `defaultSelectedKeys` | `Iterable<Key> \| "all"` | none | Initial selection (uncontrolled). |
| `onSelectionChange` | `(keys: Selection) => void` | none | |
| `disabledKeys` | `Iterable<Key>` | none | |
| `disabledBehavior` | `"all" \| "selection"` | `"all"` | `selection`: disabled rows stay focusable and run actions, but cannot be selected. |
| `disallowEmptySelection` | `boolean` | `false` | |
| `allowDuplicateSelectionEvents` | `boolean` | `false` | |
| `escapeKeyBehavior` | `"clearSelection" \| "none"` | `"clearSelection"` | |
| `onAction` | `(key: Key) => void` | none | :kbd[Enter]; a press with nothing selected (toggle); a double click (replace). |
| `shouldFocusWrap` | `boolean` | `false` | |
| `shouldSelectOnPressUp` | `boolean` | `false` | |
| `disallowTypeAhead` | `boolean` (or accessor) | `false` | |
| `keyboardNavigationBehavior` | `"arrow" \| "tab"` | `"arrow"` (`"tab"` with `layout="grid"`) | How focus reaches the elements inside a row. |
| `layout` | `"stack" \| "grid"` | `"stack"` | `grid`: arrows follow the rendered rows and columns. |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | |
| `autoFocus` | `boolean \| "first" \| "last"` (or accessor) | none | Focuses the grid (or the first / last row) on mount. |
| `UNSTABLE_focusOnEntry` | `"first" \| "last"` | none | Row focused when tabbing in with no focused key. |
| `renderEmptyState` | `(props: GridListRenderProps) => content` | none | |
| `keyboardDelegate` | `KeyboardDelegate` | none | Replaces the default `ListKeyboardDelegate`. |
| `onScroll` | `(e: Event) => void` | none | |
| `dragAndDropHooks` | | none | Accepted and ignored (drag and drop not wired). |
| `class`, `style` | value or `(props: GridListRenderProps) => value` | `rv-GridList` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `GridList`; see [Render](#render). |
| `slot`, `ref` | | | `GridListContext` slots. |
| global DOM props | `GlobalDOMAttributes` | none | See [DOM events and attributes](#dom-events-and-attributes). |

`GridListRenderProps` (accessors unless noted): `isEmpty()`, `isFocused()`, `isFocusVisible()`, `isDropTarget()` (always false), `layout`, `orientation`, `state`.

### GridListItem

| Prop | Type | Notes |
| --- | --- | --- |
| `id` | `Key` | Defaults to the item's `id` / `key` inside `items`, else generated. |
| `value` | `T` | The item object (set inside `items`). |
| `textValue` | `string` | Typeahead text and the row's `aria-label`; set it when the children are not a string. |
| `aria-label` | `string` | |
| `isDisabled` | `boolean` | |
| `onAction` | `() => void` | Runs before the GridList `onAction`. |
| `focusMode` | `"row" \| "child"` | `child`: moving to the row focuses its first focusable child. Default `"row"`. |
| `allowsArrowNavigation` | `boolean` | Arrow keys inside the row even with `keyboardNavigationBehavior="tab"`. |
| `href`, `hrefLang`, `target`, `rel`, `download`, `ping`, `referrerPolicy`, `routerOptions` | | Link row. |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | | |
| `onPressStart`, `onPressEnd`, `onPressChange`, `onPress`, `onPressUp` | | Chained with the row's press handling. |
| `children` | content, or `(props: GridListItemRenderProps) => content` | |
| `class`, `style` | value or function of the render props | Default `rv-GridListItem`. |
| global DOM props | | On the row. |

`GridListItemRenderProps` (accessors unless noted): `id`, `isHovered()`, `isPressed()`, `isSelected()`, `isFocused()`, `isFocusVisible()`, `isFocusVisibleWithin()`, `isDisabled()`, `selectionMode` (value), `selectionBehavior()`, `state`, plus `allowsDragging`, `isDragging()`, `isDropTarget()` (always false: no drag and drop yet).

### GridListSection, GridListHeader, GridListLoadMoreItem

| Part | Props |
| --- | --- |
| `GridListSection` | `id`, `value`, `aria-label` (required without a `GridListHeader`), `items` + item renderer (or static children), `idScope`, `dependencies`, `class` (`rv-GridListSection`), `style`, `ref`, global DOM props. |
| `GridListHeader` | `id`, `children`, `class` (`rv-GridListHeader`), `style`, `ref`, global DOM props. |
| `GridListLoadMoreItem` | `isLoading` (boolean or accessor), `onLoadMore`, `scrollOffset` (fraction of the scroll body's height, default `1`), `children` (loading content, shown while `isLoading`), `class` (`rv-GridListLoadingIndicator`), `style`, global DOM props. |

`Key` is `string | number`; `Selection` is `"all" | Set<Key>`.

### Events

| Event | Fires |
| --- | --- |
| `onSelectionChange(keys)` | A press, :kbd[Space], :kbd[Enter] without an action, the selection checkbox, arrows with `replace`, :kbd[Ctrl]+:kbd[A], :kbd[Escape]. |
| `onAction(key)` / item `onAction()` | :kbd[Enter]; a press when nothing is selected (toggle) or the row is not selectable; a double click (replace). |
| `onLoadMore()` | The `GridListLoadMoreItem` sentinel came within `scrollOffset` of the viewport. |
| item press / hover events | On that row. |

## Content

`GridList` takes static `GridListItem`s, or `items` with a render function. Each row's content can be anything: text, a `Text slot="description"`, icons, buttons. This example keeps the items and the selection in `createListData` (`@rivetjs/cdk/data`): one button appends a card, another removes the selected cards.

::example{id=grid-list-dynamic}

### Infinite loading

Put a `GridListLoadMoreItem` after the rows (the rows in a `Collection items={…}`). Its sentinel calls `onLoadMore` as it scrolls within `scrollOffset` of the scroll container's viewport; its children show while `isLoading` is true.

::example{id=grid-list-load-more}

### Links

A row with `href` is a link: the row stays a `div[role="row"]` (a grid row cannot be an `<a>`) with `data-href` / `data-target`. With `selectionMode="none"` a press and :kbd[Enter] open it (through the `RouterProvider` when one is set). With selection, the link behaviour is `action`: a press selects, :kbd[Enter] or a double click (`replace`) opens the link.

::example{id=grid-list-links}

### Empty state

`renderEmptyState` renders inside the grid while the collection is empty; the grid gets `data-empty`. Derive `items` with a `computed` to filter.

::example{id=grid-list-empty}

### Sections

`GridListSection` groups rows into a `role="rowgroup"`; a `GridListHeader` renders a header row that names it, or pass `aria-label`. Arrow keys cross sections.

::example{id=grid-list-sections}

## Selection and actions

`selectionMode` enables single or multiple selection; pass a `selectedKeys` signal to own it, or `defaultSelectedKeys`. `onAction` handles row actions. With `selectionBehavior="toggle"` (default), a press runs the action while nothing is selected and toggles once something is; with `replace`, a press replaces the selection and :kbd[Enter] / double click run the action. Disabled rows are skipped by the keyboard and cannot be selected.

::example{id=grid-list-selection}

## Layouts

`layout="grid"` arranges rows in a CSS grid: arrow keys follow the rendered rows and columns (measured from the DOM), and `keyboardNavigationBehavior` becomes `"tab"`. `orientation="horizontal"` (with `layout="grid"`) makes left / right the primary direction, for a scrolling strip.

::example{id=grid-list-layout}

## Keyboard navigation

With `keyboardNavigationBehavior="arrow"` (default for stacks), :kbd[ArrowRight] / :kbd[ArrowLeft] move focus into and through the focusable elements of a row. With `"tab"`, :kbd[Tab] moves into a row's elements and arrows, typing and :kbd[Space] inside a text field stay in the field.

::example{id=grid-list-keyboard}

## DOM events and attributes

Every part takes the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`): `GridList` props land on the grid, `GridListItem` props on the row, `GridListSection` props on the rowgroup, `GridListHeader` props on the header row.

The grid handles `onKeyDown`, `onFocusIn`, `onFocusOut`, `onMouseDown` and `onScroll` itself (your `onMouseDown` / `onScroll` run after its own). A row handles `onPointerDown`, `onPointerUp`, `onPointerCancel`, `onClick`, `onDblClick`, `onPointerEnter`, `onPointerLeave`, `onKeyDown`, `onKeyUp` and `onDragStart`; your pointer and double-click handlers run after its own, `onClick` is reserved for the row's press. `on…Capture` handlers do not resume yet.

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-GridList` | grid | `class` |
| `.rv-GridList[data-focused]`, `[data-focus-visible]` | the grid element has focus | `focused:`, `data-focus-visible:` |
| `.rv-GridList[data-layout="grid"]`, `[data-orientation="horizontal"]`, `[data-empty]` | layout, orientation, empty | `data-[layout=grid]:`, `orientation-horizontal:`, `data-empty:` |
| `.rv-GridListItem[data-selected]`, `[aria-selected="true"]` | selected row | `data-selected:`, `aria-selected:` |
| `.rv-GridListItem[data-disabled]` | disabled row | `data-disabled:` |
| `.rv-GridListItem[data-focused]`, `[data-focus-visible]`, `[data-focus-visible-within]` | focused row; keyboard focus on / inside the row | `focused:`, `data-focus-visible:`, `data-focus-visible-within:` |
| `.rv-GridListItem[data-hovered]`, `[data-pressed]` | hovered / pressed row | `data-hovered:`, `data-pressed:` |
| `.rv-GridListSection`, `.rv-GridListHeader`, `.rv-GridListLoadingIndicator` | section, header, loading row | `class` |
| `[slot="description"]` | description text | `[&_[slot=description]]:` |

`class` / `style` replace the default class names (or compute them from the render props); the attributes stay.

### Tailwind

::example{id=grid-list-tailwind}

### Plain CSS

::example{id=grid-list-css}

`@rivetjs/cdk/theme.css` styles `.rv-GridList` (box, `[data-empty]` state), `.rv-GridListItem` (hover, selected, disabled, focus ring) and `.rv-GridListHeader`; layout (`layout="grid"` columns) and checkboxes are yours.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `GridList` (`<div>`), `GridListItem` (`<div>`), `GridListSection` (`<div>`), `GridListHeader` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<GridList render={(props) => <div {...(props as {})} />}>…</GridList>
```

## Custom markup

`@rivetjs/cdk/grid-list/behaviour` is the layer `GridList` (and `Tree`, `TagGroup`) is built on (react-aria `useGridList`, `useGridListItem`, `useGridListSection`, `useGridListSelectionCheckbox`):

| Export | What it does |
| --- | --- |
| `gridListProps(props, state, hasTabbableChild?)` | `{ gridProps }`: grid attributes (`tabIndex`, `aria-multiselectable`, labels). |
| `gridListItemProps(props, state)` | `{ rowProps, gridCellProps, descriptionProps, isSelected, isDisabled, isFocused, isPressed, allowsSelection, hasAction, … }`. |
| `gridListSectionProps(props)` | `{ rowGroupProps, rowProps, rowHeaderProps }`. |
| `gridListSelectionCheckboxProps(props, state)`, `gridListSelectionCheckboxChange(isSelected, props, state)` | The selection checkbox props and its change handler. |
| `gridListKeyDown`, `gridListKeyDownCapture`, `gridListFocus`, `gridListBlur`, `gridListMouseDown`, `gridListAutoFocus` | Grid handlers `(event, props, state)`. |
| `gridListItemKeyDown`, `gridListItemKeyDownCapture`, `gridListItemKeyUp`, `gridListItemFocus`, `gridListItemPointerDown`, `gridListItemPointerUp`, `gridListItemPointerCancel`, `gridListItemClick`, `gridListItemDoubleClick`, `gridListItemDragStart` | Row handlers `(event, props, state)`. |
| `gridListHighlightDescription(props, state)` | The long-press / highlight selection description text. |
| `listStateView(state, shared, root?)`, `treeStateView(state, shared)` | The react-stately state view the handlers read, built per event from a `createListState` / `createTreeState` state and the rows in the DOM. |
| `getRowId(state, key)`, `normalizeKey(key)` | Row id `<grid id>-<key>`. |
| `gridListItemsChanged(state, root, previous)` | Focused-key reset and focus restore after rows are removed. |

Rows must carry `data-key` and `data-collection` (the grid id): the handlers read the collection from the rendered rows.

## Accessibility

- `role="grid"` with `aria-multiselectable` for multiple selection. Name it with `aria-label` or `aria-labelledby`.
- Each row is `role="row"` with one `role="gridcell"`, `aria-selected` (absent in `none` mode) and `aria-disabled`; its name is `textValue` plus the description `Text`.
- Sections are `role="rowgroup"`, named by a header row (`role="rowheader"` cell) or `aria-label`.
- One tab stop: the grid until a row is focused, then the focused row.
- The selection checkbox is labelled "Select" + the row's name.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[ArrowDown], :kbd[ArrowUp] | Next or previous enabled row (rows of a grid layout). Wraps with `shouldFocusWrap`. With `replace`, the selection follows. |
| :kbd[ArrowRight], :kbd[ArrowLeft] | `arrow` behaviour: into / through the row's focusable elements and back to the row. Grid layout: next / previous column. Mirrored in right-to-left text. |
| :kbd[Home], :kbd[End] | First or last row. |
| :kbd[PageDown], :kbd[PageUp] | One visible page down or up in a scrolling list. |
| Letters | Typeahead on `textValue` (unless `disallowTypeAhead`). |
| :kbd[Space] | Select or toggle the focused row. |
| :kbd[Enter] | `onAction` when set, else select. Links open. |
| :kbd[Shift]+arrow, :kbd[Shift]+:kbd[Space] | Multiple: select the range from the anchor. |
| :kbd[Ctrl]+:kbd[A] (:kbd[Cmd]+:kbd[A] on Mac) | Multiple: select all. |
| :kbd[Escape] | Clear the selection (unless `escapeKeyBehavior="none"` or `disallowEmptySelection`). |
| :kbd[Tab] | `tab` behaviour: through the row's elements, then out of the grid. |

## Resumability

- The server renders every row with its final `aria-selected`, `aria-disabled` and `tabindex`, and the selection checkboxes checked. No GridList code runs before the first interaction.
- Live collection: handlers read `data-key`, `data-text-value`, `aria-disabled`, `data-href` back from the DOM, so no item model is serialized.
- Callbacks (`onAction`, `onSelectionChange`, `onLoadMore`, press / hover events) must be inline arrows or local functions. For derived `items`, pass a `computed` (or a signal).
- `GridListLoadMoreItem` observes its sentinel once the GridList code has loaded.
- `on…Capture` handlers do not resume yet.

## Testing

`@rivetjs/testing/user` ships the ported `GridListTester` (React Aria test-utils): `user.createTester("GridList", { root, interactionType?, layout? })`, then `getGridlist()`, `getRows()`, `getSelectedRows()`, `getCells({ element? })`, `findRow({ indexOrText })`, `toggleRowSelection({ row, checkboxSelection?, needsLongPress?, selectionBehavior? })` and `triggerRowAction({ row, needsDoubleClick? })`.

```tsx
import { signal } from "@rivetjs/reactivity";
import { render } from "@rivetjs/runtime/testing";
import { User } from "@rivetjs/testing/user";
import { GridList, GridListItem, type Key, type Selection } from "@rivetjs/cdk/grid-list";

const picked = signal<Selection>(new Set<Key>());
render(() => (
  <GridList id="pets" aria-label="Pets" selectionMode="multiple" selectedKeys={picked}>
    <GridListItem id="cat">Cat</GridListItem>
    <GridListItem id="dog">Dog</GridListItem>
  </GridList>
));
const grid = new User({ interactionType: "keyboard" }).createTester("GridList", { root: document.getElementById("pets")! });
await grid.toggleRowSelection({ row: "Dog" });
expect([...(picked() as Set<Key>)]).toEqual(["dog"]);
```

## Upstream

| Rivet | Upstream |
| --- | --- |
| `GridList`, `GridListItem`, `GridListSection`, `GridListHeader`, `GridListLoadMoreItem`, `GridListContext`, `GridListHeaderContext` | RAC `GridList.tsx` |
| `@rivetjs/cdk/grid-list/behaviour` | react-aria `useGridList`, `useGridListItem`, `useGridListSection`, `useGridListSelectionCheckbox` |
| state, keyboard | react-stately `useListState`; react-aria `useSelectableCollection`, `useSelectableItem`, `ListKeyboardDelegate` |

Deviations:

- Live collection: rows render in place and the handlers read the collection from the DOM.
- Render props are accessors; `class` is RAC `className`.
- `isEmpty` of static children is only known with `renderEmptyState` set; an empty grid is always tabbable (no `useHasTabbableChild`).
- The description / section heading ids are always set on the server (like React SSR), even without a description `Text`.
- No `FocusScope` and no `SharedElementTransition` around the rows.

## Not yet supported

- Drag and drop (`dragAndDropHooks`, drop indicators, `slot="drag"` button) and virtualized lists.
- Focus restore after the focused row is removed (`gridListItemsChanged` is wired in TagGroup only).
- `SelectionIndicator` inside a row: RAC wraps the rows in a `SharedElementTransition`, the port does not, so it throws.

## Common mistakes

- **Mixing `items` and static children.** `GridListLoadMoreItem` next to dynamic rows needs `<Collection items={…}>{renderer}</Collection>` as a sibling, not the `items` prop.
- **Changing the Set in place.** Set a new Set on the `selectedKeys` signal; check for `"all"` before spreading.
- **No name.** Pass `aria-label` or `aria-labelledby`.
- **Expecting left / right to move between rows of a stack.** In a stack, :kbd[ArrowRight] / :kbd[ArrowLeft] enter the row's elements; use `layout="grid"` for two-dimensional navigation.
- **Using it for a simple pick list.** Rows without interactive content are a [ListBox](listbox.md).
