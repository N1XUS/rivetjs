---
title: RadioButtonGroup
description: "Radio options drawn as selectable cards, with an optional corner indicator, icon tile and description."
template: reference
status: experimental
related: [components/radio-group, components/checkbox-button-group, components/segment]
---

`RadioButtonGroup` shows one option out of a few (plan, delivery speed, payment method) as cards: the whole card is the click target, the selected card gets an accent border, and an optional indicator marks the state in the corner. Behaviour is the [cdk RadioGroup](site:cdk/components/radio-group/) with native inputs, so it works before any JavaScript loads and submits with plain forms.

Accessibility: the root is a `radiogroup` labelled by its `Label`; each card is a `label` around a visually hidden native radio sharing the group's `name`, so the group is one tab stop, arrow keys move the selection (disabled cards are skipped), and the value submits with the form. An `ItemContent` `Description` describes its own input. Indicator and ItemIcon are decorative (`aria-hidden`).

## Usage

```tsx
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";
```

::example{id=radio-button-group-basic}

## Anatomy

```tsx
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export default function Options() {
  return (
    <RadioButtonGroup name="plan" defaultValue={"pro"}>
      <Label>Plan</Label>
      <RadioButtonGroup.Item value="pro">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>…</RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Pro</Label>
          <Description>For growing teams</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
    </RadioButtonGroup>
  );
}
```

## Examples

### Shorthand

Rivet addition: `label`, `description` and `errorMessage` render the group's Label, Description and FieldError; `items` (`{ value, label, description?, icon?, isDisabled? }[]`, live: a keyed list by `value`, so each `value` must be unique) renders one card per option (Indicator, optional ItemIcon, ItemContent with Label + Description). Explicit children win: next to children the shorthand props are ignored, with a development warning.

::example{id=radio-button-group-shorthand}

### Delivery And Payment

::example{id=radio-button-group-delivery-and-payment}

### Subscription Plans

::example{id=radio-button-group-subscription-plans}

### Controlled

Pass a two-way `Signal<string | null>` as `value`: the group writes the new selection, and writing the signal moves it. `onChange` reports each change.

::example{id=radio-button-group-controlled}

### Custom Indicator

`Indicator` children replace the default mark (`data-custom` is set); a function child gets the item render props, so the mark can follow `isSelected()`.

::example{id=radio-button-group-custom-indicator}

### Disabled Group

::example{id=radio-button-group-disabled}

### Grid Layout

`layout="grid"` lays the cards out in equal columns (auto-fill, 12rem minimum); set your own `grid-cols-*` on `class` for a fixed count.

::example{id=radio-button-group-grid}

### Icon Cards

Stack the content with layout classes on the `Item` (`flex-col items-center text-center`) for icon-first cards.

::example{id=radio-button-group-icon-cards}

### No Indicator

Without an `Indicator` the accent border and ring alone mark the selection.

::example{id=radio-button-group-no-indicator}

### Render Prop Children

A function child of `Item` receives the render props (accessors such as `isSelected()`, `isHovered()`, `isFocusVisible()`) and renders the card content itself.

::example{id=radio-button-group-render-props}

### With Icons

::example{id=radio-button-group-with-icons}

### With Ripple

:::warning
Not ported yet: Rivet has no ripple effect (the same gap as Button's ripple). Pressed cards scale down slightly instead (`data-pressed`, none with reduced motion).
:::

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.radio-button-group` - The group. Modifiers `.radio-button-group--flex` (wrapping row) / `.radio-button-group--grid` (equal columns). The group `Label`, `Description` and `FieldError` span the full row.
- `.radio-button-group__field` - The item wrapper (stretches the card in its cell).
- `.radio-button-group__item` - The card (`label`): surface, border, hover tint, accent border + ring when selected, focus ring on keyboard focus, disabled.
- `.radio-button-group__indicator` - Corner mark (a radio dot); with custom children only positioned and tinted.
- `.radio-button-group__item-icon` - Leading icon tile; accent-soft on the selected card.
- `.radio-button-group__item-content` - Title + description column.

### Data Attributes

- `[data-slot]`: `radio-button-group`, `radio-button-group-field`, `radio-button-group-item`, `radio-button-group-indicator`, `radio-button-group-item-icon`, `radio-button-group-item-content`.
- Card: `[data-selected]`, `[data-hovered]`, `[data-pressed]`, `[data-focus-visible]`, `[data-disabled]`, `[data-invalid]`. Indicator: `[data-custom]`. Group: `[data-disabled]`, `[data-invalid]`, `[data-required]`.

## API Reference

### RadioButtonGroup

| Prop           | Type                                       | Default  | Description                                 |
| -------------- | ------------------------------------------ | -------- | ------------------------------------------- |
| `layout`       | `"flex"` \| `"grid"`                       | `"flex"` | Card layout                                 |
| `value`        | `string \| null \| Signal<string \| null>` | -        | Selection (controlled; a Signal is two-way) |
| `defaultValue` | `string`                                   | -        | Initial selection (uncontrolled)            |
| `onChange`     | `(value: string) => void`                  | -        | Called with the new selection               |
| `name`         | `string`                                   | -        | Form field name                             |
| `isDisabled`   | `boolean`                                  | `false`  | Disables every card                         |
| `isRequired`   | `boolean`                                  | `false`  | Required (native validation)                |
| `isInvalid`    | `boolean`                                  | `false`  | Invalid state                               |
| `class`        | `string` \| render-prop function           | -        | Additional CSS classes                      |

::api{symbol="@rivetjs/ui/radio-button-group#RadioButtonGroupRootProps"}

### RadioButtonGroup.Item

| Prop         | Type                               | Default | Description                              |
| ------------ | ---------------------------------- | ------- | ---------------------------------------- |
| `value`      | `string`                           | -       | The item's value (required)              |
| `isDisabled` | `boolean`                          | `false` | Disables this card                       |
| `children`   | `Content` \| `(values) => Content` | -       | Parts, or a function of the render props |
| `class`      | `string` \| render-prop function   | -       | Classes of the card (`label`)            |
| `fieldClass` | `string`                           | -       | Classes of the field wrapper             |

### RadioButtonGroup.Indicator

`span` props and `class`; `children` (content or a function of the item render props) replace the default mark.

### RadioButtonGroup.ItemIcon / RadioButtonGroup.ItemContent

`span` props and `class`.

## Related Components

- [RadioGroup](/components/radio-group/): The classic list of radio buttons.
- [CheckboxButtonGroup](/components/checkbox-button-group/): The same cards for several choices.
- [Segment](/components/segment/): A compact segmented control for one choice.
