---
title: NumberValue
description: "A locale-aware number: decimal, currency, percent, unit and compact formatting, sign display, tabular numerals, prefix and suffix."
template: reference
status: experimental
related: [components/kpi, components/number-field, components/trend-chip]
---

`NumberValue` formats a number with `Intl.NumberFormat` for the reader's locale (the nearest cdk `I18nProvider`, else `<html lang>`; `en-US` on the server). One formatter is cached per locale and options. `value` can be a signal or an accessor: only the text updates. Pure markup: no script.

## Usage

```tsx
import { NumberValue } from "@rivetjs/ui/number-value";
```

::example{id=number-value-basic}

## Anatomy

```tsx
import { NumberValue } from "@rivetjs/ui/number-value";

export default function Anatomy() {
  return (
    <NumberValue value={4.8} minimumFractionDigits={1}>
      <NumberValue.Prefix>…</NumberValue.Prefix>
      <NumberValue.Value />
      <NumberValue.Suffix>…</NumberValue.Suffix>
    </NumberValue>
  );
}
```

Without children the root renders the formatted value alone, or with the `prefix` / `suffix` shorthand props. With compound children, place `NumberValue.Value` where the number goes (children are rendered in order). A function child receives the formatted string.

## Compact

::example{id=number-value-compact}

## Currency

::example{id=number-value-currency}

## Format Options

`formatOptions` takes any `Intl.NumberFormatOptions` and wins over the convenience props.

::example{id=number-value-format-options}

## Percent

::example{id=number-value-percent}

## Sign Display

::example{id=number-value-sign-display}

## Tabular Nums

::example{id=number-value-tabular-nums}

## With Prefix Suffix

::example{id=number-value-prefix-suffix}

## Styling Reference

### CSS Classes

- `.number-value` - Inline wrapper; inherits size, weight and colour. Modifier `.number-value--tabular` (tabular numerals).
- `.number-value__prefix`, `.number-value__suffix` - Muted text at 0.75em around the number.
- `.number-value__value` - The formatted number.

### Data Attributes

- `[data-slot]`: `number-value`, `number-value-prefix`, `number-value-value`, `number-value-suffix`.

## API Reference

### NumberValue

| Prop                    | Type                                                          | Default      | Description                                                    |
| ----------------------- | ------------------------------------------------------------- | ------------ | -------------------------------------------------------------- |
| `value`                 | `number \| () => number`                                      | -            | The number (signal / accessor updates the text)                |
| `style`                 | `"decimal" \| "currency" \| "percent" \| "unit"`              | `"decimal"`  | Format style (the Intl option, not the inline style attribute) |
| `currency`              | `string`                                                      | -            | Currency code, with `style="currency"`                         |
| `unit`                  | `string`                                                      | -            | Unit identifier, with `style="unit"`                           |
| `notation`              | `"standard" \| "compact" \| "scientific" \| "engineering"`    | `"standard"` | Notation                                                       |
| `signDisplay`           | `"auto" \| "always" \| "exceptZero" \| "never" \| "negative"` | -            | When to show the sign                                          |
| `minimumFractionDigits` | `number`                                                      | -            | Minimum fraction digits                                        |
| `maximumFractionDigits` | `number`                                                      | -            | Maximum fraction digits                                        |
| `locale`                | `string`                                                      | -            | Overrides the `I18nProvider` locale                            |
| `formatOptions`         | `Intl.NumberFormatOptions`                                    | -            | Merged over the convenience props                              |
| `isTabular`             | `boolean`                                                     | `false`      | Tabular numerals                                               |
| `prefix` / `suffix`     | `Content`                                                     | -            | Text before / after the number                                 |
| `children`              | `Content \| (formatted: string) => Content`                   | -            | Compound parts, or a render function                           |
| `class`                 | `string`                                                      | -            | Additional CSS classes                                         |

Also takes `span` props except `style` and `children`. `formatNumberValue(props, locale)` is the formatter as a plain function.

### NumberValue.Prefix / NumberValue.Value / NumberValue.Suffix

`span` props and `class`; `Value` renders the formatted number of the enclosing `NumberValue`.

## Accessibility

The number is plain text: screen readers read the formatted string. Add an `aria-label` on the root when the visible text is abbreviated (compact notation) and the full value matters.

## Related Components

- [Kpi](/components/kpi/): Metric card with a formatted value.
- [NumberField](/components/number-field/): Editable number input with the same formatting.
- [TrendChip](/components/trend-chip/): Change indicator.
