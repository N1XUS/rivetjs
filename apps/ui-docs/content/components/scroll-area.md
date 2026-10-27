---
title: ScrollArea
description: "Custom overlay scrollbars the Rivet UI look over native scrolling: hover or always visible, two sizes, optional edge fade."
template: reference
status: experimental
related: [components/scroll-shadow, components/card]
---

`ScrollArea` keeps native scrolling (wheel, touch, keyboard, scroll chaining) and draws its own thin, rounded scrollbars on top, the Rivet UI look. Behaviour is the [cdk ScrollArea](site:cdk/components/scroll-area/), a port of Radix UI ScrollArea.

## Usage

```tsx
import { ScrollArea } from "@rivetjs/ui/scroll-area";
```

::example{id=scroll-area-vertical}

## Anatomy

```tsx
import { ScrollArea } from "@rivetjs/ui/scroll-area";

export default function Tags() {
  return (
    <ScrollArea class="h-72 w-48">
      <ScrollArea.Viewport>{/* content */}</ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical">
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar orientation="horizontal" />
      <ScrollArea.Corner />
    </ScrollArea>
  );
}
```

A `Scrollbar` without children renders its `Thumb`. Add a `Scrollbar` per axis you want to scroll: an axis without one does not scroll (Radix).

Additional exported parts: `ScrollArea.Root`.

## Examples

### Horizontal

::example{id=scroll-area-horizontal}

### Both Axes

`Corner` fills the square where the two scrollbars meet.

::example{id=scroll-area-both}

### Always Visible

`variant="always"` keeps the scrollbars visible; `size="sm"` makes them 6 px instead of 10 px.

::example{id=scroll-area-always}

### With Shadow

`shadow` (`true` / `"vertical"` / `"horizontal"`) puts the [ScrollShadow](scroll-shadow.md) fade on the viewport, CSS only (scroll-driven; browsers without scroll timelines show no fade). `shadowSize` sets its size (default `40`).

::example{id=scroll-area-shadow}

### Resumability

On a resumed page the area loads no JavaScript until it is used: the first frame is server markup with native scrolling on both axes (`variant="always"` also server-renders its scrollbar tracks). The pointer entering the area, a wheel, a scroll or keyboard focus activates it; `variant="always"` (and `type="auto"`) activates when it scrolls into view. Once active it behaves exactly like Radix ScrollArea.

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.scroll-area` - Root; clips the viewport to its radius. Modifiers `.scroll-area--md` (default, 10 px bars) / `.scroll-area--sm` (6 px), `.scroll-area--hover` (default) / `.scroll-area--always`.
- `.scroll-area__viewport` - The native scroll container; focus ring on `:focus-visible`.
- `.scroll-area__scrollbar` - The track along an edge; tinted on hover; fades in / out with `data-state`.
- `.scroll-area__thumb` - Thin rounded thumb (`--scrollbar-thumb`), darker on hover and while dragged; 44 px hit area.
- `.scroll-area__corner` - The corner between two scrollbars.

### CSS Variables

| Variable                    | Default                 | Description                                          |
| --------------------------- | ----------------------- | ---------------------------------------------------- |
| `--scroll-area-size`        | `10px` (`6px` for `sm`) | Scrollbar thickness                                  |
| `--scroll-area-padding`     | `2px` (`1px` for `sm`)  | Space between the track edge and the thumb           |
| `--scrollbar-thumb`         | theme token             | Thumb colour                                         |
| `--scrollbar-track`         | theme token             | Track colour                                         |
| `--rv-scroll-area-thumb-*`  | set by the cdk          | Thumb width / height (Radix `--radix-scroll-area-*`) |
| `--rv-scroll-area-corner-*` | set by the cdk          | Corner width / height                                |

### Data Attributes

- `[data-slot]`: `scroll-area`, `scroll-area-viewport`, `scroll-area-scrollbar`, `scroll-area-thumb`, `scroll-area-corner`.
- `[data-orientation]` (`vertical` / `horizontal`) on scrollbars; `[data-state]` (`visible` / `hidden`) on scrollbars and thumbs.

## API Reference

See the [full module API](/api/rivetjs/ui/scroll-area/) for every named export and part prop type.

### ScrollArea

| Prop              | Type                                              | Default   | Description                                              |
| ----------------- | ------------------------------------------------- | --------- | -------------------------------------------------------- |
| `variant`         | `"hover"` \| `"always"`                           | `"hover"` | `hover`: scrollbars while the pointer is over the area   |
| `size`            | `"sm"` \| `"md"`                                  | `"md"`    | Scrollbar thickness                                      |
| `type`            | `"hover"` \| `"scroll"` \| `"auto"` \| `"always"` | -         | Radix visibility type; overrides the one `variant` picks |
| `scrollHideDelay` | `number`                                          | `600`     | Delay before `hover` / `scroll` scrollbars hide (ms)     |
| `shadow`          | `boolean` \| `"vertical"` \| `"horizontal"`       | `false`   | ScrollShadow fade on the viewport                        |
| `shadowSize`      | `number`                                          | `40`      | Fade size in px                                          |
| `dir`             | `"ltr"` \| `"rtl"`                                | inherited | Reading direction (vertical scrollbar side)              |
| `class`           | `string`                                          | -         | Additional CSS classes                                   |

Props are read once, when the area is created. The other parts take the cdk part props plus `class`: `Scrollbar` `orientation` and `forceMount`, `Thumb` / `Corner` / `Viewport` element props.

::api{symbol="@rivetjs/ui/scroll-area#ScrollAreaRootProps"}

## Accessibility

The viewport is the native scroll container, so screen readers and keyboard scrolling work as usual; the custom scrollbars are presentational. Give the viewport `tabIndex={0}` (and an `aria-label`) when its content has nothing focusable.

## Related Components

- [ScrollShadow](/components/scroll-shadow/): Fade the scrolled-away edges of a native scroll container.
- [Card](/components/card/): Content container with header, body, and footer.
