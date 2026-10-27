---
title: CellSwitch
description: "A switch laid out as a settings row: the label on the start, the switch on the end, and a press anywhere in the row toggles it."
template: reference
status: experimental
related: [components/switch, components/cell-slider, components/cell-select, components/item-card]
---

`CellSwitch` is a [Switch](/components/switch/) shaped as a settings cell. The whole row is the switch's label, so a press anywhere on it toggles the switch, and the focus ring moves from the track to the row. It takes every Switch prop: `isSelected` (a value or a two-way signal), `defaultSelected`, `onChange`, `isDisabled`, `name`, `value` and form validation.

## Usage

```tsx
import { CellSwitch } from "@rivetjs/ui/cell-switch";
```

::example{id=cell-switch-basic}

## Anatomy

```tsx
import { CellSwitch } from "@rivetjs/ui/cell-switch";

export default function Anatomy() {
  return (
    <CellSwitch>
      <CellSwitch.Trigger>
        <CellSwitch.Label>Wi-Fi</CellSwitch.Label>
        <CellSwitch.Control />
      </CellSwitch.Trigger>
    </CellSwitch>
  );
}
```

Shorthand: with no children, `label` and `description` build the same row, as in `<CellSwitch label="Wi-Fi" description="Connected to Home" />`.

Additional exported parts: `CellSwitch.Root`.

## Examples

### Controlled

::example{id=cell-switch-controlled}

### Disabled

::example{id=cell-switch-disabled}

### Feature Announcement

::example{id=cell-switch-feature-announcement}

### Secondary Group

::example{id=cell-switch-secondary-group}

### Settings Group

::example{id=cell-switch-settings-group}

### Variants

::example{id=cell-switch-variants}

## Styling Reference

### CSS Classes

- `.cell-switch` - The root (the Switch field). `.cell-switch--secondary` for the secondary variant.
- `.cell-switch__trigger` - The row (a `label`). Modifiers: `.cell-switch__trigger--default` (gray cell for pages) and `.cell-switch__trigger--secondary` (surface cell inside gray containers).
- `.cell-switch__label` - The leading text column.
- `.cell-switch__description` - The muted line from the `description` shorthand.
- `.cell-switch__control` - The switch track. `.cell-switch__control--secondary` keeps the unchecked track visible on a surface.

### Data Attributes

- `[data-slot]`: `switch`, `switch-content`, `cell-switch-label`, `cell-switch-description`, `switch-control`, `switch-thumb`.
- State, from Switch: `[data-selected]`, `[data-disabled]`, `[data-hovered]`, `[data-pressed]`, `[data-focus-visible]`.

## API Reference

See the [full module API](/api/rivetjs/ui/cell-switch/) for every named export and part prop type.

### CellSwitch

| Prop          | Type                       | Default     | Description                        |
| ------------- | -------------------------- | ----------- | ---------------------------------- |
| `variant`     | `"default" \| "secondary"` | `"default"` | Cell surface                       |
| `label`       | `Content`                  | -           | Shorthand (no children): the label |
| `description` | `Content`                  | -           | Shorthand: a muted line under it   |
| `class`       | `string`                   | -           | Additional CSS classes             |

Also takes every [Switch](/components/switch/) prop except `size`.

### CellSwitch.Trigger

The row: `Switch.Content` (a `label`). Takes Switch.Content props.

### CellSwitch.Label

The leading text (`span`). Takes `span` props and `class`.

### CellSwitch.Control

`Switch.Control`. With no children it renders the default `Switch.Thumb`.

## Accessibility

The row renders a native `input role="switch"` inside the label, so the label text names the switch and the description is read with it. Space toggles it from the keyboard.

## Related Components

- [Switch](/components/switch/): The base control.
- [CellSlider](/components/cell-slider/) and [CellSelect](/components/cell-select/): Other settings cells.
- [ItemCard](/components/item-card/): A row with an icon and a trailing control.
