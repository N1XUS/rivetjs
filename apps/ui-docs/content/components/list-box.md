---
title: ListBox
description: "A listbox displays a list of options and allows a user to select one or more of them."
template: reference
status: experimental
related: [components/header, components/label, components/description]
---

`ListBox` shows a list of options with optional single or multiple selection. It is the [cdk ListBox](site:cdk/components/listbox/); `ListBox.Item` (`@rivetjs/ui/list-box-item`) is a cdk `ListBoxItem` that provides its render props to `ListBox.ItemIndicator`, and `ListBox.Section` groups options under a [Header](header.md).

Notes:

- `class`, not `className`. Render props are accessors (`({ isSelected }) => isSelected() ? … : …`). `selectedKeys` takes a signal (two-way) or a value (controlled).
- The default item indicator is the lucide `Check` icon with the Rivet UI stroke-draw animation.
- Set `virtualized` for large lists; give the list a fixed height and set `initialSize` to its viewport size for the server window.
- `ListBox.Item` `render` renders a `div` (Rivet types the item attributes as `div`).

## Usage

```tsx
import { ListBox } from "@rivetjs/ui/list-box";
```

::example{id=list-box-default}

## Anatomy

```tsx
import { Description } from "@rivetjs/ui/description";
import { Header } from "@rivetjs/ui/header";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export default () => (
  <ListBox>
    <ListBox.Item>
      <Label />
      <Description />
      <ListBox.ItemIndicator />
    </ListBox.Item>
    <ListBox.Section>
      <Header />
      <ListBox.Item>
        <Label />
      </ListBox.Item>
    </ListBox.Section>
  </ListBox>
);
```

Additional exported parts: `ListBox.Root`.

## Examples

### With Disabled Items

::example{id=list-box-with-disabled-items}

### With Sections

::example{id=list-box-with-sections}

### Multi Select

::example{id=list-box-multi-select}

### Controlled

::example{id=list-box-controlled}

### Virtualization

Set `virtualized` to render a window of a large collection. `rowHeight` defaults to **36 px**, matching the default item's `min-h-9`. Set it explicitly for taller content or custom density. Give the ListBox a fixed height and set `initialSize={{ width, height }}` to its client box in pixels (default: 800 × 600). The opt-in styles remove container padding and size each item to its layout row.

::example{id=list-box-virtualized}

:::warning Resumed keyboard focus
On a resumed page, pressing End from the initial server window currently scrolls to the last option but can lose keyboard focus. This also affects direct CDK virtualizer composition; client-rendered lists support End normally.
:::

The virtualizer code loads only for virtualized lists. Ordinary lists retain their existing markup and rendering path. Options expose `aria-setsize` and `aria-posinset`; selection, typeahead, and Arrow / Home / End navigation operate on the full collection, including offscreen options.

For custom layout options, a ListBox inside the [cdk Virtualizer](site:cdk/foundations/virtualizer/#collection-components) with a `ListLayout` renders only the options in view (plus overscan and the focused option). The server renders the first window at `initialSize`. After the first scroll or focus move, the browser renders the rest as you scroll. Keyboard navigation scrolls offscreen options into view.

::example{id=list-box-virtualization}

### Custom Check Icon

::example{id=list-box-custom-check-icon}

### Render Function

::example{id=list-box-render-function}

### Item Morph

An iOS-style preview. Press and hold an item and it lifts out of the list into a panel (a preview card, settings, actions) over a dimmed page, then morphs back into its row when it closes. `@rivetjs/ui/item-morph` sits on the [cdk item morph](site:cdk/components/listbox/#item-morph).

```tsx
import { ItemMorph, itemMorphProps, useItemMorph } from "@rivetjs/ui/item-morph";

const preview = useItemMorph({ trigger: ["longPress", "contextMenu"] });

<ListBox aria-label="Contacts" selectionMode="single">
  <ListBox.Item id="bob" textValue="Bob" {...itemMorphProps(preview)}>Bob</ListBox.Item>
</ListBox>
<ItemMorph morph={preview}>{(key) => <ContactCard id={key()} />}</ItemMorph>
```

- One `useItemMorph(options)` per list. Spread `itemMorphProps(morph)` on every item and render one `<ItemMorph morph={morph}>`. Its child is a render function that gets the opening item's key, and nothing renders before a trigger.
- `trigger` sets what opens the panel. Pass one value or a list:
  - `"longPress"`: the default. A 500 ms hold (`threshold`). The row shrinks a little while held. A long press never selects the item or runs its action.
  - `"contextMenu"`: a right click, or a long press on touch screens.
  - `"press"`: the item's action, which suits lists without selection.
  - `"doubleClick"`.
  - `"none"`: the panel opens only through the controlled `openKey` (a value or a two-way signal).
- Keyboard: the ContextMenu key and Shift+F10 open the panel for every trigger except `"none"`. Arrow keys keep moving through the list.
- `onOpenChange(key | null)` reports opens and closes. `backdrop` is `"blur"` (default), `"opaque"` or `"transparent"`; `hideBackdrop` removes it. `panelClass` sets the panel's width.
- Closing: Escape, a press on the backdrop, `<ItemMorph.Close>` and `useItemMorphPanel().close()` all morph the panel back and return focus to the row.
- Accessibility: the panel is a `dialog` named by its row (or by `aria-label`). Focus moves to `[data-morph-autofocus]`, else to the first focusable element. The rest of the page is `inert` while the panel is open, and page scroll is locked.
- Motion: the house morph motion. It can be interrupted, and with reduced motion the panel opens and closes instantly.
- Resumed pages: nothing runs at load. The panel's code loads while the press is held, so it is ready by the threshold.

::example{id=list-box-item-morph-contacts}

A settings list (no selection) opens each row's settings in place with `trigger: "press"`:

::example{id=list-box-item-morph-settings}

## Customization

### Tailwind CSS

::example{id=list-box-custom-styles}

### Global CSS

To customize the ListBox component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .list-box {
    @apply rounded-lg border border-border bg-surface p-2;
  }

  .list-box-item {
    @apply rounded px-2 py-1 cursor-pointer;
  }

  .list-box-item--danger {
    @apply text-danger;
  }

  .list-box-item__indicator {
    @apply text-accent;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ListBox component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/list-box.css)):

#### Base Classes

- `.list-box` - Base listbox container
- `.list-box-item` - Individual listbox item
- `.list-box-item__indicator` - Selection indicator icon
- `.list-box-section` - Section container for grouping items

#### Variant Classes

- `.list-box--default` - Default variant styling
- `.list-box--danger` - Danger variant styling
- `.list-box-item--default` - Default item variant
- `.list-box-item--danger` - Danger item variant

#### State Classes

- `.list-box-item[data-selected="true"]` - Selected item state
- `.list-box-item[data-focus-visible="true"]` - Focused item state
- `.list-box-item[data-disabled="true"]` - Disabled item state
- `.list-box-item__indicator[data-visible="true"]` - Visible indicator state

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` on item
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on item
- **Selected**: `[data-selected="true"]` on item
- **Disabled**: `:disabled` or `[data-disabled="true"]` on item

## API Reference

See the [full module API](/api/rivetjs/ui/list-box/) for every named export and part prop type.

### ListBox

| Prop                  | Type                                                                 | Default     | Description                                                      |
| --------------------- | -------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `virtualized` | `boolean` | `false` | Render a window of the collection. Requires a fixed height. |
| `rowHeight` | `number` | `36` | Fixed virtual row height in pixels. |
| `initialSize` | `{ width: number; height: number }` | `{ width: 800, height: 600 }` | Server window viewport in pixels. |
| `aria-label`          | `string`                                                             | -           | Accessibility label for the listbox                              |
| `aria-labelledby`     | `string`                                                             | -           | ID of element that labels the listbox                            |
| `selectionMode`       | `"none" \| "single" \| "multiple"`                                   | `"single"`  | Selection behavior                                               |
| `selectedKeys`        | `Selection`                                                          | -           | Controlled selected keys                                         |
| `defaultSelectedKeys` | `Selection`                                                          | -           | Initial selected keys                                            |
| `onSelectionChange`   | `(keys: Selection) => void`                                          | -           | Handler called when selection changes                            |
| `disabledKeys`        | `Iterable<Key>`                                                      | -           | Keys of disabled items                                           |
| `onAction`            | `(key: Key) => void`                                                 | -           | Handler called when an item is activated                         |
| `variant`             | `"default" \| "danger"`                                              | `"default"` | Visual variant                                                   |
| `class`               | `string`                                                             | -           | Additional CSS classes                                           |
| `children`            | `Content`                                                            | -           | ListBox items and sections                                       |
| `render`              | `DOMRenderFunction<keyof JSX.IntrinsicElements, ListBoxRenderProps>` | -           | Overrides the default DOM element with a custom render function. |

### ListBox.Item

| Prop         | Type                                                                                                                                                                            | Default     | Description                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `id`         | `Key`                                                                                                                                                                           | -           | Unique identifier for the item                                   |
| `textValue`  | `string`                                                                                                                                                                        | -           | Text value for accessibility and typeahead                       |
| `isDisabled` | `boolean`                                                                                                                                                                       | `false`     | Whether this item is disabled                                    |
| `variant`    | `"default" \| "danger"`                                                                                                                                                         | `"default"` | Visual variant                                                   |
| `class`      | `string`                                                                                                                                                                        | -           | Additional CSS classes                                           |
| `children`   | `Content \| RenderFunction`                                                                                                                                                     | -           | Item content or render function                                  |
| `render`     | `(props: DetailedHTMLProps<LinkWithRequiredHref, HTMLAnchorElement> \| JSX.IntrinsicElements[keyof JSX.IntrinsicElements], renderProps: ListBoxItemRenderProps) => JSX.Element` | -           | Overrides the default DOM element with a custom render function. |

### ListBox.ItemIndicator

| Prop       | Type                        | Default | Description                                 |
| ---------- | --------------------------- | ------- | ------------------------------------------- |
| `class`    | `string`                    | -       | Additional CSS classes                      |
| `children` | `Content \| RenderFunction` | -       | Custom indicator content or render function |

### ListBox.Section

| Prop       | Type      | Default | Description                                |
| ---------- | --------- | ------- | ------------------------------------------ |
| `class`    | `string`  | -       | Additional CSS classes                     |
| `children` | `Content` | -       | Section content including Header and Items |

### Render Props

When using render functions with ListBox.Item or ListBox.ItemIndicator, these values are provided:

| Prop         | Type            | Description                       |
| ------------ | --------------- | --------------------------------- |
| `isSelected` | `() => boolean` | Whether the item is selected      |
| `isFocused`  | `() => boolean` | Whether the item is focused       |
| `isDisabled` | `() => boolean` | Whether the item is disabled      |
| `isPressed`  | `() => boolean` | Whether the item is being pressed |

### ListLayout

`ListLayout` and `CollectionVirtualizer` come from `@rivetjs/cdk/virtualizer`. The options go in the `CollectionVirtualizer`'s `layoutOptions`: `rowHeight` / `estimatedRowHeight`, `headingHeight` / `estimatedHeadingHeight`, `loaderHeight`, `gap`, `padding`. See the [cdk Virtualizer](site:cdk/foundations/virtualizer/#layouts) for the full list.

::api{symbol="@rivetjs/ui/item-morph#ItemMorphRootProps"}

::api{symbol="@rivetjs/ui/list-box#ListBoxRootProps"}

## Accessibility

The ListBox component implements the ARIA listbox pattern and provides:

- Full keyboard navigation support
- Screen reader announcements for selection changes
- Proper focus management
- Support for disabled states
- Typeahead search functionality

For more information, see the [cdk ListBox page](site:cdk/components/listbox/).

ARIA `listbox` with `option`s (`aria-selected`), keyboard navigation (arrows, Home / End, Page Up / Down), typeahead on `textValue`, sections as labelled `group`s.

## Related Components

- [Select](/components/select/): Dropdown select control.
- [ComboBox](/components/combo-box/): Text input with searchable dropdown list.
- [Avatar](/components/avatar/): Display user profile images.
- [Kbd](/components/kbd/): Keyboard key display.
- [Separator](/components/separator/): Visual divider between content.
- [Surface](/components/surface/): Base container surface.
- [Dropdown](/components/dropdown/): Context menu with actions and options.
