---
title: Overflow
description: "Overflow collapsing from @rivetjs/cdk/overflow: measure items, keep what fits, render the rest behind one overflow element (React Spectrum collapse)."
template: guide
status: experimental
related: [components/breadcrumbs, components/toolbar, components/menu, foundations/observers]
---

`@rivetjs/cdk/overflow` measures the items of a container and collapses the ones that do not fit behind one overflow element you render, typically a "…" button opening a [Menu](../components/menu.md) of the hidden items. It can keep the last items, optionally the root, or keep the leading items. [Breadcrumbs](../components/breadcrumbs.md#overflow) uses it through `overflowMode="collapse"`.

:::note
Rivet addition: React Aria Components and Angular CDK have no overflow primitive. The algorithm, defaults and test cases come from React Spectrum v3 (`@react-spectrum/breadcrumbs`, `@react-spectrum/actiongroup`).
:::

::example{id=overflow-toolbar}

## Import

```ts
import { OVERFLOW, createOverflow, overflowSlices } from "@rivetjs/cdk/overflow";
```

## createOverflow

```tsx
const list = ref<HTMLDivElement>();
const overflow = createOverflow({ ref: list, items: () => actions, collapse: "end" });

<div ref={list} class="flex gap-1">
  <For each={overflow.items} by={(a) => (a === OVERFLOW ? a : a.id)}>
    {(a) => (a() === OVERFLOW ? <MoreMenu items={overflow.hidden()} /> : <Button>{a().label}</Button>)}
  </For>
</div>;
```

The container's own element children are the measured items, in `items()` order, with the overflow element as a direct child where `OVERFLOW` sits. Children without a box (`display: none` / `contents`, such as the anchor a Popover leaves next to its trigger) are skipped.

| Option                | Type                         | Default                                 | Notes                                                                                                                                    |
| --------------------- | ---------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ref`                 | `ref()`                      | required                                | The container.                                                                                                                           |
| `items`               | `() => readonly T[]`         | required                                | The items; a change re-measures.                                                                                                         |
| `collapse`            | `"start" \| "end"`           | `"end"`                                 | `"start"`: keep the last items, collapse the leading ones (Breadcrumbs). `"end"`: keep the first items, collapse the tail (ActionGroup). |
| `showRoot`            | `boolean`                    | `false`                                 | `"start"`: keep the first item too while it fits (Spectrum `showRoot`).                                                                  |
| `isMultiline`         | `boolean`                    | `false`                                 | `"start"`: the last item sits on its own line and is not measured (Spectrum `isMultiline`).                                              |
| `maxVisibleItems`     | `number \| "auto"`           | `4` for `"start"`, `"auto"` for `"end"` | Upper bound of visible items, the overflow element counted (Spectrum `MAX_VISIBLE_ITEMS`).                                               |
| `orientation`         | `"horizontal" \| "vertical"` | `"horizontal"`                          | `"end"`: measure widths or heights.                                                                                                      |
| `defaultVisibleItems` | `number`                     | every item                              | What renders before the browser measures (server render).                                                                                |
| `isDisabled`          | `boolean \| () => boolean`   | `false`                                 | No measuring, every item visible (Spectrum `overflowMode="wrap"`).                                                                       |
| `onMeasureAll`        | `(elements) => void`         | none                                    | Called while every item is shown, before each measurement (read their text, links).                                                      |

| Result                              | Type                | Notes                                                                                         |
| ----------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `items()`                           | `(T \| OVERFLOW)[]` | What to render, `OVERFLOW` where the overflow element goes (only while collapsed).            |
| `before()` / `hidden()` / `after()` | `T[]`               | The visible items before the overflow element, the collapsed ones, the visible ones after it. |
| `visibleCount()`                    | `number`            | How many items are visible.                                                                   |
| `isCollapsed()`                     | `boolean`           | Whether some items are collapsed.                                                             |
| `isMeasuring()`                     | `boolean`           | A measurement is running (ActionGroup grows the container meanwhile).                         |

`overflowSlices(items, visible, { collapse, showRoot })` is the pure split, and `computeVisibleItemsStart` / `computeVisibleItemsEnd` the two Spectrum measurements, for custom markup.

## Measuring

- Spectrum's sequence: show every item, measure, show the items that fit with the overflow element, measure again so the overflow element fits too. Each step updates the DOM synchronously inside one measurement (the first one in the ResizeObserver callback, later resizes in the next animation frame, so a container whose height follows its content raises no `ResizeObserver loop` error), so nothing paints in between.
- `"start"` sums `offsetWidth`s against the container's `offsetWidth`: root (with `showRoot`), the overflow element, the last item (measured with `overflow: visible`), then the others from the end; an item fits while the sum stays below the width. At least one item stays visible.
- `"end"` sums bounding widths (or heights) plus margins in order and stops at the first item that does not fit; everything can collapse, leaving only the overflow element.
- A flex `gap` on the container counts between items. Style items with `flex-shrink: 0` and `white-space: nowrap`: a shrinking item measures smaller than it renders.
- Re-measures when the container resizes, when `items()` or `isDisabled` change and once web fonts finish loading.

## Server rendering and layout shift

The server renders `defaultVisibleItems` (default: every item), then the browser measures after mount, or, on a resumed page, once the container is visible. Every item fits on wide screens, so the default renders the final markup there; on narrow screens the collapse is one layout change right after load. When your narrow layout is the common case, set `defaultVisibleItems` to what usually fits so the server already renders the overflow element. Give the container a fixed height (no wrapping) so the change never moves the content below it.

## Resumability

`createOverflow` must be called in a `.tsx` component: on a resumed page, its measuring client effect starts when the component runs in the browser. Pass `items` as an accessor or `computed`, so a change reaches the measurement. `onMeasureAll` and the overflow render function can be any function.

## Accessibility

- Give the overflow trigger a name (`aria-label="More actions"`): it usually shows only an icon.
- The hidden items are not in the DOM: list every one in the menu so keyboard and screen reader users reach them.
