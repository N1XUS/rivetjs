---
title: NativeSelect
description: "A styled native select field: the platform option list (mobile pickers, autofill, form submission) with the field look, label, description and validation."
template: reference
status: experimental
related: [components/select, components/text-field, components/form]
---

`NativeSelect` wraps a real `<select>`: the browser draws the option list, so it gets mobile pickers, type-ahead, autofill and plain form submission for free. Use it for short, simple choices in forms; use [Select](/components/select/) when options need custom content, search or multiple selection. The field is the [cdk TextField](site:cdk/components/text-field/) with the cdk `NativeSelect` part, so Label, Description, FieldError and Form validation work as for a text field.

Accessibility: the `<select>` keeps its native `combobox` role and keyboard handling. `Label` is linked with `for` / `id`; without a visible label pass `aria-label` on the root. Description and FieldError are referenced from `aria-describedby`; `isInvalid` or a failed validation sets `aria-invalid`. The indicator is decorative (`aria-hidden`, no pointer events).

## Usage

```tsx
import { NativeSelect } from "@rivetjs/ui/native-select";
```

::example{id=native-select-basic}

## Anatomy

```tsx
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export default function Field() {
  return (
    <NativeSelect name="size" defaultValue="m">
      <Label>Size</Label>
      <NativeSelect.Trigger indicator={<NativeSelect.Indicator />}>
        <NativeSelect.OptGroup label="Regular">
          <NativeSelect.Option value="m">Medium</NativeSelect.Option>
        </NativeSelect.OptGroup>
      </NativeSelect.Trigger>
      <Description>Fits true to size</Description>
      <FieldError />
    </NativeSelect>
  );
}
```

`NativeSelect.Trigger` is the positioned wrapper holding the `<select>` (its children are the options) and the indicator. An HTML `<select>` cannot contain anything but options, so the indicator is passed through the Trigger's `indicator` prop rather than as a child; the default is `<NativeSelect.Indicator />` (a chevron), `null` hides it.

## Examples

### Shorthand

Rivet addition: without children, `label`, `description`, `errorMessage` and `items` (`{ value, label, isDisabled? }[]`, live: a keyed list by `value`, so each `value` must be unique) render the Label, a Trigger with one Option per item, the Description and the FieldError, with the same markup and accessibility as the compound form. Use the parts for option groups or a custom indicator. Explicit children win: next to children the shorthand props are ignored, with a development warning.

::example{id=native-select-shorthand}

### Controlled

Pass a two-way `Signal<string>` as `value`: the select writes the picked value, and writing the signal changes the selection. `onChange` reports each pick.

::example{id=native-select-controlled}

### Indicator

The default `NativeSelect.Indicator` is a morph chevron: two CSS bars drawn like lucide `ChevronDown` that flatten into a line and fold up while the platform list is open (320 ms, the timing of apple.com's navigation chevron). It is CSS: no JavaScript, nothing plays on page load, and a toggle halfway reverses from the current shape. Reduced motion swaps it at once. A native `<select>` reports no open state to the page, so the chevron folds up only in browsers that match `select:open`; elsewhere it keeps pointing down.

::example{id=native-select-indicator}

Style hooks, on the NativeSelect or any ancestor (Tailwind: `[--native-select-indicator-size:20px]`):

| Variable | Default | |
| --- | --- | --- |
| `--native-select-indicator-size` | `1rem` | Box size; the chevron scales with it |
| `--native-select-indicator-stroke` | size / 12 | Bar thickness |
| `--native-select-indicator-duration` | `var(--duration-morph-chevron)` (320 ms) | `0s` turns the morph off |

Theme tokens for every morph chevron: `--duration-morph-chevron`, `--ease-morph-chevron-open`, `--ease-morph-chevron-close`. Children replace the morph (next section).

### Custom Indicator

::example{id=native-select-custom-indicator}

### Disabled Select

::example{id=native-select-disabled}

### Form Example

`name` submits the value with the form; `isRequired` with an empty first option uses native validation, and `FieldError` shows the browser message after a submit.

::example{id=native-select-form}

### Full Width

::example{id=native-select-full-width}

### Invalid State

::example{id=native-select-invalid}

### Variants

::example{id=native-select-variants}

### With Description

::example{id=native-select-description}

### With Disabled Options

::example{id=native-select-disabled-options}

### With Groups

::example{id=native-select-groups}

### With Label

::example{id=native-select-label}

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.native-select` - The field (label, trigger, description, error). Modifiers `.native-select--primary` / `.native-select--secondary`, `.native-select--full-width`.
- `.native-select__trigger` - The positioned wrapper around the select and the indicator; `.native-select__trigger--full-width`.
- `.native-select__select` - The `<select>` (`appearance: none`), styled like the Select trigger: hover, focus ring on keyboard focus, invalid ring, disabled.
- `.native-select__indicator` - The chevron over the select's inline end; the default one also has `.morph-chevron` (CSS bars).
- `.native-select__option`, `.native-select__optgroup` - Option colors (the list itself is drawn by the platform).

### Data Attributes

- `[data-slot]`: `native-select`, `native-select-trigger`, `native-select-select`, `native-select-indicator` / `native-select-default-indicator`, `native-select-option`, `native-select-optgroup`.
- Root: `[data-disabled]`, `[data-invalid]`, `[data-required]`. Select: `[data-hovered]`, `[data-focused]`, `[data-focus-visible]`, `[data-disabled]`, `[data-invalid]`.

## API Reference

### NativeSelect

| Prop                 | Type                                            | Default     | Description                                      |
| -------------------- | ----------------------------------------------- | ----------- | ------------------------------------------------ |
| `variant`            | `"primary"` \| `"secondary"`                    | `"primary"` | Field style                                      |
| `fullWidth`          | `boolean`                                       | `false`     | Stretch to the container                         |
| `value`              | `string` \| `Signal<string>`                    | -           | Selected value (controlled; a Signal is two-way) |
| `defaultValue`       | `string`                                        | -           | Initially selected value (uncontrolled)          |
| `onChange`           | `(value: string) => void`                       | -           | Called with the picked value                     |
| `name`               | `string`                                        | -           | Form field name                                  |
| `isRequired`         | `boolean`                                       | `false`     | Required (native validation)                     |
| `isInvalid`          | `boolean`                                       | `false`     | Invalid state                                    |
| `isDisabled`         | `boolean`                                       | `false`     | Disables the select                              |
| `validate`           | `(value: string) => string \| string[] \| null` | -           | Custom validation                                |
| `validationBehavior` | `"native"` \| `"aria"`                          | `"native"`  | Native constraint validation or ARIA-only        |
| `class`              | `string` \| render-prop function                | -           | Additional CSS classes                           |

::api{symbol="@rivetjs/ui/native-select#NativeSelectRootProps"}

### NativeSelect.Trigger

| Prop           | Type                             | Default                      | Description                                   |
| -------------- | -------------------------------- | ---------------------------- | --------------------------------------------- |
| `children`     | `Content`                        | -                            | `NativeSelect.Option` / `.OptGroup` elements  |
| `indicator`    | `Content` \| `null`              | `<NativeSelect.Indicator />` | Indicator next to the select; `null` hides it |
| `class`        | `string` \| render-prop function | -                            | Classes of the `<select>`                     |
| `wrapperClass` | `string`                         | -                            | Classes of the positioned wrapper             |

### NativeSelect.Indicator

`span` props and `class`; `children` replace the default morph chevron. Style hooks: [Indicator](#indicator).

### NativeSelect.Option

`<option>` props; `value` is required. `selected` follows the field value (server markup included).

### NativeSelect.OptGroup

`<optgroup>` props; `label` is required.

## Related Components

- [Select](/components/select/): Custom listbox popover with rich items and multiple selection.
- [TextField](/components/text-field/): The field wrapper NativeSelect is built on.
