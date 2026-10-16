---
title: Rating
description: "A star rating: an interactive radio group for picking a score, or a read-only display of a fractional average."
template: reference
status: experimental
related: [components/radio-group, components/slider]
---

`Rating` lets people score something from 1 to `maxValue` stars, or shows an average like 4.6 with the last star partly filled. Interactive ratings are a group of native radio inputs, so they submit with a form, work without JavaScript and follow the platform's arrow-key behaviour.

Accessibility: the interactive rating is a `radiogroup` named by `aria-label`; each star is a visually hidden native radio labelled "N stars", so Tab reaches the group, arrow keys change the value and Space selects. The read-only rating is a single `img` whose label reads the value ("4.6 out of 5").

## Usage

```tsx
import { Rating } from "@rivetjs/ui/rating";
```

::example{id=rating-basic}

`value` takes a number, an accessor or a two-way Signal; `defaultValue` keeps the state inside; `onChange` is called with the new score. With `name`, the score is submitted with the surrounding form.

## Read Only

::example{id=rating-read-only}

`isReadOnly` renders a display, not an input: fractional values fill the last star partially (`--rating-fill`), `showValue` prints the value with one decimal, and nothing runs in the browser.

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.rating` - The row of stars. Modifiers `.rating--sm` / `.rating--lg`, `.rating--readonly`.
- `.rating__item` - One star (a `label` around the radio, or a `span` when read-only).
- `.rating__star` - The empty star outline.
- `.rating__fill` - The filled star, clipped to `--rating-fill`.
- `.rating__value` - The printed value (`showValue`).

### CSS Variables

| Variable         | Default                        | Description               |
| ---------------- | ------------------------------ | ------------------------- |
| `--rating-color` | `var(--warning)`               | Filled star colour        |
| `--rating-empty` | muted at 45%                   | Empty star colour         |
| `--rating-size`  | `1.25rem` (`1rem` / `1.75rem`) | Star size                 |
| `--rating-fill`  | `0%`                           | Per star fill (read-only) |

### Data Attributes

- `[data-slot]`: `rating`, `rating-item`, `rating-value`.
- Root: `[data-disabled]`. Interactive stars: the native `:checked` / `:hover` / `:focus-visible` states.

## API Reference

### Rating

| Prop           | Type                                           | Default | Description                                 |
| -------------- | ---------------------------------------------- | ------- | ------------------------------------------- |
| `value`        | `number` \| `() => number` \| `Signal<number>` | -       | The score (controlled; a Signal is two-way) |
| `defaultValue` | `number`                                       | `0`     | Initial score (uncontrolled)                |
| `onChange`     | `(value: number) => void`                      | -       | Called with the picked score                |
| `maxValue`     | `number`                                       | `5`     | Number of stars                             |
| `isReadOnly`   | `boolean`                                      | `false` | Display only (fractional values, no input)  |
| `isDisabled`   | `boolean`                                      | `false` | Disables the radios                         |
| `name`         | `string`                                       | -       | Form field name                             |
| `showValue`    | `boolean`                                      | `false` | Print the value after the stars             |
| `size`         | `"sm"` \| `"md"` \| `"lg"`                     | `"md"`  | Star size                                   |
| `aria-label`   | `string`                                       | -       | Accessible name                             |
| `class`        | `string`                                       | -       | Additional CSS classes                      |

## Related Components

- [RadioGroup](/components/radio-group/): Single selection among labelled options.
- [Slider](/components/slider/): Pick a value on a continuous track.
