---
title: TrendChip
description: "A compact chip for a change over time: direction icon, colour by whether the change is good, prefix / suffix, five variants, three sizes."
template: reference
status: experimental
related: [components/kpi, components/chip, components/chart]
---

`TrendChip` shows how a number moved: up, down or flat, with a lucide trend icon and a colour that says whether that is good. It is plain markup with no script, so it costs nothing on a page full of metrics.

## Usage

```tsx
import { TrendChip } from "@rivetjs/ui/trend-chip";
```

::example{id=trend-chip-basic}

`trend` picks the icon (`TrendingUp`, `TrendingDown`, `Minus`). Up reads as positive (success) and down as negative (danger); `isInverted` swaps that for metrics where lower is better, such as churn, cost or latency. The text is yours: write the sign and unit you want read out.

## Anatomy

```tsx
<TrendChip trend="up">
  <TrendChip.Prefix />
  <TrendChip.Indicator />
  value
  <TrendChip.Suffix />
</TrendChip>
```

Additional exported parts: `TrendChip.Root`.

## Examples

### Sizes

::example{id=trend-chip-sizes}

### Variants

::example{id=trend-chip-variants}

`soft` tints the background, `primary` fills it with the tone colour, `secondary` uses the neutral chip background with tone-coloured text, `tertiary` and `ghost` drop the background (`ghost` also drops the padding).

### Prefix And Suffix

::example{id=trend-chip-prefix-suffix}

### Custom Indicator

::example{id=trend-chip-custom-indicator}

`TrendChip.Indicator` holds your own icon; the default direction icon hides while an indicator is present (CSS `:has()`, no script).

### Tabular Nums

::example{id=trend-chip-tabular-nums}

The chip always uses tabular numerals, so changes line up in tables and lists.

## Styling Reference

### CSS Classes

- `.trend-chip` - The chip. Tone `.trend-chip--positive` / `--negative` / `--neutral`, variant `.trend-chip--soft` / `--primary` / `--secondary` / `--tertiary` / `--ghost`, size `.trend-chip--sm` / `--md` / `--lg`.
- `.trend-chip__icon` - The default direction icon.
- `.trend-chip__indicator` - A custom indicator.
- `.trend-chip__prefix`, `.trend-chip__suffix` - Text before and after the value.

### CSS Variables

| Variable                | Description           |
| ----------------------- | --------------------- |
| `--trend-chip-color`    | Text and icon colour  |
| `--trend-chip-bg`       | Soft background       |
| `--trend-chip-solid`    | Primary background    |
| `--trend-chip-solid-fg` | Primary text and icon |

### Data Attributes

- `[data-slot="trend-chip"]`, `[data-trend]`: `up` / `down` / `neutral`.
- `[data-slot]` on parts: `trend-chip-prefix`, `trend-chip-suffix`, `trend-chip-indicator`.

## API Reference

See the [full module API](/api/rivetjs/ui/trend-chip/) for every named export and part prop type.

### TrendChip

| Prop         | Type                                                                  | Default     | Description                             |
| ------------ | --------------------------------------------------------------------- | ----------- | --------------------------------------- |
| `trend`      | `"up"` \| `"down"` \| `"neutral"`                                     | `"neutral"` | Direction of the change                 |
| `isInverted` | `boolean`                                                             | `false`     | Lower is better: down reads as positive |
| `variant`    | `"soft"` \| `"primary"` \| `"secondary"` \| `"tertiary"` \| `"ghost"` | `"soft"`    | Chip style                              |
| `size`       | `"sm"` \| `"md"` \| `"lg"`                                            | `"md"`      | Chip size                               |
| `hideIcon`   | `boolean`                                                             | `false`     | Hide the direction icon                 |
| `class`      | `string`                                                              | -           | Additional CSS classes                  |

### TrendChip.Prefix / TrendChip.Suffix / TrendChip.Indicator

`span` parts with `children` and `class`; native `span` attributes pass through. The indicator is `aria-hidden`.

## Accessibility

The direction indicator is decorative (`aria-hidden`). Include the direction and meaning in the text, such as “Revenue increased 8%”, so color and the arrow are not the only cues.

## Related Components

- [Kpi](/components/kpi/): A metric card that uses TrendChip for its change.
- [Chip](/components/chip/): General purpose labels.
