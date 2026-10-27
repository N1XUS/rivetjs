---
title: EmojiReactionButton
description: "A pill toggle with an emoji and a count, for reactions on messages and posts."
template: reference
status: experimental
related: [components/toggle-button, components/toggle-button-group]
---

`EmojiReactionButton` is a [ToggleButton](/components/toggle-button/) shaped as a reaction pill. Selected means "I reacted": it gets an accent border and tint, and the count turns accent. It takes every cdk ToggleButton prop, including `isSelected` as a value or a two-way signal, plus `isReadOnly`.

## Usage

```tsx
import { EmojiReactionButton } from "@rivetjs/ui/emoji-reaction-button";
```

::example{id=emoji-reaction-button-basic}

## Anatomy

```tsx
import { EmojiReactionButton } from "@rivetjs/ui/emoji-reaction-button";

export default function Anatomy() {
  return (
    <EmojiReactionButton aria-label="Thumbs up, 12 reactions">
      <EmojiReactionButton.Emoji>👍</EmojiReactionButton.Emoji>
      <EmojiReactionButton.Count>12</EmojiReactionButton.Count>
    </EmojiReactionButton>
  );
}
```

## Disabled

::example{id=emoji-reaction-button-disabled}

## Read-only

`isReadOnly` keeps the selection and ignores presses. The button stays focusable, so screen readers still announce it.

::example{id=emoji-reaction-button-read-only}

## Sizes

::example{id=emoji-reaction-button-sizes}

## Styling Reference

### CSS Classes

- `.emoji-reaction-button` - The pill. Sizes: `.emoji-reaction-button--sm`, `--md` (default), `--lg`.
- `.emoji-reaction-button__emoji` - The emoji.
- `.emoji-reaction-button__count` - The count (tabular figures).

### Data Attributes

- `[data-slot]`: `emoji-reaction-button`, `emoji-reaction-button-emoji`, `emoji-reaction-button-count`.
- `[data-selected="true"]`: reacted. `[data-readonly="true"]`: read-only (default cursor, no hover tint, no press scale).
- `[data-hovered]`, `[data-pressed]`, `[data-focus-visible]`, `[data-disabled]`.

## API Reference

### EmojiReactionButton

| Prop              | Type                                  | Default | Description                        |
| ----------------- | ------------------------------------- | ------- | ---------------------------------- |
| `size`            | `"sm" \| "md" \| "lg"`                | `"md"`  | Size                               |
| `isSelected`      | `boolean \| Signal<boolean>`          | -       | Selected (controlled, or two-way)  |
| `defaultSelected` | `boolean`                             | -       | Initial selection (uncontrolled)   |
| `onChange`        | `(isSelected: boolean) => void`       | -       | Called when the selection changes  |
| `isReadOnly`      | `boolean`                             | -       | Keep the selection, ignore presses |
| `isDisabled`      | `boolean`                             | -       | Disabled                           |
| `children`        | `Content \| (renderProps) => Content` | -       | Emoji and count                    |

Also takes the cdk ToggleButton props.

### EmojiReactionButton.Emoji / .Count

`span` parts. They take `span` props and `class`.

## Accessibility

The root is a `button` with `aria-pressed`. The emoji alone is a poor name, so give each button an `aria-label` that says the reaction and the count (`"Thumbs up, 12 reactions"`). The emoji is user content, not an icon.

## Related Components

- [ToggleButton](/components/toggle-button/): The base toggle.
- [ToggleButtonGroup](/components/toggle-button-group/): Exclusive or multiple toggles in one control.
