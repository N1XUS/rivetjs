---
title: ContextMenu
description: "A menu opened by a right click (or a long press on touch) at the pointer, with sections, selection and submenus."
template: reference
status: experimental
related: [components/dropdown, components/command]
---

`ContextMenu` replaces the browser's right-click menu on an area with your own menu, opened where the pointer is. It is the cdk `MenuTrigger` with `trigger="contextMenu"` and the `Dropdown` surface, so items, sections, selection and submenus work the same as in a [Dropdown](/components/dropdown/). On iOS, where browsers fire no `contextmenu` event, a long press opens it. Nothing loads before the first right click.

## Usage

```tsx
import { ContextMenu } from "@rivetjs/ui/context-menu";
```

::example{id=context-menu-basic}

## Anatomy

```tsx
import { ContextMenu } from "@rivetjs/ui/context-menu";

export default function Anatomy() {
  return (
    <ContextMenu>
      <ContextMenu.Trigger>Right click here</ContextMenu.Trigger>
      <ContextMenu.Popover>
        <ContextMenu.Menu>
          <ContextMenu.Section>
            <ContextMenu.Item id="copy">
              <ContextMenu.ItemIndicator />
            </ContextMenu.Item>
          </ContextMenu.Section>
          <ContextMenu.Separator />
          <ContextMenu.SubmenuTrigger>
            <ContextMenu.Item id="share">
              <ContextMenu.SubmenuIndicator />
            </ContextMenu.Item>
            <ContextMenu.Popover>
              <ContextMenu.Menu>…</ContextMenu.Menu>
            </ContextMenu.Popover>
          </ContextMenu.SubmenuTrigger>
        </ContextMenu.Menu>
      </ContextMenu.Popover>
    </ContextMenu>
  );
}
```

## Controlled

`isOpen` takes a value or a two-way signal. `onOpenChange` reports changes.

::example{id=context-menu-controlled}

## Disabled

`isDisabled` turns the custom menu off: the browser's own context menu appears.

::example{id=context-menu-disabled}

## Long Press

On iOS a touch long press (500 ms) opens the menu. Elsewhere touch browsers fire `contextmenu` on a long press themselves.

::example{id=context-menu-long-press}

## Sections

::example{id=context-menu-sections}

## Selection

`selectionMode` and `selectedKeys` on `.Menu`, as in a Dropdown.

::example{id=context-menu-selection}

## Submenus

::example{id=context-menu-submenus}

## Styling Reference

### CSS Classes

- `.context-menu__trigger` - The area that listens for the right click.
- `.context-menu__popover` - The floating surface (also `.dropdown__popover`).
- `.context-menu__menu` - The list (also `.dropdown__menu`).
- `.context-menu__separator` - A divider between items.
- Items, sections and indicators use the [Dropdown](/components/dropdown/) classes.

### Data Attributes

- `[data-slot]`: `context-menu-trigger`, `context-menu-popover`, `context-menu-menu`.
- `[data-disabled="true"]` on the trigger when `isDisabled`.
- `[data-entering]` / `[data-exiting]` and `[data-placement]` on the popover.

## API Reference

### ContextMenu

| Prop           | Type                         | Default | Description                                          |
| -------------- | ---------------------------- | ------- | ---------------------------------------------------- |
| `isOpen`       | `boolean \| Signal<boolean>` | -       | Open state (controlled, or two-way)                  |
| `defaultOpen`  | `boolean`                    | -       | Initial open state (uncontrolled)                    |
| `onOpenChange` | `(isOpen: boolean) => void`  | -       | Called when the menu opens or closes                 |
| `isDisabled`   | `boolean`                    | `false` | No custom menu: the browser's own menu shows. Read once |
| `children`     | `Content`                    | -       | The trigger and the popover                          |

### ContextMenu.Trigger

A `div` that receives the right click and the iOS long press. Not focusable unless you pass `tabIndex`; a focusable trigger also opens on Shift+F10 and the context-menu key. Takes `div` props and `class`.

### ContextMenu.Popover

| Prop        | Type        | Default          | Description                        |
| ----------- | ----------- | ---------------- | ---------------------------------- |
| `placement` | `Placement` | `"bottom start"` | Side of the pointer                |
| `offset`    | `number`    | `0`              | Distance from the pointer          |

Also takes the cdk Popover props, except the open state ones and `triggerRef`.

### ContextMenu.Menu, Item, ItemIndicator, Section, SubmenuTrigger, SubmenuIndicator

The [Dropdown](/components/dropdown/) parts: see their API reference.

### ContextMenu.Separator

A `Separator` that the menu treats as a collection leaf.

## Accessibility

- Mouse: right click opens the menu at the pointer; a right click elsewhere closes it.
- Keyboard: on a focusable trigger, Shift+F10 or the context-menu key opens it. Arrows move, Enter runs, Escape closes and focus returns to the trigger.
- Touch: a long press opens it.
- The list is a `role="menu"`; name it with `aria-label` on `.Menu`.

## Related Components

- [Dropdown](/components/dropdown/): The same menu opened by a button.
- [Command](/components/command/): A searchable palette of actions.
