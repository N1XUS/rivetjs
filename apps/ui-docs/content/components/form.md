---
title: Form
description: "Wrapper component for form validation and submission handling"
template: reference
status: experimental
related: [components/text-field, components/fieldset, components/button]
---

`Form` is the [cdk Form](site:cdk/components/form/): a native `<form>` that sets the validation behaviour and server errors (`validationErrors`) of the fields inside it.

Notes:

- `class`, not `className`.
- `onSubmit` receives the native `SubmitEvent`.

## Usage

```tsx
import { Form } from "@rivetjs/ui/form";
```

::example{id=form-basic}

## Anatomy

```tsx
import { Button } from "@rivetjs/ui/button";
import { Form } from "@rivetjs/ui/form";

export default () => (
  <Form>
    {/* Form fields go here */}
    <Button type="submit" />
    <Button type="reset" />
  </Form>
);
```

Additional exported parts: `Form.Root`.

## Examples

### Render Function

::example{id=form-render-function}

### With @rivetjs/forms

Pass a `@rivetjs/forms` store (`form`) and its definition (`definition`): every field inside with a `name` shows that field's issues, with no per-field glue. Getting started: [Forms](/start/forms/).

```tsx
import { createForm } from "@rivetjs/forms";
import { actionResult } from "@rivetjs/router/client";
import { Button } from "@rivetjs/ui/button";
import { Form } from "@rivetjs/ui/form";
import { TextField } from "@rivetjs/ui/textfield";
import { signupForm } from "../forms/definitions.ts";

export default function SignupPage() {
  const form = createForm(signupForm, { result: actionResult() });
  return (
    <Form form={form} definition={signupForm}>
      <TextField name="name" label="Name" />
      <TextField name="email" label="Email" type="email" />
      <Button type="submit">Create account</Button>
    </Form>
  );
}
```

- The form gets `id`, `method="post"`, `action="?/<definition name>"` and `validationBehavior="aria"`; the forms handlers (input, blur, submit, invalid) are delegated from the form.
- Issues reach fields by name (`aria-invalid`, `aria-describedby`, `FieldError`); the TextField shorthand always has a `FieldError`.
- A TextField without `value` / `defaultValue` starts from the store: the echoed value after a failed no-JS post, else `initial`.
- A `type="submit"` Button without `isPending` is pending while the store's submit runs.
- `format` maps an issue to its message (i18n); your own `onSubmit` / `onInvalid` run after the forms ones.

## Customization

### Tailwind CSS

::example{id=form-custom-styles}

### Global CSS

To customize form layout and spacing, use the `class` prop on `<Form>` or add a project-level class with the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

`Form` renders a native `<form>` element and focuses on validation and submission. It does not include dedicated BEM classes in `@rivetjs/ui/styles`—apply container styles from global CSS, and use field components for control-level customization.

```css
@layer components {
  .form-layout {
    @apply flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm;
  }
}
```

```tsx
<Form class="form-layout" onSubmit={handleSubmit}>
  {/* TextField, Input, Button, etc. */}
</Form>
```

For grouped fields with shared layout, use [Fieldset](/components/fieldset/) and target `.fieldset`, `.fieldset__legend`, and related classes. For individual controls, see **Global CSS** on [TextField](/components/text-field/), [Input](/components/input/), [Label](/components/label/), and [FieldError](/components/field-error/).

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology for components that ship styles in `@rivetjs/ui/styles`.

`Form` renders a native `<form>` element without dedicated BEM classes. Apply layout, spacing, and surface styles through `class`. Field appearance and validation states come from child components such as `TextField`, `Input`, `Label`, `Description`, and `FieldError`. For structured multi-field layouts, compose with [Fieldset](/components/fieldset/).

## API Reference

See the [full module API](/api/rivetjs/ui/form/) for every named export and part prop type.

### Form

The Form component is a wrapper around React Aria's Form primitive that provides form validation and submission handling capabilities.

| Prop                 | Type                                                                           | Default                 | Description                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `action`             | `string \| FormHTMLAttributes['action']`                                       | -                       | The URL to submit the form data to.                                                                                                                     |
| `class`              | `string`                                                                       | -                       | Tailwind CSS classes applied to the form element.                                                                                                       |
| `children`           | `Content`                                                                      | -                       | Form content (fields, buttons, etc.).                                                                                                                   |
| `encType`            | `'application/x-www-form-urlencoded' \| 'multipart/form-data' \| 'text/plain'` | -                       | The encoding type for form data submission.                                                                                                             |
| `method`             | `'get' \| 'post'`                                                              | -                       | The HTTP method to use when submitting the form.                                                                                                        |
| `onInvalid`          | `(event: FormEvent<HTMLFormElement>) => void`                                  | -                       | Handler called when the form validation fails. By default, the first invalid field will be focused. Use `preventDefault()` to customize focus behavior. |
| `onReset`            | `(event: FormEvent<HTMLFormElement>) => void`                                  | -                       | Handler called when the form is reset.                                                                                                                  |
| `onSubmit`           | `(event: SubmitEvent, result?: Promise<boolean>) => void`                      | -                       | Handler called when the form is submitted. With `form`: after the forms submit, with its result.                                                        |
| `form`               | `Form` (`@rivetjs/forms`)                                                      | -                       | Rivet: a forms store (`createForm`); fields join it by `name`. Needs `definition`.                                                                      |
| `definition`         | `FormDefinition`                                                               | -                       | Rivet: the `defineForm` definition (module scope) the store was created from.                                                                           |
| `format`             | `(issue: Issue) => string`                                                     | issue message, else key | Rivet: issue → message, with `form`.                                                                                                                    |
| `target`             | `'_self' \| '_blank' \| '_parent' \| '_top'`                                   | -                       | Where to display the response after submitting the form.                                                                                                |
| `validationBehavior` | `'native' \| 'aria'`                                                           | `'native'`              | Whether to use native HTML validation or ARIA validation. 'native' blocks form submission, 'aria' displays errors in realtime.                          |
| `validationErrors`   | `ValidationErrors`                                                             | -                       | Server-side validation errors mapped by field name. Displayed immediately and cleared when user modifies the field.                                     |
| `aria-label`         | `string`                                                                       | -                       | Accessibility label for the form.                                                                                                                       |
| `aria-labelledby`    | `string`                                                                       | -                       | ID of element that labels the form. Creates a form landmark when provided.                                                                              |
| `render`             | `DOMRenderFunction<keyof JSX.IntrinsicElements, undefined>`                    | -                       | Overrides the default DOM element with a custom render function.                                                                                        |

### Form Validation

The Form component integrates with React Aria's validation system, allowing you to:

- Use built-in HTML5 validation attributes (`required`, `minLength`, `pattern`, etc.)
- Provide custom validation functions on TextField components
- Display validation errors with FieldError components
- Handle form submission with proper validation
- Provide server-side validation errors via `validationErrors` prop

#### Validation Behavior

The `validationBehavior` prop controls how validation is displayed:

- **`native`** (default): Uses native HTML validation, blocks form submission on errors
- **`aria`**: Uses ARIA attributes for validation, displays errors in realtime as user types, doesn't block submission

This behavior can be set at the form level or overridden at individual field level.

Messages for the native constraints (`isRequired`, `minLength`, `type="email"`, …) are the browser's own: their wording and language differ per browser ("Please fill out this field." in Chrome, "Fill out this field" in Safari). For your own text, give the `FieldError` (or the `errorMessage` shorthand) a function of the render props and pick the message from `validationDetails()`, or return your message from `validate`:

```tsx
<TextField name="email" type="email" isRequired>
  <Label>Email</Label>
  <Input />
  <FieldError>
    {({ validationDetails }) =>
      validationDetails().valueMissing ? "Enter your email." : validationDetails().typeMismatch ? "This is not an email address." : ""
    }
  </FieldError>
</TextField>
```

### Form Submission

Forms can be submitted in several ways:

- **Traditional submission**: Set the `action` prop to submit to a URL
- **JavaScript handling**: Use the `onSubmit` handler to process form data
- **FormData API**: Access form data using the FormData API in your submit handler

Example with FormData:

```tsx
function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  const data = Object.fromEntries(formData);
  console.log("Form data:", data);
}
```

### Integration with Form Fields

The Form component works with the Rivet UI form field components:

- **TextField**: For text inputs with labels and validation
- **Checkbox**: For boolean selections
- **RadioGroup**: For single selection from multiple options
- **Switch**: For toggle controls
- **Button**: For form submission and reset actions

All field components automatically integrate with the Form's validation and submission behavior when placed inside it.

### Advanced Usage

For more advanced use cases including:

- Custom validation context
- Form context providers
- Integration with third-party libraries
- Custom focus management on validation errors

Please refer to the [React Aria Form documentation](https://react-spectrum.adobe.com/react-aria/Form.html).

::api{symbol="@rivetjs/ui/form#FormRootProps"}

## Accessibility

Forms are accessible by default when using React Aria components. Key features include:

- Native `<form>` element semantics
- Form landmark creation with `aria-label` or `aria-labelledby`
- Automatic focus management on validation errors
- ARIA validation attributes when using `validationBehavior="aria"`

A native `<form>`; with `validationBehavior="native"` (default) invalid fields block the submit and the first one is focused.

## Related Components

- [Button](/components/button/): Allows a user to perform an action.
- [Fieldset](/components/fieldset/): Group related form controls with legends.
- [TextField](/components/text-field/): Composition-friendly fields with labels and validation.
