---
title: ProgressBar
description: ProgressBar from @rivetjs/cdk shows determinate or indeterminate progress of a task with role progressbar, a formatted value and percentage render props.
template: guide
status: experimental
related: [components/meter, components/field, foundations/i18n]
---

`ProgressBar` shows the progress of an operation over time: an upload, a sync, a multi-step setup. It renders `role="progressbar"` with the value attributes and gives you `percentage()`, `valueText()` and `isIndeterminate()` render props to draw a bar, a circle or anything else. For a static quantity in a range, use [Meter](meter.md).

::example{id=progress-bar-basic}

## Anatomy

```html
<div role="progressbar" class="rv-ProgressBar" aria-labelledby="l1" aria-valuenow="40" aria-valuemin="0" aria-valuemax="100" aria-valuetext="40%">
  <span id="l1" class="rv-Label">Uploading photos…</span>
  <span>40%</span>
  <div><div style="width:40%"></div></div>
</div>
```

| Part | |
| --- | --- |
| `ProgressBar` | the `role="progressbar"` element; children draw the bar |
| `Label` (`@rivetjs/cdk/label`) | optional visible label, rendered as a `<span>` |

## Import

```ts
import { ProgressBar } from "@rivetjs/cdk/progress-bar";
import { Label } from "@rivetjs/cdk/label";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content or `(renderProps) => content` | none | |
| `value` | `number \| () => number` | `0` | Clamped to the range. |
| `minValue`, `maxValue` | `number \| () => number` | `0`, `100` | |
| `isIndeterminate` | `boolean \| () => boolean` | `false` | Progress unknown: no `aria-valuenow` / `aria-valuetext`, `percentage()` is `undefined`. |
| `formatOptions` | `Intl.NumberFormatOptions` | `{ style: "percent" }` | |
| `valueLabel` | `string \| () => string` | none | Replaces the formatted text. |
| `id`, `slot` | `string` | generated id | |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | |
| `class` | `string \| (rp) => string` | `rv-ProgressBar` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ProgressBar`; see [Render](#render). |
| `style` | `object \| (rp) => object` | none | |
| `ref` | `ref()` / callback | none | |
| global DOM props | `GlobalDOMAttributes` | none | Forwarded to the `<div>`. |

### Render props

| Render prop | Type | Selector |
| --- | --- | --- |
| `percentage` | `() => number \| undefined` | |
| `valueText` | `() => string \| undefined` | `[aria-valuetext]` |
| `isIndeterminate` | `() => boolean` | `:not([aria-valuenow])` |

## Indeterminate

Set `isIndeterminate` while the amount of work is unknown. It accepts an accessor, so the same bar can switch to determinate once the size is known.

::example{id=progress-bar-indeterminate}

## Circular progress

The render props draw anything: here an SVG circle whose `stroke-dashoffset` comes from `percentage()`, and a spinner for the indeterminate case.

::example{id=progress-bar-circle}

## Value scale and formatting

`minValue`, `maxValue`, `formatOptions` and `valueLabel` work as in [Meter](meter.md#value-scale-and-formatting).

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes`) and `data-*` land on the progress bar element, as for [Meter](meter.md#dom-events-and-attributes).

## Styling

| Selector | When |
| --- | --- |
| `.rv-ProgressBar` | always (unless you pass `class`) |
| `[aria-valuenow]` / `:not([aria-valuenow])` | determinate / indeterminate |

### Tailwind

The first and the [indeterminate](#indeterminate) examples use Tailwind utilities; `motion-reduce:` turns off animations.

### Plain CSS

::example{id=progress-bar-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ProgressBar` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<ProgressBar render={(props) => <div {...(props as {})} />}>…</ProgressBar>
```

## Accessibility

- `role="progressbar"`; `aria-valuetext` carries the formatted value. Indeterminate bars omit `aria-valuenow`.
- A `<Label>` child labels the bar; without one, pass `aria-label`.
- Respect `prefers-reduced-motion` for indeterminate animations.

## Resumability

- Server-rendered with all aria attributes; nothing runs until a value accessor changes.
- Pass `value` / `isIndeterminate` as accessors over signals: only the bindings update.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ProgressBar`, `ProgressBarContext` | RAC `ProgressBar`, `ProgressBarContext` |
| `progressBarProps` (`@rivetjs/cdk/progress-bar/behaviour`) | react-aria `useProgressBar` |

Deviations: `className` is `class`; render props are accessors; value props accept accessors and the value attributes of `progressBarProps` are accessors.

