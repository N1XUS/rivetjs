---
title: Header
description: "Header: a section heading for groups of options (menus, list boxes, selects) on the cdk Header."
template: reference
status: experimental
related: [components/separator]
---

`Header` titles a group of options. Inside a cdk collection section it labels the section; anywhere else it is a `<header>` element with the header style.

::example{id=header-basic}

## Import

```tsx
import { Header } from "@rivetjs/ui/header";
```

## Usage

```tsx
import { Header } from "@rivetjs/ui/header";

export default function Recent() {
  return <Header>Recent files</Header>;
}
```

## Anatomy

| Part     | cdk part | Element                  | `data-slot` |
| -------- | -------- | ------------------------ | ----------- |
| `Header` | Header   | `header`, class `header` | `header`    |

`headerVariants`: no variants. There is no `Header.Root`.

::api{symbol="@rivetjs/ui/header#HeaderRootProps"}

## Accessibility

A `<header>` element. In a cdk ListBox or Menu section it becomes the section's label.

## Notes

- `class`, not `className`.
