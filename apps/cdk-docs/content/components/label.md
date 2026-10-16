---
title: Label
description: Label from @rivetjs/cdk/label names a field; LabelContext, InputContext and TextContext let a custom field wire label, input and help text ids.
template: guide
status: experimental
related: [components/field, foundations/slots, components/text-field]
---

`Label` renders a `<label>` (or a `<span>`, for groups a `<label>` cannot name). Fields provide `LabelContext` with the label id and `for`. With `Input` / `TextArea` (`InputContext`, `TextAreaContext`) and `Text` (`TextContext`), you can assemble a custom field the way RAC fields are built.

::example{id=label-context}

## Import

```ts
import { Label, LabelContext, Text, TextContext, fieldProps, labelProps, labelsProps } from "@rivetjs/cdk/label";
import { Input, InputContext } from "@rivetjs/cdk/input";
import { TextArea, TextAreaContext } from "@rivetjs/cdk/text-area";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `elementType` | `string` | `"label"` | `span` for a group label. |
| `children` | content or `() => content` | none | |
| `class` | `string` | `rv-Label` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<label>` of `Label`; see [Render](#render). |
| `for`, `id`, `style`, `slot`, `ref` | | | |

## Input and TextArea

Native `<input>` / `<textarea>` with state attributes: `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-invalid`.

- `class` / `style` accept functions of the render props (`isHovered()`, `isFocused()`, `isFocusVisible()`, `isDisabled()`, `isInvalid()`).
- `disabled` and `aria-invalid` may be accessors from context.
- Default classes: `rv-Input` / `rv-TextArea`.

## Id helpers

- `fieldProps({ id, label, description, errorMessage })` returns the ids and attribute bags for label, field, description and error (React Aria `useField`).
- `labelProps` (`useLabel`) and `labelsProps` (`useLabels`) cover the label alone.

The parts and `FieldError`: [Label, Text and FieldError](field.md).

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Label` (`<label>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<Label render={(props) => <label {...(props as {})} />}>…</Label>
```

## Upstream

- React Aria Components `Label`, `Input`, `TextArea`, `Text`.
- React Aria `useLabel` → `labelProps`, `useField` → `fieldProps`, `useLabels` → `labelsProps`.
