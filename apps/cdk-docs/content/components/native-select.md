---
title: NativeSelect
description: NativeSelect from @rivetjs/cdk is a native select as a field part of a TextField, with hover, focus and validation state attributes.
template: guide
status: experimental
related: [components/text-field, components/text-area, components/select, components/form]
---

`NativeSelect` renders a native `<select>` as the field part of a [TextField](text-field.md), built like the RAC [TextArea](text-area.md) part: the field provides the label link, `name`, value, validation and `aria-describedby`, and the select adds its own hover / focus state. Use it when the platform picker is the right choice (long option lists on mobile, no custom option content); for a styled listbox popup use [Select](select.md).

Rivet addition: React Aria Components and Angular CDK have no native select part. It is used by `@rivetjs/ui/native-select`.

::example{id=native-select-field}

## Anatomy

```html
<div class="rv-TextField">
  <label id="country-label" for="country" class="rv-Label">Country</label>
  <select id="country" name="country" required class="rv-NativeSelect" aria-describedby="country-description">
    <optgroup label="Europe">
      <option value="fr">France</option>
      <option value="de" selected>Germany</option>
    </optgroup>
  </select>
  <span id="country-description" slot="description" class="rv-Text">We ship to these countries.</span>
  <!-- FieldError: only while invalid -->
</div>
```

```tsx
<TextField>
  <Label />
  <NativeSelect>
    <NativeSelectOptGroup>
      <NativeSelectOption />
    </NativeSelectOptGroup>
  </NativeSelect>
  <Text slot="description" />
  <FieldError />
</TextField>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `TextField` | `div` | `rv-TextField` | Value, validation, root state attributes ([TextField anatomy](text-field.md#anatomy)). |
| `NativeSelect` | `select` | `rv-NativeSelect` | Id = the field `id`; `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-invalid`. |
| `NativeSelectOption` | `option` | none | `selected` follows the select's value. |
| `NativeSelectOptGroup` | `optgroup` | none | `label` is required. |
| `Label`, `Text slot="description"`, `FieldError` | | | As in TextField. |

## Import

```ts
import { NativeSelect, NativeSelectOption, NativeSelectOptGroup } from "@rivetjs/cdk/native-select";
import { TextField } from "@rivetjs/cdk/text-field";
import { Label } from "@rivetjs/cdk/label";
```

## Props

Field props (`value` / `defaultValue`, `onChange`, `name`, `isRequired`, `isDisabled`, `isInvalid`, `validate`, `validationBehavior`, …) are the [TextField props](text-field.md#props). Inside a TextField the select takes the field's textarea attributes; the text-only ones (`placeholder`, `maxLength`, `minLength`, `readOnly`, `autoCapitalize`, `autoCorrect`, `spellCheck`, `inputMode`, `enterKeyHint`) are dropped.

### NativeSelect

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `Content` | none | `NativeSelectOption` / `NativeSelectOptGroup` elements. |
| `value` | `string \| () => string` | none | Standalone use; inside a TextField the field's value wins. |
| other select attributes | `HTMLProps<"select">` | none | `multiple`, `size`, `disabled`, `aria-*`, …; values may be accessors. |
| `autoFocus` | `boolean` | `false` | |
| `class` | `string \| (rp) => string` | `rv-NativeSelect` | A value replaces the default class. |
| `style` | `object \| (rp) => object` | none | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<select>`; see [Render](#render). |
| `slot` | `string \| null` | none | |
| `ref` | `RefValue<HTMLSelectElement>` | none | |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | handlers | none | |

### NativeSelectOption

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string` | required | Submitted value, compared with the select's value. |
| `children` | `Content` | none | Option text. |
| other option attributes | `HTMLProps<"option">` | none | `disabled`, `label`, …; `selected` is set by the part. |
| `class` | `string` | none | |
| `ref` | `RefValue<HTMLOptionElement>` | none | |

### NativeSelectOptGroup

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `string` | required | Group heading. |
| `children` | `Content` | none | Options. |
| other optgroup attributes | `HTMLProps<"optgroup">` | none | `disabled`, … |
| `class` | `string` | none | |
| `ref` | `RefValue<HTMLOptGroupElement>` | none | |

### Render props

| Render prop | Type | Selector |
| --- | --- | --- |
| `isHovered` | `() => boolean` | `[data-hovered]` |
| `isFocused` | `() => boolean` | `[data-focused]` |
| `isFocusVisible` | `() => boolean` | `[data-focus-visible]` |
| `isDisabled` | `() => boolean` | `[data-disabled]` |
| `isInvalid` | `() => boolean` | `[data-invalid]` |

### Contexts

| Context | Value |
| --- | --- |
| `NativeSelectContext` | Props for the selects inside a component, optionally per `slot` (resumable `rv-native-select`). |
| `NativeSelectValueContext` | `{ value }` accessor the options compare with (resumable `rv-native-select-value`). |

## Value

The field owns the value: `value` (a two-way `Signal<string>` or a plain value with `onChange`) or `defaultValue`. The field updates on `input`, which a real pick fires together with `change`. HTML has no `<select value>` attribute, so the server marks the matching option `selected`; after load the `value` binding keeps the property in sync.

## Validation

As TextField: `isRequired` sets the native `required`, so an empty option value (`value=""`) is invalid; `validate`, `validationBehavior` (`native` / `aria`) and server errors from the [Form](form.md) work the same, with messages in `FieldError`.

## DOM events and attributes

Global DOM events and attributes set on the `TextField` land on its root `<div>`; the field's `input` / `change` / `invalid` / focus handlers land on the `<select>` (the field owns them and calls yours after its own). Select attributes go on `NativeSelect`.

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-TextField` | root; `[data-invalid]`, `[data-disabled]`, `[data-required]` |
| `.rv-NativeSelect` | the select; `[data-hovered]`, `[data-focused]`, `[data-focus-visible]`, `[data-invalid]`, `[data-disabled]` |

`appearance: none` removes the platform arrow; add your own indicator next to the select (with an icon library, not a text glyph).

## Render

`render` replaces the default `<select>` with your own element (React Aria Components `render`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return. `render` can be any function: inline, local or imported.

## Accessibility

- A native select labelled by `Label` (`for` = the select id); description and error via `aria-describedby`.
- Option lists, typeahead and the picker popup are the platform's.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[ArrowDown] / :kbd[ArrowUp] | Change the option (or open the picker, platform dependent). |
| :kbd[Space] / :kbd[Enter] | Open the picker. |
| :kbd[Tab] | Leaves the select. |

## Resumability

- The select works before code loads (it is native); the field's handlers resume on the first input or focus.
- Inside a TextField the page boots the runtime at idle only when something else asks for it: the field's slot ids are resolved during server rendering.

## Testing

As [TextField](text-field.md#testing), with `getByRole("combobox")` (single select) or `getByRole("listbox")` (`multiple` / `size > 1`); pick with `userEvent.selectOptions`, which fires `input` and `change`.

## Upstream

No upstream part: a Rivet addition built on the RAC TextField / TextArea field contract.

| Rivet | Closest upstream |
| --- | --- |
| `NativeSelect` | RAC `TextArea` (field part) on a native `<select>` |
