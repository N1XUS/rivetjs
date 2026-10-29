---
title: ListBoxSection
description: "A labelled group of related options within a ListBox."
template: reference
status: experimental
related: [components/list-box, components/list-box-item, components/header]
---

`ListBoxSection` groups the options of a [ListBox](/components/list-box/) under a heading, such as "Actions" and "Danger zone" in a list of file commands. It is the styled cdk `ListBoxSection` (`role="group"`); it is also `ListBox.Section`. The list's selection, focus and typeahead run across all sections: a section only adds the group and its label.

## Usage

```tsx
import { Header } from "@rivetjs/ui/header";
import { ListBox } from "@rivetjs/ui/list-box";

<ListBox aria-label="Fruit and vegetables" selectionMode="single">
  <ListBox.Section>
    <Header>Fruit</Header>
    <ListBox.Item id="apple">Apple</ListBox.Item>
    <ListBox.Item id="pear">Pear</ListBox.Item>
  </ListBox.Section>
  <ListBox.Section>
    <Header>Vegetables</Header>
    <ListBox.Item id="leek">Leek</ListBox.Item>
  </ListBox.Section>
</ListBox>;
```

::example{id=list-box-with-sections}

## Anatomy

| Part | Element | Notes |
| --- | --- | --- |
| `ListBoxSection` (`ListBox.Section`) | `section role="group"` | Class `list-box-section`; `aria-labelledby` points at its `Header`, or `aria-label` names it. |
| `Header` | `header` | The visible heading; not an option (the keyboard skips it). |
| `ListBox.Item` | `div role="option"` | The options of the section. |

Use a [Separator](/components/separator/) between sections for a visible divider, as in the example.

## Examples

### Sections from data

For a dynamic list of groups, pass the groups as the ListBox `items` and render each section's options with a cdk `Collection` after its `Header`:

```tsx
import { Collection } from "@rivetjs/cdk/collections/components";
import { Header } from "@rivetjs/ui/header";
import { ListBox } from "@rivetjs/ui/list-box";

const groups = [
  { id: "fruit", name: "Fruit", items: [{ id: "apple", name: "Apple" }] },
  { id: "veg", name: "Vegetables", items: [{ id: "leek", name: "Leek" }] },
];

<ListBox aria-label="Produce" items={groups}>
  {(group: (typeof groups)[number]) => (
    <ListBox.Section id={group.id}>
      <Header>{group.name}</Header>
      <Collection items={group.items}>{(item: { id: string; name: string }) => <ListBox.Item id={item.id}>{item.name}</ListBox.Item>}</Collection>
    </ListBox.Section>
  )}
</ListBox>;
```

### Sections without a heading

When the grouping is clear without a visible title, leave out the `Header` and set `aria-label` on the section so screen readers still announce the group.

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.list-box-section` | Section (flex column, no gap). |

## API Reference

See the [full module API](/api/rivetjs/ui/list-box-section/) for every named export and part prop type.

::api{symbol="@rivetjs/ui/list-box-section#ListBoxSectionRootProps"}

## Accessibility

- The section is a `group` in the `listbox`, named by its `Header` or by `aria-label`.
- Options keep the list's keyboard behaviour: the arrow keys and typeahead move across sections, and Home / End go to the first / last option of the whole list.
- A section has no selection of its own; `selectionMode` and `selectedKeys` belong to the ListBox. (Menu sections can hold their own selection, see [MenuSection](/components/menu-section/).)

## Related Components

- [ListBox](/components/list-box/)
- [ListBoxItem](/components/list-box-item/)
- [Header](/components/header/)
