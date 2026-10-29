---
title: MenuItem
description: "One action or option inside a Menu or Dropdown, with danger and disabled states, selection indicators and a render function."
template: reference
status: experimental
related: [components/menu, components/dropdown, components/menu-section]
---

`MenuItem` is one row of a [Menu](/components/menu/): a command that runs `onAction`, a link (`href`), or an option when the menu or its section has a `selectionMode`. It is the styled cdk `MenuItem`; inside a Menu it is also `Menu.Item`, and `Dropdown.Item` wraps it with the `icon` / `description` / `shortcut` shorthand.

## Usage

```tsx
import { Menu } from "@rivetjs/ui/menu";
import { MenuItem } from "@rivetjs/ui/menu-item";

<Menu aria-label="Account">
  <MenuItem id="settings">Settings</MenuItem>
  <MenuItem id="sign-out" variant="danger">
    Sign out
  </MenuItem>
</Menu>;
```

::example{id=menu-item-variants}

## Anatomy

```tsx
<MenuItem>
  <MenuItem.Indicator />
  <Label />
  <MenuItem.SubmenuIndicator />
</MenuItem>
```

| Part | Element | Notes |
| --- | --- | --- |
| `MenuItem` (`MenuItem.Root`) | `div` with `role="menuitem"`, `menuitemradio` or `menuitemcheckbox` | `data-slot="menu-item"`; children are content or a render function of the item state. |
| `MenuItem.Indicator` | `span aria-hidden` | `type="checkmark"` (default, a drawn check) or `"dot"`; `data-visible` when the item is selected. Children replace the icon. |
| `MenuItem.SubmenuIndicator` | `span aria-hidden` | Chevron; renders only in an item that opens a submenu (`Dropdown.SubmenuTrigger`). |

## Examples

### Variants

`variant="danger"` marks a destructive action: the item's `Label`, its indicator and the `Dropdown.Item` shorthand icon take the danger color. An icon you add yourself needs `class="text-danger"`, as in the example. The default variant is `default`.

### Disabled items

`isDisabled` on the item, or its key in the menu's `disabledKeys`, removes it from the keyboard order and from pointer activation; the item gets `aria-disabled="true"` and `data-disabled`.

### Links

An item with `href` (and `target`, `rel`, `download`) navigates like a link when it is activated. The [example](#usage) shows a disabled link item.

### Render function

Children can be a function of the item state (`isFocused()`, `isSelected()`, `isHovered()`, `isPressed()`, `isDisabled()`, `selectionMode`, `hasSubmenu`); the state values are accessors, so the content updates when they change. In the example the first item changes its description while it has the focus.

### Selection indicators

With a selection mode, add `MenuItem.Indicator` to show the selection; use `type="dot"` for a single choice. See [MenuSection](/components/menu-section/) for an example with both kinds.

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.menu-item`, `.menu-item--default`, `.menu-item--danger` | Item and its variant. |
| `.menu-item__indicator` | Indicator (`[data-slot="menu-item-indicator--checkmark"]` / `--dot` on the icon). |
| `.menu-item__indicator--submenu` | Submenu chevron (`data-slot="submenu-indicator"`). |
| `.menu-item__icon`, `.menu-item__text`, `.menu-item__shortcut` | Parts of the `Dropdown.Item` shorthand. |
| `[data-focused]`, `[data-focus-visible]`, `[data-hovered]`, `[data-pressed]`, `[data-selected]`, `[data-disabled]` | Item state. |
| `[data-selection-mode="single" \| "multiple"]`, `[data-has-submenu]` | Selection mode and submenu items. |

## API Reference

See the [full module API](/api/rivetjs/ui/menu-item/) for every named export and part prop type.

| Prop      | Values              | Default   |
| --------- | ------------------- | --------- |
| `variant` | `danger`, `default` | `default` |

::api{symbol="@rivetjs/ui/menu-item#MenuItemIndicatorProps"}

::api{symbol="@rivetjs/ui/menu-item#MenuItemRootProps"}

::api{symbol="@rivetjs/ui/menu-item#MenuItemSubmenuIndicatorProps"}

## Accessibility

- The role follows the selection mode: `menuitem` without selection, `menuitemradio` (single) or `menuitemcheckbox` (multiple) with `aria-checked`.
- Give items with rich content a `textValue`: it is used for typeahead and as the plain-text name.
- The indicators are `aria-hidden`; the selection is announced from `aria-checked`, not from the icon.
- Keep a disabled item visible when the user should learn that the action exists but is not available now; remove it when it never applies.

## Common mistakes

- **Using `onAction` on the item and the menu for the same thing.** The item's `onAction` runs first, then the menu's `onAction` with the item key. Handle an action in one place.
- **Expecting `icon` / `description` / `shortcut` on `MenuItem`.** Those props belong to `Dropdown.Item`; on `MenuItem` compose an `Icon`, a `Label` and a `Description` as children.
- **A submenu indicator outside a submenu trigger.** `MenuItem.SubmenuIndicator` renders nothing unless the item opens a submenu.

## Related Components

- [Menu](/components/menu/)
- [Dropdown](/components/dropdown/)
- [MenuSection](/components/menu-section/)
