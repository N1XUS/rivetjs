---
title: Command
description: "A modal command palette: a search field that filters a list of grouped commands, with keyboard navigation, sizes and backdrop variants."
template: reference
status: experimental
related: [components/context-menu, components/autocomplete, components/modal]
---

`Command` opens a palette where people type to find and run an action. It is a cdk `Modal` holding a `Dialog` with an `Autocomplete`: the search field filters the list as you type, arrows move a virtual focus through it, Enter runs the highlighted command. The filter ignores case and accents and matches each item's `textValue`, so extra words there act as search terms. Nothing loads before the button is pressed.

## Usage

```tsx
import { Command } from "@rivetjs/ui/command";
```

::example{id=command-basic}

## Anatomy

```tsx
import { Button } from "@rivetjs/ui/button";
import { Command } from "@rivetjs/ui/command";

export default function Anatomy() {
  return (
    <Command>
      <Button>Open</Button>
      <Command.Backdrop>
        <Command.Container>
          <Command.Dialog>
            <Command.Header>…</Command.Header>
            <Command.InputGroup>
              <Command.InputGroup.Prefix>…</Command.InputGroup.Prefix>
              <Command.InputGroup.Input />
              <Command.InputGroup.ClearButton />
              <Command.InputGroup.Suffix>…</Command.InputGroup.Suffix>
            </Command.InputGroup>
            <Command.List>
              <Command.Group heading="…">
                <Command.Item id="…">…</Command.Item>
              </Command.Group>
              <Command.Separator />
            </Command.List>
            <Command.Footer>…</Command.Footer>
          </Command.Dialog>
        </Command.Container>
      </Command.Backdrop>
    </Command>
  );
}
```

Additional exported parts: `Command.Root`.

## Examples

### Clean

::example{id=command-clean}

### Dev Toolbar

::example{id=command-dev-toolbar}

### Launcher

::example{id=command-launcher}

### Minimal

::example{id=command-minimal}

### Split View

::example{id=command-split-view}

### Multiple Search Terms

::example{id=command-multiple-search-terms}

### Sizes

::example{id=command-sizes}

### Backdrop Variants

::example{id=command-backdrop-variants}

## Styling Reference

### CSS Classes

- `.command__backdrop` - The full-screen layer; `--opaque`, `--blur`, `--transparent`.
- `.command__container` - Positions the palette near the top of the screen.
- `.command__dialog` - The palette surface; `--sm`, `--md`, `--lg` set its width and `--command-max-height`.
- `.command__header` / `.command__footer` - Rows above and below.
- `.command__input-group`, `.command__input`, `.command__input-group-prefix`, `.command__input-group-suffix`, `.command__input-group-clear-button` - The search field.
- `.command__list`, `.command__group`, `.command__group-heading`, `.command__item`, `.command__separator`, `.command__empty` - The list.

### Data Attributes

- `[data-slot]`: `command-backdrop`, `command-container`, `command-dialog`, `command-header`, `command-input-group`, `command-input`, `command-list`, `command-item`, `command-group`, `command-footer`, `command-input-group-prefix`, `command-input-group-suffix`.
- `[data-empty]` on the input group while the field is empty (hides the clear button).
- `[data-focused]` on the highlighted item.

## API Reference

See the [full module API](/api/rivetjs/ui/command/) for every named export and part prop type.

### Command

| Prop           | Type                         | Default | Description                               |
| -------------- | ---------------------------- | ------- | ----------------------------------------- |
| `isOpen`       | `boolean \| Signal<boolean>` | -       | Open state (controlled, or two-way)       |
| `defaultOpen`  | `boolean`                    | -       | Initial open state (uncontrolled)         |
| `onOpenChange` | `(isOpen: boolean) => void`  | -       | Called when the palette opens or closes   |
| `children`     | `Content`                    | -       | A `Button` that opens it and the backdrop |

### Command.Backdrop

| Prop            | Type                                  | Default    | Description              |
| --------------- | ------------------------------------- | ---------- | ------------------------ |
| `variant`       | `"opaque" \| "blur" \| "transparent"` | `"opaque"` | Backdrop look            |
| `isDismissable` | `boolean`                             | `true`     | Close on a press outside |

### Command.Container

| Prop   | Type                   | Default | Description                      |
| ------ | ---------------------- | ------- | -------------------------------- |
| `size` | `"sm" \| "md" \| "lg"` | `"md"`  | Palette width and maximum height |

### Command.Dialog

| Prop                | Type                                                 | Default                                | Description                          |
| ------------------- | ---------------------------------------------------- | -------------------------------------- | ------------------------------------ |
| `inputValue`        | `string \| Signal<string>`                           | -                                      | Search text (controlled, or two-way) |
| `defaultInputValue` | `string`                                             | -                                      | Initial search text                  |
| `onInputChange`     | `(value: string) => void`                            | -                                      | Called as the text changes           |
| `filter`            | `(textValue: string, inputValue: string) => boolean` | case- and accent-insensitive substring | Which items stay visible             |
| `aria-label`        | `string`                                             | `"Command palette"`                    | Name of the dialog                   |

### Command.InputGroup

The cdk `SearchField` (`autoFocus` default `true`, `aria-label` default "Search commands"). Escape clears the text, a second Escape closes the palette.

### Command.InputGroup.Input

The cdk `Input`; `placeholder` default "Search commands...".

### Command.List

The cdk `Menu`: `onAction`, `renderEmptyState` (default "No results"), `items` for a dynamic collection.

### Command.Item

The `Dropdown.Item`: `id`, `textValue` (search terms), `icon`, `description`, `shortcut`, `variant`, `isDisabled`.

### Command.Group

A `Dropdown.Section` with a `heading`.

### Command.Header, Command.Footer, Command.InputGroup.Prefix, Command.InputGroup.Suffix

`div` parts.

## Accessibility

- Focus moves to the search field on open and returns to the button on close.
- Arrows move a virtual focus through the list (`aria-activedescendant`), Enter runs the command, Escape clears then closes.
- The palette is a modal `role="dialog"`; the list is a `role="menu"` named "Commands".
- Group headings label their sections.

## Related Components

- [ContextMenu](/components/context-menu/): Actions on a right click.
- [Autocomplete](/components/autocomplete/): A search field with suggestions in a form.
- [Modal](/components/modal/): The overlay underneath.
