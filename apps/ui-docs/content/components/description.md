---
title: Description
description: "Provides supplementary text for form fields and other components."
template: reference
status: experimental
related: []
---

`Description` is the help text under a field. Inside a cdk field it fills the `description` slot, so the input's `aria-describedby` points at it.

Notes:

- `class`, not `className`.
- Always renderable: cdk parts hide themselves in a collection build pass, so no gate component is needed. There is no `FieldSlotsGate` export.

## Usage

```tsx
import { Description } from "@rivetjs/ui/description";
```

::example{id=description-basic}

## Examples

### With Form Fields

```tsx
<div class="flex flex-col gap-1">
  <Label for="password">Password</Label>
  <Input id="password" type="password" aria-describedby="password-description" />
  <Description id="password-description">Must be at least 8 characters with one uppercase letter</Description>
</div>
```

### Integration with TextField

```tsx
import { Input } from "@rivetjs/ui/input";
import { TextField } from "@rivetjs/ui/textfield";
import { Label } from "@rivetjs/ui/label";
import { Description } from "@rivetjs/ui/description";

<TextField type="email">
  <Label>Email</Label>
  <Input placeholder="Enter your email" />
  <Description>We'll never share your email</Description>
</TextField>;
```

When using the [TextField](/components/text-field/) component, accessibility attributes are automatically applied to the label and description.

## Customization

### Tailwind CSS

::example{id=description-custom-styles}

### Global CSS

To customize the Description component classes, you can use the `@layer components` directive. [Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .description {
    @apply text-muted;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Description component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/description.css)):

#### Base Classes

- `.description` - Base description styles with `muted` text color

## API Reference

### Description

| Prop       | Type      | Default | Description                    |
| ---------- | --------- | ------- | ------------------------------ |
| `class`    | `string`  | -       | Additional CSS classes         |
| `children` | `Content` | -       | The content of the description |

::api{symbol="@rivetjs/ui/description#DescriptionRootProps"}

## Accessibility

Linked through the field's `aria-describedby`; nothing is announced on its own.

The Description component enhances accessibility by:

- Using semantic HTML that screen readers can identify
- Providing the `slot="description"` attribute for React Aria integration
- Supporting proper text contrast ratios

## Related Components

- [TextField](/components/text-field/): Composition-friendly fields with labels and validation.
- [Input](/components/input/): Single-line text input built on React Aria.
- [TextArea](/components/text-area/): Multiline text input with focus management.
