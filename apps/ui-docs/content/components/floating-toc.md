---
title: FloatingToc
description: "A floating table of contents: compact section bars that open a list of sections on hover or press."
template: reference
status: experimental
related: [components/hover-card, components/popover]
---

`FloatingToc` shows one short bar per section and opens a floating list of sections on hover (or on press). Which section is active is your state: pass `active` to the bars and items, for example from an `IntersectionObserver` (see [In Page Context](#in-page-context)).

## Usage

```tsx
import { FloatingToc } from "@rivetjs/ui/floating-toc";
```

::example{id=floating-toc-basic}

## Anatomy

```tsx
import { FloatingToc } from "@rivetjs/ui/floating-toc";

export default function Anatomy() {
  return (
    <FloatingToc>
      <FloatingToc.Trigger>
        <FloatingToc.Bar active />
        <FloatingToc.Bar />
      </FloatingToc.Trigger>
      <FloatingToc.Content aria-label="On this page">
        <FloatingToc.Item active>Overview</FloatingToc.Item>
        <FloatingToc.Item>Installation</FloatingToc.Item>
      </FloatingToc.Content>
    </FloatingToc>
  );
}
```

Additional exported parts: `FloatingToc.Root`.

## Examples

### Hierarchical

::example{id=floating-toc-hierarchical}

### Press Mode

::example{id=floating-toc-press-mode}

### Left Placement

::example{id=floating-toc-left}

### Custom Delays

::example{id=floating-toc-delays}

### Controlled

::example{id=floating-toc-controlled}

### In Page Context

::example{id=floating-toc-in-page}

## Styling Reference

The component’s parts emit these additional `data-slot` values: `floating-toc-trigger`, `floating-toc-content`.

### CSS Classes

- `.floating-toc__trigger` - The bar stack; hover / press target.
- `.floating-toc__bar` - One section bar (the line is `::after`).
- `.floating-toc__content` - The floating list.
- `.floating-toc__item` - One section entry.

### Data Attributes

- `[data-placement="left|right"]` on the trigger.
- `[data-active="true"]` on the active bar and item (`aria-current="location"` on the item).
- `[data-hovered="true"]`, `[data-pressed="true"]`, `[data-focus-visible="true"]` on items and the trigger.
- `[data-entering="true"]`, `[data-exiting="true"]`, `[data-placement]` on the content.

### CSS Variables

- `--floating-toc-bar-width` (16px), `--floating-toc-bar-active-width` (24px), `--floating-toc-bar-height` (2px), `--floating-toc-bar-level-step` (3px), `--floating-toc-bar-gap` (12px) on the trigger.
- `--floating-toc-item-indent` (0.75rem) on the content; `--floating-toc-level` on each bar and item (set from `level`).

## API Reference

See the [full module API](/api/rivetjs/ui/floating-toc/) for every named export and part prop type.

### FloatingToc

The cdk `DialogTrigger`.

| Prop           | Type                         | Default   | Description                                     |
| -------------- | ---------------------------- | --------- | ----------------------------------------------- |
| `placement`    | `"left" \| "right"`          | `"right"` | Side of the page                                |
| `triggerMode`  | `"hover" \| "press"`         | `"hover"` | What opens the list                             |
| `open`         | `boolean \| Signal<boolean>` | -         | Controlled open state (a signal is two-way)     |
| `defaultOpen`  | `boolean`                    | -         | Initial open state                              |
| `onOpenChange` | `(open: boolean) => void`    | -         | Open state changed                              |
| `openDelay`    | `number`                     | `200`     | Hover delay before opening (ms)                 |
| `closeDelay`   | `number`                     | `300`     | Delay before closing once the pointer left (ms) |

### FloatingToc.Trigger

A cdk `Button` (`aria-label` defaults to "Table of contents").

### FloatingToc.Bar

| Prop     | Type      | Default | Description                            |
| -------- | --------- | ------- | -------------------------------------- |
| `active` | `boolean` | -       | The current section                    |
| `level`  | `number`  | `1`     | Nesting depth; deeper bars are shorter |

### FloatingToc.Content

The cdk `Popover` (`offset` 8, placement from the root: `"left top"` for a right TOC, `"right top"` for a left one; flips when there is no room). Hover mode: a non-modal popover (no dialog role, so `id` is not rendered); press mode: a dialog.

### FloatingToc.Item

A cdk `Button`; a press also closes the list (both modes).

| Prop     | Type      | Default | Description                              |
| -------- | --------- | ------- | ---------------------------------------- |
| `active` | `boolean` | -       | The current section                      |
| `level`  | `number`  | `1`     | Nesting depth; deeper items are indented |

## Accessibility

The trigger is a button named “Table of contents” by default. Items are buttons; pressing an item closes the popover. Supply an `onPress` handler to navigate to the section and meaningful item text. Hover-mode content is non-modal.

## Related Components

- [HoverCard](/components/hover-card/)
- [Popover](/components/popover/)
