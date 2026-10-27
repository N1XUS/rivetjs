---
title: SwitchGroup
description: "A layout wrapper for a set of independently labelled switches."
template: reference
status: experimental
related: [components/switch, components/fieldset, components/cell-switch]
---

`SwitchGroup` — A layout wrapper for a set of independently labelled switches.

## Usage

```tsx
import { SwitchGroup } from "@rivetjs/ui/switch-group";
```

::example{id=switch-group}

## Anatomy

SwitchGroup wraps its Switch children in an internal items container. `SwitchGroup.Root` is the root alias; there is no public Items component.

Public parts: `SwitchGroup.Root`.

## Styling Reference

The component emits these `data-slot` values across its parts: `switch-group`, `switch-group-items`.

Base and part classes: `switch-group`, `switch-group__items`.

## API Reference

See the [full module API](/api/rivetjs/ui/switch-group/) for every named export and part prop type.

| Prop          | Values                   | Default    |
| ------------- | ------------------------ | ---------- |
| `orientation` | `horizontal`, `vertical` | `vertical` |

::api{symbol="@rivetjs/ui/switch-group#SwitchGroupRootProps"}

## Accessibility

This component is plain layout markup: it does not create a selection model or an ARIA group automatically. Label each Switch. Use Fieldset and its Legend when the switches need a shared semantic group label.

## Related Components

- [Switch](/components/switch/)
- [Fieldset](/components/fieldset/)
- [CellSwitch](/components/cell-switch/)
