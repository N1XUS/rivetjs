---
title: Menu
description: "A styled list of actions or options with keyboard navigation, selection and sections, shown in the page or inside a Dropdown."
template: reference
status: experimental
related: [components/dropdown, components/menu-item, components/menu-section, components/list-box]
---

`Menu` shows a list of actions (or options) that the user picks with the pointer or the keyboard. It is the styled [cdk Menu](site:cdk/components/menu/) (`role="menu"`): arrow keys move the focus, typing a letter jumps to an item, and Enter or Space runs `onAction` with the item's key. Use it directly for a menu that is always visible, such as a side panel of commands. For a menu that opens from a button, use [Dropdown](/components/dropdown/): `Dropdown.Menu` is this component inside a popover.

## Usage

```tsx
import { Menu } from "@rivetjs/ui/menu";

<Menu aria-label="Document actions" onAction={(key) => console.log(key)}>
  <Menu.Item id="edit">Edit</Menu.Item>
  <Menu.Item id="duplicate">Duplicate</Menu.Item>
  <Menu.Item id="delete" variant="danger">
    Delete
  </Menu.Item>
</Menu>
```

::example{id=menu-standalone}

## Anatomy

```tsx
<Menu>
  <Menu.Section>
    <Header />
    <Menu.Item>
      <Menu.ItemIndicator />
      <Label />
    </Menu.Item>
  </Menu.Section>
  <Separator />
</Menu>
```

| Part | Element | Notes |
| --- | --- | --- |
| `Menu` (`Menu.Root`) | `div role="menu"` | `data-slot="menu"`, class `menu`. Takes the cdk Menu props: `onAction`, `selectionMode`, `selectedKeys`, `disabledKeys`, `items` + function child, `renderEmptyState`. |
| `Menu.Item` | `div role="menuitem"` (or `menuitemradio` / `menuitemcheckbox` with selection) | The [MenuItem](/components/menu-item/) component. |
| `Menu.ItemIndicator` | `span` | Check mark or dot for selected items. |
| `Menu.Section` | `section role="group"` | The [MenuSection](/components/menu-section/) component; a `Header` inside names it. |

A Menu has no background of its own: it is the content of a popover in a Dropdown. A standalone menu goes on a surface (the examples use [Surface](/components/surface/)).

## Examples

### Actions

`onAction` receives the key (`id`) of the item that was pressed or activated with Enter / Space. Keys in `disabledKeys` (or items with `isDisabled`) can not be focused or activated. The [example above](#usage) reports the last action under the menu.

### Selection and sections

Set `selectionMode` on the Menu for one selection for all items, or on each `Menu.Section` for a separate selection per group. `selectedKeys` takes a Signal of a `Set` of keys (two-way) or a plain value (initial selection). Put a `Menu.ItemIndicator` in each item: `type="dot"` for a single choice, the default check mark for multiple choices.

::example{id=menu-section-selection}

### Dynamic items

Pass `items` and a function child to render a list from data; each item needs an `id` (or an `id` / `key` field in the data). The [example above](#usage) renders its five actions this way.

```tsx
import { Menu } from "@rivetjs/ui/menu";

const commands = [
  { id: "open", name: "Open" },
  { id: "rename", name: "Rename" },
];

<Menu aria-label="Commands" items={commands} renderEmptyState={() => "No commands"}>
  {(command: { id: string; name: string }) => <Menu.Item id={command.id}>{command.name}</Menu.Item>}
</Menu>;
```

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.menu` | Menu root (`data-slot="menu"`); flex column with a small gap and padding. |
| `.menu [data-slot="separator"]` | A Separator between sections (inset to 94 % width). |
| `[data-empty]` | Root, when the menu has no items (its `renderEmptyState` shows). |

Item and section classes: [MenuItem](/components/menu-item/#styling-reference), [MenuSection](/components/menu-section/#styling-reference). The full list of menu classes and states is on the [Dropdown](/components/dropdown/#menu-component-classes) page.

## API Reference

See the [full module API](/api/rivetjs/ui/menu/) for every named export and part prop type.

::api{symbol="@rivetjs/ui/menu#MenuRootProps"}

## Accessibility

- The root has `role="menu"`; give a standalone menu a name with `aria-label` or `aria-labelledby` (a Dropdown names its menu after the trigger).
- :kbd[ArrowDown] / :kbd[ArrowUp] move the focus, :kbd[Home] / :kbd[End] go to the first / last item, a printable key jumps to the next item whose text starts with it (typeahead), :kbd[Enter] / :kbd[Space] activate or select. :kbd[Escape] clears the selection unless `escapeKeyBehavior="none"`.
- Items whose content is not plain text need `textValue` for typeahead and for the accessible name.
- Use a menu for commands. For choosing a value in a form, use [ListBox](/components/list-box/) or [Select](/components/select/).

## Common mistakes

- **Expecting the Dropdown item shorthand.** `icon`, `description` and `shortcut` are props of `Dropdown.Item`. In a standalone `Menu`, compose the content yourself (an `Icon`, a `Label`, a `Kbd`).
- **A Menu without a name.** A standalone menu has no trigger to take its name from; set `aria-label`.
- **Putting form controls in items.** A menu item is one target; a Switch or a TextField inside it is not reachable with the menu keys. Use selection (`selectionMode`) for on / off options.

## Related Components

- [Dropdown](/components/dropdown/)
- [MenuItem](/components/menu-item/)
- [MenuSection](/components/menu-section/)
- [ListBox](/components/list-box/)
