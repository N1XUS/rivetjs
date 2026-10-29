---
title: ListBox
description: ListBox from @rivetjs/cdk is a list of options with single or multiple selection, sections, links, typeahead and range selection, rendered on the server.
template: guide
status: experimental
related: [components/overview, components/combobox, components/select, foundations/selection, foundations/collections]
---

`ListBox` renders a `role="listbox"` whose `ListBoxItem` children are `role="option"`s, optionally grouped into `ListBoxSection`s with a `Header`. The server HTML holds every option with its `aria-selected` state, so screen readers read it before any code loads. Keys go to the listbox: arrows move focus, :kbd[Space] selects, letters jump by typeahead. The selection is a `Signal<Selection>`: a `Set` of keys, or `"all"`.

::example{id=listbox-basic}

## Anatomy

```html
<div id="order" role="listbox" class="rv-ListBox" data-collection="order" aria-label="Order" aria-orientation="vertical"
     aria-multiselectable="true" tabindex="0" data-layout="stack" data-orientation="vertical"
     data-rk="ArrowDown ArrowUp Home End PageUp PageDown Space Enter">
  <section class="rv-ListBoxSection" role="group" aria-labelledby="rv0">
    <header id="rv0" role="presentation" class="rv-Header">Starters</header>
    <div id="order-option-soup" role="option" class="rv-ListBoxItem" data-key="soup" data-collection="order"
         data-text-value="Soup" aria-labelledby="order-option-soup-label" aria-describedby="order-option-soup-description"
         aria-selected="false" tabindex="-1" data-selection-mode="multiple">
      <span id="order-option-soup-label" slot="label" class="rv-Text">Soup</span>
      <span id="order-option-soup-description" slot="description" class="rv-Text">Tomato and basil</span>
    </div>
  </section>
  <div id="order-option-bread" role="option" class="rv-ListBoxItem" data-key="bread" data-collection="order"
       aria-selected="true" tabindex="-1" data-selected="true" data-selection-mode="multiple">Bread</div>
  <a id="order-option-help" role="option" class="rv-ListBoxItem" href="/help" data-key="help" data-collection="order"
     aria-selected="false" tabindex="-1" data-selection-mode="multiple">Help</a>
</div>
```

```tsx
<ListBox>
  <ListBoxItem />
  <ListBoxSection>
    <Header />
    <ListBoxItem>
      <Text slot="label" />
      <Text slot="description" />
      <SelectionIndicator />
    </ListBoxItem>
  </ListBoxSection>
  <ListBoxLoadMoreItem />
</ListBox>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `ListBox` | `div[role=listbox]` | `rv-ListBox` | `id` (generated unless set; option ids derive from it), `data-collection`, `data-layout`, `data-orientation`, `data-empty`, `data-focused`, `data-focus-visible`, `data-rk`. |
| `ListBoxSection` | `section[role=group]` | `rv-ListBoxSection` | Named by its `Header` (`aria-labelledby`) or by `aria-label`. |
| `Header` | `header[role=presentation]` | `rv-Header` | From `@rivetjs/cdk/header`. |
| `ListBoxItem` | `div[role=option]`, or `a[role=option]` with `href` | `rv-ListBoxItem` | Id `<listbox id>-option-<key>` (whitespace removed). |
| `Text slot="label"`, `Text slot="description"` | `span` | `rv-Text` | From `@rivetjs/cdk/text`; they name and describe the option (`aria-labelledby` / `aria-describedby`). |
| `ListBoxLoadMoreItem` | sentinel `div[inert]` + loading `div[role=option]` | `rv-ListBoxLoadingIndicator` | Calls `onLoadMore` when the sentinel scrolls into view. |
| Empty state | `div[role=option]` | none | `renderEmptyState` content while the collection is empty. |

| Attribute | Where | Value |
| --- | --- | --- |
| `aria-multiselectable` | listbox | `"true"` with `selectionMode="multiple"` |
| `aria-selected`, `data-selected` | option | `aria-selected` `"true"` / `"false"`, `data-selected="true"` when selected; both absent with `selectionMode="none"` |
| `aria-disabled`, `data-disabled` | option | disabled options (`isDisabled`, `disabledKeys`, with `disabledBehavior="all"`) |
| `data-focused`, `data-focus-visible` | listbox, option | the listbox element itself has focus (not focus within); the focused option; with keyboard modality |
| `data-hovered`, `data-pressed` | option | pointer over / pressing a selectable or actionable option |
| `data-selection-mode` | option | `"single"` or `"multiple"` |
| `data-key` (+ `data-key-type="number"` for number keys), `data-text-value` | option | the item key, the `textValue` |
| `tabindex` | listbox, option | listbox `0` until an option has been focused; then `0` on the focused option and `-1` on the others (roving); none on disabled options |
| `data-rk` | listbox | keys held while the code loads, so a cold arrow key does not scroll the page |

## Import

```ts
import { ListBox, ListBoxItem, ListBoxSection, ListBoxLoadMoreItem, type Key, type Selection } from "@rivetjs/cdk/listbox";
import { Header } from "@rivetjs/cdk/header";
import { Text } from "@rivetjs/cdk/text";
import { Collection } from "@rivetjs/cdk/collections/components";
```

## Props

### ListBox

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ListBoxItem` / `ListBoxSection` / `Collection` children, or `(item) => ListBoxItem` with `items` | none | Static parts, or the item renderer of `items`. |
| `items` | `Iterable<T> \| () => Iterable<T>` | none | Dynamic items; each `ListBoxItem` gets the item's `id` (or `key`) and `value`. Without `children`, items render as `ListBoxItem`s (`{ key, label, textValue?, disabled?, href? }`; sections `{ key, title?, children: [...] }`). |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | A listbox needs a name. |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | |
| `selectionBehavior` | `"toggle" \| "replace"` | `"toggle"` | `replace`: a press replaces the selection, focus moves the selection, :kbd[Ctrl] / :kbd[Cmd] adds. |
| `selectedKeys` | `Signal<Selection> \| Iterable<Key> \| "all"` | none | Controlled selection; a signal is written two-way. |
| `defaultSelectedKeys` | `Iterable<Key> \| "all"` | none | Initial selection (uncontrolled). |
| `onSelectionChange` | `(keys: Selection) => void` | none | |
| `disabledKeys` | `Iterable<Key>` | none | |
| `disabledBehavior` | `"all" \| "selection"` | `"all"` | `selection`: disabled options stay focusable and run actions, but cannot be selected. |
| `disallowEmptySelection` | `boolean` | `false` | |
| `onAction` | `(key: Key) => void` | none | :kbd[Enter], a click when nothing is selected (toggle), a double click (replace). |
| `shouldFocusWrap` | `boolean` | `false` | |
| `escapeKeyBehavior` | `"clearSelection" \| "none"` | `"clearSelection"` | |
| `shouldSelectOnPressUp` | `boolean` | `false` | |
| `shouldFocusOnHover` | `boolean` | `false` | |
| `disallowTypeAhead` | `boolean` (or accessor) | `false` | |
| `linkBehavior` | `"action" \| "selection" \| "override" \| "none"` | `"override"` (toggle), `"action"` (replace) | |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | |
| `layout` | `"stack" \| "grid"` | `"stack"` | `grid`: arrows follow the rendered rows and columns. |
| `autoFocus` | `boolean \| "first" \| "last"` | none | Focuses the listbox (or the first / last option) on mount. |
| `onFocus`, `onBlur`, `onFocusChange` | | none | Focus entering / leaving the listbox. |
| `renderEmptyState` | `(props: ListBoxRenderProps) => content` | none | |
| `class`, `style` | value or `(props: ListBoxRenderProps) => value` | `rv-ListBox` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ListBox`; see [Render](#render). |
| `slot`, `id`, `ref` | | | `ListBoxContext` slots. |
| global DOM props | `GlobalDOMAttributes` | none | See [DOM events and attributes](#dom-events-and-attributes). |

`ListBoxRenderProps`: `isEmpty()`, `isFocused()`, `isFocusVisible()`, `isDropTarget()`, `layout`, `orientation`, `state`.

### ListBoxItem

| Prop | Type | Notes |
| --- | --- | --- |
| `id` | `Key` | Defaults to the item's `id` / `key` inside `items`, else generated. |
| `value` | `T` | The item object (set inside `items`). |
| `textValue` | `string` | Typeahead text; required when the children are not a string. |
| `isDisabled` | `boolean` | |
| `href`, `hrefLang`, `target`, `rel`, `download`, `ping`, `referrerPolicy`, `routerOptions` | | Renders `<a role="option">`. |
| `aria-label` | `string` | |
| `onAction` | `() => void` | Runs before the ListBox `onAction`. |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | | |
| `onPressStart`, `onPressEnd`, `onPressChange`, `onPress`, `onPressUp`, `onClick` | | Chained with the option's press handling (keyboard presses call `onClick` with a synthetic click). |
| `onKeyDown`, `onKeyUp` | | `continuePropagation()` lets the listbox handle the key. |
| `children` | content, or `(props: ListBoxItemRenderProps) => content` | |
| `class`, `style` | value or function of the render props | Default `rv-ListBoxItem`. |
| global DOM props | | On the option element. |

`ListBoxItemRenderProps` (accessors): `isHovered()`, `isPressed()`, `isSelected()`, `isFocused()`, `isFocusVisible()`, `isDisabled()`, `selectionMode`, `selectionBehavior()`, plus `allowsDragging`, `isDragging()`, `isDropTarget()` (always false: no drag and drop yet).

### ListBoxSection, ListBoxLoadMoreItem

`ListBoxSection`: `id`, `aria-label`, `items` + item renderer (or static children), `class` (`rv-ListBoxSection`), `style`, global DOM props. `ListBoxLoadMoreItem`: `isLoading` (boolean or accessor), `onLoadMore`, `scrollOffset`, `children` (loading content), `class` (`rv-ListBoxLoadingIndicator`).

`Key` is `string | number`; `Selection` is `"all" | Set<Key>`.

### Events

| Event | Fires |
| --- | --- |
| `onSelectionChange(keys)` | The selection changed (press, :kbd[Space], :kbd[Enter] without an action, arrows with `replace`, :kbd[Ctrl]+:kbd[A], :kbd[Escape]). |
| `onAction(key)` / item `onAction()` | :kbd[Enter]; a click when the option cannot be selected or nothing is selected yet (toggle); a double click (replace). |
| item press / hover / key events | On that option, in RA order (`onPressStart` → `onPressEnd` → `onPress`, then `onClick`). |

## Selection modes

`none` keeps focus and typeahead but renders no `aria-selected`. `single` replaces the selection; pressing the selected option clears it unless `disallowEmptySelection`. `multiple` toggles, extends with :kbd[Shift], selects all with :kbd[Ctrl]+:kbd[A] (:kbd[Cmd]+:kbd[A] on Mac), and :kbd[Escape] clears.

::example{id=listbox-selection-modes}

## Selection behavior

With `toggle` (default) every press adds or removes. With `replace` the list behaves like a file list: a press replaces the selection, arrow keys move it, :kbd[Ctrl] / :kbd[Cmd]+click adds, :kbd[Shift] extends, and `onAction` moves to :kbd[Enter] and double click. On touch, a long press switches a `replace` list to `toggle` until the selection is empty.

::example{id=listbox-selection-behavior}

## Controlled and uncontrolled

Pass a `selectedKeys` signal to own the selection: the ListBox writes it, and writing it yourself (`chosen.set(new Set(["xl"]))`, `chosen.set("all")`) updates the options. Or pass `defaultSelectedKeys` and read changes from `onSelectionChange`.

::example{id=listbox-controlled}

## Disabled options

`isDisabled` on an item and `disabledKeys` both disable. With `disabledBehavior="all"` a disabled option is skipped by the keyboard, has no `tabindex` and gets `aria-disabled="true"`. With `disabledBehavior="selection"` it stays focusable (no `aria-disabled`) but cannot be selected.

::example{id=listbox-disabled}

## Events

::example{id=listbox-events}

## Sections and descriptions

`ListBoxSection` groups options under a `Header`. Inside an option, `Text slot="label"` and `Text slot="description"` name and describe it. Nest a `Collection items={…}` for dynamic options in a section.

::example{id=listbox-sections}

## Links

An item with `href` renders as `<a role="option">`. With `selectionMode="none"` it navigates on press and :kbd[Enter] (through the `RouterProvider` when one is set). With selection, `linkBehavior` decides: `override` (default with `toggle`: links are not selectable), `action` (default with `replace`: a press selects, :kbd[Enter] and double click follow the link), `selection`, `none`.

::example{id=listbox-links}

## Content and render props

`ListBoxItem` children may be a function of `ListBoxItemRenderProps`; read the accessors (`isSelected()`) inside JSX. Set `textValue` when the content is not a string. `renderEmptyState` shows while the collection is empty: pass `items` as a `computed` to filter.

::example{id=listbox-slots}

## Orientation and layout

::example{id=listbox-layout}

## Keyboard options

::example{id=listbox-keyboard}

## DOM events and attributes

Every part takes the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`: mouse, touch, pointer, scroll, wheel, animation and transition events with their `…Capture` forms, plus `dir`, `lang`, `hidden`, `inert`, `translate`, `data-*`): `ListBox` props land on the listbox, `ListBoxItem` props on the option, `ListBoxSection` props on the `section`.

The listbox handles `onPointerDown`, `onPointerUp`, `onPointerCancel`, `onClick`, `onDblClick`, `onMouseDown`, `onPointerOver`, `onPointerOut`, `onDragStart` and `onScroll` itself (delegated selection); your handler of the same name runs right after its own. Handlers on an option or a section run before the listbox's (the event bubbles to it).

::example{id=listbox-dom-events}

`on…Capture` handlers do not resume yet.

## Item morph

An item can lift out of the list into a panel, like an iOS context-menu preview. It is used for previews, inline settings and action sheets. `@rivetjs/cdk/morph/item` is Rivet-authored (no React Aria counterpart) and works on any element; it is built for ListBox, GridList and Menu items. The styled version is `@rivetjs/ui/item-morph` ([ui ListBox](site:ui/components/list-box/#item-morph)).

```tsx
import { ItemMorphPanel, closeItemMorph, createItemMorph, itemMorphProps } from "@rivetjs/cdk/morph/item";

const preview = createItemMorph({ trigger: ["longPress", "contextMenu"] });

<ListBox aria-label="Files">
  <ListBoxItem id="report" {...itemMorphProps(preview)}>report.pdf</ListBoxItem>
</ListBox>
<ItemMorphPanel morph={preview}>{(key) => <FilePreview id={key()} />}</ItemMorphPanel>
```

- `createItemMorph(options)` creates the state: plain data and signals, so it serializes and the handlers resume.
  - `trigger` (one value or a list):
    - `"longPress"`: the default. Hold for `threshold` ms (500). Moving more than 10 px, scrolling or releasing cancels.
    - `"contextMenu"`: a right click, or a long press on touch screens.
    - `"press"`: the item's action (`onAction`).
    - `"doubleClick"`.
    - `"none"`: the panel opens only through the controlled value.
  - `openKey`: the open item's key, `null` when closed (a value, a two-way Signal or an accessor). `onOpenChange(key | null)` reports changes.
  - `isDisabled`, plus motion `duration` / `friction`.
- `itemMorphProps(morph)` goes on every item: `data-rv-morph`, pointer, key and context-menu handlers. With a long press trigger it also adds `data-rv-long-press`, which makes the ListBox select that item on press up. At the threshold the long press cancels the item's press, so it never selects or runs the action.
- While held, the item gets `data-morph-holding` and `--morph-hold` (0 → 1, not under reduced motion); scale the row with them. 120 ms into the hold the panel renders hidden, so its resume chunks load before the threshold.
- `<ItemMorphPanel morph>` renders nothing until a trigger. Then it renders on the overlay layer:
  - a backdrop `[data-morph-backdrop]` (`backdropClass`, `hideBackdrop`);
  - a surface `[data-morph-surface]` (`class`; `data-open`, `data-morphing`, `--morph-progress`);
  - inside it, the panel `[data-morph-expanded]` (`panelClass`), whose children are a render function that gets the item's key.
- Motion: the surface morphs from the item's box to the panel's box. The panel is centred on the item, top-aligned with it, and kept 16 px inside the viewport. Its corner radius is `--morph-expanded-radius`. The morph can be interrupted, and reduced motion jumps.
- Keyboard: the ContextMenu key and Shift+F10 open the panel; other keys keep navigating the list. Escape, a press on the backdrop and `closeItemMorph(morph)` close it.
- Accessibility: the surface is a `dialog` (`aria-modal`) named by its item, or by `aria-label`. Focus moves to `[data-morph-autofocus]`, else the first tabbable, else the surface, and returns to the item on close. The rest of the page is `inert` and page scroll is locked.

::example{id=listbox-item-morph}

:::warning
Not supported: options get no `aria-haspopup` (ARIA does not allow it on `option`), there is no server-rendered open panel, and a mouse press on a GridList row still selects it on press down.
:::

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-ListBox` | listbox | `class` |
| `.rv-ListBox[data-focused]`, `[data-focus-visible]` | the listbox element has focus | `focused:`, `data-focus-visible:` |
| `.rv-ListBox[data-orientation="horizontal"]`, `[data-layout="grid"]`, `[data-empty]` | orientation, layout, empty | `orientation-horizontal:`, `data-[layout=grid]:`, `data-empty:` |
| `.rv-ListBoxItem[aria-selected="true"]` | selected option | `aria-selected:` |
| `.rv-ListBoxItem[aria-disabled="true"]` | disabled option | `aria-disabled:` |
| `.rv-ListBoxItem[data-focused]`, `[data-focus-visible]` | focused option; keyboard-focused option | `focused:`, `data-focus-visible:` |
| `.rv-ListBoxItem[data-hovered]`, `[data-pressed]` | hovered / pressed option | `data-hovered:`, `data-pressed:` |
| `.rv-ListBoxSection`, `.rv-Header` | section, header | `class` |
| `[slot="description"]` | description text | `[&_[slot=description]]:` |

`class` / `style` replace the default class names (or compute them from the render props); the attributes stay.

### Tailwind

::example{id=listbox-tailwind}

### Plain CSS

::example{id=listbox-css}

### Starter theme

`@rivetjs/cdk/theme.css` gives the listbox a border, options padding, an accent for `aria-selected`, dimmed disabled options, a horizontal and a grid layout, section headers and the description slot. Its rules use `:where(…)`, so any rule of yours wins.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ListBox` (`<div>`), `ListBoxSection` (`<section>`), `ListBoxItem` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<ListBox render={(props) => <div {...(props as {})} />}>…</ListBox>
```

## Custom markup

`@rivetjs/cdk/listbox/behaviour` is the layer `ListBox` is built on (react-aria `useListBox`, `useOption`, `useListBoxSection`):

| Export | What it does |
| --- | --- |
| `createListData(props, id, filter?, router?)` | The shared option data (RA `listData`): options plus the hover / press / focus signals the handlers write. |
| `listBoxProps(props, state, data)` | `{ listBoxProps, labelProps }`: listbox attributes (`tabIndex` is an accessor). |
| `optionProps({ key, isDisabled?, itemIsDisabled?, hasAction?, "aria-label"?, labelId?, descriptionId? }, state, data)` | `{ optionProps, isSelected, isDisabled, isFocused, isFocusVisible, isPressed, isHovered, allowsSelection, hasAction }` (accessors). |
| `listBoxSectionProps({ heading?, "aria-label"? })` | `{ itemProps, headingProps, groupProps }`. |
| `listBoxKeyDown`, `listBoxKeyUp`, `listBoxKeyDownCapture`, `listBoxPointerDown`, `listBoxPointerUp`, `listBoxPointerCancel`, `listBoxClick`, `listBoxDoubleClick`, `listBoxMouseDown`, `listBoxDragStart`, `listBoxFocusIn`, `listBoxFocusOut`, `listBoxPointerOver`, `listBoxPointerOut`, `listBoxVirtualFocus`, `listBoxClearVirtualFocus` | `(event, { data, orientation?, layout?, … }, state)` handlers to wire on the listbox element; they find the option from the event target. |
| `getItemId(listId, key)`, `listBoxLinkBehavior(selectionBehavior, linkBehavior?)`, `listBoxAutoFocus(root, props, state)` | Option id; the default link behaviour; autoFocus. |

The state is `createListState(props)` from `@rivetjs/cdk/collections/list-state` (react-stately `useListState`). Options must carry `data-key` and `data-collection` (the listbox id): the handlers read the collection from the rendered options.

::example{id=listbox-behaviour}

## Accessibility

- `role="listbox"` with `aria-multiselectable` for multiple selection and `aria-orientation`. Name it with `aria-label` or `aria-labelledby`.
- Each option is `role="option"` with `aria-selected` (absent in `none` mode) and `aria-disabled`; label and description `Text` slots name and describe it.
- Sections are `role="group"`, named by a `role="presentation"` header.
- One tab stop: the listbox until an option is focused, then the focused option. :kbd[Tab] leaves the list.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[ArrowDown], :kbd[ArrowUp] | Next or previous enabled option (vertical, and rows in a grid). Wraps with `shouldFocusWrap`. With `replace`, the selection follows. |
| :kbd[ArrowRight], :kbd[ArrowLeft] | The same with `orientation="horizontal"` or in a grid, mirrored in right-to-left text. |
| :kbd[Home], :kbd[End] | First or last enabled option. |
| :kbd[PageDown], :kbd[PageUp] | One visible page down or up in a scrolling list. |
| Letters | Typeahead on `textValue` / text content. |
| :kbd[Space] | Select the focused option (single) or toggle it (multiple). |
| :kbd[Enter] | `onAction` when set, else the same as :kbd[Space]. Links follow. |
| :kbd[Shift]+arrow, :kbd[Shift]+:kbd[Space] | Multiple: select the range from the anchor. |
| :kbd[Ctrl]+:kbd[A] (:kbd[Cmd]+:kbd[A] on Mac) | Multiple: select all (`"all"`). |
| :kbd[Escape] | Clear the selection (unless `escapeKeyBehavior="none"` or `disallowEmptySelection`). |
| :kbd[Ctrl]+arrow (:kbd[Option]+arrow on Mac) | Move focus without moving the selection (`replace`). |

## Resumability

- The server renders every option with its final `aria-selected`, `aria-disabled` and `tabindex`. No ListBox code runs before the first interaction; `data-rk` holds a cold navigation key so it does not scroll the page while the handler loads.
- The collection is built from the children or `items` (as React Aria builds it): the options render from it, and no item model is serialized: the browser rebuilds it from the same children on the first interaction.
- Option callbacks (`onAction`, press, hover, key events) are attached only when given.
- For derived `items`, pass a `computed` (or a signal).
- `on…Capture` handlers do not resume yet.

## Testing

`@rivetjs/testing/user` ships the ported `ListBoxTester` (React Aria test-utils): `user.createTester("ListBox", { root, interactionType?, layout? })`, then `getListbox()`, `getOptions()`, `getSections()`, `getSelectedOptions()`, `findOption({ indexOrText })`, `toggleOptionSelection({ option, … })` and `triggerOptionAction({ option, … })`.

```tsx
import { signal } from "@rivetjs/reactivity";
import { render } from "@rivetjs/runtime/testing";
import { User } from "@rivetjs/testing/user";
import { ListBox, ListBoxItem, type Key, type Selection } from "@rivetjs/cdk/listbox";

const picked = signal<Selection>(new Set<Key>());
render(() => (
  <ListBox id="fruit" aria-label="Fruit" selectionMode="multiple" selectedKeys={picked}>
    <ListBoxItem id="apple">Apple</ListBoxItem>
    <ListBoxItem id="banana">Banana</ListBoxItem>
  </ListBox>
));
const listbox = new User({ interactionType: "mouse" }).createTester("ListBox", { root: document.getElementById("fruit")! });
await listbox.toggleOptionSelection({ option: "Banana" });
expect([...(picked() as Set<Key>)]).toEqual(["banana"]);
```

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ListBox`, `ListBoxItem`, `ListBoxSection`, `ListBoxLoadMoreItem`, `ListBoxContext`, `ListStateContext` | RAC `ListBox.tsx` |
| `@rivetjs/cdk/listbox/behaviour` | react-aria `useListBox`, `useOption`, `useListBoxSection` |
| `@rivetjs/cdk/collections/list-state` | react-stately `useListState` |
| keyboard, typeahead, press | react-aria `useSelectableCollection`, `useSelectableList`, `useSelectableItem`, `useTypeSelect`, `ListKeyboardDelegate` |

Deviations:

- A parent state with its own built collection (Select, ComboBox) renders from that collection.
- One delegated handler set on the listbox runs every option's selectable-item / hover logic.
- Render props are accessors; `class` is RAC `className`.
- `items` preset: `<ListBox items={…} />` without children renders each item as a `ListBoxItem`.

## Not yet supported

- Drag and drop (`dragAndDropHooks`, drop indicators). Virtualized lists: `<CollectionVirtualizer layout={ListLayout}>` (see [Virtualizer](../foundations/virtualizer.md#collection-components)); sections render with their header (positions count per section). A ListBox in a Select / ComboBox / Autocomplete popover is not virtualized yet.
- `dependencies` is accepted and ignored.
- A dynamic function child (`{() => cond() ? <ListBoxItem/> : null}`) does not update: derive `items` instead.

## Common mistakes

- **Changing the Set in place.** `picked().add("apple")` notifies nobody. Set a new Set: `picked.set(new Set([...picked(), "apple"]))`. Check for `"all"` before spreading.
- **Duplicate or unstable keys.** Keys identify options in the DOM (`data-key`) and in the selection.
- **No name.** Pass `aria-label` or `aria-labelledby`.
- **No `selectionMode`.** The default is `"none"` (RAC): options focus but never select.
- **Buttons or links inside options.** An option is one control. Put actions next to the list, or use link items.
- **Using it as a dropdown.** A ListBox is always visible. For a field that opens a list, use the [Select](select.md) or the [ComboBox](combobox.md).
