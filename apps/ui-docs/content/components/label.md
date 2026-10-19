---
title: Label
description: "Renders an accessible label associated with form controls."
template: reference
status: experimental
related: []
---

`Label` names a form field. Inside a cdk field (TextField, Select, CheckboxGroup, …) it is wired to the input: `for`, `id` and the input's `aria-labelledby`. It is the [cdk Label](site:cdk/components/label/) with the Rivet UI classes.

Notes:

- `class`, not `className`.
- Prop types are the cdk Label props plus the variants.

## Usage

```tsx
import { Label } from "@rivetjs/ui/label";
```

::example{id=label-basic}

## Examples

### With Required Indicator

```tsx
<Label for="email" isRequired>
  Email Address
</Label>
<Input id="email" type="email" />
```

### With Disabled State

```tsx
<Label for="username" isDisabled>
  Username
</Label>
<Input id="username" isDisabled />
```

### With Invalid State

```tsx
<Label for="password" isInvalid>
  Password
</Label>
<Input id="password" isInvalid />
```

## Customization

### Tailwind CSS

::example{id=label-custom-styles}

### Global CSS

To customize the Label component classes, you can use the `@layer components` directive. [Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .label {
    @apply font-semibold text-foreground;
  }

  .label--required::after {
    @apply text-accent;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Label component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/label.css)):

#### Base Classes

- `.label` - Base label styles with text styling

#### State Modifier Classes

- `.label--required` or `[data-required="true"] > .label` - Shows required asterisk indicator
- `.label--disabled` or `[data-disabled="true"] .label` - Disabled state styling
- `.label--invalid` or `[data-invalid="true"] .label` or `[aria-invalid="true"] .label` - Invalid state styling (danger/red text color)

**Note**: The required asterisk is smartly applied using role and data-slot detection. It excludes:

- Elements with `role="group"`, `role="radiogroup"`, or `role="checkboxgroup"`
- Elements with `data-slot="radio"` or `data-slot="checkbox"`

This prevents duplicate asterisks when using group components with required fields.

## API Reference

### Label

| Prop         | Type      | Default | Description                                        |
| ------------ | --------- | ------- | -------------------------------------------------- |
| `htmlFor`    | `string`  | -       | The id of the element the label is associated with |
| `isRequired` | `boolean` | `false` | Whether to display a required indicator            |
| `isDisabled` | `boolean` | `false` | Whether the label is in a disabled state           |
| `isInvalid`  | `boolean` | `false` | Whether the label is in an invalid state           |
| `class`      | `string`  | -       | Additional CSS classes                             |
| `children`   | `Content` | -       | The content of the label                           |

::api{symbol="@rivetjs/ui/label#LabelRootProps"}

## Accessibility

Inside a cdk field the label and input are linked by ids; outside one, set `for` yourself.

The Label component is built on the native HTML `<label>` element ([MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/label)) and follows WAI-ARIA best practices:

- Associates with form controls using the `htmlFor` attribute
- Provides semantic HTML `<label>` element
- Supports keyboard navigation when associated with form controls
- Communicates required and invalid states to screen readers
- Clicking the label focuses/activates the associated form control

## Related Components

- [Input](/components/input/): Single-line text input built on React Aria.
- [TextArea](/components/text-area/): Multiline text input with focus management.
- [Fieldset](/components/fieldset/): Group related form controls with legends.
