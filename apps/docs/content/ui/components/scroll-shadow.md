---
title: Scroll shadow
description: "@rivetjs/ui ScrollShadow: a scroll container that fades its edges while more content is hidden, with scroll-state attributes and a visibility callback."
template: reference
status: experimental
related: [ui/heroui-port]
---

`ScrollShadow` is a scroll container that fades its start and end edges while content is hidden beyond them. Port of HeroUI v3.2.6 [ScrollShadow](https://www.heroui.com/docs/components/scroll-shadow).

## Import

```tsx
import { ScrollShadow } from "@rivetjs/ui/scroll-shadow";
```

## Usage

```tsx
import { ScrollShadow } from "@rivetjs/ui/scroll-shadow";

export default function Page() {
  return (
    <ScrollShadow class="max-h-[240px] p-4" size={40}>
      <p>Long content …</p>
    </ScrollShadow>
  );
}
```

## Props

| Prop | Type | Default |
| --- | --- | --- |
| `orientation` | `vertical`, `horizontal` | `vertical` |
| `size` | shadow size in px | `40` |
| `offset` | scroll distance in px before a shadow shows | `0` |
| `visibility` | `auto`, `both`, `top`, `bottom`, `left`, `right`, `none` | `auto` |
| `isEnabled` | detect the scroll state | `true` |
| `hideScrollBar` | hide the scroll bar | `false` |
| `variant` | `fade` | `fade` |
| `onVisibilityChange` | `(visibility) => void` | — |

Every prop can change after render (`orientation={o()}`): the same element updates and keeps its scroll position. The root is generic over the element (`render`).

## Scroll state

The server renders `data-scroll-shadow-mode="auto"` and the `--scroll-shadow-size` / `--scroll-shadow-offset` variables, so browsers with scroll-driven animations paint the fade without measuring. On the client (on a resumed page too, without a user event) the container is measured on scroll, on resize and when its content changes, and it gets `data-top-scroll` / `data-bottom-scroll` (`data-left-scroll` / `data-right-scroll` when horizontal), or `data-top-bottom-scroll` / `data-left-right-scroll` when both edges are hidden. `onVisibilityChange` receives the same state. A `visibility` other than `auto`, or `isEnabled={false}`, sets `data-scroll-shadow-mode="manual"`; a controlled `visibility` writes its attributes directly.

`useScrollShadow({ containerRef, orientation, offset, visibility, isEnabled, onVisibilityChange })` runs the same detection on your own element (`containerRef` is a `ref()` from `@rivetjs/runtime/dom`).

## Differences from HeroUI React

- `class`, not `className`; `style` is a style object.
- `containerRef` of `useScrollShadow` is an element accessor; the other options are read when they change (pass getters for live values).
