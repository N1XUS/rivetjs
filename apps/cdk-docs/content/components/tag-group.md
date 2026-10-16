---
title: TagGroup
description: TagGroup from @rivetjs/cdk is a focusable list of labels, categories or filters with arrow-key navigation, selection, actions, links and removal.
template: guide
status: experimental
related: [components/overview, components/grid-list, components/listbox, foundations/selection, foundations/collections]
---

`TagGroup` renders a label, a `TagList` (`role="grid"`) of `Tag`s (`role="row"`), and optional description and error texts. It is a port of React Aria Components `TagGroup` / `TagList` / `Tag` on the react-aria `useTagGroup` / `useTag` hooks (which build on the GridList port). Tags can be selected, run an action, open a link or be removed with a remove button or :kbd[Delete]. The server HTML holds every tag with its `aria-selected` state; no TagGroup code runs before the first interaction.

::example{id=tag-group-basic}

## Anatomy

```html
<div id="sizes" class="rv-TagGroup">
  <span id="rv1" class="rv-Label">Size</span>
  <div id="rv0" role="grid" class="rv-TagList" aria-labelledby="rv1" aria-describedby="rv0-description rv0-error"
       aria-atomic="false" aria-relevant="additions" aria-live="off" tabindex="0">
    <div id="rv0-m" role="row" class="rv-Tag" data-key="m" data-collection="rv0" data-text-value="Medium" tabindex="0"
         aria-label="Medium" aria-selected="true" data-selected="true" data-selection-mode="single" data-allows-removing="true">
      <div role="gridcell" aria-colindex="1" style="display:contents">
        Medium
        <button type="button" id="rv2" slot="remove" aria-label="Remove" aria-labelledby="rv2 rv0-m">…</button>
      </div>
    </div>
  </div>
  <span id="rv0-description" slot="description" class="rv-Text">Extra large is sold out.</span>
</div>
```

```tsx
<TagGroup>
  <Label />
  <TagList>
    <Tag>
      <Button slot="remove" />
    </Tag>
  </TagList>
  <Text slot="description" />
  <Text slot="errorMessage" />
</TagGroup>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `TagGroup` | `div` | `rv-TagGroup` | Its `id` is the wrapper's; the grid gets a generated id (tag ids derive from it). Provides the label, description and error ids. |
| `Label` | `span` | `rv-Label` | From `@rivetjs/cdk/label`; names the grid (`aria-labelledby`). |
| `TagList` | `div[role=grid]` (`role=group` while empty) | `rv-TagList` | `aria-live="polite"` while focus is inside, else `off`; `data-empty`. |
| `Tag` | `div[role=row]` > `div[role=gridcell]` | `rv-Tag` | Id `<grid id>-<key>` (whitespace removed). The cell is `display: contents`. |
| `Button slot="remove"` | `button` | `rv-Button` | Gets the remove label ("Remove", labelled by itself and the tag), `isDisabled` for disabled tags, and the press that calls `onRemove`. |
| `Text slot="description"`, `Text slot="errorMessage"` | `span` | `rv-Text` | Describe the grid (`aria-describedby`). |
| Empty state | inside the grid | none | `renderEmptyState` content while the list has no tags. |

| Attribute | Where | Value |
| --- | --- | --- |
| `aria-multiselectable` | grid | `"true"` with `selectionMode="multiple"` |
| `aria-selected`, `data-selected` | tag | `aria-selected` `"true"` / `"false"` on selectable tags (absent with `selectionMode="none"` and on disabled tags), `data-selected="true"` when selected |
| `aria-disabled`, `data-disabled` | tag | `isDisabled`, `disabledKeys` |
| `data-focused`, `data-focus-visible` | grid, tag | focused element; with keyboard modality |
| `data-hovered`, `data-pressed` | tag | pointer over / pressing a selectable or actionable tag |
| `data-allows-removing` | tag | the TagGroup has `onRemove` |
| `data-selection-mode` | tag | `"single"` or `"multiple"` |
| `data-href`, `data-target`, `data-rel`, `data-download`, `data-ping`, `data-referrer-policy` | tag | link tags (the row is not an `<a>`) |
| `data-key` (+ `data-key-type="number"`), `data-collection`, `data-text-value` | tag | key, grid id, `textValue` |
| `tabindex` | grid, tag | grid `0`; every enabled tag `0` until one has been focused, then only the focused tag (roving) |
| `data-empty` | grid | no tags |

## Import

```ts
import { TagGroup, TagList, Tag, type Key, type Selection } from "@rivetjs/cdk/tag-group";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { Button } from "@rivetjs/cdk/button";
```

## Props

### TagGroup

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `Label`, `TagList`, `Text` parts | none | |
| `id` | `string` | none | On the wrapper `div`. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | Passed to the grid. Without them, a `Label` child names it. |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | |
| `selectionBehavior` | `"toggle" \| "replace"` | `"toggle"` | |
| `selectedKeys` | `Signal<Selection> \| Iterable<Key> \| "all"` | none | Controlled selection; a signal is written two-way. |
| `defaultSelectedKeys` | `Iterable<Key> \| "all"` | none | Initial selection (uncontrolled). |
| `onSelectionChange` | `(keys: Selection) => void` | none | |
| `disabledKeys` | `Iterable<Key>` | none | |
| `disabledBehavior` | `"all" \| "selection"` | `"all"` | |
| `disallowEmptySelection` | `boolean` | `false` | |
| `allowDuplicateSelectionEvents` | `boolean` | `false` | Fire `onSelectionChange` even when the keys did not change. |
| `shouldSelectOnPressUp` | `boolean` | `false` | |
| `onRemove` | `(keys: Set<Key>) => void` | none | Enables removal: remove buttons, :kbd[Delete] / :kbd[Backspace]. Remove the keys from your data. |
| `onAction` | `(key: Key) => void` | none | A press or :kbd[Enter] on a tag. |
| `escapeKeyBehavior` | `"clearSelection" \| "none"` | `"clearSelection"` | |
| `class`, `style` | `string`, style object or `(props) => style` | `rv-TagGroup` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `TagGroup`; see [Render](#render). |
| `slot`, `ref` | | | `TagGroupContext` slots. |
| global DOM props | `GlobalDOMAttributes` | none | On the wrapper `div`. |

### TagList

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `Tag` children, or `(item) => Tag` with `items` | none | |
| `items` | `Iterable<T> \| () => Iterable<T>` | none | Dynamic tags; each `Tag` gets the item's `id` (or `key`) and `value`. |
| `renderEmptyState` | `(props: TagListRenderProps) => content` | none | Shown while there are no tags; the grid becomes `role="group"`. |
| `idScope` | `Key` | none | Prefix of the item ids (`<idScope>:<id>`). |
| `dependencies` | `unknown[]` | none | RAC parity; ignored (signals re-render). |
| `class`, `style` | value or `(props: TagListRenderProps) => value` | `rv-TagList` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `TagList`; see [Render](#render). |
| `ref` | | | `TagListContext` provides props. |
| global DOM props | | none | On the grid; `onMouseDown` runs after the grid's own. |

`TagListRenderProps` (accessors): `isEmpty()`, `isFocused()`, `isFocusVisible()`, `state`.

### Tag

| Prop | Type | Notes |
| --- | --- | --- |
| `id` | `Key` | Defaults to the item's `id` / `key` inside `items`, else generated. |
| `textValue` | `string` | Accessible text (`aria-label` of the row); required when the children are not plain text (a dev warning says so). |
| `isDisabled` | `boolean` | |
| `onAction` | `() => void` | Runs before the TagGroup `onAction`. |
| `href`, `hrefLang`, `target`, `rel`, `download`, `ping`, `referrerPolicy`, `routerOptions` | | Link tag: a press opens it through the `RouterProvider` (or the browser). |
| `onFocus`, `onBlur`, `onFocusChange` | | The tag row itself gets / loses focus. |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | | |
| `onPressStart`, `onPressEnd`, `onPressChange`, `onPress`, `onPressUp` | | Chained with the row's press handling. |
| `children` | content, or `(props: TagRenderProps) => content` | See [Common mistakes](#common-mistakes) for the remove button. |
| `class`, `style` | value or function of the render props | Default `rv-Tag`. |
| global DOM props | | On the row. |

`TagRenderProps` (accessors unless noted): `id`, `isHovered()`, `isPressed()`, `isSelected()`, `isFocused()`, `isFocusVisible()`, `isDisabled()`, `selectionMode` (value), `selectionBehavior()`, `allowsRemoving` (value), `state`.

`Key` is `string | number`; `Selection` is `"all" | Set<Key>`.

### Events

| Event | Fires |
| --- | --- |
| `onSelectionChange(keys)` | A press, :kbd[Space], :kbd[Enter] (without an action), :kbd[Ctrl]+:kbd[A], :kbd[Escape]. |
| `onAction(key)` / tag `onAction()` | A press or :kbd[Enter] on a tag (with nothing selected in `toggle` mode). |
| `onRemove(keys)` | The remove button (that tag), :kbd[Delete] / :kbd[Backspace] on a tag (the whole selection when the tag is selected, else that tag). |
| tag focus / hover / press events | On that tag. |

## Content and removal

`TagList` takes static `Tag`s or `items` with a render function. Pair `items` with `createListData` from `@rivetjs/cdk/data` and remove the keys `onRemove` passes: a `<Button slot="remove">` inside a tag removes it, :kbd[Delete] and :kbd[Backspace] remove the focused tag (or the selection, when the focused tag is selected). Focus then moves to the next tag, the previous one, or the list. `renderEmptyState` shows while the list is empty.

::example{id=tag-group-removal}

## Selection

`selectionMode="single"` or `"multiple"` makes tags selectable; pass a `selectedKeys` signal to own the selection, or `defaultSelectedKeys`. Disabled tags (`isDisabled`, `disabledKeys`) are skipped by the arrow keys, are not tab stops and cannot be selected.

::example{id=tag-group-selection}

## Actions

`onAction` on the TagGroup (or on a `Tag`) runs on a press or :kbd[Enter]. Without `selectionMode` tags are not selectable, so every press is an action.

::example{id=tag-group-actions}

## Links

A `Tag` with `href` is a link: the row stays a `div[role="row"]` (a grid row cannot be an `<a>`) with `data-href` / `data-target`, and a press or :kbd[Enter] opens it through the `RouterProvider` when one is set, else with a native navigation. With a client-side router, prefer `onAction` and navigate yourself.

::example{id=tag-group-links}

## DOM events and attributes

Every part takes the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`): `TagGroup` props land on the wrapper `div`, `TagList` props on the grid, `Tag` props on the row.

The grid handles `onKeyDown`, `onFocusIn`, `onFocusOut` and `onMouseDown` itself (your `onMouseDown` runs after its own). A tag row handles `onPointerDown`, `onPointerUp`, `onPointerCancel`, `onClick`, `onDblClick`, `onPointerEnter`, `onPointerLeave`, `onKeyDown`, `onKeyUp` and `onDragStart`; your pointer and double-click handlers run after its own, `onClick` is reserved for the row's press. `on…Capture` handlers do not resume yet.

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-TagGroup`, `.rv-TagList`, `.rv-Tag` | wrapper, grid, tag | `class` |
| `.rv-TagList[data-empty]` | no tags | `data-empty:` |
| `.rv-Tag[aria-selected="true"]`, `[data-selected]` | selected tag | `aria-selected:`, `data-selected:` |
| `.rv-Tag[data-disabled]` | disabled tag | `data-disabled:` |
| `.rv-Tag[data-focused]`, `[data-focus-visible]` | focused tag; keyboard-focused tag | `focused:`, `data-focus-visible:` |
| `.rv-Tag[data-hovered]`, `[data-pressed]` | hovered / pressed tag | `data-hovered:`, `data-pressed:` |
| `.rv-Tag[data-allows-removing]` | removable tag | `data-allows-removing:` |
| `[slot="description"]`, `[slot="errorMessage"]` | texts | `[&_[slot=description]]:` |

`class` / `style` replace the default class names (or compute them from the render props); the attributes stay.

### Tailwind

::example{id=tag-group-tailwind}

### Plain CSS

::example{id=tag-group-css}

`@rivetjs/cdk/theme.css` styles `.rv-TagList` (wrapping row) and `.rv-Tag` (pill, selected, disabled, focus ring); the remove button and labels are yours.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `TagGroup` (`<div>`), `TagList` (`<div>`), `Tag` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<TagGroup render={(props) => <div {...(props as {})} />}>…</TagGroup>
```

## Custom markup

`@rivetjs/cdk/tag-group/behaviour` is the layer `TagGroup` is built on (react-aria `useTagGroup`, `useTag`), on top of `@rivetjs/cdk/grid-list/behaviour`:

| Export | What it does |
| --- | --- |
| `tagGroupOptions(props)` | The gridList options `useTagGroup` forces: `shouldFocusWrap`, `linkBehavior: "override"`, `keyboardNavigationBehavior: "tab"`. |
| `tagGroupKeyboardDelegate(state, el, direction)` | Horizontal `ListKeyboardDelegate` (right-to-left aware). |
| `tagGroupProps(props, state, isFocusWithin)` | Grid attributes: role `grid` / `group`, `aria-atomic`, `aria-relevant`, `aria-live`. |
| `tagProps(props, state)` | `{ rowProps, gridCellProps, removeButtonProps, allowsRemoving, isSelected, isDisabled, isFocused, … }`. |
| `tagKeyDown(e, props, state)` | Row keydown: the gridList item keys, then :kbd[Delete] / :kbd[Backspace] removal. |
| `tagRemove({ onRemove, node })` | The remove button press. |
| `tagFocus(e, props)`, `tagBlur(e, props)` | Tag focus events + the "Press Delete to remove tag." description (keyboard focus only). |

## Accessibility

- The list is a `role="grid"` of `role="row"` tags, each with one `role="gridcell"`; it is `role="group"` while empty. Name it with a `Label` (or `aria-label`); description and error texts describe it.
- `aria-live="polite"` while focus is inside, so screen readers announce added tags.
- A keyboard-focused removable tag is described by "Press Delete to remove tag." (localized).
- The remove button is labelled "Remove" plus the tag's name.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[ArrowRight], :kbd[ArrowLeft] | Next or previous enabled tag (wraps; mirrored in right-to-left text). |
| :kbd[ArrowDown], :kbd[ArrowUp] | Same as right / left. |
| :kbd[Home], :kbd[End] | First or last tag. |
| :kbd[Space] | Select or toggle the focused tag. |
| :kbd[Enter] | `onAction` when set, else select; links open. |
| :kbd[Delete], :kbd[Backspace] | `onRemove`: the selection when the focused tag is selected, else the focused tag. |
| :kbd[Ctrl]+:kbd[A] | Multiple: select all. |
| :kbd[Escape] | Clear the selection (unless `escapeKeyBehavior="none"`). |
| :kbd[Tab] | To the focused tag's remove button, then out of the list (tags use `keyboardNavigationBehavior="tab"`). |

## Resumability

- The server renders every tag with its final `aria-selected`, `aria-disabled`, `tabindex` and the remove button labels. No TagGroup code runs before the first interaction.
- Live collection: the handlers read the tags (`data-key`, `data-text-value`, `aria-disabled`, `data-href`) back from the grid's DOM, so no item model is serialized.
- `onRemove`, `onAction` and the other callbacks must be inline arrows or local functions. A `createListData` list resumes: its actions are resumable.
- `on…Capture` handlers do not resume yet.

## Testing

`@rivetjs/testing/user` has no TagGroup tester (React Aria has none either). The grid is a GridList for `user.createTester("GridList", { root: <the TagList element>, interactionType? })`: `getRows()`, `findRow({ indexOrText })`, `toggleRowSelection({ row })`, `triggerRowAction({ row })`. :kbd[Delete] removal is a plain `user.keyboard("{Delete}")` on a focused tag.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `TagGroup`, `TagList`, `Tag`, `TagGroupContext`, `TagListContext` | RAC `TagGroup.tsx` |
| `@rivetjs/cdk/tag-group/behaviour` | react-aria `useTagGroup`, `useTag` |
| keyboard, selection, focus restore | react-aria `useGridList`, `useGridListItem`, `useSelectableCollection`, `ListKeyboardDelegate`; react-stately `useListState` |

Deviations:

- Live collection: tags render in place; handlers read the collection from the DOM.
- Render props are accessors; `class` is RAC `className`.
- The remove description is attached while the tag has focus, not on every render.
- `TagGroupInternalContext` replaces RAC's `ListStateContext` + `useTagGroup` `hookData` for `onRemove`.
- The description and error ids are always in the server HTML `aria-describedby`, even when the `Text` is not rendered.
- `isEmpty` of static children is only known with `renderEmptyState` set.

## Not yet supported

- `SelectionIndicator` inside a `Tag`: RAC wraps the list in a `SharedElementTransition`, the port does not, so it throws.
- Tooltips on truncated tags.

## Common mistakes

- **Remove button inside a render-function child.** `<Tag>{({ isSelected }) => <>…<Button slot="remove" /></>}</Tag>` renders the button but it does not respond on a resumed page. Keep the button in plain children; style the selected state with `aria-selected:` / `group-aria-selected:`.
- **Forgetting to remove the keys.** `onRemove` only reports keys: delete them from your data (`list.remove(...keys)`).
- **No name.** Use a `Label` child or `aria-label`.
- **Non-text children without `textValue`.** The tag's accessible name comes from `textValue`.
- **Changing the Set in place.** Set a new Set on the `selectedKeys` signal.
