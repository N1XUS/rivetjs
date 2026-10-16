---
title: Label, Text and FieldError
description: Label, Text and FieldError are the RAC field parts the field components fill through contexts; fieldProps / describedBy give the ids for a custom field.
template: guide
status: experimental
related: [components/text-field, components/form, components/checkbox, components/radio-group]
---

The field components ([TextField](text-field.md), [CheckboxGroup](checkbox-group.md), [Switch](switch.md), [RadioGroup](radio-group.md)…) are composed from parts: `<TextField><Label/><Input/><Text slot="description"/><FieldError/></TextField>`. The field provides each part's context (`LabelContext`, `InputContext`, `TextContext` slots, `FieldErrorContext`), so the parts get their ids, `for`, and the validation without props. For a field built from your own input, use the same parts with `fieldProps` ids and provide `FieldErrorContext` yourself.

::example{id=field-custom}

## Anatomy

```html
<label id="slug-label" for="slug" class="rv-Label">Slug</label>
<input id="slug" aria-labelledby="slug-label" aria-describedby="slug-description" />
<span id="slug-description" slot="description" class="rv-Text">Used in the page URL.</span>
<!-- only while invalid -->
<span id="slug-error" slot="errorMessage" class="rv-FieldError">Lowercase letters and dashes only.</span>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `Label` | `label` (or `elementType`) | `rv-Label` | Props merged with `LabelContext`. Use `elementType="span"` for an element a `<label>` cannot name (a group). |
| `Text` | `span` (or `elementType`) | `rv-Text` | `slot` picks the `TextContext` slot (`description`, `errorMessage`) and renders as the `slot` attribute. |
| `FieldError` | `span` (or `elementType`) | `rv-FieldError` | Renders `<Text slot="errorMessage">`; renders nothing while the field is valid. |

## Import

```ts
import { Label, LabelContext, Text, TextContext, fieldProps, labelProps, labelsProps, describedBy } from "@rivetjs/cdk/label";
import { FieldError, FieldErrorContext, type FieldErrorProps, type FieldErrorRenderProps } from "@rivetjs/cdk/form";
import { getValidationResult, DEFAULT_VALIDATION_RESULT, type ValidationResult } from "@rivetjs/cdk/state/form-validation";
```

## Props

### FieldError

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content, or `({ isInvalid, validationErrors, validationDetails }) => content` | the errors joined by a space | Render props are accessors (`validationErrors()`); returning `null` renders nothing. |
| `elementType` | string | `"span"` | |
| `id` | `string` | the field's error id | |
| `class` | `string \| (renderProps) => string` | `rv-FieldError` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<span>` of `FieldError`; see [Render](#render). |
| `style` | object or `(renderProps) => object` | none | |
| global DOM props | `GlobalDOMAttributes` | none | |

`FieldErrorContext` holds a `ValidationResult` or an accessor returning one (the field components provide an accessor). Label and Text props: see [Label](label.md).

## Ids with fieldProps

`fieldProps({ id, label, description, errorMessage, "aria-label", "aria-labelledby", "aria-describedby", labelElementType })` (react-aria `useField`) returns:

| Field | Value |
| --- | --- |
| `labelProps` | `{ id, for }` for the `Label` (`for` only with a `label` element) |
| `fieldProps` | `{ id, "aria-label", "aria-labelledby" }` for the input |
| `descriptionId` | `<id>-description` when `description` is set, else `undefined` |
| `errorMessageId` | `<id>-error` (always reserved: errors can appear later) |
| `extraDescribedBy` | your `aria-describedby` |

With an explicit `id` every part id derives from it, so the server HTML is stable; without one, ids come from `createId()`.

- `describedBy(ids, invalid)`: the input's `aria-describedby` — description, the error id while `invalid`, then yours.
- `labelProps(props)`: only `labelProps` / `fieldProps` (react-aria `useLabel`). Warns in development when the field has no name.
- `labelsProps(id, ariaLabel, ariaLabelledby, defaultLabel?)`: react-aria `useLabels`.
- Deprecated names `fieldAria`, `labelAria`, `labelsAttrs` still resolve (migration shims).

## Error messages

`FieldError` shows the validation errors by default; children replace them with static content or a function of the validation. Build a `ValidationResult` with `getValidationResult(errors)` (returns `null` for no errors) or use `DEFAULT_VALIDATION_RESULT`.

::example{id=field-error-messages}

## Labelling a group and other help

A `<label>` names only one input. For a group, render `Label elementType="span"` and reference it with `aria-labelledby` (CheckboxGroup / RadioGroup do this). `Text` takes any `slot` name and element type.

::example{id=field-parts}

## DOM events and attributes

Each part spreads the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`) on its element.

::example{id=field-dom-events}

## Styling

| Selector | When |
| --- | --- |
| `.rv-Label` | labels |
| `.rv-Text[slot=description]` | descriptions |
| `.rv-FieldError` | error messages (present only while invalid) |
| field roots `[data-invalid]`, `[data-required]`, `[data-disabled]`, `[data-readonly]` | field state |

### Tailwind

::example{id=field-tailwind}

### Plain CSS

::example{id=field-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `FieldError` (`<span>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<FieldError render={(props) => <span {...(props as {})} />}>…</FieldError>
```

## Accessibility

- The label names the input through `for` and `aria-labelledby`; an `id` set on `<Input id>` re-links the label's `for` (RA `mergeIds`).
- The description and (while invalid) the error are read after the name through `aria-describedby`; slot ids are dropped when the part does not render (RA `useSlotId`).
- A field without a visible label needs `aria-label` or `aria-labelledby`.

### Keyboard

No keys of their own.

## Resumability

- Parts render on the server; ids derived from an explicit `id` are stable.
- `FieldError` reads `FieldErrorContext` in a binding, so it appears / disappears without re-rendering the field; provide the validation as an object-literal function (`{ validation: () => … }.validation`) so a re-created region on a resumed page keeps it.
- Server render: the error part renders only while invalid, so the input's `aria-describedby` never points at a missing element.

## Testing

Query the input by its label (`getByLabelText`), assert `toHaveAccessibleDescription`, and check that the error part is absent while valid.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Label`, `Text`, `FieldError`, `FieldErrorContext` | RAC `Label`, `Text`, `FieldError` |
| `fieldProps`, `labelProps`, `labelsProps` | react-aria `useField`, `useLabel`, `useLabels` |

Deviations: render props are accessors; a server render of an input placed before its label keeps the label's server `for` (the `mergeIds` relink happens on the client).

## Common mistakes

- **A `<label>` for a group.** Use `elementType="span"` plus `aria-labelledby`.
- **FieldError outside a field.** Without `FieldErrorContext` it renders nothing — provide it for custom fields.
- **Error id always in `aria-describedby`.** Use `describedBy(ids, invalid)` so the error is read only while it shows.
