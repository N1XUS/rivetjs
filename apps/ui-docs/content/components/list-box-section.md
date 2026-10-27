---
title: ListBoxSection
description: "A labelled group of related options within a ListBox."
template: reference
status: experimental
related: [components/list-box, components/list-box-item, components/header]
---

`ListBoxSection` — A labelled group of related options within a ListBox.

## Usage

```tsx
import { ListBoxSection } from "@rivetjs/ui/list-box-section";
```

::example{id=list-box-with-sections}

## Anatomy

Place `Header` and `ListBox.Item` children inside `ListBoxSection`. The same component is available as `ListBox.Section`; it has no compound subparts.

## Styling Reference

Base and part classes: `list-box-section`.

## API Reference

See the [full module API](/api/rivetjs/ui/list-box-section/) for every named export and part prop type.

::api{symbol="@rivetjs/ui/list-box-section#ListBoxSectionRootProps"}

## Accessibility

The section renders a group within the listbox. A child Header supplies its accessible name; use `aria-label` when the visible heading is omitted. Items retain the parent listbox’s keyboard behavior.

## Related Components

- [ListBox](/components/list-box/)
- [ListBoxItem](/components/list-box-item/)
- [Header](/components/header/)
