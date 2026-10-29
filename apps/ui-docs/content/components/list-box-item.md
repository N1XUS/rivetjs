---
title: ListBoxItem
description: "One option of a ListBox with selection state, a check-mark indicator, a danger variant and a render function."
template: reference
status: experimental
related: [components/list-box, components/list-box-section, components/select]
---

`ListBoxItem` is one option of a [ListBox](/components/list-box/) (`role="option"`). The list owns focus, selection and typeahead; the item shows its content and its state. Inside a ListBox it is also `ListBox.Item`, with `ListBox.ItemIndicator` for the check mark. The `.Item` part of Select, ComboBox and Autocomplete is a variant of it that adds the indicator and derives `textValue` from text children.

## Usage

```tsx
import { ListBox } from "@rivetjs/ui/list-box";
import { ListBoxItem } from "@rivetjs/ui/list-box-item";

<ListBox aria-label="Channels" selectionMode="multiple">
  <ListBoxItem id="email" textValue="Email">
    Email
    <ListBoxItem.Indicator />
  </ListBoxItem>
  <ListBoxItem id="push" textValue="Push">
    Push
    <ListBoxItem.Indicator />
  </ListBoxItem>
</ListBox>;
```

::example{id=list-box-item-variants}

## Anatomy

| Part | Element | Notes |
| --- | --- | --- |
| `ListBoxItem` (`ListBoxItem.Root`, `ListBox.Item`) | `div role="option"` | `data-slot="list-box-item"`; `aria-selected` / `aria-disabled`. Children: content or a render function of the item state. |
| `ListBoxItem.Indicator` (`ListBox.ItemIndicator`) | `span aria-hidden` | A drawn check mark, `data-visible` when selected; children (or a render function) replace it. |

## Examples

### Rich content

Put any content in an item (an Avatar, a `Label` and a `Description`, a `Kbd`). Set `textValue` to the plain text of the option: typeahead and the accessible name use it. See [ListBox](/components/list-box/#usage) for an option list with avatars.

### Render function

Children can be a function of the item state: `isSelected()`, `isFocused()`, `isFocusVisible()`, `isHovered()`, `isPressed()`, `isDisabled()` are accessors, `selectionMode` is a value. In the example, the first option's description follows its selection.

### Disabled options

`isDisabled` on the item, or its key in the list's `disabledKeys`, keeps the option visible but skips it with the arrow keys and ignores presses.

### Danger variant

`variant="danger"` gives the option's `Label` and indicator the danger color, for an option with a destructive effect.

### Custom indicator

Pass children to `ListBoxItem.Indicator` to replace the check mark, or a function of the state to show an icon only when selected. See [ListBox: Custom Check Icon](/components/list-box/#custom-check-icon).

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.list-box-item`, `.list-box-item--default`, `.list-box-item--danger` | Option and its variant. |
| `.list-box-item__indicator` | Indicator (`[data-slot="list-box-item-indicator--checkmark"]` on the default icon). |
| `[data-selected]`, `[data-focused]`, `[data-focus-visible]`, `[data-hovered]`, `[data-pressed]`, `[data-disabled]` | Option state (cdk). |

## API Reference

See the [full module API](/api/rivetjs/ui/list-box-item/) for every named export and part prop type.

| Prop      | Values              | Default   |
| --------- | ------------------- | --------- |
| `variant` | `danger`, `default` | `default` |

::api{symbol="@rivetjs/ui/list-box-item#ListBoxItemIndicatorProps"}

::api{symbol="@rivetjs/ui/list-box-item#ListBoxItemRootProps"}

## Accessibility

- Each item is an `option` in the `listbox`; the list announces the selection through `aria-selected`. The indicator is decorative.
- Give every item a stable `id` (its selection key) and a `textValue` when its content is not plain text.
- Keep buttons, links and inputs out of options: an option is a single target. For rows with their own actions, use [ListView](/components/list-view/).

## Common mistakes

- **A ListBoxItem outside a ListBox.** The item gets its focus, selection and role from the list's collection; use it only inside a ListBox.
- **Expecting a check mark without the indicator.** A plain `ListBox.Item` has no check mark; add `ListBoxItem.Indicator`. (The `.Item` parts of Select and ComboBox add it for you.)
- **Keys that change on every render.** Selection is stored by key; generated keys lose the selection when the list re-renders.

## Related Components

- [ListBox](/components/list-box/)
- [ListBoxSection](/components/list-box-section/)
- [Select](/components/select/)
