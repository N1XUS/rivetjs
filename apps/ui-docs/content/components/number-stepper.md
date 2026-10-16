---
title: NumberStepper
description: "A compact pill stepper for small counts: round minus / plus buttons around an editable value whose changed digits roll in."
template: reference
status: experimental
related: [components/number-field, components/slider]
---

`NumberStepper` adjusts small numbers such as guests, seats or quantities. The buttons step the value and turn off at the bounds, the value stays editable (type a number and press Enter), and only the characters that change roll in. It is the [cdk NumberField](site:cdk/components/number-field/), so every NumberField option works: bounds, step, `formatOptions`, locale, validation and form submission.

Accessibility: the value is the NumberField's text input (`aria-roledescription="Number field"`): arrow keys, Page Up / Down, Home / End and typing work as in NumberField, and screen readers announce the value. The animated display over it is `aria-hidden`. The buttons are labelled "Decrease" / "Increase" plus the field label. Give the root a `Label` or an `aria-label`.

## Usage

```tsx
import { NumberStepper } from "@rivetjs/ui/number-stepper";
```

::example{id=number-stepper-basic}

## Anatomy

```tsx
import { Label } from "@rivetjs/ui/label";
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export default function Quantity() {
  return (
    <NumberStepper defaultValue={1} minValue={0}>
      <Label>Quantity</Label>
      <NumberStepper.Group>
        <NumberStepper.DecrementButton />
        <NumberStepper.Value />
        <NumberStepper.IncrementButton />
      </NumberStepper.Group>
    </NumberStepper>
  );
}
```

`NumberStepper.Value` renders the real input with transparent text and a display above it, one span per character. A changed character is a new span that rolls in with a CSS animation; characters rendered by the server never animate, and with `prefers-reduced-motion` nothing moves. The display stays while the input has focus (a button press focuses it), so every step animates. The input's own text shows only while you edit it (typing, IME, moving the caret or clicking into the text); a step, Enter or leaving the field brings the display back, and the committed edit rolls in.

## Examples

### Shorthand

Rivet addition: without children, NumberStepper renders its Group with the decrement button, the value and the increment button. Use the parts for custom icons or a custom value display.

::example{id=number-stepper-shorthand}

### Guest Picker

::example{id=number-stepper-guest-picker}

### Controlled

Pass a two-way `Signal<number | null>` as `value`: the stepper writes each change, and writing the signal updates the display. A plain value such as `value={line().qty}` is controlled: the stepper shows the expression, follows every change of it, and `onChange` reports each step.

::example{id=number-stepper-controlled}

### Custom Icons

::example{id=number-stepper-custom-icons}

### Custom Value

`format(value)` replaces the displayed text (the input keeps the field's formatting for editing). A function child renders the display itself and gets `{ value, text }` accessors.

::example{id=number-stepper-custom-value}

### Disabled

::example{id=number-stepper-disabled}

### Min Max Values

::example{id=number-stepper-min-max}

### Reversed Layout

The parts render in the order you write them.

::example{id=number-stepper-reversed}

### Sizes

::example{id=number-stepper-sizes}

### With Custom Buttons

::example{id=number-stepper-custom-buttons}

### With Format Options

::example{id=number-stepper-format-options}

### With Label

::example{id=number-stepper-label}

### With Step

::example{id=number-stepper-step}

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.number-stepper` - The field (label, group, description, error). Sizes `.number-stepper--sm` / `--md` / `--lg`.
- `.number-stepper__group` - The pill; focus ring while the input has keyboard focus, invalid ring, disabled.
- `.number-stepper__button` (+ `.number-stepper__decrement-button` / `.number-stepper__increment-button`) - Round buttons; hover, pressed scale, focus ring, faded when disabled.
- `.number-stepper__value` - Wrapper of the input and the display.
- `.number-stepper__input` - The editable input (transparent text unless the value is being edited).
- `.number-stepper__display` - The animated display (`aria-hidden`).
- `.number-stepper__char` - One displayed character; `[data-roll]` on client-created ones plays the roll-in.

### CSS Variables

| Variable                       | Default (md) | Description                |
| ------------------------------ | ------------ | -------------------------- |
| `--number-stepper-height`      | `2.25rem`    | Pill height                |
| `--number-stepper-button`      | `1.75rem`    | Button size                |
| `--number-stepper-font-size`   | `--text-sm`  | Value text size            |
| `--number-stepper-value-width` | `3ch`        | Minimum width of the value |

### Data Attributes

- `[data-slot]`: `number-stepper`, `number-stepper-group`, `number-stepper-decrement-button`, `number-stepper-increment-button`, `number-stepper-value`, `number-stepper-input`, `number-stepper-display`, `number-stepper-char`.
- Root: `[data-disabled]`, `[data-invalid]`, `[data-readonly]`, `[data-required]`. Buttons: `[data-hovered]`, `[data-pressed]`, `[data-focus-visible]`, `[data-disabled]`. Value: `[data-editing]` while the text is being edited (raw input shown, display hidden).

## API Reference

### NumberStepper

| Prop            | Type                                 | Default | Description                             |
| --------------- | ------------------------------------ | ------- | --------------------------------------- |
| `size`          | `"sm"` \| `"md"` \| `"lg"`           | `"md"`  | Pill, button and text size              |
| `value`         | `number` \| `Signal<number \| null>` | -       | Value (controlled; a Signal is two-way) |
| `defaultValue`  | `number`                             | -       | Initial value (uncontrolled)            |
| `onChange`      | `(value: number) => void`            | -       | Called with the committed value         |
| `minValue`      | `number`                             | -       | Lower bound                             |
| `maxValue`      | `number`                             | -       | Upper bound                             |
| `step`          | `number`                             | `1`     | Step of the buttons and arrow keys      |
| `formatOptions` | `Intl.NumberFormatOptions`           | -       | Number formatting                       |
| `isDisabled`    | `boolean`                            | `false` | Disables the stepper                    |
| `name`          | `string`                             | -       | Form field name (hidden input)          |
| `class`         | `string` \| render-prop function     | -       | Additional CSS classes                  |

::api{symbol="@rivetjs/ui/number-stepper#NumberStepperRootProps"}

### NumberStepper.Value

| Prop           | Type                                        | Default | Description            |
| -------------- | ------------------------------------------- | ------- | ---------------------- |
| `format`       | `(value: number \| null) => string`         | -       | Displayed text         |
| `children`     | `Content` \| `({ value, text }) => Content` | -       | Custom display         |
| `class`        | `string` \| render-prop function            | -       | Classes of the input   |
| `wrapperClass` | `string`                                    | -       | Classes of the wrapper |

### NumberStepper.Group / .DecrementButton / .IncrementButton

Group takes the cdk `Group` props. The buttons take cdk `Button` props (the `slot` is fixed); `children` replace the default icon.

## Related Components

- [NumberField](/components/number-field/): A full-width numeric input with steppers.
- [Slider](/components/slider/): Pick a value on a track.
