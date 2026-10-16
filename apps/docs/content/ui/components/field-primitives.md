---
title: Field primitives
description: "@rivetjs/ui Label, Description, ErrorMessage, FieldError and Header: the text parts of a form field, styled on the cdk parts."
template: reference
status: experimental
related: [ui/heroui-port, ui/components/separator, guides/components/forms-and-input]
---

The field primitives are the small text parts of a form field: `Label`, `Description`, `ErrorMessage`, `FieldError` and `Header`. Each one styles a cdk part, so inside a cdk field (text field, select, checkbox group) it is wired to the input through the field's slots and ids. The upstream pages: [Label](https://www.heroui.com/docs/components/label), [Description](https://www.heroui.com/docs/components/description), [ErrorMessage](https://www.heroui.com/docs/components/error-message), [FieldError](https://www.heroui.com/docs/components/field-error), [Header](https://www.heroui.com/docs/components/header) of HeroUI v3.2.6.

## Import

```tsx
import { Label } from "@rivetjs/ui/label";
import { Description } from "@rivetjs/ui/description";
import { ErrorMessage } from "@rivetjs/ui/error-message";
import { FieldError } from "@rivetjs/ui/field-error";
import { Header } from "@rivetjs/ui/header";
```

## Usage

```tsx
import { TextField } from "@rivetjs/cdk/text-field";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/ui/label";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";

export default function Page() {
  return (
    <TextField name="email" type="email" isRequired>
      <Label isRequired>Email</Label>
      <Input />
      <Description>We only use it for receipts.</Description>
      <FieldError />
    </TextField>
  );
}
```

`FieldError` renders the field's validation errors and shows only while the field is invalid. `ErrorMessage` is the always-rendered text variant for cases where you control the message yourself.

## Variants

`Label` (`labelVariants`):

| Prop | Values | Default |
| --- | --- | --- |
| `isRequired` | `true` | `false` |
| `isInvalid` | `true` | `false` |
| `isDisabled` | `true` | `false` |

These three only choose the `label--required` / `label--invalid` / `label--disabled` classes; they are not forwarded to the element (as in HeroUI).

`Description`, `ErrorMessage`, `FieldError` and `Header` have no variants: one base class each (`description`, `error-message`, `field-error`, `header`). Pass `class` to extend.

## Parts

| Component | cdk part | Element | `data-slot` |
| --- | --- | --- | --- |
| `Label` / `Label.Root` | [Label](site:cdk/components/label/) | `label` | `label` |
| `Description` / `Description.Root` | Text with `slot="description"` | `span` | `description` |
| `ErrorMessage` / `ErrorMessage.Root` | Text with `slot="errorMessage"` | `span` | `error-message` |
| `FieldError` / `FieldError.Root` | [Form](site:cdk/components/form/) `FieldError` | `span` | `field-error` (+ `data-visible`) |
| `Header` | Header | `header` | `header` |

Prop types are the cdk parts' props plus the variants; these components are not generic over the element. `Header` has no `.Root`.

## Accessibility

The cdk field connects the parts: the label gets `for`, the input gets `aria-labelledby` and `aria-describedby` for the description and the error. `FieldError` gets the field's validation state; its render props are accessors (`{({ isInvalid }) => …}`, `validationErrors()`). Nothing is announced by `Description` or `ErrorMessage` on their own.

## Differences from HeroUI React

- `class`, not `className`.
- `Description` and `ErrorMessage` are always renderable: HeroUI's `FieldSlotsGate` and `useHasTextSlot` are not ported, because cdk parts return nothing in a collection build pass by themselves. There is no `FieldSlotsGate` export.
- `FieldError` `children` / `class` functions receive accessors, not snapshots.
- Handlers must be inline arrows or local consts ([serializable captures](../../best-practices/serializable-captures.md)).
