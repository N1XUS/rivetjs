---
title: HoverCard
description: "A card that previews more content when the pointer rests on its trigger, when the trigger gets keyboard focus, or on a touch long press."
template: reference
status: experimental
related: [components/tooltip, components/popover, components/avatar]
---

`HoverCard` shows a floating card for a trigger, such as a profile behind a name or a page behind a link, without navigating away. It is built on the cdk `PreviewTrigger`. The card waits `openDelay` (700 ms) before it opens. A safe area keeps it open while the pointer travels from the trigger to the card, so its content can be interactive. Nothing loads before the first hover or focus.

## Usage

```tsx
import { HoverCard } from "@rivetjs/ui/hover-card";
```

::example{id=hover-card-basic}

## Anatomy

```tsx
import { HoverCard } from "@rivetjs/ui/hover-card";

export default function Anatomy() {
  return (
    <HoverCard>
      <HoverCard.Trigger>@mara</HoverCard.Trigger>
      <HoverCard.Content aria-label="Mara">
        <HoverCard.Arrow />…
      </HoverCard.Content>
    </HoverCard>
  );
}
```

## Controlled

`isOpen` takes a value or a two-way signal. `onOpenChange` reports changes.

::example{id=hover-card-controlled}

## Custom Delays

::example{id=hover-card-custom-delays}

## Placements

::example{id=hover-card-placements}

## With Arrow

::example{id=hover-card-with-arrow}

## With Image

When the trigger wraps a link, give the trigger `tabIndex={-1}` so the link stays the only tab stop. The link's focus does not open the card; hover does.

::example{id=hover-card-with-image}

## Styling Reference

### CSS Classes

- `.hover-card__trigger` - The inline wrapper around the trigger content.
- `.hover-card__content` - The floating card.
- `.hover-card__arrow` - The optional tip pointing at the trigger.

### Data Attributes

- `[data-slot]`: `hover-card-trigger`, `hover-card-content`, `hover-card-arrow`, `hover-card-arrow-tip`.
- `[data-entering]` / `[data-exiting]` on the content: fade, zoom and slide. Skipped when one card replaces another during the shared warm-up.
- `[data-placement="top | bottom | left | right"]` on the content and the arrow.

## API Reference

### HoverCard

| Prop           | Type                         | Default | Description                                          |
| -------------- | ---------------------------- | ------- | ---------------------------------------------------- |
| `isOpen`       | `boolean \| Signal<boolean>` | -       | Open state (controlled, or two-way)                  |
| `defaultOpen`  | `boolean`                    | -       | Initial open state (uncontrolled)                    |
| `onOpenChange` | `(isOpen: boolean) => void`  | -       | Called when the card opens or closes                 |
| `openDelay`    | `number`                     | `700`   | ms before the card opens after hover                 |
| `closeDelay`   | `number`                     | `300`   | ms before it closes after the pointer / focus leaves |
| `isDisabled`   | `boolean`                    | `false` | Never open                                           |
| `children`     | `Content`                    | -       | The trigger and the content                          |

### HoverCard.Trigger

An inline `span` (`role="button"`, `tabIndex` 0) that receives hover, focus and long press. Takes `span` props, `class` and `render`.

### HoverCard.Content

| Prop        | Type        | Default | Description               |
| ----------- | ----------- | ------- | ------------------------- |
| `placement` | `Placement` | `"top"` | Side of the trigger       |
| `offset`    | `number`    | `8`     | Distance from the trigger |

Also takes the cdk Popover props, except the open state ones and `triggerRef`, which the root owns.

### HoverCard.Arrow

The cdk `OverlayArrow` with a default CSS tip. Pass children for a custom tip.

## Accessibility

- Pointer: hover opens the card after `openDelay`, and the safe area keeps it open on the way to it.
- Keyboard: focusing the trigger opens it, Tab moves into it, Escape closes it.
- Touch: a long press opens it and moves focus into it.
- The card is a non-modal `role="dialog"`: name it with `aria-label`. The trigger carries `aria-haspopup="dialog"` and `aria-expanded`.
- Delays are shared with tooltips: once one has opened, the next opens at once.

## Related Components

- [Tooltip](/components/tooltip/): Short text hints.
- [Popover](/components/popover/): A card opened by a press.
- [Avatar](/components/avatar/): Common trigger content.
