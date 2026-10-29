---
title: Form
description: Form from @rivetjs/cdk is a native form that sets its fields' validation behaviour, shows server errors by field name, gates onSubmit; plus FieldError.
template: guide
status: experimental
related: [components/text-field, components/checkbox, components/radio-group, components/button, components/field]
---

A form is a group of inputs that allows users to submit data to a server, with support for providing field validation errors. `Form` renders a native `<form>`: it gives the fields inside a validation behaviour (`native` or `aria`) and server errors keyed by field `name`, and calls `onSubmit` only once the form is valid. Submission, reset and `FormData` stay the browser's. `FieldError` shows a field's validation errors.

::example{id=form-events}

## Anatomy

```html
<form class="rv-Form" action="/search" method="get" aria-label="Site search">
  <div class="rv-TextField">
    <label class="rv-Label">…</label>
    <input class="rv-Input" name="q" />
    <span slot="errorMessage" class="rv-FieldError">…</span> <!-- FieldError, while invalid -->
  </div>
  <button type="submit" class="rv-Button">Search</button>
</form>
<!-- validationBehavior="aria" -->
<form class="rv-Form" novalidate>…</form>
```

```tsx
<Form>
  <TextField name="…">
    <Label />
    <Input />
    <FieldError />
  </TextField>
  <Button type="submit" />
</Form>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `Form` | `form` | `rv-Form` | `novalidate` with `validationBehavior="aria"`; native attributes from the props. |
| `FieldError` | `span` (`elementType`) | `rv-FieldError` | Inside a field: renders only while the field is invalid, `slot="errorMessage"`, id from the field (`<id>-error`). |

## Import

```ts
import { Form, FieldError } from "@rivetjs/cdk/form";
```

Also exported: `FormContext`, `FormValidationContext`, `FieldErrorContext`, `formValidationBehavior`, `formValidationErrors`, types `FormProps`, `FieldErrorProps`, `FieldErrorRenderProps`, `ValidationBehavior`, `ValidationErrors`, `ValidationResult`, `ValidationFunction`.

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content, or `() => content` | none | Rendered inside the Form contexts (plain JSX children are lazy); a function child works too. |
| `validationBehavior` | `"native" \| "aria"` | `"native"` | Default for the fields inside (a field's own prop wins). |
| `validationErrors` | `Record<string, string \| string[]>`, a signal or an accessor | none | Server errors per field `name`, shown until the field's next commit. |
| `action` | `string` | none | URL (no React form actions). |
| `method` | `"get" \| "post" \| "dialog"` | none | |
| `encType` | `"application/x-www-form-urlencoded" \| "multipart/form-data" \| "text/plain"` | none | |
| `target` | `"_blank" \| "_self" \| "_parent" \| "_top" \| string` | none | |
| `autoComplete` | `"off" \| "on"` | none | Rendered as `autocomplete`. |
| `autoCapitalize` | `"off" \| "none" \| "on" \| "sentences" \| "words" \| "characters"` | none | Rendered as `autocapitalize`. |
| `role` | `"search" \| "presentation"` | none | |
| `name`, `id` | `string` | none | |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | A named form is a `form` landmark. |
| `class` | `string` | `rv-Form` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<form>` of `Form`; see [Render](#render). |
| `slot` | `string` | none | Slot of an enclosing `FormContext`. |
| `ref` | `RefValue<HTMLFormElement>` | none | |
| global DOM props | `GlobalDOMAttributes` | none | On the `<form>`. |

### Events

| Event | Fires |
| --- | --- |
| `onSubmit(e)` | A submit of a valid form (native mode: after the pending field errors were applied). Call `e.preventDefault()` to handle it yourself. |
| `onReset(e)` | The form reset; fields restore their default values and clear their validation. |
| `onInvalid(e)` | Each invalid field on a native submit (capture phase, before the field's handler); `e.preventDefault()` keeps the first invalid field from taking focus. |

### FieldError props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content, or `(rp) => content` | the error messages joined by spaces | `null` renders nothing. |
| `elementType` | `string` | `"span"` | `"div"` for block children (a `<ul>`). |
| `class` | `string \| (rp) => string` | `rv-FieldError` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<span>` of `FieldError`; see [Render](#render). |
| `style` | `object \| (rp) => object` | none | |
| `id` | `string` | the field's error id | |
| `ref` | `RefValue<HTMLElement>` | none | |
| global DOM props | `GlobalDOMAttributes` | none | |

| Render prop | Type |
| --- | --- |
| `isInvalid` | `() => boolean` |
| `validationErrors` | `() => string[]` |
| `validationDetails` | `() => ValidityDetails` (native `ValidityState` flags) |

`FieldError` reads `FieldErrorContext`, which TextField, NumberField, SearchField, ColorField, DateField, DatePicker, ComboBox, Select, Checkbox, Switch and RadioGroup provide. Outside a field it renders nothing.

## Children and the Form contexts

Plain JSX children are compiled to a lazy slot rendered inside the Form, so the fields see its behaviour and server errors; a function child `{() => …}` does the same.

```tsx
<Form validationErrors={{ username: "Taken." }}>
  {() => (
    <>
      <TextField name="username">
        <Label>Username</Label>
        <Input />
        <FieldError />
      </TextField>
      <Button type="submit">Save</Button>
    </>
  )}
</Form>
```

## Validation behavior

- **native** (default): the fields render `required` and native constraints; the browser blocks an invalid submit, the fields show their errors and the first invalid field takes focus.
- **aria**: the form gets `novalidate`; fields show errors as they change (`aria-invalid`, `aria-required`) and the submit always goes through. Validate again on the server.

::example{id=form-validation-behavior}

## Server errors

`validationErrors` maps field names to messages. A field shows its error from the server render on; committing an edit (blur after a change) clears it. Pass a signal or an accessor to set errors after a submit: in native mode the form then re-applies the fields' custom validity.

::example{id=form-server-errors}

## Form submission

Without validation props, `Form` is a native form with a gated `onSubmit`: native inputs work as they always do, and `action` / `method` submit without any code.

::example{id=form-native-submit}

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`) land on the `<form>`. `onSubmit`, `onReset` and `onInvalid` are Form's own props; the form owns `submit` (it applies pending field validity first).

::example{id=form-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-Form` | the form |
| `.rv-Form:has(:user-invalid)`, `:has([data-invalid])` | some field invalid |
| `.rv-FieldError` | an error message |

### Tailwind

::example{id=form-tailwind}

### Plain CSS

::example{id=form-css}

### Starter theme

`@rivetjs/cdk/theme.css` has no `.rv-Form` rule; style the fields.

## Custom fields

`formValidationBehavior(own)` returns a field's behaviour (its own prop, the Form's, else `"native"`); `formValidationErrors()` returns the Form's server errors (`useValidationBehavior` / `useValidationErrors` are deprecated aliases). Both read context. Provide `FieldErrorContext` (a `ValidationResult` or an accessor) so `FieldError` works inside your field. `@rivetjs/cdk/form/behaviour` has the plumbing the fields use: `validityError`, `nativeValidity`, `syncValidity`, `validationInvalid`, `validationChange`, `commit`, `onFormReset`, `applyPendingValidity`, `formSubmit`; `@rivetjs/cdk/state/form-validation` the react-stately validation state.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Form` (`<form>`), `FieldError` (`<span>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<Form render={(props) => <form {...(props as {})} />}>…</Form>
```

## Accessibility

- A named form (`aria-label` / `aria-labelledby`) is a `form` landmark.
- Native mode focuses the first invalid field on submit (keyboard modality, so its focus ring shows); `FieldError` is linked to the input with `aria-describedby` while it renders.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Enter] | Submit from a text field. |

## Resumability

- The form is plain HTML: submitting works before code loads, and server errors are part of the server render.
- Native mode: each field renders its custom error as `data-rv-error`; Form's submit handler applies those before checking validity, so fields that never ran code still block the submit.
- `validationErrors` as an object, signal or accessor resumes.
- `FieldError` is a region: an error appearing on the client mounts it.

## Testing

Render with `render` from `@rivetjs/runtime/testing`, fill fields with `@testing-library/user-event`, click the submit button, then assert the `onSubmit` spy and `aria-invalid` / `validationMessage` on the fields.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Form`, `FormContext` | RAC `Form` |
| `FieldError`, `FieldErrorContext` | RAC `FieldError` |
| `FormValidationContext`, `@rivetjs/cdk/state/form-validation` | react-stately `useFormValidationState` |
| `@rivetjs/cdk/form/behaviour` | react-aria `useFormValidation`, `useFormReset` |

Deviations: `action` is a URL string; `FormContext` provides only `{ validationBehavior }`; native mode applies the fields' pending errors (`data-rv-error`) on submit, since no layout effect runs before interaction.

## Common mistakes

- **Field without `name`.** Server errors map by name, and the field submits nothing.
- **Relying on aria mode to stop bad data.** It never blocks; validate on the server.
- **Expecting a server error to clear while typing.** It clears on commit (blur after a change).
