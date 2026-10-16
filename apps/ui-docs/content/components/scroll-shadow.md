---
title: ScrollShadow
description: "Apply visual shadows to indicate scrollable content overflow with automatic detection of scroll position."
template: reference
status: experimental
related: [components/scroll-area, components/card]
---

`ScrollShadow` is a scroll container that fades its scrolled-away edges, so readers see there is more content.

Notes:

- `class`, not `className`.
- Every prop is live: changing `orientation`, `size`, `hideScrollBar`, `visibility` or `isEnabled` updates the same container and keeps its scroll position.
- `useScrollShadow` takes an element accessor (`containerRef`) instead of a React ref.
- An RTL page needs an RTL `lang` (for example `lang="ar"`) for the horizontal fade to flip: Tailwind v4 lowers `:dir(rtl)` to `:lang(…)`.
- Need custom scrollbars too? [ScrollArea](scroll-area.md) (Rivet addition) takes a `shadow` option that puts this fade on its viewport.

Accessibility: A plain `div` scroll container; the fade is a CSS mask and is not announced. Give a focusable scroll region a `tabIndex={0}` and an `aria-label` when it has no focusable content.

## Usage

```tsx
import { ScrollShadow } from "@rivetjs/ui/scroll-shadow";
```

::example{id=scroll-shadow-default}

## Examples

### Orientation

::example{id=scroll-shadow-orientation}

### Shadow Size

::example{id=scroll-shadow-size}

### With Card

::example{id=scroll-shadow-with-card}

### Hide Scroll Bar

::example{id=scroll-shadow-hide-scroll-bar}

### Visibility Change

::example{id=scroll-shadow-visibility-change}

## Customization

### Tailwind CSS

::example{id=scroll-shadow-custom-styles}

### Global CSS

To customize the ScrollShadow component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .scroll-shadow {
    @apply rounded-xl border border-default-200;
  }

  .scroll-shadow--vertical {
    @apply pr-2; /* Add padding for custom scrollbar styling */
  }

  .scroll-shadow--horizontal {
    @apply pb-2;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ScrollShadow component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/scroll-shadow.css)):

#### Base Classes

- `.scroll-shadow` - Root container element

#### Orientation Variants

- `.scroll-shadow--vertical` - Vertical scrolling (default)
- `.scroll-shadow--horizontal` - Horizontal scrolling

#### State Modifiers

- `.scroll-shadow--hide-scrollbar` - Hides native scrollbar

### CSS Variables

The ScrollShadow component uses CSS variables to size the fade mask and reserve space for visible native scrollbars:

| Variable                         | Default                             | Description                                                                                                         |
| -------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `--scroll-shadow-size`           | `40px`                              | Controls the fade gradient size. This is set from the `size` prop.                                                  |
| `--scroll-shadow-offset`         | `0px`                               | How far the container must be scrolled before the fade starts. This is set from the `offset` prop.                  |
| `--scroll-shadow-scrollbar-size` | `10px` (`0px` when `hideScrollBar`) | Reserves a solid mask gutter for the native scrollbar so the fade does not cover it. Override for wider scrollbars. |

### Data Attributes

The component uses data attributes to control shadow visibility:

- **Scroll States**: `[data-top-scroll]`, `[data-bottom-scroll]`, `[data-left-scroll]`, `[data-right-scroll]` - Applied when content can be scrolled in that direction
- **Combined States**: `[data-top-bottom-scroll]`, `[data-left-right-scroll]` - Applied when content can be scrolled in both directions
- **Orientation**: `[data-orientation="vertical"]` or `[data-orientation="horizontal"]` - Indicates scroll direction
- **Size**: `[data-scroll-shadow-size]` - Contains the shadow gradient size value
- **Shadow Mode**: `[data-scroll-shadow-mode]` - `"auto"` when the fade is derived from the scroll position, `"manual"` when `visibility` is controlled or `isEnabled` is `false`

### Scroll-Driven Fade

In `auto` mode, browsers that support [scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline)
derive the fade from the scroll position in CSS. The mask is therefore correct on the very
first paint, with no measurement and no flash of unfaded content while the page resumes. Browsers
without support fall back to the `[data-*-scroll]` attributes above, which are written once the
page has resumed (no user event needed). Two things to keep in mind when customizing:

- In `auto` mode the root always resolves a `mask-image`, even when there is nothing to scroll.
  That makes it a stacking context and a containing block for `position: fixed` descendants.
  Set `visibility` explicitly if you need to opt out.
- The scroll-driven fade uses the `animation` property on the root. Applying an `animate-*`
  utility to the same element replaces it and leaves no fade. Animate a wrapper instead.

## API Reference

### ScrollShadow

| Prop                 | Type                                                                               | Default      | Description                                          |
| -------------------- | ---------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------- |
| `orientation`        | `"vertical"` \| `"horizontal"`                                                     | `"vertical"` | The scroll direction                                 |
| `variant`            | `"fade"`                                                                           | `"fade"`     | The visual shadow effect style                       |
| `size`               | `number`                                                                           | `40`         | The shadow gradient size in pixels                   |
| `offset`             | `number`                                                                           | `0`          | The scroll offset before showing shadows (in pixels) |
| `hideScrollBar`      | `boolean`                                                                          | `false`      | Whether to hide the native scrollbar                 |
| `isEnabled`          | `boolean`                                                                          | `true`       | Whether scroll shadow detection is enabled           |
| `visibility`         | `"auto"` \| `"both"` \| `"top"` \| `"bottom"` \| `"left"` \| `"right"` \| `"none"` | `"auto"`     | Controlled shadow visibility state                   |
| `onVisibilityChange` | `(visibility: ScrollShadowVisibility) => void`                                     | -            | Callback invoked when shadow visibility changes      |
| `class`              | `string`                                                                           | -            | Additional CSS classes to apply to the root element  |
| `children`           | `JSX.Element`                                                                      | -            | The scrollable content                               |

::api{symbol="@rivetjs/ui/scroll-shadow#ScrollShadowRootProps"}

## Related Components

- [ScrollArea](/components/scroll-area/): Custom overlay scrollbars over native scrolling (Rivet addition).
- [Card](/components/card/): Content container with header, body, and footer.
