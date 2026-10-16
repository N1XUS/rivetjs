---
title: CellSelect
description: "A settings-row select: the whole cell is the trigger, with the label on the left and the selected value and a chevron on the right."
template: reference
status: experimental
related: [components/select, components/cell-slider, components/inline-select]
---

`CellSelect` fits pickers into settings lists and preference panels. The cell is the trigger button: the label sits on the left, the selected value and a chevron on the right, and the list opens below, aligned to the end of the cell. It is built on the [cdk Select](site:cdk/components/select/) parts, so single and multiple selection, `value` / `defaultValue`, `onChange`, `disabledKeys`, `name` (form submission), keyboard and typeahead work as in [Select](/components/select/); the options are a [ListBox](/components/list-box/).

Accessibility: the trigger is a button with `aria-haspopup="listbox"`. `CellSelect.Label` renders a `span` inside it and names the trigger together with the value. Without a label, give the root an `aria-label`.

## Usage

```tsx
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ListBox } from "@rivetjs/ui/list-box";
```

::example{id=cell-select-basic}

## Anatomy

```tsx
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ListBox } from "@rivetjs/ui/list-box";

export default function Appearance() {
  return (
    <CellSelect defaultValue="system">
      <CellSelect.Trigger>
        <CellSelect.Label>Appearance</CellSelect.Label>
        <CellSelect.Value />
        <CellSelect.Indicator />
      </CellSelect.Trigger>
      <CellSelect.Popover>
        <ListBox>
          <ListBox.Item id="light" textValue="Light">
            Light
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="system" textValue="System">
            System
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </CellSelect.Popover>
    </CellSelect>
  );
}
```

`CellSelect.Value` shows the selected item's content (its `ListBox.ItemIndicator` is hidden there).

## Examples

### Shorthand

Give the root a `label` (or `items`) and only `CellSelect.Item` children: the trigger row (Label, Value, Indicator), the popover and the list are rendered for you with the compound form's markup. With `items`, `children` is a render function of one item. `CellSelect.Item` adds the selection indicator and takes its `textValue` from string children. Children do not switch the shorthand off: in the shorthand form they are the list content (the items, or the render function of one item), so `label` + children is the normal case and never warns.

`items` selects the shorthand form: compound parts next to `items` win and `items` is ignored, with a development warning. `CellSelect.Item` keeps a `{expr}` child live (the option text follows its signals); `items` is live too (appended / removed items update the open list). The form is decided once, at render: adding or removing `label` / `items` later does not switch it.

::example{id=cell-select-shorthand}

### Controlled

Pass a two-way `Signal` as `value`: the select writes each change, and writing the signal updates the cell. With `selectionMode="multiple"` the value is an array.

::example{id=cell-select-controlled}

### Custom Value

A function child of `CellSelect.Value` gets the value render props (`selectedText`, `selectedItems`, `isPlaceholder`, `state`). Use `selectedKeys(state)` from `@rivetjs/cdk/select` for the keys.

::example{id=cell-select-custom-value}

### Disabled

::example{id=cell-select-disabled}

### Font Family

::example{id=cell-select-font-family}

### Settings Group

::example{id=cell-select-settings-group}

### Variants

::example{id=cell-select-variants}

### Indicator

The default `CellSelect.Indicator` is a morph chevron: two CSS bars drawn like lucide `ChevronDown` that flatten into a line and fold up while the list is open (320 ms, the timing of apple.com's navigation chevron). It is CSS on the `data-open` attribute: no JavaScript, nothing plays on page load, and a toggle halfway reverses from the current shape. Reduced motion swaps it at once.

::example{id=cell-select-indicator}

Style hooks, on the CellSelect or any ancestor (Tailwind: `[--cell-select-indicator-size:20px]`):

| Variable | Default | |
| --- | --- | --- |
| `--cell-select-indicator-size` | `1rem` | Box size; the chevron scales with it |
| `--cell-select-indicator-stroke` | size / 12 | Bar thickness |
| `--cell-select-indicator-duration` | `var(--duration-morph-chevron)` (320 ms) | `0s` turns the morph off |

Theme tokens for every morph chevron: `--duration-morph-chevron`, `--ease-morph-chevron-open`, `--ease-morph-chevron-close`. Children replace the morph; a custom indicator rotates 180° while open, or animate it yourself with `.cell-select__indicator[data-open="true"]`.

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.cell-select` - The field wrapper.
- `.cell-select__trigger` - The cell (row button): hover, pressed, focus ring, disabled. Variants `.cell-select__trigger--default` (gray) / `.cell-select__trigger--secondary` (surface, for gray containers).
- `.cell-select__label` - The label on the left.
- `.cell-select__value` - The value on the right (truncated; `[data-placeholder]`).
- `.cell-select__indicator` - The chevron: the default one is a morph chevron (`.morph-chevron`, CSS bars); a custom child rotates while open.
- `.cell-select__popover` - Added to the vendored `.select__popover` look.

### CSS Variables

| Variable                 | Default                               | Description                   |
| ------------------------ | ------------------------------------- | ----------------------------- |
| `--cell-select-height`   | `calc(var(--spacing) * 11)`           | Cell height                   |
| `--cell-select-bg`       | `--default` / `--surface`             | Cell background (per variant) |
| `--cell-select-bg-hover` | `--default-hover` / `--surface-hover` | Hover background              |

### Data Attributes

- `[data-slot]`: `cell-select`, `cell-select-trigger`, `cell-select-label`, `cell-select-value`, `cell-select-default-indicator` (or `cell-select-indicator` with children), `cell-select-popover`.
- Trigger: `[data-hovered]`, `[data-pressed]`, `[data-focus-visible]`, `[data-disabled]`. Indicator: `[data-open]`. Value: `[data-placeholder]`.

## API Reference

### CellSelect

| Prop            | Type                                       | Default     | Description                                                                   |
| --------------- | ------------------------------------------ | ----------- | ----------------------------------------------------------------------------- |
| `variant`       | `"default"` \| `"secondary"`               | `"default"` | Cell color                                                                    |
| `value`         | `Key` \| `Signal<Key \| null>` (or arrays) | -           | Selection (controlled; Signal two-way)                                        |
| `defaultValue`  | `Key` \| `Key[]`                           | -           | Initial selection                                                             |
| `onChange`      | `(value) => void`                          | -           | Called when the selection changes                                             |
| `selectionMode` | `"single"` \| `"multiple"`                 | `"single"`  | Selection mode                                                                |
| `placeholder`   | `string`                                   | -           | Text while nothing is selected                                                |
| `disabledKeys`  | `Iterable<Key>`                            | -           | Options that cannot be picked                                                 |
| `isDisabled`    | `boolean`                                  | `false`     | Disables the cell                                                             |
| `name`          | `string`                                   | -           | Form field name (hidden select)                                               |
| `label`         | `Content`                                  | -           | Shorthand: the row label (with `label` or `items` the root renders the parts) |
| `items`         | `Iterable<T>`                              | -           | Shorthand: the list items; `children` is then a render function of one item   |
| `class`         | `string` \| render-prop function           | -           | Additional CSS classes                                                        |

::api{symbol="@rivetjs/ui/cell-select#CellSelectRootProps"}

### CellSelect.Item

`ListBox.Item` props (`id`, `textValue`, `isDisabled`, …) plus the item indicator; `textValue` defaults to string children.

### CellSelect.Popover

| Prop        | Type        | Default        | Description               |
| ----------- | ----------- | -------------- | ------------------------- |
| `placement` | `Placement` | `"bottom end"` | Position against the cell |

Takes the cdk `Popover` props.

### CellSelect.Indicator

`children` replace the morph chevron (rendered in a `span` with the indicator class; rotates while open). Style hooks: [Indicator](#indicator).

### CellSelect.Trigger / .Label / .Value

Take the cdk `Button` / `Label` / `SelectValue` props.

## Related Components

- [Select](/components/select/): A full form field select.
- [InlineSelect](/components/inline-select/): A select that flows with text.
- [CellSlider](/components/cell-slider/): A settings-row slider.
