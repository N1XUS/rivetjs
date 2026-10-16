---
title: TrendChip
description: "A compact chip for a change over time: direction icon, colour by whether the change is good, soft or ghost."
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

## Styling Reference

### CSS Classes

- `.trend-chip` - The chip. Tone `.trend-chip--positive` / `--negative` / `--neutral`, variant `.trend-chip--soft` (tinted background) / `--ghost` (text only), size `.trend-chip--sm` / `--md`.
- `.trend-chip__icon` - The direction icon.

### CSS Variables

| Variable             | Description          |
| -------------------- | -------------------- |
| `--trend-chip-color` | Text and icon colour |
| `--trend-chip-bg`    | Soft background      |

### Data Attributes

- `[data-slot="trend-chip"]`, `[data-trend]`: `up` / `down` / `neutral`.

## API Reference

### TrendChip

| Prop         | Type                              | Default     | Description                             |
| ------------ | --------------------------------- | ----------- | --------------------------------------- |
| `trend`      | `"up"` \| `"down"` \| `"neutral"` | `"neutral"` | Direction of the change                 |
| `isInverted` | `boolean`                         | `false`     | Lower is better: down reads as positive |
| `variant`    | `"soft"` \| `"ghost"`             | `"soft"`    | Tinted chip or text only                |
| `size`       | `"sm"` \| `"md"`                  | `"md"`      | Chip size                               |
| `hideIcon`   | `boolean`                         | `false`     | Hide the direction icon                 |
| `class`      | `string`                          | -           | Additional CSS classes                  |

## Related Components

- [Kpi](/components/kpi/): A metric card that uses TrendChip for its change.
- [Chip](/components/chip/): General purpose labels.
