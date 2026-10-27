---
title: Rating
description: "A star rating: an interactive radio group for picking a score, or a read-only display of a fractional average; custom icons and a render function."
template: reference
status: experimental
related: [components/radio-group, components/slider]
---

`Rating` lets people score something from 1 to `maxValue` stars, or shows an average like 4.6 with the last star partly filled. Interactive ratings are a group of native radio inputs, so they submit with a form, work without JavaScript and follow the platform's arrow-key behaviour.

## Usage

```tsx
import { Rating } from "@rivetjs/ui/rating";
```

::example{id=rating-basic}

`value` takes a number, an accessor or a two-way Signal; `defaultValue` keeps the state inside; `onChange` is called with the new score. With `name`, the score is submitted with the surrounding form.

## Anatomy

`Rating` exposes `Rating.Root`.

Use the composition in the live example above; the API reference below describes the props.

## Examples

### Read Only

::example{id=rating-read-only}

`isReadOnly` renders a display, not an input: fractional values fill the last star partially (`--rating-fill`), `showValue` prints the value with one decimal, and nothing runs in the browser.

#### Read Only Fractional

::example{id=rating-read-only-fractional}

### Controlled

::example{id=rating-controlled}

### Sizes

::example{id=rating-sizes}

### Disabled

::example{id=rating-disabled}

### With Label

::example{id=rating-with-label}

Name the group with `aria-labelledby` pointing at a visible label, or with `aria-label`.

### Custom Color

::example{id=rating-custom-color}

### Custom Icon Heart

::example{id=rating-custom-icon-heart}

`icon` takes any lucide icon; both layers (empty and filled) use it.

### Custom Icon Per Item

::example{id=rating-custom-icon-per-item}

`icon` as a function returns the icon of each value (1…`maxValue`).

### Render Function

::example{id=rating-render-function}

`renderItem` replaces a star's two icon layers with your content. It gets `{ value, isActive, isPartial, partialPercent }` and re-renders when the score changes; the CSS hover preview does not apply to custom content, so style hover yourself if you need it.

### Product Review

::example{id=rating-product-review}

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

See the [full module API](/api/rivetjs/ui/rating/) for every named export and part prop type.

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
| `icon`         | `IconNode` \| `(value: number) => IconNode`    | `Star`  | Lucide icon of every star, or one per value |
| `renderItem`   | `(item: RatingItemRenderProps) => Content`     | -       | Custom content of one star                  |
| `aria-label`   | `string`                                       | -       | Accessible name                             |
| `class`        | `string`                                       | -       | Additional CSS classes                      |

### RatingItemRenderProps

| Property         | Type      | Description                               |
| ---------------- | --------- | ----------------------------------------- |
| `value`          | `number`  | The star's value (1…`maxValue`)           |
| `isActive`       | `boolean` | The score is at or above this star        |
| `isPartial`      | `boolean` | Read-only fractional score: partly filled |
| `partialPercent` | `number`  | Fill of this star, 0…100                  |

## Accessibility

the interactive rating is a `radiogroup` named by `aria-label`; each star is a visually hidden native radio labelled "N stars", so Tab reaches the group, arrow keys change the value and Space selects. The read-only rating is a single `img` whose label reads the value ("4.6 out of 5").

## Related Components

- [RadioGroup](/components/radio-group/): Single selection among labelled options.
- [Slider](/components/slider/): Pick a value on a continuous track.
