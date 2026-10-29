---
title: MenuSection
description: "A labelled group of items inside a Menu or Dropdown, optionally with its own selection."
template: reference
status: experimental
related: [components/menu, components/menu-item, components/header, components/dropdown]
---

`MenuSection` groups related items of a [Menu](/components/menu/) under a heading, such as "Sort by" and "Columns" in a view menu. A section can also hold its own selection: one section allows a single choice while the next allows several, in the same menu. It is the styled cdk `MenuSection`; it is also `Menu.Section`, and `Dropdown.Section` is the same component.

## Usage

```tsx
import { Header } from "@rivetjs/ui/header";
import { Menu } from "@rivetjs/ui/menu";

<Menu aria-label="File">
  <Menu.Section>
    <Header>Actions</Header>
    <Menu.Item id="new">New file</Menu.Item>
    <Menu.Item id="open">Open</Menu.Item>
  </Menu.Section>
</Menu>;
```

::example{id=menu-section-selection}

## Anatomy

| Part | Element | Notes |
| --- | --- | --- |
| `MenuSection` (`Menu.Section`) | `section role="group"` | Class `menu-section`; `aria-labelledby` points at its `Header`. |
| `Header` | `header role="presentation"` | The heading; it labels the group and is not an item (the keyboard skips it). |
| `Menu.Item` | `div role="menuitem…"` | The items of the section. |

Put a [Separator](/components/separator/) between sections; the menu insets it.

## Examples

### Selection per section

`selectionMode`, `selectedKeys` (a Signal: two-way; a plain value: initial), `defaultSelectedKeys`, `onSelectionChange` and `disallowEmptySelection` on a section apply to its items only, so each section keeps its own set of keys. In the example, "Sort by" is a single selection that can not be emptied (dot indicators) and "Columns" a multiple selection (check marks).

### Closing behaviour

In a Dropdown, `shouldCloseOnSelect` on a section overrides the menu's rule for its items: set it to `false` to keep the popover open while the user ticks several options.

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.menu-section` | Section (flex column, no gap). |
| `[data-section]`, `[data-key]` | Present on the section element. |

## API Reference

See the [full module API](/api/rivetjs/ui/menu-section/) for every named export and part prop type.

::api{symbol="@rivetjs/ui/menu-section#MenuSectionRootProps"}

## Accessibility

- The section is a `group` named by its `Header`. Without a visible heading, set `aria-label` on the section.
- The parent menu owns the arrow keys and typeahead; they move across section boundaries.
- A section with `selectionMode="single"` exposes its items as `menuitemradio`, with `multiple` as `menuitemcheckbox`.

## Common mistakes

- **Selection on the menu and on a section.** A section's own `selectionMode` replaces the menu's for its items. Set the mode in one place per item.
- **A Header outside a section.** The heading labels the group only when it is inside `MenuSection`.

## Related Components

- [Menu](/components/menu/)
- [MenuItem](/components/menu-item/)
- [Header](/components/header/)
- [Dropdown](/components/dropdown/)
