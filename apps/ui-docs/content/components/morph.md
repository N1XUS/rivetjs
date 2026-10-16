---
title: Morph
description: "A pill that morphs into a panel and back: box, radius and surface animate continuously, content cross-fades, focus moves in and returns."
template: reference
status: experimental
related: [components/button, components/popover, components/drawer, components/list-box]
---

`Morph` turns a compact pill (a bag count, a notification badge, a delivery chip) into a small panel in place. The surface's box, radius and background animate continuously from one to the other, the pill's content fades out while the panel's content fades in with a short stagger, and the press that opened it can reverse it at any moment. The page around it never moves: the footprint is always the pill's size and the panel overflows it.

Accessibility: `Morph.Trigger` is a native button with `aria-expanded` and `aria-controls`; the panel is a `dialog` named by `aria-label` on `Morph.ExpandedContent`. Opening moves focus to the first focusable element in the panel (or one marked `data-morph-autofocus`); `Morph.Close`, Escape and a press outside close it and return focus to the trigger; tabbing out of the panel closes it and leaves focus where it went. The hidden side is `inert`, so neither keyboard nor screen readers reach it.

## Usage

```tsx
import { Morph } from "@rivetjs/ui/morph";
```

::example{id=morph-basic}

## Anatomy

```tsx
import { Morph } from "@rivetjs/ui/morph";

export default function Anatomy() {
  return (
    <Morph>
      <Morph.CollapsedContent>
        2 items
        <Morph.Trigger>View</Morph.Trigger>
      </Morph.CollapsedContent>
      <Morph.ExpandedContent aria-label="Order summary" class="w-80">
        <p>…</p>
        <Morph.Close>Keep shopping</Morph.Close>
      </Morph.ExpandedContent>
    </Morph>
  );
}
```

A press anywhere on the collapsed content opens the morph; `Morph.Trigger` is its keyboard and focus target. Set the panel's width with a class on `Morph.ExpandedContent`; its height follows the content. Both sizes are measured when the morph starts, so content can change between opens.

## Directions

::example{id=morph-directions}

## Variants

::example{id=morph-variants}

`primary` (default) inverts the surface: inside it the theme tokens (`foreground`, `background`, `muted`, `default`, `separator`, `border`) are swapped, so Buttons, Separators and `text-muted` read correctly on the dark (light mode) or light (dark mode) panel.

## Controlled

::example{id=morph-controlled}

`isOpen` takes a value, an accessor or a two-way Signal; `defaultOpen` renders the panel open from the server with no script. Inside a Morph, `useMorph()` returns `{ isOpen, open, close, toggle }`.

## Animation

::example{id=morph-animation}

The motion is the house motion of `@rivetjs/cdk/motion` (the same integrator as the carousel, slider snap and drawer drag): one progress value from 0 to 1 drives the surface's width, height and radius as inline styles while it moves, and a `--morph-progress` variable drives the content fades in CSS. It is interruptible: a press, Escape or outside press mid-morph turns it around from where it is. At rest no inline style remains. `prefers-reduced-motion: reduce` and `animation="disabled"` jump between the states.

The same motion lifts a list item into a panel: `@rivetjs/ui/item-morph` (iOS-style long-press preview, [ListBox: Item Morph](/components/list-box/#item-morph)).

## Behaviour without JavaScript

Nothing runs at page load: the server renders the closed (or `defaultOpen`) state, and the press handler's code is fetched while the morph is visible, so the first press morphs at once.
