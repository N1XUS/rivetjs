---
title: CheckboxButtonGroup
description: "Checkbox options drawn as selectable cards, with an optional corner indicator, icon tile and description."
template: reference
status: experimental
related: [components/checkbox-group, components/radio-button-group, components/segment]
---

`CheckboxButtonGroup` shows several independent options (add-ons, notification channels, devices) as cards: the whole card is the click target, the selected card gets an accent border, and an optional indicator marks the state in the corner. Behaviour is the [cdk CheckboxGroup](site:cdk/components/checkbox-group/) with native inputs, so it works before any JavaScript loads and submits with plain forms.

## Usage

```tsx
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";
```

::example{id=checkbox-button-group-basic}

## Anatomy

```tsx
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export default function Options() {
  return (
    <CheckboxButtonGroup name="plan" defaultValue={["pro"]}>
      <Label>Plan</Label>
      <CheckboxButtonGroup.Item value="pro">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>…</CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Pro</Label>
          <Description>For growing teams</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
  );
}
```

Additional exported parts: `CheckboxButtonGroup.Root`.

## Examples

### Shorthand

Rivet addition: `label`, `description` and `errorMessage` render the group's Label, Description and FieldError; `items` (`{ value, label, description?, icon?, isDisabled? }[]`, live: a keyed list by `value`, so each `value` must be unique) renders one card per option (Indicator, optional ItemIcon, ItemContent with Label + Description). Explicit children win: next to children the shorthand props are ignored, with a development warning.

::example{id=checkbox-button-group-shorthand}

### Controlled

Pass a two-way `Signal<string[]>` as `value`: the group writes the new selection, and writing the signal moves it. `onChange` reports each change.

::example{id=checkbox-button-group-controlled}

### Custom Indicator

`Indicator` children replace the default mark (`data-custom` is set); a function child gets the item render props, so the mark can follow `isSelected()`.

::example{id=checkbox-button-group-custom-indicator}

### Disabled Group

::example{id=checkbox-button-group-disabled}

### Grid Layout

`layout="grid"` lays the cards out in equal columns (auto-fill, 12rem minimum); set your own `grid-cols-*` on `class` for a fixed count.

::example{id=checkbox-button-group-grid}

### Icon Cards

Stack the content with layout classes on the `Item` (`flex-col items-center text-center`) for icon-first cards.

::example{id=checkbox-button-group-icon-cards}

### No Indicator

Without an `Indicator` the accent border and ring alone mark the selection.

::example{id=checkbox-button-group-no-indicator}

### Render Prop Children

A function child of `Item` receives the render props (accessors such as `isSelected()`, `isHovered()`, `isFocusVisible()`) and renders the card content itself.

::example{id=checkbox-button-group-render-props}

### Subscription Plans

::example{id=checkbox-button-group-subscription-plans}

### With Icons

::example{id=checkbox-button-group-with-icons}

### With Ripple

Put a [`PressableFeedback.Ripple`](pressable-feedback.md#standalone-ripple) first in each item: it follows the card's own press, from the pointer, or from the centre when Space toggles the focused card (keyboard focus sits on the card's visually hidden input). Pressed cards also scale down slightly (`data-pressed`, none with reduced motion).

::example{id=checkbox-button-group-with-ripple}

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.checkbox-button-group` - The group. Modifiers `.checkbox-button-group--flex` (wrapping row) / `.checkbox-button-group--grid` (equal columns). The group `Label`, `Description` and `FieldError` span the full row.
- `.checkbox-button-group__field` - The item wrapper (stretches the card in its cell).
- `.checkbox-button-group__item` - The card (`label`): surface, border, hover tint, accent border + ring when selected, focus ring on keyboard focus, disabled.
- `.checkbox-button-group__indicator` - Corner mark (a box with a check icon); with custom children only positioned and tinted.
- `.checkbox-button-group__item-icon` - Leading icon tile; accent-soft on the selected card.
- `.checkbox-button-group__item-content` - Title + description column.

### Data Attributes

- `[data-slot]`: `checkbox-button-group`, `checkbox-button-group-field`, `checkbox-button-group-item`, `checkbox-button-group-indicator`, `checkbox-button-group-default-indicator`, `checkbox-button-group-item-icon`, `checkbox-button-group-item-content`.
- Card: `[data-selected]`, `[data-hovered]`, `[data-pressed]`, `[data-focus-visible]`, `[data-disabled]`, `[data-invalid]`. Indicator: `[data-custom]`. Group: `[data-disabled]`, `[data-invalid]`, `[data-required]`.

## API Reference

See the [full module API](/api/rivetjs/ui/checkbox-button-group/) for every named export and part prop type.

### CheckboxButtonGroup

| Prop           | Type                             | Default  | Description                                 |
| -------------- | -------------------------------- | -------- | ------------------------------------------- |
| `layout`       | `"flex"` \| `"grid"`             | `"flex"` | Card layout                                 |
| `value`        | `string[] \| Signal<string[]>`   | -        | Selection (controlled; a Signal is two-way) |
| `defaultValue` | `string[]`                       | -        | Initial selection (uncontrolled)            |
| `onChange`     | `(value: string[]) => void`      | -        | Called with the new selection               |
| `name`         | `string`                         | -        | Form field name                             |
| `isDisabled`   | `boolean \| (() => boolean)`     | `false`  | Disables every card                         |
| `isRequired`   | `boolean \| (() => boolean)`     | `false`  | Required (native validation)                |
| `isInvalid`    | `boolean \| (() => boolean)`     | `false`  | Invalid state                               |
| `class`        | `string` \| render-prop function | -        | Additional CSS classes                      |

### CheckboxButtonGroup.Item

| Prop         | Type                               | Default | Description                              |
| ------------ | ---------------------------------- | ------- | ---------------------------------------- |
| `value`      | `string`                           | -       | The item's value (required)              |
| `isDisabled` | `boolean`                          | `false` | Disables this card                       |
| `children`   | `Content` \| `(values) => Content` | -       | Parts, or a function of the render props |
| `class`      | `string` \| render-prop function   | -       | Classes of the card (`label`)            |
| `fieldClass` | `string`                           | -       | Classes of the field wrapper             |

### CheckboxButtonGroup.Indicator

`span` props and `class`; `children` (content or a function of the item render props) replace the default mark.

### CheckboxButtonGroup.ItemIcon / CheckboxButtonGroup.ItemContent

`span` props and `class`.

::api{symbol="@rivetjs/ui/checkbox-button-group#CheckboxButtonGroupRootProps"}

## Accessibility

the root is a `group` labelled by its `Label`; each card is a `label` around a visually hidden native checkbox, so Tab moves between cards, Space toggles the focused one, and the values submit with the form under `name`. An `ItemContent` `Description` describes its own input. Indicator and ItemIcon are decorative (`aria-hidden`).

## Related Components

- [CheckboxGroup](/components/checkbox-group/): The classic list of checkboxes.
- [RadioButtonGroup](/components/radio-button-group/): The same cards for a single choice.
- [Segment](/components/segment/): A compact segmented control for one choice.
