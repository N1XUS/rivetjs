---
title: WheelPicker
description: Headless iOS-style scroll wheels from @rivetjs/cdk — spinbutton drums with momentum and snap, plus TimeWheels for a TimeField.
template: guide
status: experimental
related: [components/time-field, components/popover, foundations/motion]
---

`Wheel` is one drum: a column of options that spins under a fixed selection band, the way iOS pickers do. Drag it, flick it (momentum, then it settles on an item), turn the mouse wheel or swipe the trackpad, press an item, or use the keys. `WheelPicker` groups drums. `TimeWheels` builds the drums of a [TimeField](time-field.md) — hours, minutes, optional seconds and AM / PM for the locale's hour cycle — over the field's own state, so the segments and the drums edit the same value.

Rivet addition: React Aria Components and Angular CDK have no wheel picker. The motion is the house motion ([Motion](../foundations/motion.md), embla-carousel's physics), the same as Carousel, Slider snapping and Sheet. `@rivetjs/ui/time-picker` uses it.

::example{id=wheel-picker-time}

## Anatomy

```html
<div class="rv-TimeWheels" role="group" dir="ltr" style="display:flex">
  <div class="rv-TimeWheels-run" style="display:flex;direction:ltr">
    <div class="rv-Wheel" role="spinbutton" tabindex="0" aria-label="hour"
         aria-valuenow="7" aria-valuetext="7" aria-valuemin="1" aria-valuemax="12" data-type="hour"
         style="position:relative;overflow:hidden;touch-action:none;user-select:none;--rv-wheel-visible:5">
      <div class="rv-WheelItem" data-rv-wheel-item data-index="7" aria-hidden="true" data-selected="true"
           style="position:absolute;top:50%;left:0;right:0;transform:translateY(calc(-0.5 * 100%));--rv-wheel-offset:0;--rv-wheel-distance:0">7</div>
      <!-- one item per option -->
    </div>
    <div class="rv-Wheel" role="spinbutton" aria-label="minute" data-type="minute">…</div>
  </div>
  <div class="rv-Wheel" role="spinbutton" aria-label="AM/PM" data-type="dayPeriod">…</div>
</div>
```

| Part | Element | Default class | Attributes |
| --- | --- | --- | --- |
| `WheelPicker` | `div[role=group]` | `rv-WheelPicker` | `dir`, `aria-label` / `aria-labelledby`; inline `display: flex` |
| `TimeWheels` | `div[role=group]` | `rv-TimeWheels` | `dir` of the locale, `aria-disabled`; numeric drums inside `div.rv-TimeWheels-run` (inline `direction: ltr`) |
| `Wheel` | `div[role=spinbutton]` | `rv-Wheel` | `aria-valuenow` / `-valuetext` / `-valuemin` / `-valuemax`, `data-type`, `data-disabled`, `data-readonly`, `data-moving` (spinning), `data-dragging` (held); inline clipping, `touch-action: none`, `--rv-wheel-visible` |
| item | `div[data-rv-wheel-item]` | `rv-WheelItem` (`itemClass`) | `data-index`, `data-selected` (at the centre), `data-disabled`, `aria-hidden`; inline position + `--rv-wheel-offset` (signed items from the centre) / `--rv-wheel-distance` (absolute) |

## Import

```tsx
import { Wheel, WheelPicker, createWheelState } from "@rivetjs/cdk/wheel-picker";
import { TimeWheels } from "@rivetjs/cdk/time-wheels";
```

Behaviour functions (state, handlers, pure helpers) are also exported from `@rivetjs/cdk/wheel-picker/behaviour` and `@rivetjs/cdk/time-wheels/behaviour`.

## Wheel

::example{id=wheel-picker-basic}

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `options` | `readonly { value: string \| number; label: string }[]` | — | Drum order, read once. `label` is shown and announced (`aria-valuetext`). |
| `value` | `V \| null \| Signal<V \| null> \| (() => V \| null)` | — | Controlled; a Signal is two-way, an accessor is read live (with `onChange`). |
| `defaultValue` | `V \| null` | `null` | Uncontrolled start value (`null`: option 0 shows, nothing selected). |
| `onChange` | `(value: V) => void` | — | Called once a spin, step, wheel snap or tap decides the value (not per frame). |
| `loop` | `boolean` | `false` | Wrap around (infinite). Needs at least `visibleItems + 2` options, else the drum stops at its ends. |
| `isOptionDisabled` | `(value: V) => boolean` | — | Disabled options are marked `data-disabled` and skipped by steps, spins and type-ahead; may read signals. |
| `isDisabled` / `isReadOnly` | `boolean` | `false` | No interaction; disabled also drops `tabindex`. |
| `visibleItems` | `number` (odd) | `5` | Exposed as `--rv-wheel-visible`: size the drum with `height: calc(var(--rv-wheel-visible) * <item height>)`. Items further than half of it + 1 are `visibility: hidden`. |
| `pageStep` | `number` | `5` | Items PageUp / PageDown move. |
| `state` | `WheelState<V>` | — | A state from `createWheelState(options)` (same options); the props above are then ignored. |
| `class` / `itemClass` | `string` | `rv-Wheel` / `rv-WheelItem` | |
| `children` | `(option, index) => Content` | label | Item content. |
| `id`, `aria-label`, `aria-labelledby`, `aria-describedby`, `data-type` | | | Forwarded to the spinbutton. |

`WheelPicker` takes `id`, `class`, `dir`, `aria-label`, `aria-labelledby`, `aria-describedby` and the drums as children.

### Motion

- Drag follows the pointer after 4 px; a release projects the flick velocity (`VelocityTracker` × `DragRelease` free boost: 500 mouse / 600 touch) and settles on the nearest enabled item with embla's settle physics (the further the snap falls short of the throw, the shorter and stiffer the settle). Non-looped drums rubber band (0.2) past their ends.
- A press without a drag spins to the pressed item.
- Mouse wheel notches (line / page deltas, or ≥ 50 px) step one item; trackpad deltas spin the drum continuously and snap 120 ms after the last event. The drum adds a non-passive `wheel` listener so the page does not scroll under it.
- Keyboard and programmatic changes spin with embla's base duration (25) / friction (0.68). A value changed from outside (a typed segment) spins the drum to it on client renders.
- `prefers-reduced-motion: reduce`: every settle and step jumps; a drag still follows the pointer.

## TimeWheels

Put `TimeWheels` inside a `TimeField` (it reads `TimeFieldStateContext`; `state` prop otherwise). Usually it lives in a popover opened from the field: wrap the group in a `DialogTrigger` and pass the drums as a render-function child of the `Popover`, so nothing is created until it opens (first example).

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `state` | `DateFieldState` | the enclosing TimeField's (then DateField's) | |
| `minuteStep` / `secondStep` | `number` | `1` | Option spacing; the drum shows the step at or below the field's value until spun. |
| `loop` | `boolean` | `true` | Numeric drums wrap (59 → 00, 11 → 12); AM / PM never loops. A drum with fewer than `visibleItems + 2` options does not loop. |
| `visibleItems` | `number` | `5` | Per drum. |
| `autoFocus` | `boolean` | `false` | Focus the first enabled drum when it mounts (client renders: a popover opening). |
| `class` / `wheelClass` / `itemClass` | `string` | `rv-TimeWheels` / `rv-Wheel` / `rv-WheelItem` | |
| `id`, `aria-label`, `aria-labelledby` | | | On the group. |

- Drums follow the field: one per editable time segment, in the locale's segment order; granularity `hour` / `minute` / `second` decides which. The hour drum uses the field's hour cycle (h12: 12, 1 … 11; h11: 0 … 11; h23: 0 … 23), digits like the field (`ar-EG` shows Arabic-Indic digits), AM / PM labels from `Intl.DateTimeFormat`.
- A drum change sets every drum's field at once: the first spin of an empty field completes it from the shown (placeholder) values, like an iOS wheel that always shows a full time. The value keeps its type (`Time`, or a date-time when the field holds one).
- `minValue` / `maxValue`: an option whose whole span (hour, minute, second, half day) is outside the range — given the other drums — is disabled and skipped; a change that lands outside clamps to the bound. Times compare as seconds of the day.
- RTL: the group takes the locale's `dir`; the numeric drums sit in an LTR run (the field wraps its time segments in LTR isolates too), AM / PM on the locale's side.

## Styling

Headless: the drum needs a height and the items a height; the band and fade are looks. `@rivetjs/cdk/theme.css` has a starter look (`.rv-TimeWheels::before` band, `mask-image` fade, `--rv-wheel-item-height`).

```css
.rv-Wheel {
  inline-size: 3.5rem;
  block-size: calc(var(--rv-wheel-visible) * 2.25rem);
  mask-image: linear-gradient(transparent, #000 35%, #000 65%, transparent);
}
.rv-WheelItem {
  block-size: 2.25rem;
  line-height: 2.25rem;
  text-align: center;
  opacity: calc(1 - var(--rv-wheel-distance) * 0.25);
}
.rv-WheelItem[data-selected] {
  font-weight: 600;
}
```

Do not override the items' inline `transform` / `position` (that is the drum position); use `--rv-wheel-offset` / `--rv-wheel-distance` with properties such as `opacity`, `color`, `filter` or `font-weight`.

## Accessibility

Each drum is a `spinbutton` named by `aria-label` (TimeWheels: the localized field name, "hour", "minute", "AM/PM"), with the value as `aria-valuenow` (AM / PM: 0 / 1) and the label as `aria-valuetext`; items are `aria-hidden`.

| Key | Action |
| --- | --- |
| :kbd[ArrowUp] / :kbd[ArrowDown] | Next / previous option (wraps when looped). |
| :kbd[PageUp] / :kbd[PageDown] | ± `pageStep` (TimeWheels: 2 hours, 15 minutes / seconds). |
| :kbd[Home] / :kbd[End] | First / last enabled option. |
| digits, letters | Type-ahead (1 s): a numeric value equal to the digits, else the first label starting with the text (`a` / `p` for AM / PM). |

## Resumability

State is plain signals; handlers are inline arrows calling `@rivetjs/cdk/wheel-picker/behaviour`; the motion runtime is created by the first pointer / key / wheel event, so a server-rendered drum runs nothing at load (`wheel-picker-basic` resumes). The non-passive wheel listener is added from a client render's effect, or on a resumed page by the first pointer over the drum. TimeWheels in a popover renders on open (render-function child).

## Upstream

Rivet-authored; no React Aria / Angular CDK counterpart. Behaviour modelled on iOS `UIPickerView` / `UIDatePicker` wheels; physics = embla-carousel 8.6.0 (MIT, © David Jerleke) via `@rivetjs/cdk/motion`. Not yet supported: date drums (day / month / year), a 3D cylinder transform (style items with the offset variables instead).
