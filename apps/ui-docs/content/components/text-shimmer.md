---
title: TextShimmer
description: 'A light sweep over a short status label ("Thinking…", "Searching…") while work is in progress.'
template: reference
status: experimental
related: [components/chain-of-thought, components/chat-loader, components/skeleton]
---

`TextShimmer` animates a highlight across a short label to show that something is running: a reasoning step, a tool call, a search. It is one element: a gradient from the dimmed text colour to full `currentColor` is clipped to the glyphs (`background-clip: text`) and slides across them, so the text exists once and nothing is positioned outside the label.

## Usage

```tsx
import { TextShimmer } from "@rivetjs/ui/text-shimmer";
```

::example{id=text-shimmer-basic}

## Anatomy

```tsx
<TextShimmer isActive={() => running()}>Thinking…</TextShimmer>
```

Additional exported parts: `TextShimmer.Root`.

## Examples

### Color

The shimmer uses `currentColor`: text colour and size utilities on the root restyle it. `isActive` (value or accessor) stops the sweep and renders the text solid.

::example{id=text-shimmer-color}

### Performance

The sweep is a CSS `background-position` animation on one short label: no layers, no JavaScript at load or while it runs, and `data-active="false"` drops the gradient entirely.

### Resumability

Server-rendered, CSS-animated: nothing runs at load. An `isActive` accessor is an attribute binding.

## Styling Reference

### CSS Classes

| Class          | Applied                                            |
| -------------- | -------------------------------------------------- |
| `text-shimmer` | the only element; `data-active` (`true` / `false`) |

| CSS variable              | Default | What                                 |
| ------------------------- | ------- | ------------------------------------ |
| `--text-shimmer-duration` | `2.2s`  | one sweep                            |
| `--spread`                | `2.5em` | half width of the bright band        |
| `--text-shimmer-dim`      | `45%`   | opacity of the text outside the band |

## API Reference

See the [full module API](/api/rivetjs/ui/text-shimmer/) for every named export and part prop type.

| Prop       | Type                       | Default |
| ---------- | -------------------------- | ------- |
| `children` | `Content`                  | —       |
| `isActive` | `boolean \| () => boolean` | `true`  |
| `class`    | `string`                   | —       |

Other `span` attributes pass to the root.

::api{symbol="@rivetjs/ui/text-shimmer#TextShimmerProps"}

## Accessibility

the label is ordinary text, read once (no duplicated copy). With `prefers-reduced-motion: reduce` the text is solid and nothing moves.

## Related Components

- [ChainOfThought](/components/chain-of-thought/)
- [ChatLoader](/components/chat-loader/)
- [Skeleton](/components/skeleton/)
