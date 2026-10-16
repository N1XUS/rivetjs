---
title: Meter
description: Meter from @rivetjs/cdk shows a quantity within a known range (disk use, battery) with role meter, a formatted value and percentage render props.
template: guide
status: experimental
related: [components/progress-bar, components/field, foundations/i18n]
---

`Meter` represents a quantity within a known range, or a fractional value: storage used, battery level, a score. It renders `role="meter"` with `aria-valuenow` / `aria-valuemin` / `aria-valuemax` / `aria-valuetext`, and its render props give you the `percentage()` and the formatted `valueText()` to draw the fill. For progress of a task over time, use [ProgressBar](progress-bar.md).

::example{id=meter-basic}

## Anatomy

```html
<div role="meter" class="rv-Meter" aria-labelledby="l1" aria-valuenow="72" aria-valuemin="0" aria-valuemax="100" aria-valuetext="72%">
  <span id="l1" class="rv-Label">Storage space</span>
  <span>72%</span>
  <div><div style="width:72%"></div></div>
</div>
```

| Part | |
| --- | --- |
| `Meter` | the `role="meter"` element; children draw the bar |
| `Label` (`@rivetjs/cdk/label`) | optional visible label, rendered as a `<span>`; labels the meter |

## Import

```ts
import { Meter } from "@rivetjs/cdk/meter";
import { Label } from "@rivetjs/cdk/label";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content or `(renderProps) => content` | none | |
| `value` | `number \| () => number` | `0` | Clamped to the range. An accessor updates only the bindings. |
| `minValue` | `number \| () => number` | `0` | |
| `maxValue` | `number \| () => number` | `100` | |
| `formatOptions` | `Intl.NumberFormatOptions` | `{ style: "percent" }` | Percent formats the fraction; other styles format the value. |
| `valueLabel` | `string \| () => string` | none | Replaces the formatted text (and `aria-valuetext`). |
| `id`, `slot` | `string` | generated id | |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | Needed when there is no `<Label>`. |
| `class` | `string \| (rp) => string` | `rv-Meter` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `Meter`; see [Render](#render). |
| `style` | `object \| (rp) => object` | none | |
| `ref` | `ref()` / callback | none | |
| global DOM props | `GlobalDOMAttributes` | none | Forwarded to the `<div>`. |

### Render props

| Render prop | Type | Selector |
| --- | --- | --- |
| `percentage` | `() => number` (0–100) | |
| `valueText` | `() => string \| undefined` | `[aria-valuetext]` |

## Value scale and formatting

`minValue` / `maxValue` set the range; `formatOptions` takes any `Intl.NumberFormat` option (units, currency, decimals) and is formatted in the current locale ([I18nProvider](../foundations/i18n.md)). `valueLabel` sets your own text. Pass `value` as an accessor to update it from a signal.

::example{id=meter-format}

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes`), `data-*` and `lang` land on the meter element.

::example{id=meter-dom-events}

## Styling

| Selector | When |
| --- | --- |
| `.rv-Meter` | always (unless you pass `class`) |
| `[aria-valuetext]` | always (the formatted value) |

Size the fill from the `percentage()` render prop: inline `style={{ width: percentage() + "%" }}` on a child, or a custom property from the `style` render prop.

### Tailwind

The first example on this page uses Tailwind utilities on the parts.

### Plain CSS

::example{id=meter-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Meter` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<Meter render={(props) => <div {...(props as {})} />}>…</Meter>
```

## Accessibility

- `role="meter"` with the value attributes; `aria-valuetext` carries the formatted text so screen readers read "72%" or "512 MB".
- A `<Label>` child labels the meter (`aria-labelledby`); without one, pass `aria-label`.
- Not focusable; no keyboard interaction.

## Resumability

- Server-rendered with all aria attributes; no script runs until a value accessor changes.
- `value={() => used()}` keeps the component from re-running: the aria attributes and render props update in place.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Meter`, `MeterContext` | RAC `Meter`, `MeterContext` |
| `meterProps` (`@rivetjs/cdk/meter/behaviour`) | react-aria `useMeter` |

Deviations: `className` is `class`; render props are accessors; value props accept accessors and the value attributes of `meterProps` are accessors (read them in bindings).

