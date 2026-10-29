---
title: SwitchGroup
description: "Lays out a set of independent switches vertically or horizontally; pair it with a Fieldset for a shared label."
template: reference
status: experimental
related: [components/switch, components/fieldset, components/cell-switch]
---

`SwitchGroup` stacks several [Switch](/components/switch/) controls with consistent spacing, in a column (default) or a row. Each switch stays independent: it has its own name, value and label, and the group adds no selection model, no shared value and no ARIA group. To give the switches a common, announced label, wrap the group in a [Fieldset](/components/fieldset/) with a `Fieldset.Legend`. For one-of-many choices use [RadioGroup](/components/radio-group/); for several values submitted as one field, use [CheckboxGroup](/components/checkbox-group/).

## Usage

```tsx
import { Switch } from "@rivetjs/ui/switch";
import { SwitchGroup } from "@rivetjs/ui/switch-group";

<SwitchGroup>
  <Switch name="notifications" label="Allow notifications" />
  <Switch name="marketing" label="Marketing emails" />
</SwitchGroup>;
```

::example{id=switch-group}

## Anatomy

| Part | Element | Notes |
| --- | --- | --- |
| `SwitchGroup` (`SwitchGroup.Root`) | `div` | `data-slot="switch-group"`, classes `switch-group switch-group--vertical` / `--horizontal`. Accepts `render` and the `div` attributes. |
| Items container | `div` | `data-slot="switch-group-items"`, class `switch-group__items`; added by the group around its children (no public part). |

## Examples

### In a Fieldset, and horizontal

The first group below is named by a `Fieldset.Legend` and described by a `Description`; its switches use the `label` / `description` shorthand, and one is disabled. The second group is a horizontal row; since it has no legend, it gets `role="group"` and an `aria-label` itself.

::example{id=switch-group-fieldset}

### Orientation

`orientation="horizontal"` puts the switches in a row (gap 1 rem); the default `vertical` stacks them. For a row that may overflow on small screens, add `class="overflow-x-auto"` as in [Switch: Group Horizontal](/components/switch/#group-horizontal).

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.switch-group` | Root: flex column, 1.5 rem gap. |
| `.switch-group__items` | Items: flex with a 1 rem gap. |
| `.switch-group--vertical`, `.switch-group--horizontal` | Orientation of the items (column / row). |

## API Reference

See the [full module API](/api/rivetjs/ui/switch-group/) for every named export and part prop type.

| Prop          | Values                   | Default    |
| ------------- | ------------------------ | ---------- |
| `orientation` | `horizontal`, `vertical` | `vertical` |

::api{symbol="@rivetjs/ui/switch-group#SwitchGroupRootProps"}

## Accessibility

- The group is plain layout markup. Each Switch is a native checkbox with `role="switch"` and its own label; screen readers announce them one by one.
- For a shared name, use a Fieldset and Legend (a native `fieldset` is announced as a group), or give the group `role="group"` and `aria-label` / `aria-labelledby`.
- `orientation` changes only the layout; :kbd[Tab] moves through the switches in both orientations, :kbd[Space] toggles the focused one.

## Common mistakes

- **Expecting a group value.** There is none: read each switch (two-way `isSelected` Signals, or the form data by `name`).
- **Using a switch group for exclusive options.** Switches are independent; for one choice out of several, use a RadioGroup.

## Related Components

- [Switch](/components/switch/)
- [Fieldset](/components/fieldset/)
- [CellSwitch](/components/cell-switch/)
