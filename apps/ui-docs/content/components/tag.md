---
title: Tag
description: "A selectable or removable token within a TagGroup."
template: reference
status: experimental
related: [components/tag-group, components/chip, components/list-box]
---

`Tag` — A selectable or removable token within a TagGroup.

## Usage

```tsx
import { Tag } from "@rivetjs/ui/tag";
```

::example{id=tag-group-with-remove-button}

## Anatomy

Place Tag inside TagGroup.List and give it an `id`. Tag.RemoveButton customizes the remove control. The parent TagGroup supplies selection and removal behavior; use Chip for a standalone label without collection behavior.

Public parts: `Tag.Root`, `Tag.RemoveButton`.

## Styling Reference

The component emits these `data-slot` values across its parts: `tag`, `tag-remove-button`.

Base and part classes: `tag`, `tag__remove-button`.

## API Reference

See the [full module API](/api/rivetjs/ui/tag/) for every named export and part prop type.

| Prop      | Values               | Default   |
| --------- | -------------------- | --------- |
| `size`    | `lg`, `md`, `sm`     | `md`      |
| `variant` | `default`, `surface` | `default` |

::api{symbol="@rivetjs/ui/tag#TagRemoveButtonProps"}

::api{symbol="@rivetjs/ui/tag#TagRootProps"}

## Accessibility

The cdk TagGroup owns keyboard navigation, selection and removal. Give the group an accessible name and rich tags `textValue`. The remove button has the default accessible name “Remove tag”; retain a meaningful name when customizing it.

## Related Components

- [TagGroup](/components/tag-group/)
- [Chip](/components/chip/)
- [ListBox](/components/list-box/)
