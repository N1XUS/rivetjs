---
title: Dropdown
description: "Displays a menu of actions or options in a popover, triggered by a button."
template: reference
status: experimental
related: [components/button, components/popover, components/kbd]
---

`Dropdown` shows a menu of actions or options in a popover when its trigger is pressed. It wraps the [cdk Menu](site:cdk/components/menu/): the root is a cdk `MenuTrigger`, `Dropdown.Popover` a cdk `Popover`, `Dropdown.Menu` a cdk `Menu`, and items / sections / indicators are the `@rivetjs/ui/menu-item` / `menu-section` parts (also usable standalone through `@rivetjs/ui/menu`).

Notes:

- `class`, not `className`. `selectedKeys` (menu or section) and `isOpen` take a signal (two-way) or a value; render props are accessors (`({ isSelected }) => isSelected() ? … : …`).
- Default indicators are lucide icons with `data-slot` attributes: `Check` (with the stroke-draw animation), a filled `Circle` for `type="dot"`, `ChevronRight` for submenus.
- `Dropdown.Popover` is optional: a `Dropdown.Menu` outside one renders its own popover (`placement` / `offset` / `crossOffset` / `shouldFlip` go on the Menu), also inside a `Dropdown.SubmenuTrigger`. Write the Popover to style it or to put more than the menu in it (see [Item shorthand](#item-shorthand)).
- `Dropdown.Item` shorthand: string children become a `Label` and the `textValue`; `icon` (lucide icon data), `description` and `shortcut` (`"command+N"`: known keys as `Kbd.Abbr`, the rest as `Kbd.Content`; or any content) render the full item anatomy.

Accessibility: ARIA `menu` with `menuitem` / `menuitemradio` / `menuitemcheckbox` items, keyboard navigation and typeahead, submenus on ArrowRight / hover, focus returns to the trigger on close.

## Usage

```tsx
import { Dropdown } from "@rivetjs/ui/dropdown";
```

::example{id=dropdown-default}

## Anatomy

```tsx
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Header } from "@rivetjs/ui/header";
import { Kbd } from "@rivetjs/ui/kbd";
import { Label } from "@rivetjs/ui/label";
import { Separator } from "@rivetjs/ui/separator";

export default () => (
  <Dropdown>
    <Dropdown.Trigger>
      <Button />
    </Dropdown.Trigger>
    <Dropdown.Popover>{/* optional */}
      <Dropdown.Menu>
        <Dropdown.Item>
          <Label />
          <Description />
          <Kbd slot="keyboard" />
          <Dropdown.ItemIndicator />
        </Dropdown.Item>
        <Separator />
        <Dropdown.Section>
          <Header />
          <Dropdown.Item />
        </Dropdown.Section>
        <Dropdown.SubmenuTrigger>
          <Dropdown.Item>
            <Label />
            <Dropdown.SubmenuIndicator />
          </Dropdown.Item>
          <Dropdown.Popover>
            <Dropdown.Menu>
              <Dropdown.Item />
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.SubmenuTrigger>
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown>
)
```

## Examples

### Item Shorthand

Without a `Dropdown.Popover`, `Dropdown.Menu` renders the popover itself, and a string item is a `Label` with its `textValue`. The shorthand renders the same markup as the explicit parts:

```tsx
import { Copy, Trash2 } from "lucide";

// explicit parts
<Dropdown>
  <Button>Actions</Button>
  <Dropdown.Popover placement="bottom end">
    <Dropdown.Menu>
      <Dropdown.Item id="copy" textValue="Copy link">
        <Icon icon={Copy} size={16} class="menu-item__icon" />
        <Label>Copy link</Label>
        <Kbd class="menu-item__shortcut" slot="keyboard" variant="light">
          <Kbd.Abbr keyValue="command" />
          <Kbd.Content>C</Kbd.Content>
        </Kbd>
      </Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown.Popover>
</Dropdown>

// shorthand
<Dropdown>
  <Button>Actions</Button>
  <Dropdown.Menu placement="bottom end">
    <Dropdown.Item id="copy" icon={Copy} shortcut="command+C">
      Copy link
    </Dropdown.Item>
    <Dropdown.Item id="delete" variant="danger" icon={Trash2} description="Move to trash">
      Delete
    </Dropdown.Item>
  </Dropdown.Menu>
</Dropdown>
```

With `description`, the label and description sit in a `.menu-item__text` column and the icon aligns to the first line. Function children (render props) skip the shorthand.

### With Icons

::example{id=dropdown-with-icons}

### With Descriptions

::example{id=dropdown-with-descriptions}

### With Disabled Items

::example{id=dropdown-with-disabled-items}

### With Sections

::example{id=dropdown-with-sections}

### With Multiple Selection

::example{id=dropdown-with-multiple-selection}

### Controlled

::example{id=dropdown-controlled}

### Controlled Open State

::example{id=dropdown-controlled-open-state}

### With Single Selection

::example{id=dropdown-with-single-selection}

### Single With Custom Indicator

::example{id=dropdown-single-with-custom-indicator}

### With Section Level Selection

::example{id=dropdown-with-section-level-selection}

### With Keyboard Shortcuts

::example{id=dropdown-with-keyboard-shortcuts}

### With Submenus

::example{id=dropdown-with-submenus}

### With Custom Submenu Indicator

::example{id=dropdown-with-custom-submenu-indicator}

### Custom Trigger

::example{id=dropdown-custom-trigger}

### Long Press Trigger

::example{id=dropdown-long-press-trigger}

## Customization

### Tailwind CSS

::example{id=dropdown-custom-styles}

### Global CSS

To customize the Dropdown component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .dropdown {
    @apply flex flex-col gap-1;
  }

  .dropdown__trigger {
    @apply outline-none;
  }

  .dropdown__popover {
    @apply rounded-lg border border-border bg-overlay p-2;
  }

  .dropdown__menu {
    @apply flex flex-col gap-1;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Dropdown component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/dropdown.css)):

#### Base Classes
- `.dropdown` - Base dropdown container
- `.dropdown__trigger` - The button or element that triggers the dropdown
- `.dropdown__popover` - The popover container
- `.dropdown__menu` - The menu container inside the popover

#### State Classes
- `.dropdown__trigger[data-focus-visible="true"]` - Focused trigger state
- `.dropdown__trigger[data-disabled="true"]` - Disabled trigger state
- `.dropdown__trigger[data-pressed="true"]` - Pressed trigger state
- `.dropdown__popover[data-entering]` - Entering animation state
- `.dropdown__popover[data-exiting]` - Exiting animation state
- `.dropdown__menu[data-selection-mode="single"]` - Single selection mode
- `.dropdown__menu[data-selection-mode="multiple"]` - Multiple selection mode

### Menu Component Classes

The Dropdown component uses Menu, MenuItem, and MenuSection as base components. These classes are also available for customization:

#### Menu Classes
- `.menu` - Base menu container ([menu.css](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/menu.css))
  - `[data-slot="separator"]` - Separator elements within the menu

#### MenuItem Classes
- `.menu-item` - Base menu item container ([menu-item.css](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/menu-item.css))
- `.menu-item__indicator` - Selection indicator (checkmark or dot)
  - `[data-slot="menu-item-indicator--checkmark"]` - Checkmark indicator SVG
  - `[data-slot="menu-item-indicator--dot"]` - Dot indicator SVG
- `.menu-item__indicator--submenu` - Submenu indicator (chevron)
- `.menu-item--default` - Default variant styling
- `.menu-item--danger` - Danger variant styling
- `.menu-item__icon` / `.menu-item__text` / `.menu-item__shortcut` - Rivet: the `icon` / `description` / `shortcut` shorthand parts

#### MenuItem State Classes
- `.menu-item[data-focus-visible="true"]` - Focused item state (keyboard focus)
- `.menu-item[data-focus="true"]` - Focused item state
- `.menu-item[data-pressed]` - Pressed item state
- `.menu-item[data-hovered]` - Hovered item state
- `.menu-item[data-selected="true"]` - Selected item state
- `.menu-item[data-disabled]` - Disabled item state
- `.menu-item[data-has-submenu="true"]` - Item with submenu
- `.menu-item[data-selection-mode="single"]` - Single selection mode
- `.menu-item[data-selection-mode="multiple"]` - Multiple selection mode
- `.menu-item[aria-checked="true"]` - Checked item (ARIA)
- `.menu-item[aria-selected="true"]` - Selected item (ARIA)

#### MenuSection Classes
- `.menu-section` - Base menu section container ([menu-section.css](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/menu-section.css))

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` on trigger and items
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on trigger and items
- **Disabled**: `:disabled` or `[data-disabled="true"]` on trigger and items
- **Pressed**: `:active` or `[data-pressed="true"]` on trigger and items
- **Selected**: `[data-selected="true"]` or `[aria-selected="true"]` on items

## API Reference

### Dropdown

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | - | Sets the open state of the menu (controlled) |
| `defaultOpen` | `boolean` | - | Sets the default open state of the menu (uncontrolled) |
| `onOpenChange` | `(isOpen: boolean) => void` | - | Handler called when the open state changes |
| `trigger` | `"press" \| "longPress"` | `"press"` | The type of interaction that triggers the menu |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Dropdown content |

### Dropdown.Trigger

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content \| RenderFunction` | - | Trigger content or render function |

All [cdk Button](site:cdk/components/button/) props are also supported when using a Button as the trigger.

### Dropdown.Popover

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placement` | `"bottom" \| "bottom left" \| "bottom right" \| "bottom start" \| "bottom end" \| "top" \| "top left" \| "top right" \| "top start" \| "top end" \| "left" \| "left top" \| "left bottom" \| "start" \| "start top" \| "start bottom" \| "right" \| "right top" \| "right bottom" \| "end" \| "end top" \| "end bottom"` | `"bottom"` | Placement of the popover relative to the trigger |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Content children |

All [cdk Popover](site:cdk/components/popover/) props are also supported.

### Dropdown.Menu

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selectionMode` | `"single" \| "multiple" \| "none"` | `"none"` | Whether single or multiple selection is enabled |
| `selectedKeys` | `Iterable<Key>` | - | The currently selected keys (controlled) |
| `defaultSelectedKeys` | `Iterable<Key>` | - | The initial selected keys (uncontrolled) |
| `onSelectionChange` | `(keys: Selection) => void` | - | Handler called when the selection changes |
| `disabledKeys` | `Iterable<Key>` | - | Keys of disabled items |
| `onAction` | `(key: Key) => void` | - | Handler called when an item is activated |
| `placement` / `offset` / `crossOffset` / `shouldFlip` | `Dropdown.Popover` props | - | Rivet: the popover the Menu renders when it is not inside a `Dropdown.Popover` |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Menu content |

All [cdk Menu](site:cdk/components/menu/) props are also supported.

### Dropdown.Section

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selectionMode` | `"single" \| "multiple"` | - | Selection mode for items within this section |
| `selectedKeys` | `Iterable<Key>` | - | The currently selected keys (controlled) |
| `defaultSelectedKeys` | `Iterable<Key>` | - | The initial selected keys (uncontrolled) |
| `onSelectionChange` | `(keys: Selection) => void` | - | Handler called when the selection changes |
| `disabledKeys` | `Iterable<Key>` | - | Keys of disabled items |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Section content |

All [cdk MenuSection](site:cdk/components/menu/) props are also supported.

### Dropdown.Item

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `Key` | - | Unique identifier for the item |
| `textValue` | `string` | - | Text content of the item for typeahead |
| `variant` | `"default" \| "danger"` | `"default"` | Visual variant of the item |
| `icon` | `IconNode` | - | Rivet: leading lucide icon (`.menu-item__icon`, 16 px; danger items tint it) |
| `description` | `Content` | - | Rivet: second line under the label (`Description`, wires `aria-describedby`) |
| `shortcut` | `string \| Content` | - | Rivet: trailing `Kbd` (`"command+shift+D"`: known keys as `Kbd.Abbr`, the rest as `Kbd.Content`) |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content \| RenderFunction` | - | Item content or render function; a string = `Label` + `textValue` |

All [cdk MenuItem](site:cdk/components/menu/) props are also supported.

### Dropdown.ItemIndicator

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `"checkmark" \| "dot"` | `"checkmark"` | Type of indicator to display |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content \| RenderFunction` | - | Custom indicator content or render function |

When using a render function, these values are provided:

| Prop | Type | Description |
|------|------|-------------|
| `isSelected` | `boolean` | Whether the item is selected |
| `isIndeterminate` | `boolean` | Whether the item is in an indeterminate state |

### Dropdown.SubmenuIndicator

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Custom indicator content |

### Dropdown.SubmenuTrigger

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | - | Additional CSS classes |
| `children` | `Content` | - | Submenu trigger content |

All [cdk SubmenuTrigger](site:cdk/components/menu/) props are also supported.

### Render Props

When using render functions with Dropdown.Item, these values are provided:

| Prop | Type | Description |
|------|------|-------------|
| `isSelected` | `() => boolean` | Whether the item is selected |
| `isFocused` | `() => boolean` | Whether the item is focused |
| `isDisabled` | `() => boolean` | Whether the item is disabled |
| `isPressed` | `() => boolean` | Whether the item is being pressed |

::api{symbol="@rivetjs/ui/dropdown#DropdownRootProps"}

## Accessibility

The Dropdown component implements the ARIA menu pattern and provides:

- Full keyboard navigation support (arrow keys, home/end, typeahead)
- Screen reader announcements for actions and selection changes
- Proper focus management
- Support for disabled states
- Long press interaction support
- Submenu navigation

For more information, see the [cdk Menu page](site:cdk/components/menu/).

## Related Components

- [Button](/components/button/): Allows a user to perform an action.
- [Popover](/components/popover/): Displays content in context with a trigger.
- [Separator](/components/separator/): Visual divider between content.
- [Listbox](/components/list-box/): Scrollable list of selectable items.
