---
title: Radio
description: "One labelled choice of a RadioGroup, as shorthand or composed parts, with a description, a render function and a disabled state."
template: reference
status: experimental
related: [components/radio-group, components/radio-button-group, components/checkbox]
---

`Radio` is one option of a [RadioGroup](/components/radio-group/): the user picks exactly one of the group's radios. The group holds the value, the name and the label; each `Radio` has its own `value`, its label and an optional description. It renders a native `<input type="radio">` (visually hidden) inside a styled control, from the cdk `RadioField` and `RadioButton` parts. For large, card-like choices use [RadioButtonGroup](/components/radio-button-group/).

## Usage

```tsx
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

<RadioGroup name="plan" label="Plan" defaultValue="pro">
  <Radio value="free" label="Free" />
  <Radio value="pro" label="Pro" description="Billed yearly" />
</RadioGroup>;
```

::example{id=radio-states}

## Anatomy

```tsx
<Radio value="express">
  <Radio.Content>
    <Radio.Control>
      <Radio.Indicator />
    </Radio.Control>
    Express
  </Radio.Content>
  <Description />
</Radio>
```

| Part | Element | Notes |
| --- | --- | --- |
| `Radio` (`Radio.Root`) | `div` | `data-slot="radio"`, class `radio`; `data-selected` / `data-disabled` follow its state. Takes `value`, `isDisabled`, and the `label` / `description` shorthand. |
| `Radio.Content` | `label` | The clickable area: wraps the hidden input, the control and the label text. |
| `Radio.Control` | `span` | The circle. |
| `Radio.Indicator` | `span aria-hidden` | The dot inside the circle; children (or a render function) replace it. |

Keep a `Description` or `FieldError` next to `Radio.Content`, not inside it: the field links it with `aria-describedby`.

## Examples

### Shorthand

Without children, `label` and `description` render the full composition (`Content` > `Control` > `Indicator` + label, then a `Description`). Children win over the shorthand (development builds warn when both are given). For a whole list, the group's `items` prop renders one shorthand `Radio` per entry: see [RadioGroup: Shorthand](/components/radio-group/#shorthand).

### Composed parts

Compose the parts for custom content in the label (icons, badges, two lines of text) or a custom indicator.

### Render function

`Radio` children can be a function of its state: `isSelected()`, `isDisabled()`, `isReadOnly()` and the others are accessors. In the example, the pickup option changes its description once it is selected.

### Disabled

`isDisabled` on one `Radio` disables that choice only (`data-disabled`, native `disabled` on the input); `isDisabled` on the group disables all of them.

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.radio` | Root (`data-slot="radio"`). |
| `.radio__content` | Label (`data-slot="radio-content"`). |
| `.radio__control` | Circle (`data-slot="radio-control"`). |
| `.radio__indicator` | Dot (`data-slot="radio-indicator"`). |
| `[data-selected]`, `[data-disabled]`, `[data-readonly]`, `[data-invalid]` | State on the root. |
| `[data-hovered]`, `[data-pressed]`, `[data-focused]`, `[data-focus-visible]` | Interaction state on `Radio.Content`. |

## API Reference

See the [full module API](/api/rivetjs/ui/radio/) for every named export and part prop type.

::api{symbol="@rivetjs/ui/radio#RadioContentProps"}

::api{symbol="@rivetjs/ui/radio#RadioControlProps"}

::api{symbol="@rivetjs/ui/radio#RadioIndicatorProps"}

::api{symbol="@rivetjs/ui/radio#RadioRootProps"}

## Accessibility

- Each radio is a native `input type="radio"` inside a `label`, so a click on the text selects it and screen readers read the label.
- :kbd[Tab] enters the group at the selected radio; :kbd[ArrowDown] / :kbd[ArrowRight] and :kbd[ArrowUp] / :kbd[ArrowLeft] move and select within the group (disabled radios are skipped), :kbd[Space] selects the focused radio.
- Name the group with its `Label` (or `label`), and give each radio visible text. The indicator is decorative.

## Common mistakes

- **A Radio outside a RadioGroup.** The value, the name and the keyboard behaviour come from the group; a lone `Radio` has nothing to select into.
- **Two radios with the same `value`.** The group stores one value; radios that share it are selected and cleared together.
- **The description inside `Radio.Content`.** It then becomes part of the label; put it next to the content.

## Related Components

- [RadioGroup](/components/radio-group/)
- [RadioButtonGroup](/components/radio-button-group/)
- [Checkbox](/components/checkbox/)
